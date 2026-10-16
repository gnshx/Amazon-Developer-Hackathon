import DatabaseConstructor, { Database as DatabaseType } from "better-sqlite3";
import {
  ActionReceipt,
  ActionState,
  Approval,
  ApprovalStatus,
  AuditEvent,
  AuditEventType,
  Grant,
  GrantStatus,
  IdempotencyRecord,
  IdempotencyRecordState,
  MinorUnits,
  Plan,
  PlanAction,
  PlanState,
  RiskTier
} from "../types.js";
import { createAuditEvent, GENESIS_HASH } from "../audit/chain.js";
import { canonicalizeJson } from "../crypto/canonical.js";

export class WarrantRepository {
  private db: DatabaseType;

  constructor(dbPath: string = ":memory:") {
    this.db = new DatabaseConstructor(dbPath);
    // WAL mode for high concurrency if backed by file
    if (dbPath !== ":memory:") {
      this.db.pragma("journal_mode = WAL");
    }
    this.db.pragma("foreign_keys = ON");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS grants (
        id TEXT PRIMARY KEY,
        session_token TEXT UNIQUE NOT NULL,
        scopes TEXT NOT NULL,
        spend_cap_minor INTEGER NOT NULL,
        spent_minor INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        grant_id TEXT NOT NULL REFERENCES grants(id),
        state TEXT NOT NULL,
        total_estimated_minor INTEGER NOT NULL,
        total_confirmed_minor INTEGER NOT NULL DEFAULT 0,
        undo_window_seconds INTEGER,
        settles_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL REFERENCES plans(id),
        seq INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        params_json TEXT NOT NULL,
        params_canonical TEXT NOT NULL,
        params_hash TEXT NOT NULL,
        risk_tier TEXT NOT NULL,
        state TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        estimated_cost_minor INTEGER NOT NULL,
        confirmed_cost_minor INTEGER,
        result_payload TEXT,
        compensation_tool TEXT,
        compensation_params TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (plan_id, seq)
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL REFERENCES actions(id),
        plan_id TEXT NOT NULL REFERENCES plans(id),
        params_hash TEXT NOT NULL,
        approval_token TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        decided_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS idempotency_records (
        grant_id TEXT NOT NULL REFERENCES grants(id),
        tool_name TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        params_hash TEXT NOT NULL,
        state TEXT NOT NULL,
        response_payload TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (grant_id, tool_name, idempotency_key)
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        seq INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        payload_canonical TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL REFERENCES actions(id),
        plan_id TEXT NOT NULL REFERENCES plans(id),
        grant_id TEXT NOT NULL REFERENCES grants(id),
        tool_name TEXT NOT NULL,
        params_hash TEXT NOT NULL,
        spend_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        booking_ref TEXT NOT NULL,
        executed_at TEXT NOT NULL,
        public_key TEXT NOT NULL,
        signature TEXT NOT NULL
      );
    `);

    // Safe migrations for newly added columns on existing sqlite databases
    try {
      this.db.exec("ALTER TABLE plans ADD COLUMN undo_window_seconds INTEGER;");
    } catch {}
    try {
      this.db.exec("ALTER TABLE plans ADD COLUMN settles_at TEXT;");
    } catch {}
  }

  // ================= Grant Operations =================
  public createGrant(grant: Omit<Grant, "spentMinor" | "createdAt">): Grant {
    const createdAt = new Date().toISOString();
    const fullGrant: Grant = {
      ...grant,
      spentMinor: 0,
      createdAt
    };

    const stmt = this.db.prepare(`
      INSERT INTO grants (id, session_token, scopes, spend_cap_minor, spent_minor, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      fullGrant.id,
      fullGrant.sessionToken,
      JSON.stringify(fullGrant.scopes),
      fullGrant.spendCapMinor,
      fullGrant.spentMinor,
      fullGrant.expiresAt,
      fullGrant.status,
      fullGrant.createdAt
    );

    this.appendAuditEvent("GRANT_CREATED", fullGrant.id, {
      scopes: fullGrant.scopes,
      spendCapMinor: fullGrant.spendCapMinor,
      expiresAt: fullGrant.expiresAt
    });

    return fullGrant;
  }

  public getGrantById(id: string): Grant | null {
    const row = this.db.prepare("SELECT * FROM grants WHERE id = ?").get(id) as any;
    if (!row) return null;
    return this.mapGrant(row);
  }

  public getGrantBySessionToken(token: string): Grant | null {
    const row = this.db.prepare("SELECT * FROM grants WHERE session_token = ?").get(token) as any;
    if (!row) return null;
    return this.mapGrant(row);
  }

  public updateGrantSpent(id: string, additionalSpentMinor: MinorUnits): Grant {
    const tx = this.db.transaction(() => {
      const grant = this.getGrantById(id);
      if (!grant) throw new Error(`Grant ${id} not found`);

      const newSpent = grant.spentMinor + additionalSpentMinor;
      this.db.prepare("UPDATE grants SET spent_minor = ? WHERE id = ?").run(newSpent, id);
      grant.spentMinor = newSpent;
      return grant;
    });
    return tx();
  }

  public revokeGrant(id: string): Grant {
    const tx = this.db.transaction(() => {
      const grant = this.getGrantById(id);
      if (!grant) throw new Error(`Grant ${id} not found`);

      this.db.prepare("UPDATE grants SET status = 'REVOKED' WHERE id = ?").run(id);
      grant.status = "REVOKED";

      this.appendAuditEvent("GRANT_REVOKED", id, {
        previousSpentMinor: grant.spentMinor,
        revokedAt: new Date().toISOString()
      });

      return grant;
    });
    return tx();
  }

  // ================= Plan Operations =================
  public createPlan(plan: Plan): void {
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO plans (id, grant_id, state, total_estimated_minor, total_confirmed_minor, undo_window_seconds, settles_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        plan.id,
        plan.grantId,
        plan.state,
        plan.totalEstimatedMinor,
        plan.totalConfirmedMinor,
        plan.undoWindowSeconds ?? null,
        plan.settlesAt ?? null,
        plan.createdAt,
        plan.updatedAt
      );

      const actionStmt = this.db.prepare(`
        INSERT INTO actions (
          id, plan_id, seq, tool_name, params_json, params_canonical, params_hash,
          risk_tier, state, idempotency_key, estimated_cost_minor, compensation_tool, compensation_params, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const act of plan.actions) {
        actionStmt.run(
          act.id,
          act.planId,
          act.seq,
          act.toolName,
          JSON.stringify(act.params),
          act.paramsCanonical,
          act.paramsHash,
          act.riskTier,
          act.state,
          act.idempotencyKey,
          act.estimatedCostMinor,
          act.compensationTool ?? null,
          act.compensationParams ? JSON.stringify(act.compensationParams) : null,
          new Date().toISOString()
        );
      }

      this.appendAuditEvent("PLAN_PROPOSED", plan.id, {
        grantId: plan.grantId,
        totalEstimatedMinor: plan.totalEstimatedMinor,
        stepCount: plan.actions.length
      });
    });

    tx();
  }

  public getPlanById(id: string): Plan | null {
    const planRow = this.db.prepare("SELECT * FROM plans WHERE id = ?").get(id) as any;
    if (!planRow) return null;

    const actionRows = this.db.prepare("SELECT * FROM actions WHERE plan_id = ? ORDER BY seq ASC").all(id) as any[];
    const actions: PlanAction[] = actionRows.map((r) => this.mapAction(r));

    return {
      id: planRow.id,
      grantId: planRow.grant_id,
      state: planRow.state as PlanState,
      totalEstimatedMinor: planRow.total_estimated_minor,
      totalConfirmedMinor: planRow.total_confirmed_minor,
      undoWindowSeconds: planRow.undo_window_seconds ?? undefined,
      settlesAt: planRow.settles_at ?? undefined,
      actions,
      createdAt: planRow.created_at,
      updatedAt: planRow.updated_at
    };
  }

  public updatePlanState(id: string, state: PlanState): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE plans SET state = ?, updated_at = ? WHERE id = ?").run(state, now, id);
  }

  public updatePlanHold(id: string, undoWindowSeconds: number, settlesAt: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE plans SET state = 'HELD', undo_window_seconds = ?, settles_at = ?, updated_at = ? WHERE id = ?").run(undoWindowSeconds, settlesAt, now, id);
  }

  public updateActionState(id: string, state: ActionState, resultPayload?: Record<string, unknown>, confirmedCost?: MinorUnits): void {
    const tx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE actions 
        SET state = ?, result_payload = COALESCE(?, result_payload), confirmed_cost_minor = COALESCE(?, confirmed_cost_minor)
        WHERE id = ?
      `).run(state, resultPayload ? JSON.stringify(resultPayload) : null, confirmedCost ?? null, id);
    });
    tx();
  }

  // ================= Approval Operations =================
  public createApproval(approval: Approval): void {
    this.db.prepare(`
      INSERT INTO approvals (id, action_id, plan_id, params_hash, approval_token, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      approval.id,
      approval.actionId,
      approval.planId,
      approval.paramsHash,
      approval.approvalToken,
      approval.status,
      approval.expiresAt,
      approval.createdAt
    );

    this.appendAuditEvent("APPROVAL_REQUESTED", approval.id, {
      actionId: approval.actionId,
      planId: approval.planId,
      paramsHash: approval.paramsHash
    });
  }

  public getApprovalByToken(token: string): Approval | null {
    const row = this.db.prepare("SELECT * FROM approvals WHERE approval_token = ?").get(token) as any;
    if (!row) return null;
    return this.mapApproval(row);
  }

  public getApprovalByActionId(actionId: string): Approval | null {
    const row = this.db.prepare("SELECT * FROM approvals WHERE action_id = ?").get(actionId) as any;
    if (!row) return null;
    return this.mapApproval(row);
  }

  public getPendingApprovals(): Approval[] {
    const rows = this.db.prepare("SELECT * FROM approvals WHERE status = 'PENDING' ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => this.mapApproval(r));
  }

  public decideApproval(id: string, decision: "APPROVED" | "REJECTED"): Approval {
    const tx = this.db.transaction(() => {
      const now = new Date().toISOString();
      this.db.prepare("UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?").run(decision, now, id);
      const row = this.db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as any;
      const approval = this.mapApproval(row);

      this.appendAuditEvent(decision === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED", id, {
        actionId: approval.actionId,
        paramsHash: approval.paramsHash
      });

      return approval;
    });
    return tx();
  }

  // ================= Idempotency Operations =================
  public getIdempotencyRecord(grantId: string, toolName: string, idempotencyKey: string): IdempotencyRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM idempotency_records 
      WHERE grant_id = ? AND tool_name = ? AND idempotency_key = ?
    `).get(grantId, toolName, idempotencyKey) as any;
    if (!row) return null;

    return {
      grantId: row.grant_id,
      toolName: row.tool_name,
      idempotencyKey: row.idempotency_key,
      paramsHash: row.params_hash,
      state: row.state as IdempotencyRecordState,
      responsePayload: row.response_payload ? JSON.parse(row.response_payload) : undefined,
      createdAt: row.created_at
    };
  }

  public recordIdempotencyStart(grantId: string, toolName: string, idempotencyKey: string, paramsHash: string): void {
    this.db.prepare(`
      INSERT INTO idempotency_records (grant_id, tool_name, idempotency_key, params_hash, state, created_at)
      VALUES (?, ?, ?, ?, 'PROCESSING', ?)
    `).run(grantId, toolName, idempotencyKey, paramsHash, new Date().toISOString());
  }

  public recordIdempotencyComplete(grantId: string, toolName: string, idempotencyKey: string, payload: Record<string, unknown>): void {
    this.db.prepare(`
      UPDATE idempotency_records 
      SET state = 'COMPLETED', response_payload = ?
      WHERE grant_id = ? AND tool_name = ? AND idempotency_key = ?
    `).run(JSON.stringify(payload), grantId, toolName, idempotencyKey);
  }

  // ================= Audit Operations =================
  public appendAuditEvent(eventType: AuditEventType, refId: string, payload: Record<string, unknown>): AuditEvent {
    const tx = this.db.transaction(() => {
      const latest = this.getLatestAuditEvent();
      const event = createAuditEvent(latest, eventType, refId, payload);

      this.db.prepare(`
        INSERT INTO audit_events (seq, timestamp, event_type, ref_id, payload_canonical, prev_hash, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.seq,
        event.timestamp,
        event.eventType,
        event.refId,
        event.payloadCanonical,
        event.prevHash,
        event.hash
      );

      return event;
    });

    return tx();
  }

  public getAuditEvents(): AuditEvent[] {
    const rows = this.db.prepare("SELECT * FROM audit_events ORDER BY seq ASC").all() as any[];
    return rows.map((r) => ({
      seq: r.seq,
      timestamp: r.timestamp,
      eventType: r.event_type as AuditEventType,
      refId: r.ref_id,
      payloadCanonical: r.payload_canonical,
      prevHash: r.prev_hash,
      hash: r.hash
    }));
  }

  public getLatestAuditEvent(): AuditEvent | null {
    const r = this.db.prepare("SELECT * FROM audit_events ORDER BY seq DESC LIMIT 1").get() as any;
    if (!r) return null;
    return {
      seq: r.seq,
      timestamp: r.timestamp,
      eventType: r.event_type as AuditEventType,
      refId: r.ref_id,
      payloadCanonical: r.payload_canonical,
      prevHash: r.prev_hash,
      hash: r.hash
    };
  }

  // ================= Helpers =================
  private mapGrant(row: any): Grant {
    return {
      id: row.id,
      sessionToken: row.session_token,
      scopes: JSON.parse(row.scopes),
      spendCapMinor: row.spend_cap_minor,
      spentMinor: row.spent_minor,
      expiresAt: row.expires_at,
      status: row.status as GrantStatus,
      createdAt: row.created_at
    };
  }

  private mapAction(r: any): PlanAction {
    return {
      id: r.id,
      planId: r.plan_id,
      seq: r.seq,
      toolName: r.tool_name,
      params: JSON.parse(r.params_json),
      paramsCanonical: r.params_canonical,
      paramsHash: r.params_hash,
      riskTier: r.risk_tier as RiskTier,
      state: r.state as ActionState,
      idempotencyKey: r.idempotency_key,
      estimatedCostMinor: r.estimated_cost_minor,
      confirmedCostMinor: r.confirmed_cost_minor ?? undefined,
      resultPayload: r.result_payload ? JSON.parse(r.result_payload) : undefined,
      compensationTool: r.compensation_tool ?? undefined,
      compensationParams: r.compensation_params ? JSON.parse(r.compensation_params) : undefined
    };
  }

  private mapApproval(r: any): Approval {
    return {
      id: r.id,
      actionId: r.action_id,
      planId: r.plan_id,
      paramsHash: r.params_hash,
      approvalToken: r.approval_token,
      status: r.status as ApprovalStatus,
      expiresAt: r.expires_at,
      decidedAt: r.decided_at ?? undefined,
      createdAt: r.created_at
    };
  }

  // ================= Receipt Operations =================
  public saveReceipt(receipt: ActionReceipt): void {
    const stmt = this.db.prepare(`
      INSERT INTO receipts (
        id, action_id, plan_id, grant_id, tool_name, params_hash,
        spend_minor, currency, booking_ref, executed_at, public_key, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      receipt.receiptId,
      receipt.actionId,
      receipt.planId,
      receipt.grantId,
      receipt.toolName,
      receipt.paramsHash,
      receipt.spendMinor,
      receipt.currency,
      receipt.providerBookingRef,
      receipt.executedAt,
      receipt.gatewayPublicKey,
      receipt.signature
    );
  }

  public getReceipt(receiptId: string): ActionReceipt | null {
    const stmt = this.db.prepare(`SELECT * FROM receipts WHERE id = ?`);
    const row = stmt.get(receiptId);
    return row ? this.mapReceipt(row) : null;
  }

  public getReceiptByActionId(actionId: string): ActionReceipt | null {
    const stmt = this.db.prepare(`SELECT * FROM receipts WHERE action_id = ?`);
    const row = stmt.get(actionId);
    return row ? this.mapReceipt(row) : null;
  }

  public listReceipts(limit: number = 50): ActionReceipt[] {
    const stmt = this.db.prepare(`SELECT * FROM receipts ORDER BY executed_at DESC LIMIT ?`);
    const rows = stmt.all(limit);
    return rows.map((r) => this.mapReceipt(r));
  }

  private mapReceipt(r: any): ActionReceipt {
    return {
      version: "1.0",
      receiptId: r.id,
      actionId: r.action_id,
      planId: r.plan_id,
      grantId: r.grant_id,
      toolName: r.tool_name,
      paramsHash: r.params_hash,
      spendMinor: r.spend_minor,
      currency: r.currency as "USD",
      providerBookingRef: r.booking_ref,
      executedAt: r.executed_at,
      gatewayPublicKey: r.public_key,
      signature: r.signature
    };
  }

  public close(): void {
    this.db.close();
  }
}
