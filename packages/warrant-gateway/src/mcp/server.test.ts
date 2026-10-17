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

  it("Saving limits in Admin API updates grant and is returned by GET /admin/grants/:id", async () => {
    const updateRes = await fetch(`${baseUrl}/admin/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "grant_custom_limits_test",
        scopes: ["hotels", "trains", "dining"],
        spendCapMinor: 75000, // $750.00
        expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        userId: "user_household_primary"
      })
    });
    expect(updateRes.status).toBe(201);
    const updateJson = await updateRes.json();
    expect(updateJson.grant.spendCapMinor).toBe(75000);

    const getRes = await fetch(`${baseUrl}/admin/grants/grant_custom_limits_test`);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.grant.spendCapMinor).toBe(75000);
    expect(getJson.grant.scopes).toContain("dining");
  });

  it("Bad Origin header returns 403 Forbidden; allowed Origin succeeds", async () => {
    // Bad / untrusted origin
    const badRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        Origin: "https://malicious-attacker.com"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bad_origin_01",
        method: "tools/list"
      })
    });
    expect(badRes.status).toBe(403);
    const badJson = await badRes.json();
    expect(badJson.error.code).toBe(-32009);
    expect(badJson.error.message).toContain("Origin");

    // Allowed origin (e.g. Alexa domain or localhost)
    const goodRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        Origin: "https://alexa.amazon.com"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "good_origin_01",
        method: "tools/list"
      })
    });
    expect(goodRes.status).toBe(200);
  });

  it("MCP-Protocol-Version header validation and negotiation", async () => {
    // Unsupported protocol version -> 400 Bad Request
    const unsuppRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        "MCP-Protocol-Version": "1999-01-01"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "proto_unsupp_01",
        method: "tools/list"
      })
    });
    expect(unsuppRes.status).toBe(400);
    const unsuppJson = await unsuppRes.json();
    expect(unsuppJson.error.code).toBe(-32602);
    expect(unsuppJson.error.message).toContain("Unsupported MCP-Protocol-Version");

    // Supported protocol version -> 200 OK with header
    const suppRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
        "MCP-Protocol-Version": "2025-11-25"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "proto_supp_01",
        method: "tools/list"
      })
    });
    expect(suppRes.status).toBe(200);
    expect(suppRes.headers.get("mcp-protocol-version")).toBe("2025-11-25");

    // Missing header -> succeeds and returns header
    const defaultRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "proto_def_01",
        method: "tools/list"
      })
    });
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.headers.get("mcp-protocol-version")).toBe("2025-11-25");
  });

  it("MCP initialize negotiates protocolVersion 2025-11-25", async () => {
    const res = await mcpPost({
      jsonrpc: "2.0",
      id: "init_neg_01",
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {}
      }
    });
    expect(res.status).toBe(200);
    expect(res.json.result.protocolVersion).toBe("2025-11-25");
    expect(res.json.result.serverInfo.name).toBe("warrant-gateway");
  });

  it("MCP tools/list includes titles and 2025-11-25 annotations on every tool", async () => {
    const res = await mcpPost({
      jsonrpc: "2.0",
      id: "tools_meta_01",
      method: "tools/list"
    });
    expect(res.status).toBe(200);
    const tools: any[] = res.json.result.tools;
    expect(tools.length).toBeGreaterThanOrEqual(8);

    for (const tool of tools) {
      expect(tool.title).toBeDefined();
      expect(typeof tool.title).toBe("string");
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.annotations).toBeDefined();
      expect(typeof tool.annotations.readOnlyHint).toBe("boolean");
      expect(typeof tool.annotations.destructiveHint).toBe("boolean");
      expect(typeof tool.annotations.idempotentHint).toBe("boolean");
      expect(typeof tool.annotations.openWorldHint).toBe("boolean");
    }

    // Explicit check on tool safety annotations per T5 spec
    const hotel = tools.find((t) => t.name === "search_hotels");
    expect(hotel.annotations.readOnlyHint).toBe(true);
    expect(hotel.annotations.destructiveHint).toBe(false);

    const propose = tools.find((t) => t.name === "propose_plan");
    expect(propose.annotations.readOnlyHint).toBe(true);
    expect(propose.annotations.destructiveHint).toBe(false);

    const exec = tools.find((t) => t.name === "execute_plan");
    expect(exec.annotations.readOnlyHint).toBe(false);
    expect(exec.annotations.destructiveHint).toBe(true);
    expect(exec.annotations.idempotentHint).toBe(true);

    const status = tools.find((t) => t.name === "get_plan_status");
    expect(status.annotations.readOnlyHint).toBe(true);
    expect(status.annotations.destructiveHint).toBe(false);

    const cancel = tools.find((t) => t.name === "request_cancellation");
    expect(cancel.annotations.readOnlyHint).toBe(false);
    expect(cancel.annotations.destructiveHint).toBe(true);
    expect(cancel.annotations.idempotentHint).toBe(true);
  });

  it("Spoken summaries never exceed 300 characters across all tools", async () => {
    // 1. search_hotels
    const hotelRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_hotel",
      method: "tools/call",
      params: { name: "search_hotels", arguments: { destination: "Seattle" } }
    });
    const hotelSummary = hotelRes.json.result.spoken_summary;
    expect(hotelSummary).toBeDefined();
    expect(hotelSummary.length).toBeLessThanOrEqual(300);

    // 2. search_trains
    const trainRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_train",
      method: "tools/call",
      params: { name: "search_trains", arguments: { origin: "Portland", destination: "Seattle" } }
    });
    const trainSummary = trainRes.json.result.spoken_summary;
    expect(trainSummary).toBeDefined();
    expect(trainSummary.length).toBeLessThanOrEqual(300);

    // 3. search_restaurants
    const restRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_rest",
      method: "tools/call",
      params: { name: "search_restaurants", arguments: { city: "Seattle" } }
    });
    const restSummary = restRes.json.result.spoken_summary;
    expect(restSummary).toBeDefined();
    expect(restSummary.length).toBeLessThanOrEqual(300);

    // 4. propose_plan
    const propRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_prop",
      method: "tools/call",
      params: {
        name: "propose_plan",
        arguments: {
          steps: [
            { toolName: "book_hotel", params: { hotelId: "h1", nights: 1 }, estimatedCostMinor: 9500 }
          ]
        }
      }
    });
    const propSummary = propRes.json.result.spoken_summary;
    expect(propSummary).toBeDefined();
    expect(propSummary.length).toBeLessThanOrEqual(300);
    const planId = JSON.parse(propRes.json.result.content[0].text).planId;

    // 5. execute_plan (with undoWindow)
    const execRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_exec",
      method: "tools/call",
      params: {
        name: "execute_plan",
        arguments: {
          planId,
          idempotencyKey: "idem_sum_01",
          undoWindowSeconds: 10
        }
      }
    });
    const execSummary = execRes.json.result.spoken_summary;
    expect(execSummary).toBeDefined();
    expect(execSummary.length).toBeLessThanOrEqual(300);

    // 6. get_plan_status
    const statusRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_status",
      method: "tools/call",
      params: { name: "get_plan_status", arguments: { planId } }
    });
    const statusSummary = statusRes.json.result.spoken_summary;
    expect(statusSummary).toBeDefined();
    expect(statusSummary.length).toBeLessThanOrEqual(300);

    // 7. undo_plan
    const undoRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_undo",
      method: "tools/call",
      params: { name: "undo_plan", arguments: { planId } }
    });
    const undoSummary = undoRes.json.result.spoken_summary;
    expect(undoSummary).toBeDefined();
    expect(undoSummary.length).toBeLessThanOrEqual(300);

    // 8. request_cancellation
    const cancelRes = await mcpPost({
      jsonrpc: "2.0",
      id: "sum_cancel",
      method: "tools/call",
      params: {
        name: "request_cancellation",
        arguments: { bookingRef: "HTL-999", idempotencyKey: "idem_cancel_01" }
      }
    });
    const cancelSummary = cancelRes.json.result.spoken_summary;
    expect(cancelSummary).toBeDefined();
    expect(cancelSummary.length).toBeLessThanOrEqual(300);
  });
});

