/**
 * Warrant Siege Invariant & Scorecard Types
 */

export type InvariantId = "I1" | "I2" | "I3" | "I4" | "I5" | "I6" | "I7" | "I8";

export interface ScenarioDefinition {
  id: string; // S1 through S8
  name: string;
  targetInvariant: InvariantId;
  description: string;
  expectedOutcome: string;
}

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  targetInvariant: InvariantId;
  passed: boolean;
  durationMs: number;
  assertion: string;
  details?: Record<string, unknown>;
  error?: string;
}

export interface Scorecard {
  runId: string;
  timestamp: string;
  targetUrl: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  allInvariantsSatisfied: boolean;
  invariants: Record<
    InvariantId,
    {
      name: string;
      satisfied: boolean;
      testedBy: string[];
    }
  >;
  results: ScenarioResult[];
  auditProofHash?: string;
}
