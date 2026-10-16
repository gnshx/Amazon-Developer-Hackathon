/**
 * Client for communicating with the Warrant Gateway over MCP Streamable HTTP and Admin REST API.
 */

export interface ToolCallResult {
  data: any;
  spoken_summary: string;
  cached?: boolean;
}

export class WarrantMcpClient {
  private gatewayUrl: string;
  private adminUrl: string;
  private sessionToken: string;

  constructor(
    gatewayUrl: string = process.env.GATEWAY_URL || "http://localhost:8000/mcp",
    adminUrl: string = process.env.ADMIN_URL || "http://localhost:8000/admin",
    sessionToken: string = ""
  ) {
    this.gatewayUrl = gatewayUrl;
    this.adminUrl = adminUrl;
    this.sessionToken = sessionToken;
  }

  public setSessionToken(token: string) {
    this.sessionToken = token;
  }

  public getSessionToken(): string {
    return this.sessionToken;
  }

  /**
   * Calls an MCP tool over Streamable HTTP JSON-RPC 2.0.
   */
  public async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    const res = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.sessionToken ? { Authorization: `Bearer ${this.sessionToken}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error?.message || `Gateway returned HTTP ${res.status}`);
    }

    const contentText = json.result?.content?.[0]?.text;
    const data = contentText ? JSON.parse(contentText) : json.result;

    return {
      data,
      spoken_summary: json.result?.spoken_summary || "",
      cached: json.result?.cached
    };
  }

  public async listTools(): Promise<any[]> {
    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/list"
    };

    const res = await fetch(this.gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.sessionToken ? { Authorization: `Bearer ${this.sessionToken}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    return json.result?.tools || [];
  }

  // Admin APIs (out-of-band phone channel)
  public async createGrant(scopes: string[], spendCapMinor: number, expiresAt: string): Promise<any> {
    const res = await fetch(`${this.adminUrl}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes, spendCapMinor, expiresAt })
    });
    const json = await res.json();
    if (json.grant?.sessionToken) {
      this.setSessionToken(json.grant.sessionToken);
    }
    return json;
  }

  public async getPendingApprovals(): Promise<any[]> {
    const res = await fetch(`${this.adminUrl}/approvals/pending`);
    const json = await res.json();
    return json.approvals || [];
  }

  public async decideApproval(id: string, decision: "APPROVED" | "REJECTED"): Promise<any> {
    const res = await fetch(`${this.adminUrl}/approvals/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision })
    });
    return await res.json();
  }

  public async getAuditTimeline(): Promise<any[]> {
    const res = await fetch(`${this.adminUrl}/audit/timeline`);
    const json = await res.json();
    return json.events || [];
  }

  public async verifyAuditChain(): Promise<{ valid: boolean; eventCount: number; spoken_summary: string; tipHash?: string }> {
    const res = await fetch(`${this.adminUrl}/audit/verify`);
    return await res.json();
  }
}
