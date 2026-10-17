import { Router, Request, Response } from "express";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "../approval/service.js";
import { verifyAuditChain, computeMerkleRoot, generateMerkleProof, verifyMerkleProof } from "../audit/chain.js";
import { SagaOrchestrator } from "../saga/orchestrator.js";
import { ReceiptService } from "../receipt/service.js";
import { randomUUID } from "node:crypto";

export function createAdminRouter(
  repo: WarrantRepository,
  approvalService: ApprovalService,
  sagaOrchestrator?: SagaOrchestrator,
  receiptService?: ReceiptService
): Router {
  const router = Router();

  // POST /admin/grants
  router.post("/grants", (req: Request, res: Response) => {
    try {
      const { scopes, spendCapMinor, expiresAt, sessionToken, id, userId } = req.body;
      if (!scopes || spendCapMinor === undefined || !expiresAt) {
        return res.status(400).json({ error: "Missing required fields: scopes, spendCapMinor, expiresAt" });
      }

      const grantId = id ?? `grant_${randomUUID().replace(/-/g, "")}`;
      const token = sessionToken ?? `tok_${randomUUID().replace(/-/g, "")}`;

      const grant = repo.createGrant({
        id: grantId,
        sessionToken: token,
        userId: userId ?? `user_${grantId}`,
        scopes: Array.isArray(scopes) ? scopes : [scopes],
        spendCapMinor: Number(spendCapMinor),
        expiresAt: new Date(expiresAt).toISOString(),
        status: "ACTIVE"
      });

      return res.status(201).json({
        grant,
        spoken_summary: `Created active grant ${grant.id} with a spend cap of $${(grant.spendCapMinor / 100).toFixed(2)}.`
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/grants/:id
  router.get("/grants/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const grant = repo.getGrantById(id);
    if (!grant) {
      return res.status(404).json({ error: `Grant ${id} not found` });
    }
    const remainingMinor = Math.max(0, grant.spendCapMinor - grant.spentMinor);
    return res.json({
      grant,
      remainingMinor,
      spoken_summary: `Grant ${grant.id} has $${(remainingMinor / 100).toFixed(2)} remaining out of $${(grant.spendCapMinor / 100).toFixed(2)}.`
    });
  });

  // POST /admin/grants/:id/revoke
  router.post("/grants/:id/revoke", (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const grant = repo.revokeGrant(id);
      return res.json({
        grant,
        spoken_summary: `Grant ${grant.id} has been revoked successfully.`
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  // GET /admin/approvals/pending
  router.get("/approvals/pending", (_req: Request, res: Response) => {
    const pending = approvalService.getPendingApprovals();
    return res.json({
      approvals: pending,
      count: pending.length,
      spoken_summary: `You have ${pending.length} pending action approval${pending.length === 1 ? "" : "s"} waiting for confirmation.`
    });
  });

  // POST /admin/approvals/:id/decide
  router.post("/approvals/:id/decide", (req: Request, res: Response) => {
    try {
      const { decision } = req.body;
      if (decision !== "APPROVED" && decision !== "REJECTED") {
        return res.status(400).json({ error: "Decision must be 'APPROVED' or 'REJECTED'" });
      }

      const id = String(req.params.id);
      const approvingUserId = (req.headers["x-user-id"] || req.body.userId) as string | undefined;
      if (approvingUserId) {
        const approvalRecord = repo.getApprovalById(id);
        if (approvalRecord) {
          const plan = repo.getPlanById(approvalRecord.planId);
          const planUserId = plan?.userId ?? (plan ? repo.getGrantById(plan.grantId)?.userId : null);
          if (planUserId && planUserId !== approvingUserId) {
            return res.status(403).json({
              error: `Forbidden: User ${approvingUserId} cannot approve actions for user ${planUserId}'s plan.`
            });
          }
        }
      }

      const approval = approvalService.decide(id, decision);
      return res.json({
        approval,
        spoken_summary: `Action approval was marked ${decision.toLowerCase()}.`
      });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  // GET /admin/audit/timeline
  router.get("/audit/timeline", (_req: Request, res: Response) => {
    const events = repo.getAuditEvents();
    return res.json({
      events,
      count: events.length
    });
  });

  // GET /admin/audit/verify
  router.get("/audit/verify", (_req: Request, res: Response) => {
    const events = repo.getAuditEvents();
    const result = verifyAuditChain(events);
    return res.json({
      ...result,
      spoken_summary: result.valid
        ? `Audit chain verified successfully from genesis across ${result.eventCount} recorded events.`
        : `Audit verification failed: ${result.error?.reason}`
    });
  });

  // GET /admin/audit/merkle-root (Cryptographic checkpoint of entire audit log)
  router.get("/audit/merkle-root", (_req: Request, res: Response) => {
    const events = repo.getAuditEvents();
    const root = computeMerkleRoot(events.map((e) => e.hash));
    return res.json({
      root,
      eventCount: events.length,
      genesisHash: "0000000000000000000000000000000000000000000000000000000000000000",
      spoken_summary: `Current audit log Merkle root checkpoint is ${root.slice(0, 16)}... spanning ${events.length} events.`
    });
  });

  // GET /admin/audit/merkle-proof/:seq (O(log N) inclusion proof for event)
  router.get("/admin/audit/merkle-proof/:seq", (req: Request, res: Response) => {
    const seq = parseInt(String(req.params.seq), 10);
    const events = repo.getAuditEvents();
    if (isNaN(seq) || seq < 1 || seq > events.length) {
      return res.status(400).json({ error: `Invalid event sequence ${req.params.seq}` });
    }
    const proof = generateMerkleProof(events, seq);
    return res.json(proof);
  });

  // POST /admin/audit/merkle-verify (Offline verification of inclusion proof)
  router.post("/admin/audit/merkle-verify", (req: Request, res: Response) => {
    const { leafHash, proof, root } = req.body;
    if (!leafHash || !proof || !root) {
      return res.status(400).json({ error: "Missing required fields: leafHash, proof, root" });
    }
    const valid = verifyMerkleProof(leafHash, proof, root);
    return res.json({
      valid,
      spoken_summary: valid
        ? "Cryptographic Merkle inclusion proof verified successfully."
        : "Merkle inclusion proof failed verification: tampered data or invalid root."
    });
  });

  // GET /admin/plans/:id
  router.get("/plans/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const plan = repo.getPlanById(id);
    if (!plan) return res.status(404).json({ error: `Plan ${id} not found` });
    return res.json({ plan });
  });

  // POST /admin/plans/:id/undo (Grace Window Pre-Settlement & Reversible Hold Cancellation)
  router.post("/plans/:id/undo", async (req: Request, res: Response) => {
    if (!sagaOrchestrator) {
      return res.status(500).json({ error: "Saga orchestrator not initialized" });
    }
    const id = String(req.params.id);
    const result = await sagaOrchestrator.undoPlan(id);
    const status = result.success ? 200 : 400;
    return res.status(status).json(result);
  });

  // GET /admin/receipts
  router.get("/receipts", (_req: Request, res: Response) => {
    const receipts = repo.listReceipts();
    return res.json({ receipts, count: receipts.length });
  });

  // GET /admin/receipts/:id
  router.get("/receipts/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const receipt = repo.getReceipt(id);
    if (!receipt) return res.status(404).json({ error: "Receipt not found" });
    return res.json({ receipt });
  });

  // POST /admin/receipts/verify
  router.post("/receipts/verify", (req: Request, res: Response) => {
    const { receipt, expectedPublicKey } = req.body;
    if (!receipt) return res.status(400).json({ error: "Missing receipt object" });
    const result = ReceiptService.verifyReceipt(receipt, expectedPublicKey);
    return res.json(result);
  });

  return router;
}
