import { NextResponse } from "next/server";

export async function GET() {
  const hasAwsCreds = Boolean(
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    process.env.BEDROCK_ENABLED === "true"
  );
  const modelId = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0";

  return NextResponse.json({
    bedrockLive: hasAwsCreds,
    modelId: hasAwsCreds ? modelId : null,
    mode: hasAwsCreds ? "Bedrock Live" : "Offline Stub"
  });
}
