import { randomUUID } from "node:crypto";
import { WarrantRepository } from "../storage/db.js";
import { canonicalSha256 } from "../crypto/canonical.js";
import { Approval } from "../types.js";

export class ApprovalService {
  constructor(private repo: WarrantRepository) {}

  /**
   * Creates a pending approval request for a T2 action bound to the canonical parameter hash.
   */
  public createPendingApproval(
    actionId: string,
    planId: string,
    params: Record<string, unknown>,
    ttlSeconds: number = 900 // 15 minutes default
  ): Approval {
    const paramsHash = canonicalSha256(params);
    const approvalToken = `appr_${randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const approval: Approval = {
      id: `apr_${randomUUID().replace(/-/g, "")}`,
      actionId,
      planId,
      paramsHash,
      approvalToken,
      status: "PENDING",
      expiresAt,
      createdAt: new Date().toISOString()
    };

    this.repo.createApproval(approval);
    return approval;
  }

  /**
   * Verifies that the approval token is valid and mathematically bound to the incoming parameters (Invariant I3).
   */
  public verifyApprovalToken(
    token: string,
    incomingParams: Record<string, unknown>,
    now: Date = new Date()
  ): { valid: boolean; reason?: string; approval?: Approval } {
    const approval = this.repo.getApprovalByToken(token);

    if (!approval) {
      return { valid: false, reason: "INVALID_APPROVAL_TOKEN" };
    }

    if (approval.status !== "APPROVED") {
      return {
        valid: false,
        reason: `APPROVAL_NOT_GRANTED: Current status is ${approval.status}`
      };
    }

    if (now.getTime() >= new Date(approval.expiresAt).getTime()) {
      return { valid: false, reason: "APPROVAL_EXPIRED" };
    }

    const incomingHash = canonicalSha256(incomingParams);
    if (incomingHash !== approval.paramsHash) {
      this.repo.appendAuditEvent("APPROVAL_TAMPER_DETECTED", approval.id, {
        actionId: approval.actionId,
        approvedHash: approval.paramsHash,
        incomingHash
      });

      return {
        valid: false,
        reason: `APPROVAL_PARAMETER_MISMATCH: Incoming parameters do not match approved parameters. Expected hash ${approval.paramsHash}, got ${incomingHash}`
      };
    }

    return { valid: true, approval };
  }

  public decide(approvalId: string, decision: "APPROVED" | "REJECTED"): Approval {
    return this.repo.decideApproval(approvalId, decision);
  }

  public getPendingApprovals(): Approval[] {
    return this.repo.getPendingApprovals();
  }
}
