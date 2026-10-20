/**
 * Runtime state tracker for Amazon Bedrock Converse calls.
 * Ensures the UI badge strictly reflects the last call that actually succeeded
 * rather than the mere presence of environment variables.
 *
 * Implements strict startup-only caching so that polling or subsequent status checks
 * NEVER make redundant or billable Bedrock calls.
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
  __warrantStartupVerified?: boolean;
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

/**
 * Runs a single verification check on server startup (at most once).
 * Subsequent checks are served entirely from in-memory cache with zero external network calls.
 */
export async function verifyBedrockOnceAtStartup(): Promise<void> {
  if (globalForBedrock.__warrantStartupVerified) {
    return;
  }
  globalForBedrock.__warrantStartupVerified = true;

  const hasEnvCreds = Boolean(
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    process.env.AWS_PROFILE
  );

  if (!hasEnvCreds) {
    recordBedrockFallback("AWS credentials not configured. Running offline stub.");
    return;
  }

  try {
    const { BedrockRuntimeClient, ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const region = process.env.AWS_REGION || "us-east-1";
    const modelId = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0";

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
    if (res.output?.message) {
      recordBedrockSuccess(modelId, Date.now() - startMs);
    } else {
      recordBedrockFallback("Empty response from Bedrock");
    }
  } catch (err: any) {
    recordBedrockFallback(`Bedrock verification failed: ${err.message || String(err)}`);
  }
}
