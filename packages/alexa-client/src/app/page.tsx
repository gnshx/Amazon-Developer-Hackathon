"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Smartphone,
  Terminal,
  Mic,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Lock,
  Layers,
  ArrowRight
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  spokenSummary?: string;
  planId?: string;
}

export default function AlexaClientDashboard() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_welcome",
      sender: "agent",
      text: "Hello! I'm your simulated Alexa+ assistant powered by Amazon Bedrock and protected by Warrant Trust Gateway. How can I assist you with your travels today?",
      timestamp: new Date().toLocaleTimeString(),
      spokenSummary: "Hello! I'm your Alexa assistant protected by Warrant Trust Gateway."
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Grant & Session State
  const [grant, setGrant] = useState({
    id: "grant_demo",
    spendCapMinor: 25000, // $250.00
    spentMinor: 0,
    scopes: ["hotel:*", "train:*", "dining:*"],
    token: "session_token_demo"
  });

  // Approvals & Audit State
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [toolTraces, setToolTraces] = useState<any[]>([
    {
      id: "trace_init",
      tool: "gateway_handshake",
      timestamp: new Date().toLocaleTimeString(),
      status: "CONNECTED",
      summary: "Connected to Warrant Gateway MCP Streamable HTTP (2025-11-25)"
    }
  ]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"trace" | "audit">("trace");

  // Send message / invoke agent
  const handleSendMessage = async (textToSend: string) => {
    const prompt = textToSend || inputText;
    if (!prompt.trim()) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      sender: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);
    setIsSpeaking(true);

    // Add trace
    addTrace("bedrock_agent_loop", { prompt }, "RUNNING", "Agent reasoning loop dispatched");

    setTimeout(() => {
      // Simulate agent response logic and tool proposal
      if (prompt.toLowerCase().includes("trip") || prompt.toLowerCase().includes("seattle")) {
        addTrace("search_trains", { origin: "Portland", destination: "Seattle" }, "SUCCEEDED", "Found 2 trains starting at $45.00");
        addTrace("search_hotels", { destination: "Seattle", nights: 2 }, "SUCCEEDED", "Found Grand Plaza Hotel ($120.00)");
        addTrace("propose_plan", { steps: 2, totalMinor: 16500 }, "T2_APPROVAL_REQUIRED", "Created pending phone approval for hotel booking");

        const planId = `plan_${Math.random().toString(36).substring(2, 9)}`;
        const approvalItem = {
          id: `apr_${Math.random().toString(36).substring(2, 9)}`,
          actionId: "act_hotel_01",
          planId,
          toolName: "book_hotel",
          params: { hotel_id: "grand_plaza", nights: 2, price: 12000 },
          paramsHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          estimatedCostMinor: 12000,
          status: "PENDING"
        };

        setPendingApprovals([approvalItem]);

        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: `I've planned your weekend trip from Portland to Seattle: Amtrak train ($45.00) and Grand Plaza Hotel ($120.00) for $165.00 total. The hotel booking requires your approval on your phone.`,
          timestamp: new Date().toLocaleTimeString(),
          spokenSummary: "I found a train and hotel for $165.00 total. Please confirm the hotel booking on your phone.",
          planId
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: `I can help you search hotels, trains, and dining options, or propose a trip within your $250.00 budget.`,
          timestamp: new Date().toLocaleTimeString(),
          spokenSummary: "I can help search or propose a safe trip within your budget."
        };
        setMessages((prev) => [...prev, agentMsg]);
      }

      setIsLoading(false);
      setTimeout(() => setIsSpeaking(false), 2000);
    }, 1200);
  };

  const addTrace = (tool: string, args: any, status: string, summary: string) => {
    setToolTraces((prev) => [
      {
        id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        tool,
        args,
        status,
        summary,
        timestamp: new Date().toLocaleTimeString()
      },
      ...prev
    ]);
  };

  // User decides approval on phone
  const handleApprove = (approvalId: string) => {
    setPendingApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    addTrace("admin_approval_granted", { approvalId }, "APPROVED", "Approval token minted and bound to RFC 8785 canonical hash");

    // Execute plan automatically
    setTimeout(() => {
      addTrace("execute_plan", { approvalToken: "appr_98a72b..." }, "EXECUTING", "Dispatched to Saga Orchestrator over MCP");
      setGrant((prev) => ({ ...prev, spentMinor: prev.spentMinor + 16500 }));

      // Add to audit trail
      setAuditEvents((prev) => [
        {
          seq: prev.length + 1,
          type: "ACTION_SUCCEEDED",
          refId: "act_hotel_01",
          hash: "3a8f...91c2",
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);

      const successMsg: Message = {
        id: `a_${Date.now()}`,
        sender: "agent",
        text: "Your hotel and train tickets have been booked and confirmed! Total spend was $165.00.",
        timestamp: new Date().toLocaleTimeString(),
        spokenSummary: "Your trip is booked and confirmed! Total charge was $165.00."
      };
      setMessages((prev) => [...prev, successMsg]);
    }, 800);
  };

  const handleVerifyAudit = () => {
    setVerificationResult({
      valid: true,
      eventCount: auditEvents.length + 4,
      genesisHash: "0000000000000000000000000000000000000000000000000000000000000000",
      tipHash: "7d8f9a2e4b1c8a3f9e2d1c4b7a9f8e2d1c4b7a9f8e2d1c4b7a9f8e2d1c4b7a9f",
      spoken_summary: "Audit chain verified successfully from genesis across all recorded events."
    });
  };

  return (
    <div className="app-container">
      {/* COLUMN 1: SIMULATED ALEXA+ CLIENT */}
      <div className="glass-panel chat-container">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
              <h1 style={{ fontSize: "16px", fontWeight: "600", letterSpacing: "-0.01em" }}>Simulated Alexa+ Client</h1>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Connected to Warrant Gateway (MCP 2025-11-25) & Bedrock Converse
            </p>
          </div>

          {isSpeaking && (
            <div className="audio-visualizer">
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
            </div>
          )}
        </div>

        {/* Grant Cap Banner */}
        <div style={{ background: "rgba(56, 189, 248, 0.06)", padding: "10px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
          <span>Grant Cap: <strong>${(grant.spendCapMinor / 100).toFixed(2)}</strong></span>
          <span>Spent: <strong style={{ color: "#38bdf8" }}>${(grant.spentMinor / 100).toFixed(2)}</strong></span>
          <span>Remaining: <strong style={{ color: "#10b981" }}>${((grant.spendCapMinor - grant.spentMinor) / 100).toFixed(2)}</strong></span>
        </div>

        {/* Message Stream */}
        <div className="messages-list">
          {messages.map((m) => (
            <div key={m.id} className={`message-bubble ${m.sender === "user" ? "message-user" : "message-agent"}`}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px", opacity: 0.8 }}>
                <span>{m.sender === "user" ? "You (Voice Input)" : "Alexa+ (Bedrock)"}</span>
                <span>{m.timestamp}</span>
              </div>
              <p>{m.text}</p>
              {m.spokenSummary && (
                <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "12px", color: "var(--accent-cyan)", fontStyle: "italic" }}>
                  🔊 &ldquo;{m.spokenSummary}&rdquo;
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="message-bubble message-agent" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <RefreshCw size={14} className="animate-spin" />
              <span>Evaluating grant policies and querying tools...</span>
            </div>
          )}
        </div>

        {/* Quick Demo Prompts */}
        <div style={{ padding: "8px 16px", display: "flex", gap: "8px", overflowX: "auto", borderTop: "1px solid var(--border-color)" }}>
          <button
            onClick={() => handleSendMessage("Book a weekend trip to Seattle with train and hotel under $200")}
            style={{ fontSize: "11px", padding: "6px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "#f8fafc", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ✈️ Happy Path ($165 Trip)
          </button>
          <button
            onClick={() => handleSendMessage("Simulate train decline mid-saga rollback")}
            style={{ fontSize: "11px", padding: "6px 10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#fca5a5", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ⚡ Train Decline (Rollback I4)
          </button>
        </div>

        {/* Chat Input */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-color)", display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputText)}
            placeholder="Speak or type a travel command..."
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-color)", borderRadius: "8px", padding: "10px 14px", color: "#fff", outline: "none" }}
          />
          <button
            onClick={() => handleSendMessage(inputText)}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* COLUMN 2: PHONE APPROVAL PORTAL */}
      <div className="phone-frame">
        <div className="phone-speaker" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Smartphone size={16} color="#38bdf8" />
            <h2 style={{ fontSize: "14px", fontWeight: "600" }}>Household Phone</h2>
          </div>
          <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.1)", padding: "2px 8px", borderRadius: "10px" }}>
            Admin API (Out-of-band)
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {pendingApprovals.length === 0 ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
              <ShieldCheck size={36} style={{ marginBottom: "12px", opacity: 0.5 }} />
              <p style={{ fontSize: "13px", fontWeight: "500" }}>No Pending Approvals</p>
              <p style={{ fontSize: "11px", marginTop: "4px" }}>
                High-risk commitments ($T_2$) will appear here for cryptographic confirmation.
              </p>
            </div>
          ) : (
            pendingApprovals.map((appr) => (
              <div key={appr.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245, 158, 11, 0.4)", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", background: "#f59e0b", color: "#000", fontWeight: "700", padding: "2px 6px", borderRadius: "4px" }}>
                    T2 ACTION CONFIRMATION
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{appr.toolName}</span>
                </div>

                <p style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
                  Book Grand Plaza Hotel (${(appr.estimatedCostMinor / 100).toFixed(2)})
                </p>

                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
                  <p>Destination: Seattle (2 Nights)</p>
                  <p style={{ marginTop: "4px" }}><strong>RFC 8785 Canonical Hash:</strong></p>
                  <div className="hash-badge" style={{ marginTop: "2px" }}>
                    {appr.paramsHash}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    onClick={() => handleApprove(appr.id)}
                    style={{ background: "#10b981", color: "#fff", border: "none", padding: "8px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => setPendingApprovals((prev) => prev.filter((a) => a.id !== appr.id))}
                    style={{ background: "rgba(244, 63, 94, 0.2)", color: "#f43f5e", border: "1px solid #f43f5e", padding: "8px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px", fontSize: "10px", color: "var(--text-dim)", textAlign: "center" }}>
          🔒 Invariant $I_3$: Modifying parameters invalidates the token hash.
        </div>
      </div>

      {/* COLUMN 3: MCP TRACE & AUDIT TIMELINE */}
      <div className="glass-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)" }}>
          <button
            onClick={() => setActiveTab("trace")}
            style={{ flex: 1, padding: "12px", background: activeTab === "trace" ? "rgba(255,255,255,0.06)" : "transparent", border: "none", color: activeTab === "trace" ? "#38bdf8" : "var(--text-muted)", fontWeight: "600", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          >
            <Terminal size={14} /> MCP Tool Trace
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            style={{ flex: 1, padding: "12px", background: activeTab === "audit" ? "rgba(255,255,255,0.06)" : "transparent", border: "none", color: activeTab === "audit" ? "#38bdf8" : "var(--text-muted)", fontWeight: "600", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          >
            <Layers size={14} /> Audit Ledger ($I_7$)
          </button>
        </div>

        <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
          {activeTab === "trace" ? (
            <div className="trace-log">
              {toolTraces.map((t) => (
                <div key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-cyan)", fontSize: "11px" }}>
                    <span>{t.tool}</span>
                    <span>{t.timestamp}</span>
                  </div>
                  <div style={{ color: "#fff", fontSize: "12px", marginTop: "2px" }}>{t.summary}</div>
                  {t.args && (
                    <div style={{ color: "var(--text-dim)", fontSize: "11px", marginTop: "2px" }}>
                      Args: {JSON.stringify(t.args)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: "600" }}>SHA-256 Chained Events</span>
                <button
                  onClick={handleVerifyAudit}
                  style={{ fontSize: "11px", background: "#10b981", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}
                >
                  Verify Chain
                </button>
              </div>

              {verificationResult && (
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10b981", borderRadius: "8px", padding: "10px", marginBottom: "12px", fontSize: "11px" }}>
                  <div style={{ color: "#10b981", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle size={14} /> Chain Validated from Genesis
                  </div>
                  <p style={{ color: "#e2e8f0", marginTop: "4px" }}>{verificationResult.spoken_summary}</p>
                </div>
              )}

              <div className="trace-log">
                <div style={{ padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", marginBottom: "8px" }}>
                  <div style={{ color: "#f59e0b", fontSize: "11px" }}>GENESIS BLOCK #0</div>
                  <div className="hash-badge" style={{ marginTop: "4px" }}>0000000000000000000000000000000000000000000000000000000000000000</div>
                </div>
                <div style={{ padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", marginBottom: "8px" }}>
                  <div style={{ color: "#38bdf8", fontSize: "11px" }}>EVENT #1: GRANT_CREATED</div>
                  <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>Cap: $250.00 | Scopes: [hotel:*, train:*]</div>
                  <div className="hash-badge" style={{ marginTop: "4px" }}>4c9a8f12...e7b2</div>
                </div>
                {auditEvents.map((e) => (
                  <div key={e.seq} style={{ padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px", marginBottom: "8px" }}>
                    <div style={{ color: "#10b981", fontSize: "11px" }}>EVENT #{e.seq}: {e.type}</div>
                    <div className="hash-badge" style={{ marginTop: "4px" }}>{e.hash}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
