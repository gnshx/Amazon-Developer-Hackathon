#!/usr/bin/env tsx
import { BedrockClient, GetFoundationModelCommand, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";

const CANDIDATE_MODELS = [
  { id: "amazon.nova-pro-v1:0", provider: "Amazon", note: "Amazon Nova Pro multimodal model; native Converse API & tool use" },
  { id: "amazon.nova-lite-v1:0", provider: "Amazon", note: "Amazon low-latency lightweight model" },
  { id: "us.anthropic.claude-3-5-haiku-20241022-v1:0", provider: "Anthropic", note: "Claude 3.5 Haiku via US Cross-Region Inference Profile" },
  { id: "anthropic.claude-haiku-4-5-20251001-v1:0", provider: "Anthropic", note: "Next-gen Claude Haiku (if active in account)" },
  { id: "us.anthropic.claude-3-5-sonnet-20241022-v2:0", provider: "Anthropic", note: "Claude 3.5 Sonnet v2 via US Cross-Region Inference Profile" },
  { id: "anthropic.claude-3-haiku-20240307-v1:0", provider: "Anthropic", note: "Legacy Claude 3 Haiku (subject to deprecation / regional sunset)" }
];

async function main() {
  console.log("\n========================================================");
  console.log("🔍  AMAZON BEDROCK: Model Lifecycle & Availability Audit");
  console.log("========================================================\n");

  const region = process.env.AWS_REGION || "us-east-1";
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKey || !secretKey) {
    console.log("ℹ️  No AWS credentials found in environment (AWS_ACCESS_KEY_ID not set).");
    console.log("   Displaying candidate Bedrock models and lifecycle considerations:\n");

    console.log("Candidate Models for Voice Assistant Agent Loop:");
    for (const m of CANDIDATE_MODELS) {
      console.log(`  • [${m.provider}] ${m.id}`);
      console.log(`    ↳ Note: ${m.note}`);
    }

    console.log("\nTo query your AWS account live for exact foundation model status:");
    console.log("  export AWS_ACCESS_KEY_ID=\"your_key\"");
    console.log("  export AWS_SECRET_ACCESS_KEY=\"your_secret\"");
    console.log(`  export AWS_REGION=\"${region}\"`);
    console.log("  npm run check:bedrock-models\n");
    console.log("========================================================\n");
    return;
  }

  console.log(`Querying Bedrock control plane in region: ${region}...\n`);

  const client = new BedrockClient({
    region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      sessionToken
    }
  });

  for (const model of CANDIDATE_MODELS) {
    process.stdout.write(`Checking ${model.id.padEnd(46)} ... `);
    try {
      const res = await client.send(new GetFoundationModelCommand({ modelIdentifier: model.id }));
      const status = res.modelDetails?.modelLifecycle?.status || "UNKNOWN";
      const modalities = res.modelDetails?.outputModalities?.join(",") || "TEXT";
      console.log(`[${status}] (output: ${modalities})`);
    } catch (err: any) {
      if (err.name === "ResourceNotFoundException") {
        console.log(`[NOT FOUND / RETIRED in ${region}]`);
      } else if (err.name === "AccessDeniedException") {
        console.log(`[ACCESS DENIED: permissions or model access not requested]`);
      } else {
        console.log(`[ERROR: ${err.message}]`);
      }
    }
  }

  console.log("\n========================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
