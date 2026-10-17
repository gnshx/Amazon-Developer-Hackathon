#!/usr/bin/env tsx
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

async function main() {
  console.log("\n========================================================");
  console.log("☁️  AMAZON BEDROCK CONVERSE API: Live Integration Check");
  console.log("========================================================\n");

  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION || "us-east-1";
  const modelId = process.env.BEDROCK_MODEL_ID || "amazon.nova-pro-v1:0";

  if (!accessKey || !secretKey) {
    console.log("ℹ️  No live AWS credentials detected in environment.");
    console.log("   AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set.\n");
    console.log("   To run against live Amazon Bedrock in your account, export:");
    console.log('   export AWS_ACCESS_KEY_ID="your_access_key"');
    console.log('   export AWS_SECRET_ACCESS_KEY="your_secret_key"');
    console.log(`   export AWS_REGION="${region}"`);
    console.log(`   export BEDROCK_MODEL_ID="${modelId}"  # or us.anthropic.claude-3-5-haiku-20241022-v1:0`);
    console.log("   npm run test:bedrock\n");
    console.log("   Warrant will continue using its deterministic offline stub fallback");
    console.log("   which simulates complete agent conversation and tool execution.\n");
    console.log("========================================================\n");
    process.exit(0);
  }

  console.log(`Target Region:  ${region}`);
  console.log(`Target Model:   ${modelId}`);
  console.log(`Access Key:     ${accessKey.substring(0, 4)}...${accessKey.substring(accessKey.length - 4)}`);

  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      sessionToken
    }
  });

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

    console.log(`\n✅ LIVE BEDROCK CONVERSE CALL SUCCEEDED! (${duration}ms)`);
    console.log(`   Model:   ${modelId}`);
    console.log(`   Status:  HTTP ${response.$metadata.httpStatusCode}`);

    const content = response.output?.message?.content || [];
    const toolUseBlock = content.find((c: any) => c.toolUse);

    if (toolUseBlock?.toolUse) {
      console.log(`   Tool:    Model invoked '${toolUseBlock.toolUse.name}'`);
      console.log(`   Args:    ${JSON.stringify(toolUseBlock.toolUse.input)}`);
    } else {
      const text = content.find((c: any) => c.text)?.text;
      console.log(`   Text:    ${text?.substring(0, 80)}...`);
    }

    console.log("\n========================================================");
    console.log("🎉 Bedrock Converse API verified live and ready for voice agent!");
    console.log("========================================================\n");
  } catch (err: any) {
    console.error(`\n❌ Bedrock Converse command failed: ${err.message}`);
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
