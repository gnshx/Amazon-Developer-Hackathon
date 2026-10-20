/**
 * Runtime state tracker for Amazon Bedrock Converse calls.
 * Ensures the UI badge strictly reflects the last call that actually succeeded
 * rather than the mere presence of environment variables.
 */

export interface BedrockCallState {
  lastCallSucceeded: boolean;
  modelId: string | null;
  lastCallTimestamp: string | null;
  lastCallLatencyMs: number | null;
  fallbackActive: boolean;
  fallbackReason: string | null;
  totalCalls: number;
}

// Global server singleton across API routes and Next.js hot reloads
const globalForBedrock = globalThis as unknown as {
  __warrantBedrockState?: BedrockCallState;
};

export const bedrockState: BedrockCallState = globalForBedrock.__warrantBedrockState ?? {
  lastCallSucceeded: false,
  modelId: null,
  lastCallTimestamp: null,
  lastCallLatencyMs: null,
  fallbackActive: true,
  fallbackReason: "No Converse calls completed yet",
  totalCalls: 0
};

if (!globalForBedrock.__warrantBedrockState) {
  globalForBedrock.__warrantBedrockState = bedrockState;
}

export function recordBedrockSuccess(modelId: string, latencyMs?: number) {
  bedrockState.lastCallSucceeded = true;
  bedrockState.modelId = modelId;
  bedrockState.lastCallTimestamp = new Date().toISOString();
  bedrockState.lastCallLatencyMs = latencyMs ?? null;
  bedrockState.fallbackActive = false;
  bedrockState.fallbackReason = null;
  bedrockState.totalCalls++;
}

export function recordBedrockFallback(reason: string) {
  bedrockState.lastCallSucceeded = false;
  bedrockState.modelId = null;
  bedrockState.lastCallTimestamp = new Date().toISOString();
  bedrockState.fallbackActive = true;
  bedrockState.fallbackReason = reason;
  bedrockState.totalCalls++;
}

export function getBedrockState(): BedrockCallState {
  return { ...bedrockState };
}
