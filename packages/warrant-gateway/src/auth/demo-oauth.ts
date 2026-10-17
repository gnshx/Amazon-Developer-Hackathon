import { Request, Response, Router } from "express";
import crypto, { randomUUID, randomBytes } from "node:crypto";
import { WarrantRepository } from "../storage/db.js";

/**
 * ============================================================================
 * DEMO ONLY: OAuth 2.1 Authorization Server with PKCE & RFC 8707 Resource Indicators
 * ============================================================================
 * 
 * DISCLAIMER:
 * This is a lightweight, simulated OAuth 2.1 authorization server intended
 * strictly for local testing, integration scenarios, and developer evaluation.
 * It is NOT intended for production deployment and does NOT claim or imply
 * official Amazon Alexa+ certification.
 * ============================================================================
 */

export interface DemoAuthCodeRecord {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  userId: string;
  scopes: string[];
  expiresAt: number;
  used: boolean;
}

export function createDemoOAuthRouter(repo: WarrantRepository): Router {
  const router = Router();
  const authCodes = new Map<string, DemoAuthCodeRecord>();

  // 1. OAuth 2.0 / 2.1 Authorization Server Metadata (RFC 8414)
  router.get("/.well-known/oauth-authorization-server", (req: Request, res: Response) => {
    const host = req.get("host") || "localhost:8000";
    const protocol = req.protocol;
    const issuerUrl = `${protocol}://${host}`;

    res.setHeader("Content-Type", "application/json");
    res.json({
      issuer: issuerUrl,
      authorization_endpoint: `${issuerUrl}/oauth/authorize`,
      token_endpoint: `${issuerUrl}/oauth/token`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [
        "hotel:search",
        "hotel:book",
        "train:search",
        "train:book",
        "dining:search",
        "dining:book"
      ],
      service_documentation: "https://github.com/gnshx/Amazon-Developer-Hackathon",
      _disclaimer: "DEMO ONLY: Simulated OAuth 2.1 PKCE server for local testing. Not for production use. Does not represent Alexa+ certification."
    });
  });

  // 2. Authorization Endpoint (RFC 6749 + RFC 7636 PKCE + RFC 8707 Resource Indicators)
  router.get("/oauth/authorize", (req: Request, res: Response) => {
    const {
      response_type,
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      resource,
      state,
      scope,
      user_id
    } = req.query;

    // Check response_type
    if (response_type !== "code") {
      return res.status(400).json({
        error: "unsupported_response_type",
        error_description: "OAuth 2.1 requires response_type=code"
      });
    }

    // Check client_id
    if (!client_id) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameter: client_id"
      });
    }

    // Check redirect_uri
    if (!redirect_uri) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameter: redirect_uri"
      });
    }

    // Check PKCE code_challenge (Mandatory in OAuth 2.1)
    if (!code_challenge) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameter: code_challenge (PKCE is mandatory in OAuth 2.1)"
      });
    }

    // Check PKCE code_challenge_method (OAuth 2.1 mandates S256; plain is disallowed)
    if (code_challenge_method !== "S256") {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "PKCE code_challenge_method must be S256"
      });
    }

    // Check resource parameter (RFC 8707 Resource Indicators for Alexa+ & Warrant)
    if (!resource) {
      return res.status(400).json({
        error: "invalid_target",
        error_description: "Missing required parameter: resource (RFC 8707 target resource is mandatory)"
      });
    }

    const code = `demo_auth_code_${randomBytes(16).toString("hex")}`;
    const scopesList = typeof scope === "string" ? scope.split(" ").filter(Boolean) : ["*"];

    const record: DemoAuthCodeRecord = {
      code,
      clientId: String(client_id),
      redirectUri: String(redirect_uri),
      codeChallenge: String(code_challenge),
      codeChallengeMethod: String(code_challenge_method),
      resource: String(resource),
      userId: typeof user_id === "string" ? user_id : "user_demo_alexa",
      scopes: scopesList,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      used: false
    };

    authCodes.set(code, record);

    // Support JSON response mode for headless testing
    const acceptsJson = req.query.response_mode === "json" || req.headers.accept?.includes("application/json");
    if (acceptsJson) {
      return res.json({
        code,
        state: state ? String(state) : null,
        resource: String(resource),
        _disclaimer: "DEMO ONLY: Demo authorization code issued for local testing."
      });
    }

    try {
      const redirectUrl = new URL(String(redirect_uri));
      redirectUrl.searchParams.set("code", code);
      if (state) {
        redirectUrl.searchParams.set("state", String(state));
      }
      return res.redirect(302, redirectUrl.toString());
    } catch {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Invalid redirect_uri URL format"
      });
    }
  });

  // 3. Token Endpoint (RFC 6749 + RFC 7636 PKCE + RFC 8707)
  router.post("/oauth/token", (req: Request, res: Response) => {
    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      code_verifier,
      resource
    } = req.body;

    if (grant_type !== "authorization_code") {
      return res.status(400).json({
        error: "unsupported_grant_type",
        error_description: "grant_type must be 'authorization_code'"
      });
    }

    if (!code) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameter: code"
      });
    }

    // Require code_verifier
    if (!code_verifier) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing required parameter: code_verifier (PKCE validation is required)"
      });
    }

    // Require resource parameter
    if (!resource) {
      return res.status(400).json({
        error: "invalid_target",
        error_description: "Missing required parameter: resource (RFC 8707 target resource is mandatory)"
      });
    }

    const record = authCodes.get(String(code));
    if (!record) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Unknown or invalid authorization code"
      });
    }

    if (record.used) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Authorization code has already been redeemed"
      });
    }

    if (Date.now() > record.expiresAt) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Authorization code has expired"
      });
    }

    if (redirect_uri && record.redirectUri !== String(redirect_uri)) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "redirect_uri mismatch"
      });
    }

    if (record.resource !== String(resource)) {
      return res.status(400).json({
        error: "invalid_target",
        error_description: "resource does not match the resource requested in authorization"
      });
    }

    // Verify PKCE S256: SHA-256(code_verifier) base64url encoded
    const computedChallenge = crypto
      .createHash("sha256")
      .update(String(code_verifier))
      .digest("base64url");

    if (computedChallenge !== record.codeChallenge) {
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "PKCE verification failed: code_verifier does not match code_challenge"
      });
    }

    // Mark code as used (single-use semantics)
    record.used = true;

    // Create active Grant in repository for this session/user
    const sessionToken = `warrant_demo_oauth_${randomBytes(16).toString("hex")}`;
    const grant = repo.createGrant({
      id: `grant_oauth_${randomUUID().slice(0, 8)}`,
      sessionToken,
      scopes: record.scopes.length > 0 ? record.scopes : ["*"],
      spendCapMinor: 25000, // $250.00 default demo spend cap
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      status: "ACTIVE"
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      access_token: grant.sessionToken,
      token_type: "Bearer",
      expires_in: 86400,
      scope: record.scopes.join(" "),
      resource: record.resource,
      _disclaimer: "DEMO ONLY: Demo OAuth 2.1 token for testing. Not for production use. Does not represent Alexa+ certification."
    });
  });

  return router;
}
