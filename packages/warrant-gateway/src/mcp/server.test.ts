import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGatewayApp } from "./server.js";
import { WarrantRepository } from "../storage/db.js";
import { verifyAuditChain } from "../audit/chain.js";
import express from "express";
import http from "node:http";

describe("Warrant Gateway MCP Streamable HTTP & Admin API Integration", () => {
  let repo: WarrantRepository;
  let server: http.Server;
  let baseUrl: string;
  const sessionToken = "valid_bearer_token_123";
  let activeGrantId: string;

  beforeEach(async () => {
    repo = new WarrantRepository(":memory:");
    const { app } = createGatewayApp({ repo });

    const grant = repo.createGrant({
      id: "grant_test",
      sessionToken,
      scopes: ["*"],
      spendCapMinor: 25000, // $250.00
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });
    activeGrantId = grant.id;

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    repo.close();
  });

  const mcpPost = async (body: any, token: string = sessionToken) => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    return { status: res.status, json: await res.json() };
  };

  it("GET /mcp returns Streamable HTTP capabilities and protocolVersion 2025-11-25", async () => {
    const res = await fetch(`${baseUrl}/mcp`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.protocolVersion).toBe("2025-11-25");
    expect(body.name).toBe("warrant-gateway");
  });

  it("POST /mcp handles JSON-RPC initialize handshake negotiating protocolVersion 2025-11-25", async () => {
    const res = await mcpPost({
      jsonrpc: "2.0",
      id: "init_handshake_01",
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "alexa-client", version: "1.0.0" }
      }
    });

    expect(res.status).toBe(200);
    expect(res.json.result.protocolVersion).toBe("2025-11-25");
    expect(res.json.result.serverInfo.name).toBe("warrant-gateway");
    expect(res.json.result.serverInfo.version).toBe("1.0.0");
    expect(res.json.result.capabilities.tools).toBeDefined();
  });

  it("GET /.well-known/oauth-protected-resource returns RFC 9728 Protected Resource Metadata", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resource).toContain("/mcp");
    expect(body.authorization_servers).toContain("https://auth.amazon.com/oauth2/v2");
    expect(body.bearer_methods_supported).toContain("header");
    expect(body.scopes_supported).toBeDefined();
  });

  it("POST /mcp requires valid Bearer Token (401 with WWW-Authenticate header)", async () => {
    // Missing header
    const res1 = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    expect(res1.status).toBe(401);
    expect(res1.headers.get("www-authenticate")).toContain("oauth-protected-resource");
    const json1 = await res1.json();
    expect(json1.error.code).toBe(-32001);

    // Invalid token
    const res2 = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer unknown_token_999"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })
    });
    expect(res2.status).toBe(401);
    expect(res2.headers.get("www-authenticate")).toContain("oauth-protected-resource");
  });

  it("tools/list returns available MCP tools with 2025-11-25 annotations", async () => {
    const res = await mcpPost({ jsonrpc: "2.0", id: 5, method: "tools/list" });
    expect(res.status).toBe(200);
    const tools = res.json.result.tools;
    expect(tools.length).toBeGreaterThanOrEqual(5);

    const searchTool = tools.find((t: any) => t.name === "search_hotels");
    expect(searchTool.annotations.readOnly).toBe(true);
    expect(searchTool.annotations.destructive).toBe(false);
    expect(searchTool.annotations.riskTier).toBe("T0");

    const execTool = tools.find((t: any) => t.name === "execute_plan");
    expect(execTool.annotations.destructive).toBe(true);
    expect(execTool.annotations.riskTier).toBe("T2");
  });

  it("POST /mcp rejects calls on expired or revoked grants (Invariant I6)", async () => {
    // Revoke grant
    repo.revokeGrant(activeGrantId);
    const resRevoked = await mcpPost({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    expect(resRevoked.status).toBe(403);
    expect(resRevoked.json.error.code).toBe(-32002);

    // Expired grant
    const expiredGrant = repo.createGrant({
      id: "grant_exp",
      sessionToken: "tok_exp",
      scopes: ["*"],
      spendCapMinor: 10000,
      expiresAt: new Date(Date.now() - 5000).toISOString(),
      status: "ACTIVE"
    });

    const resExpired = await mcpPost({ jsonrpc: "2.0", id: 4, method: "tools/list" }, "tok_exp");
    expect(resExpired.status).toBe(403);
    expect(resExpired.json.error.code).toBe(-32003);
  });

  it("tools/call: search_hotels returns options and natural spoken_summary (<= 300 chars)", async () => {
    const res = await mcpPost({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "search_hotels",
        arguments: { destination: "Seattle" }
      }
    });

    expect(res.status).toBe(200);
    const result = res.json.result;
    expect(result.spoken_summary).toBeDefined();
    expect(result.spoken_summary.length).toBeLessThanOrEqual(300);
    expect(result.spoken_summary).toContain("Seattle");
  });

  it("tools/call: propose_plan blocks plans exceeding spend cap (Invariant I2)", async () => {
    const res = await mcpPost({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "propose_plan",
        arguments: {
          steps: [
            {
              toolName: "book_hotel",
              params: { hotel_id: "luxury", price: 30000 },
              estimatedCostMinor: 30000 // $300.00 > $250.00 cap
            }
          ]
        }
      }
    });

    expect(res.status).toBe(400);
    expect(res.json.error.message.toLowerCase()).toContain("exceeds spend cap");
  });

  it("end-to-end happy path: propose plan -> phone approval -> execute plan -> audit verify", async () => {
    // 1. Propose plan with T1 train ($45) and T2 hotel ($120)
    const proposeRes = await mcpPost({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "propose_plan",
        arguments: {
          steps: [
            {
              toolName: "book_train",
              params: { origin: "Portland", destination: "Seattle", price: 4500 },
              estimatedCostMinor: 4500
            },
            {
              toolName: "book_hotel",
              params: { hotel_id: "grand_plaza", nights: 2, price: 12000 },
              estimatedCostMinor: 12000
            }
          ]
        }
      }
    });

    expect(proposeRes.status).toBe(200);
    const planData = JSON.parse(proposeRes.json.result.content[0].text);
    expect(planData.planId).toBeDefined();
    expect(planData.pendingApprovals.length).toBe(1);

    const pendingApproval = planData.pendingApprovals[0];
    expect(pendingApproval.toolName).toBe("book_hotel");

    // 2. User approves out-of-band via Admin REST API
    const approvalRes = await fetch(`${baseUrl}/admin/approvals/${pendingApproval.approvalId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "APPROVED" })
    });
    expect(approvalRes.status).toBe(200);
    const approvedJson = await approvalRes.json();
    const token = approvedJson.approval.approvalToken;
    expect(token).toBeDefined();

    // 3. Agent executes plan providing approval token
    const executeRes = await mcpPost({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "execute_plan",
        arguments: {
          planId: planData.planId,
          idempotencyKey: "idem_demo_run_1",
          approvals: {
            book_hotel: token
          }
        }
      }
    });

    expect(executeRes.status).toBe(200);
    const execData = JSON.parse(executeRes.json.result.content[0].text);
    expect(execData.state).toBe("COMPLETED");
    expect(execData.confirmedSpendMinor).toBe(16500); // 4500 + 12000 = $165.00

    // 4. Repeated submission with same idempotency key returns cached response (Invariant I1)
    const duplicateRes = await mcpPost({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "execute_plan",
        arguments: {
          planId: planData.planId,
          idempotencyKey: "idem_demo_run_1",
          approvals: { book_hotel: token }
        }
      }
    });
    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.json.result.cached).toBe(true);

    // 5. Verify Cryptographic Audit Chain from genesis (Invariant I7)
    const verifyRes = await fetch(`${baseUrl}/admin/audit/verify`);
    const verifyData = await verifyRes.json();
    expect(verifyData.valid).toBe(true);
    expect(verifyData.eventCount).toBeGreaterThan(0);
  });
});
