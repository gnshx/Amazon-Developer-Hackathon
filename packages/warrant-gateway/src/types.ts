/**
 * Warrant Gateway Domain Types
 * Invariant preservation:
 * - Currency is strictly Integer Minor Units (e.g. cents, pence, paise). Never floats.
 * - Spoken summaries must be natural, concise, and <= 300 characters.
 */

export type MinorUnits = number;

export type GrantStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface Grant {
  id: string;
  sessionToken: string;
  scopes: string[]; // e.g., ["hotel:*", "train:*", "dining:*"]
  spendCapMinor: MinorUnits;
  spentMinor: MinorUnits;
  expiresAt: string; // ISO 8601 string
  status: GrantStatus;
  createdAt: string;
}

export type RiskTier = "T0" | "T1" | "T2" | "T3";

export type PlanState =
  | "PROPOSED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "COMPENSATED"
  | "COMPENSATION_FAILED";

export type ActionState =
  | "PROPOSED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN"
  | "COMPENSATED"
  | "COMPENSATION_FAILED";

export interface PlanAction {
  id: string;
  planId: string;
  seq: number;
  toolName: string;
  params: Record<string, unknown>;
  paramsCanonical: string;
  paramsHash: string;
  riskTier: RiskTier;
  state: ActionState;
  idempotencyKey: string;
  estimatedCostMinor: MinorUnits;
  confirmedCostMinor?: MinorUnits;
  resultPayload?: Record<string, unknown>;
  compensationTool?: string;
  compensationParams?: Record<string, unknown>;
}

export interface Plan {
  id: string;
  grantId: string;
  state: PlanState;
  totalEstimatedMinor: MinorUnits;
  totalConfirmedMinor: MinorUnits;
  actions: PlanAction[];
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface Approval {
  id: string;
  actionId: string;
  planId: string;
  paramsHash: string;
  approvalToken: string;
  status: ApprovalStatus;
  expiresAt: string;
  decidedAt?: string;
  createdAt: string;
}

export type AuditEventType =
  | "GRANT_CREATED"
  | "GRANT_REVOKED"
  | "GRANT_EXPIRED"
  | "PLAN_PROPOSED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_TAMPER_DETECTED"
  | "ACTION_EXECUTION_STARTED"
  | "ACTION_SUCCEEDED"
  | "ACTION_FAILED"
  | "ACTION_UNKNOWN_TIMEOUT"
  | "ACTION_RECONCILED"
  | "SAGA_COMPENSATION_STARTED"
  | "SAGA_COMPENSATION_SUCCEEDED"
  | "SAGA_COMPENSATION_FAILED"
  | "POLICY_DENIED";

export interface AuditEvent {
  seq: number;
  timestamp: string;
  eventType: AuditEventType;
  refId: string; // grantId, planId, or actionId
  payloadCanonical: string;
  prevHash: string;
  hash: string;
}

export type IdempotencyRecordState = "PROCESSING" | "COMPLETED" | "FAILED";

export interface IdempotencyRecord {
  grantId: string;
  toolName: string;
  idempotencyKey: string;
  paramsHash: string;
  state: IdempotencyRecordState;
  responsePayload?: Record<string, unknown>;
  createdAt: string;
}

export interface PolicyDecision {
  allowed: boolean;
  riskTier: RiskTier;
  requiresApproval: boolean;
  reasonCode:
    | "ALLOWED_READ_ONLY"
    | "ALLOWED_WITHIN_THRESHOLD"
    | "REQUIRES_PHONE_APPROVAL"
    | "EXCEEDS_SPEND_CAP"
    | "OUT_OF_SCOPE"
    | "GRANT_EXPIRED"
    | "GRANT_REVOKED"
    | "INVALID_INPUT";
  reasonMessage: string;
}

export interface ToolResult<T = unknown> {
  data: T;
  spoken_summary: string;
  risk_tier?: RiskTier;
}
