import { Router, Request, Response } from "express";
import { WarrantRepository } from "../storage/db.js";
import { ApprovalService } from "../approval/service.js";
import { verifyAuditChain } from "../audit/chain.js";
import { randomUUID } from "node:crypto";

export function createAdminRouter(repo: WarrantRepository, approvalService: ApprovalService): Router {
  const router = Router();

  // POST /admin/grants
  router.post("/grants", (req: Request, res: Response) => {
    try {
      const { scopes, spendCapMinor, expiresAt, sessionToken, id } = req.body;
      if (!scopes || spendCapMinor === undefined || !expiresAt) {
        return res.status(400).json({ error: "Missing required fields: scopes, spendCapMinor, expiresAt" });
      }

      const grantId = id ?? `grant_${randomUUID().replace(/-/g, "")}`;
      const token = sessionToken ?? `tok_${randomUUID().replace(/-/g, "")}`;

      const grant = repo.createGrant({
        id: grantId,
        sessionToken: token,
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

  return router;
}
