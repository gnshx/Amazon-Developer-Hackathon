import { NextRequest, NextResponse } from "next/server";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockState, recordBedrockSuccess, recordBedrockFallback } from "@/lib/bedrock-state";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shouldVerify = url.searchParams.get("verify") === "true";

  // Check if credentials exist in environment or profile
  const hasEnvCreds = Boolean(
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    process.env.AWS_PROFILE
  );

  // If verify is explicitly requested OR if no calls have been recorded yet:
  if ((shouldVerify || bedrockState.totalCalls === 0) && hasEnvCreds) {
    const region = process.env.AWS_REGION || "us-east-1";
    const modelId = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0";

    try {
      const client = new BedrockRuntimeClient({
        region,
        ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN
              }
            }
          : {})
      });

      const startMs = Date.now();
      const command = new ConverseCommand({
        modelId,
        messages: [{ role: "user", content: [{ text: "ping" }] }]
      });

      const res = await client.send(command);
      const latencyMs = Date.now() - startMs;
      if (res.output?.message) {
        recordBedrockSuccess(modelId, latencyMs);
      } else {
        recordBedrockFallback("Bedrock Converse returned empty output");
      }
    } catch (err: any) {
      recordBedrockFallback(`Bedrock Converse verification failed: ${err.message || String(err)}`);
    }
  } else if (!hasEnvCreds && bedrockState.totalCalls === 0) {
    recordBedrockFallback("AWS credentials not configured. Running in offline stub mode.");
  }

  const live = bedrockState.lastCallSucceeded && !bedrockState.fallbackActive;

  return NextResponse.json({
    bedrockLive: live,
    modelId: live ? bedrockState.modelId : null,
    mode: live ? "Bedrock Live" : "Offline Stub",
    lastCallTimestamp: bedrockState.lastCallTimestamp,
    lastCallLatencyMs: bedrockState.lastCallLatencyMs,
    fallbackActive: bedrockState.fallbackActive,
    fallbackReason: bedrockState.fallbackReason,
    totalCalls: bedrockState.totalCalls
  });
}
