import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import {
  BedrockClient,
  GetFoundationModelCommand,
  GetInferenceProfileCommand,
  ListFoundationModelsCommand
} from "@aws-sdk/client-bedrock";

const CANDIDATE_MODELS = [
  { id: "us.amazon.nova-pro-v1:0", provider: "Amazon", type: "inference-profile", note: "Amazon Nova Pro multimodal cross-region profile (Converse API on-demand)" },
  { id: "us.amazon.nova-lite-v1:0", provider: "Amazon", type: "inference-profile", note: "Amazon Nova Lite low-latency cross-region profile" },
  { id: "amazon.nova-pro-v1:0", provider: "Amazon", type: "foundation-model", note: "Amazon Nova Pro regional foundation model" },
  { id: "amazon.nova-lite-v1:0", provider: "Amazon", type: "foundation-model", note: "Amazon Nova Lite regional foundation model" },
  { id: "us.anthropic.claude-3-haiku-20240307-v1:0", provider: "Anthropic", type: "inference-profile", note: "Claude 3 Haiku via US Cross-Region Inference Profile" },
  { id: "anthropic.claude-haiku-4-5-20251001-v1:0", provider: "Anthropic", type: "foundation-model", note: "Next-gen Claude Haiku (foundation model)" }
];

async function main() {
  const lines: string[] = [];
  const log = (msg: string = "") => {
    console.log(msg);
    lines.push(msg);
  };

  log("\n========================================================");
  log("🔍  AMAZON BEDROCK: Model Lifecycle & Availability Audit");
  log("========================================================\n");

  const region = process.env.AWS_REGION || "us-east-1";
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  const client = (accessKey && secretKey)
    ? new BedrockClient({
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
          sessionToken
        }
      })
    : new BedrockClient({ region });

  // Test credential presence before looping
  try {
    await client.send(new ListFoundationModelsCommand({}));
  } catch (err: any) {
    if (err.name === "CredentialsProviderError" || err.message?.includes("credentials")) {
      log("ℹ️  No AWS credentials found in environment or ~/.aws/credentials.");
      log("   Displaying candidate Bedrock models and lifecycle considerations:\n");

      log("Candidate Models for Voice Assistant Agent Loop:");
      for (const m of CANDIDATE_MODELS) {
        log(`  • [${m.provider}] ${m.id}`);
        log(`    ↳ Note: ${m.note}`);
      }

      log("\nTo query your AWS account live for exact foundation model status:");
      log("  export AWS_ACCESS_KEY_ID=\"your_key\"");
      log("  export AWS_SECRET_ACCESS_KEY=\"your_secret\"");
      log(`  export AWS_REGION=\"${region}\"`);
      log("  npm run check:bedrock-models\n");
      log("========================================================\n");
      return;
    }
  }

  log(`Querying Bedrock control plane in region: ${region}...\n`);

  for (const model of CANDIDATE_MODELS) {
    process.stdout.write(`Checking ${model.id.padEnd(46)} ... `);
    try {
      if (model.type === "inference-profile") {
        const res = await client.send(new GetInferenceProfileCommand({ inferenceProfileIdentifier: model.id }));
        const status = res.status || "UNKNOWN";
        const msg = `[${status}] (type: ${res.type}, name: ${res.inferenceProfileName})`;
        console.log(msg);
        lines.push(`Checking ${model.id.padEnd(46)} ... ${msg}`);
      } else {
        const res = await client.send(new GetFoundationModelCommand({ modelIdentifier: model.id }));
        const status = res.modelDetails?.modelLifecycle?.status || "UNKNOWN";
        const modalities = res.modelDetails?.outputModalities?.join(",") || "TEXT";
        const msg = `[${status}] (output: ${modalities})`;
        console.log(msg);
        lines.push(`Checking ${model.id.padEnd(46)} ... ${msg}`);
      }
    } catch (err: any) {
      let msg = "";
      if (err.name === "ResourceNotFoundException") {
        msg = `[NOT FOUND / RETIRED in ${region}]`;
      } else if (err.name === "AccessDeniedException") {
        msg = `[ACCESS DENIED: permissions or model access not requested]`;
      } else {
        msg = `[ERROR: ${err.message}]`;
      }
      console.log(msg);
      lines.push(`Checking ${model.id.padEnd(46)} ... ${msg}`);
    }
  }

  log("\n========================================================");

  let commit = "unknown";
  try {
    commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {}

  const header = [
    `# Command: npm run check:bedrock-models`,
    `# Date (UTC): ${new Date().toISOString()}`,
    `# Git Commit: ${commit}`,
    `# Machine: ${os.type()} ${os.arch()} | ${os.cpus()[0]?.model} (${os.cpus().length} cores, ${(os.totalmem() / 1e9).toFixed(1)}GB RAM)`,
    `# AWS Region: ${region}`,
    `# AWS Credential Source: default provider chain (~/.aws/credentials)`,
    `# Redacted: Account IDs and secrets omitted`,
    `--------------------------------------------------------`,
    ``
  ].join("\n");

  const evidenceDir = path.resolve(process.cwd(), "examples/evidence/bedrock-live");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "check-models.txt"), header + lines.join("\n") + "\n");
  console.log(`📄 Saved model audit evidence to: examples/evidence/bedrock-live/check-models.txt`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

