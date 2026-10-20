import { NextResponse } from "next/server";
import { getBedrockState, verifyBedrockOnceAtStartup } from "@/lib/bedrock-state";

export const dynamic = "force-dynamic";

/**
 * Public status endpoint for the UI header badge.
 * Returns only safe booleans and model ID with zero private cloud metadata.
 * Uses strict in-memory caching to prevent any billable Bedrock invocations on poll.
 */
export async function GET() {
  // Run startup self-test at most once across the lifecycle of the server
  await verifyBedrockOnceAtStartup();

  const state = getBedrockState();
  const live = state.lastCallSucceeded && !state.fallbackActive;

  return NextResponse.json({
    bedrockLive: live,
    modelId: live ? state.modelId : null,
    mode: live ? "Bedrock Live" : "Offline Stub"
  });
}
