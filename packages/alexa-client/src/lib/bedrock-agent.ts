import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { WarrantMcpClient } from "./mcp-client.js";

export interface AgentStepTrace {
  timestamp: string;
  type: "THINKING" | "TOOL_CALL" | "TOOL_RESULT" | "RESPONSE" | "ERROR";
  content: string;
  toolName?: string;
  args?: any;
  result?: any;
}

export interface AgentRunResponse {
  spokenResponse: string;
  traces: AgentStepTrace[];
  pendingApprovals?: any[];
  planId?: string;
}

export class BedrockVoiceAgent {
  private bedrockClient: BedrockRuntimeClient | null = null;
  private mcpClient: WarrantMcpClient;
  private modelId: string;

  constructor(mcpClient: WarrantMcpClient, modelId: string = "anthropic.claude-3-haiku-20240307-v1:0") {
    this.mcpClient = mcpClient;
    this.modelId = process.env.BEDROCK_MODEL_ID || modelId;

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.bedrockClient = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          sessionToken: process.env.AWS_SESSION_TOKEN
        }
      });
    }
  }

  /**
   * Runs the conversational agent loop against the user prompt.
   */
  public async run(userPrompt: string): Promise<AgentRunResponse> {
    const traces: AgentStepTrace[] = [];

    traces.push({
      timestamp: new Date().toISOString(),
      type: "THINKING",
      content: `Received voice prompt: "${userPrompt}"`
    });

    // Check if live Bedrock access is configured
    if (this.bedrockClient) {
      try {
        return await this.runLiveBedrockLoop(userPrompt, traces);
      } catch (err: any) {
        traces.push({
          timestamp: new Date().toISOString(),
          type: "ERROR",
          content: `Bedrock Converse error (${err.message}). Falling back to simulated Bedrock runner.`
        });
      }
    }

    // Deterministic Bedrock Agent Simulator (Offline mode)
    return await this.runOfflineSimulatedLoop(userPrompt, traces);
  }

  private async runOfflineSimulatedLoop(prompt: string, traces: AgentStepTrace[]): Promise<AgentRunResponse> {
    const lower = prompt.toLowerCase();

    // 1. Plan / Trip Booking Intent
    if (lower.includes("trip") || lower.includes("book") || lower.includes("seattle") || lower.includes("hotel")) {
      traces.push({
        timestamp: new Date().toISOString(),
        type: "TOOL_CALL",
        toolName: "search_trains",
        args: { origin: "Portland", destination: "Seattle" },
        content: "Calling search_trains over MCP Streamable HTTP"
      });

      const trainRes = await this.mcpClient.callTool("search_trains", {
        origin: "Portland",
        destination: "Seattle"
      });

      traces.push({
        timestamp: new Date().toISOString(),
        type: "TOOL_RESULT",
        toolName: "search_trains",
        result: trainRes.data,
        content: trainRes.spoken_summary
      });

      traces.push({
        timestamp: new Date().toISOString(),
        type: "TOOL_CALL",
        toolName: "search_hotels",
        args: { destination: "Seattle", nights: 2 },
        content: "Calling search_hotels over MCP Streamable HTTP"
      });

      const hotelRes = await this.mcpClient.callTool("search_hotels", {
        destination: "Seattle",
        nights: 2
      });

      traces.push({
        timestamp: new Date().toISOString(),
        type: "TOOL_RESULT",
        toolName: "search_hotels",
        result: hotelRes.data,
        content: hotelRes.spoken_summary
      });

      // Propose plan
      traces.push({
        timestamp: new Date().toISOString(),
        type: "TOOL_CALL",
        toolName: "propose_plan",
        args: { steps: 2 },
        content: "Submitting proposed plan to Warrant Gateway Policy Engine"
      });

      const proposeRes = await this.mcpClient.callTool("propose_plan", {
        steps: [
          {
            toolName: "book_train",
            params: { origin: "Portland", destination: "Seattle", price: 4500 },
            estimatedCostMinor: 4500
          },
          {
            toolName: "book_hotel",
            params: { hotel_id: "grand_plaza", nights: 2, price: 12000 },
            estimatedCostMinor: 12000,
            compensationTool: "cancel_hotel",
            compensationParams: { hotel_id: "grand_plaza" }
          }
        ]
      });

      traces.push({
        timestamp: new Date().toISOString(),
        type: "TOOL_RESULT",
        toolName: "propose_plan",
        result: proposeRes.data,
        content: proposeRes.spoken_summary
      });

      return {
        spokenResponse: proposeRes.spoken_summary,
        traces,
        planId: proposeRes.data.planId,
        pendingApprovals: proposeRes.data.pendingApprovals
      };
    }

    // Default search fallback
    const searchRes = await this.mcpClient.callTool("search_hotels", { destination: "Seattle" });
    traces.push({
      timestamp: new Date().toISOString(),
      type: "TOOL_RESULT",
      toolName: "search_hotels",
      result: searchRes.data,
      content: searchRes.spoken_summary
    });

    return {
      spokenResponse: searchRes.spoken_summary,
      traces
    };
  }

  private async runLiveBedrockLoop(userPrompt: string, traces: AgentStepTrace[]): Promise<AgentRunResponse> {
    const tools = await this.mcpClient.listTools();

    // Map MCP tools to Bedrock Converse toolConfig format
    const bedrockTools = tools.map((t: any) => ({
      toolSpec: {
        name: t.name,
        description: t.description,
        inputSchema: {
          json: t.inputSchema
        }
      }
    }));

    const messages: any[] = [
      {
        role: "user",
        content: [{ text: userPrompt }]
      }
    ];

    let finalResponse = "";
    let planId: string | undefined;
    let pendingApprovals: any[] = [];

    // Conversation loop
    for (let turn = 0; turn < 5; turn++) {
      const command = new ConverseCommand({
        modelId: this.modelId,
        messages,
        toolConfig: { tools: bedrockTools }
      });

      const response = await this.bedrockClient!.send(command);
      const outputMsg = response.output?.message;
      if (!outputMsg) break;

      messages.push(outputMsg);

      const toolUseBlocks = outputMsg.content?.filter((c: any) => c.toolUse) || [];
      if (toolUseBlocks.length === 0) {
        finalResponse = outputMsg.content?.find((c: any) => c.text)?.text || "";
        break;
      }

      // Execute tool uses
      const toolResultBlocks: any[] = [];
      for (const block of toolUseBlocks) {
        if (!block.toolUse || !block.toolUse.name || !block.toolUse.toolUseId) continue;
        const { toolUseId, name } = block.toolUse;
        const input = (block.toolUse.input || {}) as Record<string, unknown>;

        traces.push({
          timestamp: new Date().toISOString(),
          type: "TOOL_CALL",
          toolName: name,
          args: input,
          content: `Bedrock Converse invoked tool ${name}`
        });

        try {
          const res = await this.mcpClient.callTool(name, input);
          if (name === "propose_plan") {
            planId = res.data.planId;
            pendingApprovals = res.data.pendingApprovals;
          }

          traces.push({
            timestamp: new Date().toISOString(),
            type: "TOOL_RESULT",
            toolName: name,
            result: res.data,
            content: res.spoken_summary
          });

          toolResultBlocks.push({
            toolResult: {
              toolUseId,
              content: [{ text: JSON.stringify(res.data) }]
            }
          });
        } catch (err: any) {
          toolResultBlocks.push({
            toolResult: {
              toolUseId,
              status: "error",
              content: [{ text: err.message }]
            }
          });
        }
      }

      messages.push({
        role: "user",
        content: toolResultBlocks
      });
    }

    return {
      spokenResponse: finalResponse || "I have prepared your plan.",
      traces,
      planId,
      pendingApprovals
    };
  }
}
