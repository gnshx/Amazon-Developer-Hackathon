"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Smartphone,
  Terminal,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Lock,
  Layers,
  ArrowRight,
  RotateCcw,
  Check,
  Info,
  DollarSign,
  Activity
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  spokenSummary?: string;
  planId?: string;
}

interface SagaStep {
  id: string;
  provider: "train" | "hotel" | "dining";
  title: string;
  costMinor: number;
  tier: "T1" | "T2";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "COMPENSATED";
  details: string;
}

interface SagaState {
  planId: string | null;
  status: "IDLE" | "WAITING_APPROVAL" | "EXECUTING" | "COMPLETED" | "ROLLED_BACK" | "DENIED";
  steps: SagaStep[];
  outcomeMessage?: string;
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

  // Grant & Session State (Default $250.00 spend cap)
  const [grant, setGrant] = useState({
    id: "grant_demo",
    spendCapMinor: 25000, // $250.00
    spentMinor: 0,
    scopes: ["hotel:*", "train:*", "dining:*"],
    token: "session_token_demo"
  });

  // Approvals & Audit State
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [phoneNotification, setPhoneNotification] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<"explain" | "trace" | "audit">("explain");

  // Visual Saga State
  const [saga, setSaga] = useState<SagaState>({
    planId: null,
    status: "IDLE",
    steps: []
  });

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

    const lower = prompt.toLowerCase();

    // SCENARIO 1: Happy Path Trip ($165.00 Total)
    if (lower.includes("happy path") || (lower.includes("seattle") && !lower.includes("decline") && !lower.includes("300"))) {
      addTrace("bedrock_agent_loop", { prompt }, "RUNNING", "Agent reasoning loop dispatched via Amazon Bedrock Converse");
      
      setTimeout(() => {
        addTrace("search_trains", { origin: "Portland", destination: "Seattle" }, "SUCCEEDED", "Found 2 trains starting at $45.00");
        addTrace("search_hotels", { destination: "Seattle", nights: 2 }, "SUCCEEDED", "Found Grand Plaza Hotel ($120.00)");
        addTrace("propose_plan", { steps: 2, totalMinor: 16500 }, "T2_APPROVAL_REQUIRED", "Created pending phone approval for hotel booking ($I3)");

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
        setPhoneNotification("New action approval required: Hotel booking for $120.00.");

        // Set visual saga
        setSaga({
          planId,
          status: "WAITING_APPROVAL",
          steps: [
            {
              id: "step_train_1",
              provider: "train",
              title: "Amtrak Pacific Surfliner",
              costMinor: 4500,
              tier: "T1",
              status: "PENDING",
              details: "Portland → Seattle (Standard Class)"
            },
            {
              id: "step_hotel_2",
              provider: "hotel",
              title: "Grand Plaza Hotel Seattle",
              costMinor: 12000,
              tier: "T2",
              status: "PENDING",
              details: "2 Nights (Queen Room) — Awaiting phone approval"
            }
          ],
          outcomeMessage: "Trip proposed for $165.00 total. Step 2 requires household phone approval ($I3)."
        });

        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: "I've planned your weekend trip from Portland to Seattle: Amtrak train ($45.00) and Grand Plaza Hotel ($120.00) for $165.00 total. The hotel booking requires your approval on your phone.",
          timestamp: new Date().toLocaleTimeString(),
          spokenSummary: "I found a train and hotel for $165.00 total. Please confirm the hotel booking on your phone.",
          planId
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        setTimeout(() => setIsSpeaking(false), 2000);
      }, 1000);
    } 
    // SCENARIO 2: Train Decline Mid-Saga Rollback ($I4 Clean Residue)
    else if (lower.includes("decline") || lower.includes("rollback")) {
      addTrace("bedrock_agent_loop", { prompt }, "RUNNING", "Agent dispatched multi-step saga execution");

      setTimeout(() => {
        const planId = `plan_saga_${Math.random().toString(36).substring(2, 9)}`;
        setPendingApprovals([]);
        setPhoneNotification(null);

        // Visual saga begins: Hotel succeeds, Train fails
        setSaga({
          planId,
          status: "EXECUTING",
          steps: [
            {
              id: "step_hotel_1",
              provider: "hotel",
              title: "Grand Plaza Hotel Seattle",
              costMinor: 12000,
              tier: "T2",
              status: "CONFIRMED",
              details: "Pre-approved booking confirmed by Grand Plaza API"
            },
            {
              id: "step_train_2",
              provider: "train",
              title: "Amtrak Cascades Express",
              costMinor: 4500,
              tier: "T1",
              status: "PENDING",
              details: "Attempting seat reservation..."
            }
          ],
          outcomeMessage: "Step 1 booked ($120.00). Step 2 in flight..."
        });

        addTrace("book_hotel", { hotel_id: "grand_plaza", price: 12000 }, "SUCCEEDED", "Hotel booking confirmed (Ref: RES-9821)");

        // 800ms later: Train fails and triggers compensating rollback
        setTimeout(() => {
          addTrace("book_train", { train_id: "amtrak_502", price: 4500 }, "FAILED", "Amtrak API rejected booking: PAYMENT_DECLINED_SEAT_UNAVAILABLE");
          addTrace("saga_orchestrator", { action: "ROLLBACK_INITIATED" }, "COMPENSATING", "Compensating saga in reverse order: cancelling hotel (Ref: RES-9821)");
          addTrace("cancel_hotel", { booking_id: "RES-9821" }, "COMPENSATED", "Hotel reservation cancelled and 100% refunded ($120.00 credited back)");

          setSaga({
            planId,
            status: "ROLLED_BACK",
            steps: [
              {
                id: "step_hotel_1",
                provider: "hotel",
                title: "Grand Plaza Hotel Seattle",
                costMinor: 12000,
                tier: "T2",
                status: "COMPENSATED",
                details: "Auto-cancelled by Saga Orchestrator ($0.00 charged)"
              },
              {
                id: "step_train_2",
                provider: "train",
                title: "Amtrak Cascades Express",
                costMinor: 4500,
                tier: "T1",
                status: "FAILED",
                details: "Amtrak seat unavailable — triggered immediate backward rollback"
              }
            ],
            outcomeMessage: "Saga compensation completed. Zero residue on your card ($I4 Clean Residue). Initial state restored."
          });

          setPhoneNotification("Rollback Alert: Train booking failed; Grand Plaza Hotel was auto-cancelled. Net charge: $0.00.");

          const agentMsg: Message = {
            id: `a_${Date.now()}`,
            sender: "agent",
            text: "I couldn't confirm your train ticket because seats sold out, so I automatically cancelled your hotel reservation. You were charged $0.00, leaving no stranded bookings.",
            timestamp: new Date().toLocaleTimeString(),
            spokenSummary: "I couldn't confirm your train ticket, so I automatically cancelled your hotel reservation. You were charged zero dollars.",
            planId
          };
          setMessages((prev) => [...prev, agentMsg]);
          setIsLoading(false);
          setTimeout(() => setIsSpeaking(false), 2000);
        }, 1200);
      }, 800);
    }
    // SCENARIO 3: Spend Cap Exceeded ($I2 Absolute Spend Cap)
    else if (lower.includes("300") || lower.includes("exceed") || lower.includes("cap")) {
      addTrace("bedrock_agent_loop", { prompt }, "RUNNING", "Agent reasoning loop dispatched");

      setTimeout(() => {
        addTrace("evaluate_grant_policy", { action: "book_luxury_resort", costMinor: 30000 }, "POLICY_DENIED", "Cost $300.00 exceeds grant spend cap of $250.00 ($I2)");

        setSaga({
          planId: `plan_denied_${Date.now()}`,
          status: "DENIED",
          steps: [
            {
              id: "step_resort_1",
              provider: "hotel",
              title: "Luxury Waterfront Suite",
              costMinor: 30000,
              tier: "T2",
              status: "FAILED",
              details: "Action denied by Gateway: $300.00 exceeds $250.00 limit"
            }
          ],
          outcomeMessage: "Deterministic Policy Denial: Spend cap enforced before reaching any external provider API."
        });

        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: "I cannot book this luxury suite because the $300.00 total exceeds your household grant limit of $250.00. Warrant blocked this action to protect your budget.",
          timestamp: new Date().toLocaleTimeString(),
          spokenSummary: "I cannot book this option because it exceeds your $250 spend limit.",
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        setTimeout(() => setIsSpeaking(false), 2000);
      }, 800);
    }
    // Default fallback
    else {
      setTimeout(() => {
        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: "I can help you search hotels, trains, and dining options, or execute a trip within your $250.00 budget. Try clicking one of the quick test buttons below!",
          timestamp: new Date().toLocaleTimeString(),
          spokenSummary: "I can help search or propose a safe trip within your budget."
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        setTimeout(() => setIsSpeaking(false), 1500);
      }, 700);
    }
  };

  // User decides approval on phone
  const handleApprove = (approvalId: string) => {
    setPendingApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    setPhoneNotification("Approval granted. Minting cryptographic approval token...");
    addTrace("admin_approval_granted", { approvalId }, "APPROVED", "Approval token minted and bound to RFC 8785 canonical hash");

    // Execute plan automatically
    setTimeout(() => {
      addTrace("execute_plan", { approvalToken: "appr_98a72b..." }, "EXECUTING", "Dispatched to Saga Orchestrator over MCP");
      setGrant((prev) => ({ ...prev, spentMinor: prev.spentMinor + 16500 }));

      // Update Saga State
      setSaga((prev) => ({
        ...prev,
        status: "COMPLETED",
        steps: prev.steps.map((s) => ({ ...s, status: "CONFIRMED" })),
        outcomeMessage: "All steps confirmed: Amtrak ($45.00) + Grand Plaza ($120.00). Total: $165.00."
      }));

      // Add to audit trail
      setAuditEvents((prev) => [
        {
          seq: prev.length + 1,
          type: "ACTION_SUCCEEDED",
          refId: "act_hotel_01",
          hash: "3a8f9c1e7d2b4f5a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ]);

      setPhoneNotification("Booking confirmed! Total charged: $165.00.");

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

  const spentDollars = (grant.spentMinor / 100).toFixed(2);
  const capDollars = (grant.spendCapMinor / 100).toFixed(2);
  const remainingDollars = ((grant.spendCapMinor - grant.spentMinor) / 100).toFixed(2);
  const percentSpent = Math.min(100, Math.round((grant.spentMinor / grant.spendCapMinor) * 100));

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
              Voice assistant with Amazon Bedrock Converse & Warrant MCP
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
          <span>Household Cap: <strong>${capDollars}</strong></span>
          <span>Spent: <strong style={{ color: "#38bdf8" }}>${spentDollars}</strong></span>
          <span>Remaining: <strong style={{ color: "#10b981" }}>${remainingDollars}</strong></span>
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
            onClick={() => handleSendMessage("Book a weekend trip to Seattle with train and hotel under $200 (Happy Path)")}
            style={{ fontSize: "11px", padding: "6px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "#f8fafc", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ✈️ Happy Path ($165 Trip)
          </button>
          <button
            onClick={() => handleSendMessage("Simulate train decline mid-saga rollback")}
            style={{ fontSize: "11px", padding: "6px 10px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", color: "#fca5a5", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ⚡ Train Decline (Rollback I4)
          </button>
          <button
            onClick={() => handleSendMessage("Book a luxury suite in Seattle for $300")}
            style={{ fontSize: "11px", padding: "6px 10px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "6px", color: "#fde68a", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ⛔ Exceed Cap ($300 Trip I2)
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

        {phoneNotification && (
          <div style={{ background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#e0f2fe", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Info size={14} color="#38bdf8" />
            <span>{phoneNotification}</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto" }}>
          {pendingApprovals.length === 0 ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
              <ShieldCheck size={42} style={{ marginBottom: "12px", color: "#10b981", opacity: 0.8 }} />
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#f8fafc" }}>Household Guard Active</p>
              <p style={{ fontSize: "11px", marginTop: "6px", lineHeight: "1.5" }}>
                Actions exceeding $50 or involving room reservations ($T_2$) require approval here before execution.
              </p>
              <div style={{ marginTop: "16px", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", fontSize: "11px", textAlign: "left", width: "100%" }}>
                <div style={{ color: "#94a3b8", marginBottom: "4px" }}>Active Grant Rules:</div>
                <div style={{ color: "#38bdf8" }}>• Cap: ${capDollars} per session</div>
                <div style={{ color: "#10b981" }}>• Auto-rollback on provider error</div>
              </div>
            </div>
          ) : (
            pendingApprovals.map((appr) => (
              <div key={appr.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(245, 158, 11, 0.5)", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", background: "#f59e0b", color: "#000", fontWeight: "700", padding: "2px 6px", borderRadius: "4px" }}>
                    T2 ACTION APPROVAL
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{appr.toolName}</span>
                </div>

                <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  Grand Plaza Hotel Seattle
                </p>
                <p style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "700", marginBottom: "10px" }}>
                  ${(appr.estimatedCostMinor / 100).toFixed(2)} USD
                </p>

                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px" }}>
                  <p><strong>Nights:</strong> 2 | <strong>City:</strong> Seattle</p>
                  <p style={{ marginTop: "4px" }}><strong>RFC 8785 Parameter Hash:</strong></p>
                  <div className="hash-badge" style={{ marginTop: "3px" }}>
                    {appr.paramsHash}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    onClick={() => handleApprove(appr.id)}
                    style={{ background: "#10b981", color: "#fff", border: "none", padding: "10px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <CheckCircle size={15} /> Approve
                  </button>
                  <button
                    onClick={() => {
                      setPendingApprovals((prev) => prev.filter((a) => a.id !== appr.id));
                      setPhoneNotification("Action rejected by user on phone.");
                    }}
                    style={{ background: "rgba(244, 63, 94, 0.2)", color: "#f43f5e", border: "1px solid #f43f5e", padding: "10px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  >
                    <XCircle size={15} /> Reject
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

      {/* COLUMN 3: WHAT WARRANT IS DOING / MCP TRACE / AUDIT TIMELINE */}
      <div className="glass-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)" }}>
          <button
            onClick={() => setActiveTab("explain")}
            className={`tab-btn ${activeTab === "explain" ? "active" : ""}`}
          >
            <ShieldCheck size={14} /> What Warrant is Doing
          </button>
          <button
            onClick={() => setActiveTab("trace")}
            className={`tab-btn ${activeTab === "trace" ? "active" : ""}`}
          >
            <Terminal size={14} /> Tool Trace
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
          >
            <Layers size={14} /> Audit ($I_7$)
          </button>
        </div>

        <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
          {/* TAB 1: PLAIN-LANGUAGE EXPLAINER & VISUAL SAGA CANVAS */}
          {activeTab === "explain" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Spend Guard Gauge */}
              <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <DollarSign size={16} color="#38bdf8" />
                    <span style={{ fontSize: "13px", fontWeight: "600" }}>Spend Cap Guard ($I_2$)</span>
                  </div>
                  <span style={{ fontSize: "12px", color: percentSpent >= 100 ? "#f43f5e" : "#10b981", fontWeight: "700" }}>
                    {percentSpent}% Used
                  </span>
                </div>

                <div className="progress-track" style={{ marginBottom: "8px" }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${percentSpent}%`,
                      background: percentSpent >= 100 ? "#f43f5e" : "linear-gradient(90deg, #38bdf8, #10b981)"
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                  <span>Spent: <strong style={{ color: "#fff" }}>${spentDollars}</strong></span>
                  <span>Cap: <strong style={{ color: "#fff" }}>${capDollars}</strong></span>
                  <span>Safe Remaining: <strong style={{ color: "#10b981" }}>${remainingDollars}</strong></span>
                </div>
              </div>

              {/* Visual Saga Workflow Canvas ($I4 Clean Residue) */}
              <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Activity size={16} color="#10b981" />
                    <span style={{ fontSize: "13px", fontWeight: "600" }}>Saga Orchestrator Canvas ($I_4$)</span>
                  </div>
                  {saga.status === "ROLLED_BACK" && (
                    <span style={{ fontSize: "10px", background: "rgba(239, 68, 68, 0.2)", color: "#fca5a5", border: "1px solid #ef4444", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>
                      ROLLBACK SUCCEEDED
                    </span>
                  )}
                  {saga.status === "COMPLETED" && (
                    <span style={{ fontSize: "10px", background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", border: "1px solid #10b981", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>
                      ALL CONFIRMED
                    </span>
                  )}
                </div>

                {saga.steps.length === 0 ? (
                  <div style={{ padding: "16px", textAlign: "center", color: "var(--text-dim)", fontSize: "12px" }}>
                    No multi-step travel saga currently active.
                    <p style={{ marginTop: "4px", fontSize: "11px" }}>Click <em>Happy Path</em> or <em>Train Decline</em> below to see forward execution and automatic rollback.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {saga.steps.map((step, idx) => (
                      <div
                        key={step.id}
                        className={`saga-step-card ${step.status === "CONFIRMED" ? "confirmed" : step.status === "COMPENSATED" ? "compensated" : "active"}`}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontSize: "12px", fontWeight: "600" }}>
                            {idx + 1}. {step.title}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: "700",
                              background:
                                step.status === "CONFIRMED"
                                  ? "#10b981"
                                  : step.status === "COMPENSATED"
                                  ? "#ef4444"
                                  : step.status === "FAILED"
                                  ? "#f43f5e"
                                  : "#f59e0b",
                              color: "#000"
                            }}
                          >
                            {step.status}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)" }}>
                          <span>{step.details}</span>
                          <strong style={{ color: step.status === "COMPENSATED" ? "#ef4444" : "#fff", textDecoration: step.status === "COMPENSATED" ? "line-through" : "none" }}>
                            ${(step.costMinor / 100).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                    ))}

                    {saga.outcomeMessage && (
                      <div style={{ background: saga.status === "ROLLED_BACK" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${saga.status === "ROLLED_BACK" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`, borderRadius: "8px", padding: "10px", fontSize: "11px", color: "#f8fafc", marginTop: "4px" }}>
                        {saga.outcomeMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Invariant Guarantees Explainer */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <ShieldCheck size={14} color="#38bdf8" />
                    <span style={{ fontSize: "12px", fontWeight: "600" }}>Spend Cap ($I_2$)</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    Enforced at the gateway. The agent cannot exceed your limit, even with prompt injection.
                  </p>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Smartphone size={14} color="#f59e0b" />
                    <span style={{ fontSize: "12px", fontWeight: "600" }}>Approval Binding ($I_3$)</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    T2 actions locked to exact arguments using RFC 8785 canonical SHA-256 hashes.
                  </p>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <RotateCcw size={14} color="#ef4444" />
                    <span style={{ fontSize: "12px", fontWeight: "600" }}>Clean Residue ($I_4$)</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    Multi-step plans undo prior steps automatically if later steps fail ($0 residue).
                  </p>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Layers size={14} color="#10b981" />
                    <span style={{ fontSize: "12px", fontWeight: "600" }}>Audit Ledger ($I_7$)</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    Every transition is cryptographically chained for end-to-end verification.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL MCP TOOL TRACE */}
          {activeTab === "trace" && (
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
          )}

          {/* TAB 3: SHA-256 AUDIT CHAIN */}
          {activeTab === "audit" && (
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
                  <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>Cap: ${capDollars} | Scopes: [hotel:*, train:*]</div>
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
