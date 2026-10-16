import { Grant, PlanAction, PolicyDecision, RiskTier } from "../types.js";

export interface PolicyEngineConfig {
  t1SpendThresholdMinor: number; // Maximum cost for T1 auto-approval (default 5000 = $50.00)
  toolTiers: Record<string, RiskTier>; // Tool base risk tier mapping
}

export const DEFAULT_POLICY_CONFIG: PolicyEngineConfig = {
  t1SpendThresholdMinor: 5000, // $50.00
  toolTiers: {
    search_hotels: "T0",
    search_trains: "T0",
    search_restaurants: "T0",
    get_plan_status: "T0",
    reserve_table: "T1",
    book_train: "T1",
    book_hotel: "T2",
    request_cancellation: "T1"
  }
};

/**
 * Checks if a requested tool matches any granted scope pattern.
 * e.g., "hotel:*" matches "book_hotel", "search_hotels"
 * e.g., "*" matches everything
 */
export function isToolInScope(toolName: string, scopes: string[]): boolean {
  if (scopes.includes("*") || scopes.includes("all")) {
    return true;
  }

  for (const scope of scopes) {
    if (scope === toolName) {
      return true;
    }
    // Namespace matching, e.g. "hotel:*" or "hotel"
    if (scope.endsWith(":*")) {
      const prefix = scope.slice(0, -2);
      if (toolName.includes(prefix)) {
        return true;
      }
    }
    if (scope.endsWith("*")) {
      const prefix = scope.slice(0, -1);
      if (toolName.startsWith(prefix)) {
        return true;
      }
    }
    // Prefix match e.g. "hotel" matching "book_hotel" or "search_hotels"
    if (toolName.includes(scope)) {
      return true;
    }
  }

  return false;
}

/**
 * Pure deterministic policy evaluation.
 * Invariant preservation:
 * - I2: Absolute Spend Cap
 * - I3: Approval Binding for T2
 * - I6: Temporal Authorization Boundary (expired or revoked grants authorize 0 actions)
 */
export function evaluatePolicy(
  grant: Grant,
  action: {
    toolName: string;
    estimatedCostMinor: number;
  },
  now: Date = new Date(),
  config: PolicyEngineConfig = DEFAULT_POLICY_CONFIG
): PolicyDecision {
  // 1. Check Grant Status (Revoked) - Invariant I6
  if (grant.status === "REVOKED") {
    return {
      allowed: false,
      riskTier: "T3",
      requiresApproval: false,
      reasonCode: "GRANT_REVOKED",
      reasonMessage: `Grant ${grant.id} has been revoked by the user.`
    };
  }

  // 2. Check Expiration Timestamp - Invariant I6
  const expiresAtDate = new Date(grant.expiresAt);
  if (now.getTime() >= expiresAtDate.getTime() || grant.status === "EXPIRED") {
    return {
      allowed: false,
      riskTier: "T3",
      requiresApproval: false,
      reasonCode: "GRANT_EXPIRED",
      reasonMessage: `Grant ${grant.id} expired at ${grant.expiresAt}. Current time: ${now.toISOString()}.`
    };
  }

  // 3. Check Scope Authorization
  if (!isToolInScope(action.toolName, grant.scopes)) {
    return {
      allowed: false,
      riskTier: "T3",
      requiresApproval: false,
      reasonCode: "OUT_OF_SCOPE",
      reasonMessage: `Action '${action.toolName}' is not authorized by grant scopes: [${grant.scopes.join(", ")}].`
    };
  }

  // 4. Resolve Base Risk Tier
  const baseTier: RiskTier = config.toolTiers[action.toolName] ?? "T2";

  // T0 Read-only actions always authorized without budget consumption
  if (baseTier === "T0") {
    return {
      allowed: true,
      riskTier: "T0",
      requiresApproval: false,
      reasonCode: "ALLOWED_READ_ONLY",
      reasonMessage: `Read-only action '${action.toolName}' authorized with zero spend impact.`
    };
  }

  // 5. Check Absolute Spend Cap - Invariant I2
  const projectedSpend = grant.spentMinor + action.estimatedCostMinor;
  if (projectedSpend > grant.spendCapMinor) {
    return {
      allowed: false,
      riskTier: "T3",
      requiresApproval: false,
      reasonCode: "EXCEEDS_SPEND_CAP",
      reasonMessage: `Action cost (${action.estimatedCostMinor} cents) plus current spend (${grant.spentMinor} cents) exceeds spend cap (${grant.spendCapMinor} cents).`
    };
  }

  // 6. Dynamic Tier Escalation based on spend threshold - Invariant I3
  // If a T1 action exceeds threshold, escalate to T2 (requires approval)
  let effectiveTier: RiskTier = baseTier;
  if (baseTier === "T1" && action.estimatedCostMinor > config.t1SpendThresholdMinor) {
    effectiveTier = "T2";
  }

  if (effectiveTier === "T2") {
    return {
      allowed: true,
      riskTier: "T2",
      requiresApproval: true,
      reasonCode: "REQUIRES_PHONE_APPROVAL",
      reasonMessage: `High-value or irreversible action '${action.toolName}' requires out-of-band user approval.`
    };
  }

  // T1 Allowed automatically within threshold
  return {
    allowed: true,
    riskTier: "T1",
    requiresApproval: false,
    reasonCode: "ALLOWED_WITHIN_THRESHOLD",
    reasonMessage: `Action '${action.toolName}' authorized automatically within remaining budget.`
  };
}
