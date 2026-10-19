import { describe, it, expect, vi } from "vitest";
import { BedrockVoiceAgent } from "./bedrock-agent.js";
import { WarrantMcpClient } from "./mcp-client.js";

describe("BedrockVoiceAgent & MCP Client", () => {
  it("executes trip planning loop and formats spoken summary", async () => {
    const mockMcpClient = new WarrantMcpClient();

    // Mock tool calls
    vi.spyOn(mockMcpClient, "callTool").mockImplementation(async (name, _args) => {
      if (name === "search_trains") {
        return {
          data: { trains: [{ id: "t1", priceMinor: 4500 }] },
          spoken_summary: "Found trains starting at $45.00."
        };
      }
      if (name === "search_hotels") {
        return {
          data: { hotels: [{ id: "h1", priceMinor: 12000 }] },
          spoken_summary: "Found Harbor Inn Hotel for $120.00."
        };
      }
      if (name === "propose_plan") {
        return {
          data: {
            planId: "plan_test_123",
            totalEstimatedMinor: 16500,
            pendingApprovals: [
              {
                actionId: "act_1",
                toolName: "book_hotel",
                status: "PENDING"
              }
            ]
          },
          spoken_summary: "I prepared a plan with 2 steps totaling $165.00. 1 step requires your approval on your phone."
        };
      }
      return { data: {}, spoken_summary: "Default summary" };
    });

    const agent = new BedrockVoiceAgent(mockMcpClient);
    const response = await agent.run("Book a weekend trip to Seattle under $200");

    expect(response.planId).toBe("plan_test_123");
    expect(response.pendingApprovals?.length).toBe(1);
    expect(response.spokenResponse).toContain("totaling $165.00");
    expect(response.traces.length).toBeGreaterThan(3);
  });
});
