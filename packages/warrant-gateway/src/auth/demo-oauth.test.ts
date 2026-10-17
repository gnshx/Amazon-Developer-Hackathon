import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createGatewayApp } from "../mcp/server.js";
import { WarrantRepository } from "../storage/db.js";
import crypto from "node:crypto";
import http from "node:http";

describe("T2: Alexa+ Authentication Behaviour & Demo OAuth 2.1 Server", () => {
  let repo: WarrantRepository;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    repo = new WarrantRepository(":memory:");
    const { app } = createGatewayApp({ repo });

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

  // Acceptance Check 1: No token gives 401; a valid token works
  it("Unauthenticated request to MCP endpoint returns 401; valid token works", async () => {
    // 1. No token gives 401
    const resNoToken = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "auth_test_1", method: "tools/list" })
    });
    expect(resNoToken.status).toBe(401);
    const jsonNoToken = await resNoToken.json();
    expect(jsonNoToken.error.code).toBe(-32001);

    // 2. Valid token works
    const grant = repo.createGrant({
      id: "grant_valid_01",
      sessionToken: "valid_session_token_xyz",
      scopes: ["*"],
      spendCapMinor: 50000,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "ACTIVE"
    });

    const resValid = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${grant.sessionToken}`
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "auth_test_2", method: "tools/list" })
    });
    expect(resValid.status).toBe(200);
    const jsonValid = await resValid.json();
    expect(jsonValid.result.tools).toBeDefined();
  });

  // Acceptance Check 2: PRM JSON has resource, authorization_servers, scopes_supported
  it("RFC 9728 Protected Resource Metadata (PRM) contains resource, authorization_servers, scopes_supported", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    const prm = await res.json();

    expect(prm.resource).toBe(`${baseUrl}/mcp`);
    expect(Array.isArray(prm.authorization_servers)).toBe(true);
    expect(prm.authorization_servers).toContain(baseUrl);
    expect(prm.authorization_servers).toContain("https://auth.amazon.com/oauth2/v2");
    expect(Array.isArray(prm.scopes_supported)).toBe(true);
    expect(prm.scopes_supported).toContain("hotel:search");
    expect(prm.bearer_methods_supported).toEqual(["header"]);
  });

  // Acceptance Check 3: A token in the query string is rejected
  it("Tokens in query parameters are strictly rejected (Alexa+ header-only token policy)", async () => {
    // POST /mcp with query token
    const resPostQuery = await fetch(`${baseUrl}/mcp?token=some_leaked_query_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/list" })
    });
    expect(resPostQuery.status).toBe(400);
    const jsonPostQuery = await resPostQuery.json();
    expect(jsonPostQuery.error.message).toContain("Bearer tokens in query parameters are strictly forbidden");

    // POST /mcp with access_token in query
    const resPostAccess = await fetch(`${baseUrl}/mcp?access_token=another_leaked_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/list" })
    });
    expect(resPostAccess.status).toBe(400);

    // GET /mcp with query token
    const resGetQuery = await fetch(`${baseUrl}/mcp?token=forbidden_query_token`);
    expect(resGetQuery.status).toBe(400);
    const jsonGetQuery = await resGetQuery.json();
    expect(jsonGetQuery.message).toContain("Bearer tokens in query parameters are strictly forbidden");
  });

  // Acceptance Check 4: Authorization request without PKCE S256 or resource is rejected
  it("OAuth 2.1 Authorization endpoint rejects requests without PKCE S256 or resource", async () => {
    const targetResource = `${baseUrl}/mcp`;
    const codeVerifier = "demo_verifier_0123456789_abcdefghijklmnopqrstuvwxyz";
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

    // Missing code_challenge (PKCE required)
    const resNoPKCE = await fetch(
      `${baseUrl}/oauth/authorize?response_type=code&client_id=alexa-client&redirect_uri=http://localhost:3000/callback&resource=${encodeURIComponent(targetResource)}`
    );
    expect(resNoPKCE.status).toBe(400);
    const jsonNoPKCE = await resNoPKCE.json();
    expect(jsonNoPKCE.error).toBe("invalid_request");
    expect(jsonNoPKCE.error_description).toContain("code_challenge");

    // Plain PKCE is rejected (S256 required)
    const resPlainPKCE = await fetch(
      `${baseUrl}/oauth/authorize?response_type=code&client_id=alexa-client&redirect_uri=http://localhost:3000/callback&code_challenge=plainval&code_challenge_method=plain&resource=${encodeURIComponent(targetResource)}`
    );
    expect(resPlainPKCE.status).toBe(400);
    const jsonPlainPKCE = await resPlainPKCE.json();
    expect(jsonPlainPKCE.error).toBe("invalid_request");
    expect(jsonPlainPKCE.error_description).toContain("must be S256");

    // Missing resource parameter
    const resNoResource = await fetch(
      `${baseUrl}/oauth/authorize?response_type=code&client_id=alexa-client&redirect_uri=http://localhost:3000/callback&code_challenge=${codeChallenge}&code_challenge_method=S256`
    );
    expect(resNoResource.status).toBe(400);
    const jsonNoResource = await resNoResource.json();
    expect(jsonNoResource.error).toBe("invalid_target");
    expect(jsonNoResource.error_description).toContain("resource");
  });

  // Acceptance Check 5: Token request without code_verifier or resource is rejected, and valid flow issues functional token
  it("OAuth 2.1 Token endpoint rejects requests without code_verifier or resource, and succeeds on valid flow", async () => {
    const targetResource = `${baseUrl}/mcp`;
    const codeVerifier = "secret_verifier_value_for_pkce_0123456789";
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

    // 1. Perform valid authorization request
    const authRes = await fetch(
      `${baseUrl}/oauth/authorize?response_type=code&client_id=alexa-client&redirect_uri=http://localhost:3000/callback&code_challenge=${codeChallenge}&code_challenge_method=S256&resource=${encodeURIComponent(targetResource)}&response_mode=json`
    );
    expect(authRes.status).toBe(200);
    const authJson = await authRes.json();
    const authCode = authJson.code;
    expect(authCode).toBeDefined();

    // 2. Token request missing code_verifier
    const resNoVerifier = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: authCode,
        client_id: "alexa-client",
        redirect_uri: "http://localhost:3000/callback",
        resource: targetResource
      })
    });
    expect(resNoVerifier.status).toBe(400);
    const jsonNoVerifier = await resNoVerifier.json();
    expect(jsonNoVerifier.error).toBe("invalid_request");
    expect(jsonNoVerifier.error_description).toContain("code_verifier");

    // 3. Token request missing resource
    const resNoResource = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: authCode,
        client_id: "alexa-client",
        redirect_uri: "http://localhost:3000/callback",
        code_verifier: codeVerifier
      })
    });
    expect(resNoResource.status).toBe(400);
    const jsonNoResource = await resNoResource.json();
    expect(jsonNoResource.error).toBe("invalid_target");
    expect(jsonNoResource.error_description).toContain("resource");

    // 4. Token request with invalid code_verifier
    const resBadVerifier = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: authCode,
        client_id: "alexa-client",
        redirect_uri: "http://localhost:3000/callback",
        code_verifier: "wrong_code_verifier_here",
        resource: targetResource
      })
    });
    expect(resBadVerifier.status).toBe(400);
    const jsonBadVerifier = await resBadVerifier.json();
    expect(jsonBadVerifier.error).toBe("invalid_grant");
    expect(jsonBadVerifier.error_description).toContain("PKCE verification failed");

    // 5. Valid token request with valid code_verifier & resource
    const resValidToken = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: authCode,
        client_id: "alexa-client",
        redirect_uri: "http://localhost:3000/callback",
        code_verifier: codeVerifier,
        resource: targetResource
      })
    });
    expect(resValidToken.status).toBe(200);
    const tokenJson = await resValidToken.json();
    expect(tokenJson.access_token).toBeDefined();
    expect(tokenJson.token_type).toBe("Bearer");
    expect(tokenJson._disclaimer).toContain("DEMO ONLY");

    // 6. Access token works immediately against MCP endpoint!
    const mcpRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenJson.access_token}`
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "oauth_mcp_call", method: "tools/list" })
    });
    expect(mcpRes.status).toBe(200);
    const mcpJson = await mcpRes.json();
    expect(mcpJson.result.tools).toBeDefined();
  });

  // Acceptance Check 6: Demo authorization server metadata is served at /.well-known/oauth-authorization-server
  it("Serves demo authorization server metadata with S256 and demo labels", async () => {
    const res = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
    expect(res.status).toBe(200);
    const meta = await res.json();

    expect(meta.issuer).toBe(baseUrl);
    expect(meta.authorization_endpoint).toBe(`${baseUrl}/oauth/authorize`);
    expect(meta.token_endpoint).toBe(`${baseUrl}/oauth/token`);
    expect(meta.code_challenge_methods_supported).toEqual(["S256"]);
    expect(meta._disclaimer).toContain("DEMO ONLY");
  });
});
