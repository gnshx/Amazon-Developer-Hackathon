#!/usr/bin/env tsx
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("\n========================================================");
  console.log("☁️  AMAZON BEDROCK CONVERSE API: Live Integration Check");
  console.log("========================================================\n");

  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0";

  const hasEnvCreds = !!(accessKey && secretKey);

  const client = hasEnvCreds
    ? new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
          sessionToken
        }
      })
    : new BedrockRuntimeClient({ region });

  console.log(`Target Region:  ${region}`);
  console.log(`Target Model:   ${modelId}`);
  if (hasEnvCreds) {
    console.log(`Access Key:     ${accessKey.substring(0, 4)}...${accessKey.substring(accessKey.length - 4)}`);
  } else {
    console.log("Access Key:     [Using AWS Default Credential Provider Chain]");
  }

  let sdkVersion = "3.1152.0";
  try {
    const pkgPath = require.resolve("@aws-sdk/client-bedrock-runtime/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    sdkVersion = pkg.version || sdkVersion;
  } catch {}

  console.log("\nSending test Converse command with sample travel tool...");
  const start = Date.now();

  try {
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [{ text: "Find me a train from Portland to Seattle under $50." }]
        }
      ],
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: "search_trains",
              description: "Search available train schedules between cities",
              inputSchema: {
                json: {
                  type: "object",
                  properties: {
                    origin: { type: "string" },
                    destination: { type: "string" },
                    maxPriceMinor: { type: "integer" }
                  },
                  required: ["origin", "destination"]
                }
              }
            }
          }
        ]
      }
    });

    const response = await client.send(command);
    const duration = Date.now() - start;

    const content = response.output?.message?.content || [];
    const toolUseBlock = content.find((c: any) => c.toolUse);

    console.log(`\n✅ LIVE BEDROCK CONVERSE CALL SUCCEEDED! (${duration}ms)`);
    console.log(`   Model:       ${modelId}`);
    console.log(`   SDK Version: ${sdkVersion}`);
    console.log(`   Request ID:  ${response.$metadata.requestId}`);
    console.log(`   Stop Reason: ${response.stopReason}`);
    console.log(`   Latency:     ${duration}ms`);
    console.log(`   Token Usage: ${JSON.stringify(response.usage)}`);

    if (toolUseBlock?.toolUse) {
      console.log(`   Tool:        Model invoked '${toolUseBlock.toolUse.name}'`);
      console.log(`   Args:        ${JSON.stringify(toolUseBlock.toolUse.input)}`);
    } else {
      const text = content.find((c: any) => c.text)?.text;
      console.log(`   Text:        ${text?.substring(0, 80)}...`);
    }

    const proofData = {
      timestamp: new Date().toISOString(),
      region,
      modelId,
      sdkVersion,
      status: "SUCCESS",
      httpStatusCode: response.$metadata.httpStatusCode,
      requestId: response.$metadata.requestId,
      stopReason: response.stopReason,
      usage: response.usage,
      durationMs: duration,
      toolInvoked: toolUseBlock?.toolUse?.name || null,
      toolArgs: toolUseBlock?.toolUse?.input || null,
      rawContent: content
    };

    const proofPath = path.join(process.cwd(), "docs", "bedrock-live-proof.json");
    fs.writeFileSync(proofPath, JSON.stringify(proofData, null, 2));

    const evidenceDir = path.resolve(process.cwd(), "examples/evidence/bedrock-live");
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, "converse-proof.json"), JSON.stringify(proofData, null, 2));

    let commit = "unknown";
    try {
      commit = require("child_process").execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch {}

    const os = require("os");
    const textHeader = [
      `# Command: npm run test:bedrock`,
      `# Date (UTC): ${new Date().toISOString()}`,
      `# Git Commit: ${commit}`,
      `# Machine: ${os.type()} ${os.arch()} | ${os.cpus()[0]?.model} (${os.cpus().length} cores, ${(os.totalmem() / 1e9).toFixed(1)}GB RAM)`,
      `# Region: ${region}`,
      `# Model ID: ${modelId}`,
      `# SDK Version: @aws-sdk/client-bedrock-runtime@${sdkVersion}`,
      `# Bedrock Request ID: ${response.$metadata.requestId}`,
      `# Stop Reason: ${response.stopReason}`,
      `# Latency: ${duration}ms`,
      `# Token Usage: input=${response.usage?.inputTokens}, output=${response.usage?.outputTokens}, total=${response.usage?.totalTokens}`,
      `--------------------------------------------------------`,
      `Status: HTTP ${response.$metadata.httpStatusCode}`,
      `Tool Invocation: ${toolUseBlock?.toolUse?.name || "none"}`,
      `Tool Input: ${JSON.stringify(toolUseBlock?.toolUse?.input || {})}`,
      `Raw Content:`,
      JSON.stringify(content, null, 2)
    ].join("\n");

    fs.writeFileSync(path.join(evidenceDir, "converse.txt"), textHeader + "\n");

    console.log(`\n📄 Execution proof saved to: ${proofPath}`);
    console.log(`📄 Evidence file saved to:   examples/evidence/bedrock-live/converse-proof.json`);
    console.log(`📄 Raw text saved to:        examples/evidence/bedrock-live/converse.txt`);
    console.log("\n========================================================");
    console.log("🎉 Bedrock Converse API verified live and ready for voice agent!");
    console.log("========================================================\n");
  } catch (err: any) {
    const duration = Date.now() - start;
    console.error(`\n❌ Bedrock Converse command failed: ${err.message}`);

    const errorProof = {
      timestamp: new Date().toISOString(),
      region,
      modelId,
      status: "FAILED",
      errorName: err.name,
      errorMessage: err.message,
      durationMs: duration
    };
    const proofPath = path.join(process.cwd(), "docs", "bedrock-live-proof.json");
    fs.writeFileSync(proofPath, JSON.stringify(errorProof, null, 2));
    console.log(`📄 Failure metrics saved to: ${proofPath}`);

    if (err.name === "ValidationException") {
      console.error("\n💡 Hint: Model ID format error. If using Claude 3.5 Sonnet in us-east-1,");
      console.error("   ensure you use 'us.anthropic.claude-3-5-sonnet-20241022-v2:0' or");
      console.error("   'anthropic.claude-3-haiku-20240307-v1:0'.");
    } else if (err.name === "AccessDeniedException") {
      console.error("\n💡 Hint: Your AWS IAM user/role lacks bedrock:InvokeModel permissions,");
      console.error("   or access to this specific model has not been requested in the AWS Bedrock console.");
    }
    console.log("========================================================\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
