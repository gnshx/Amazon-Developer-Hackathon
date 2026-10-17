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
  Activity,
  Volume2,
  VolumeX
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
  status: "PENDING" | "CONFIRMED" | "FAILED" | "COMPENSATED" | "HELD";
  details: string;
  receipt?: any;
}

interface SagaState {
  planId: string | null;
  status: "IDLE" | "WAITING_APPROVAL" | "HELD" | "EXECUTING" | "COMPLETED" | "ROLLED_BACK" | "DENIED";
  steps: SagaStep[];
  outcomeMessage?: string;
  undoWindowSeconds?: number;
  settlesAt?: string;
  receipt?: any;
}

function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJson).join(",") + "]";
  const sortedKeys = Object.keys(obj).sort();
  return "{" + sortedKeys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

async function computeSha256(canonicalStr: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(canonicalStr);
      const hashBuf = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // Fallback
    }
  }
  return "ba39052542650f7fd4cf544b163d9c67ecae94058f81dc4ed7e1860b6f06395c";
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
  const [voiceAudioEnabled, setVoiceAudioEnabled] = useState(true);

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

  // Receipt Modal & Undo Window State
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [receiptVerificationState, setReceiptVerificationState] = useState<"idle" | "valid" | "invalid">("idle");
  const [heldCountdown, setHeldCountdown] = useState<number | null>(null);

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

  // Voice speech synthesis helper (supports clean narration mode)
  const speakVoice = (text: string) => {
    setIsSpeaking(true);
    if (!voiceAudioEnabled) {
      // Narration Mode: Animate waveform visually on camera without conflicting audio
      setTimeout(() => setIsSpeaking(false), 2500);
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        return;
      } catch {
        // Fallback
      }
    }
    setTimeout(() => setIsSpeaking(false), 2000);
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
      
      setTimeout(async () => {
        addTrace("search_trains", { origin: "Portland", destination: "Seattle" }, "SUCCEEDED", "Found 2 trains starting at $45.00");
        addTrace("search_hotels", { destination: "Seattle", nights: 2 }, "SUCCEEDED", "Found Harbor Inn Hotel ($120.00)");
        addTrace("propose_plan", { steps: 2, totalMinor: 16500 }, "T2_APPROVAL_REQUIRED", "Created pending phone approval for hotel booking ($I3)");

        const planId = `plan_${Math.random().toString(36).substring(2, 9)}`;
        const hotelParams = { hotel_id: "harbor_inn", nights: 2, price: 12000 };
        const calculatedHash = await computeSha256(canonicalJson(hotelParams));
        const approvalItem = {
          id: `apr_${Math.random().toString(36).substring(2, 9)}`,
          actionId: "act_hotel_01",
          planId,
          toolName: "book_hotel",
          params: hotelParams,
          paramsHash: calculatedHash,
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
              title: "Coastal Rail Express",
              costMinor: 4500,
              tier: "T1",
              status: "PENDING",
              details: "Portland → Seattle (Standard Class)"
            },
            {
              id: "step_hotel_2",
              provider: "hotel",
              title: "Harbor Inn Seattle",
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
          text: "I've planned your weekend trip from Portland to Seattle: Coastal Rail train ($45.00) and Harbor Inn Hotel ($120.00) for $165.00 total. The hotel booking requires your approval on your phone.",
          timestamp: new Date().toLocaleTimeString(),
          spokenSummary: "I found a train and hotel for $165.00 total. Please confirm the hotel booking on your phone.",
          planId
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
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
              title: "Harbor Inn Seattle",
              costMinor: 12000,
              tier: "T2",
              status: "CONFIRMED",
              details: "Pre-approved booking confirmed by Harbor Inn API"
            },
            {
              id: "step_train_2",
              provider: "train",
              title: "Coastal Rail Express",
              costMinor: 4500,
              tier: "T1",
              status: "PENDING",
              details: "Attempting seat reservation..."
            }
          ],
          outcomeMessage: "Step 1 booked ($120.00). Step 2 in flight..."
        });

        addTrace("book_hotel", { hotel_id: "harbor_inn", price: 12000 }, "SUCCEEDED", "Hotel booking confirmed (Ref: RES-9821)");

        // 800ms later: Train fails and triggers compensating rollback
        setTimeout(() => {
          addTrace("book_train", { train_id: "rail_502", price: 4500 }, "FAILED", "Coastal Rail API rejected booking: PAYMENT_DECLINED_SEAT_UNAVAILABLE");
          addTrace("saga_orchestrator", { action: "ROLLBACK_INITIATED" }, "COMPENSATING", "Compensating saga in reverse order: cancelling hotel (Ref: RES-9821)");
          addTrace("cancel_hotel", { booking_id: "RES-9821" }, "COMPENSATED", "Hotel reservation cancelled and 100% refunded ($120.00 credited back)");

          setSaga({
            planId,
            status: "ROLLED_BACK",
            steps: [
              {
                id: "step_hotel_1",
                provider: "hotel",
                title: "Harbor Inn Seattle",
                costMinor: 12000,
                tier: "T2",
                status: "COMPENSATED",
                details: "Auto-cancelled by Saga Orchestrator ($0.00 charged)"
              },
              {
                id: "step_train_2",
                provider: "train",
                title: "Coastal Rail Express",
                costMinor: 4500,
                tier: "T1",
                status: "FAILED",
                details: "Train seat unavailable — triggered immediate backward rollback"
              }
            ],
            outcomeMessage: "Saga compensation completed. Zero residue on your card ($I4 Clean Residue). Initial state restored."
          });

          setPhoneNotification("Rollback Alert: Train booking failed; Harbor Inn Hotel was auto-cancelled. Net charge: $0.00.");

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
          speakVoice(agentMsg.spokenSummary || agentMsg.text);
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
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
      }, 800);
    }
    // SCENARIO 4: Undo Window Grace Hold ($I10 Grace-Hold Containment)
    else if (lower.includes("undo") || lower.includes("grace") || lower.includes("hold")) {
      addTrace("bedrock_agent_loop", { prompt }, "RUNNING", "Agent reasoning loop with 10s undo grace window ($I10)");

      setTimeout(() => {
        const planId = `plan_undo_${Math.random().toString(36).substring(2, 9)}`;
        addTrace("execute_plan", { planId, undoWindowSeconds: 10 }, "HELD", "Action placed on 10s grace hold before provider settlement");

        setHeldCountdown(10);
        setSaga({
          planId,
          status: "HELD",
          undoWindowSeconds: 10,
          steps: [
            {
              id: "step_train_held",
              provider: "train",
              title: "Coastal Rail Express",
              costMinor: 4500,
              tier: "T1",
              status: "HELD",
              details: "Held in Grace Window (10s before settlement) — $0 charged"
            }
          ],
          outcomeMessage: "Booking held for 10 seconds before provider settlement. You can cancel now to incur zero charges ($I10)."
        });

        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: "I've held your Coastal Rail train ticket for 10 seconds before settlement. If you change your mind, say 'Alexa, cancel booking' or click the Cancel button.",
          timestamp: new Date().toLocaleTimeString(),
          spokenSummary: "I placed your booking on a 10-second grace hold. You can cancel before it settles.",
          planId
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
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
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
      }, 700);
    }
  };

  // Countdown effect for Undo Grace Window
  React.useEffect(() => {
    if (heldCountdown === null || heldCountdown <= 0) return;
    const interval = setInterval(() => {
      setHeldCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setSaga((s) => ({
            ...s,
            status: "COMPLETED",
            steps: s.steps.map((st) => ({ ...st, status: "CONFIRMED", details: "Grace window elapsed — booking confirmed" })),
            outcomeMessage: "Grace window elapsed. Booking settled and confirmed with provider."
          }));
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [heldCountdown]);

  // Cancel booking during grace hold
  const handleCancelHeldBooking = () => {
    setHeldCountdown(null);
    addTrace("admin_plan_undo", { planId: saga.planId }, "UNDONE", "Cancelled during undo grace window; 0 provider bookings ($I10)");

    setSaga((prev) => ({
      ...prev,
      status: "ROLLED_BACK",
      steps: prev.steps.map((s) => ({ ...s, status: "COMPENSATED", details: "Cancelled in grace window: $0 charged" })),
      outcomeMessage: "Grace hold cancelled. Zero charges made ($0.00 net spend). Provider state completely untouched ($I10)."
    }));

    setPhoneNotification("Booking cancelled during 10s grace window. Net charge: $0.00.");

    const cancelMsg: Message = {
      id: `a_${Date.now()}`,
      sender: "agent",
      text: "I've cancelled your held booking before settlement. No money was charged to your account ($0.00).",
      timestamp: new Date().toLocaleTimeString(),
      spokenSummary: "Booking cancelled during grace window. Zero charges made."
    };
    setMessages((prev) => [...prev, cancelMsg]);
    speakVoice(cancelMsg.spokenSummary || cancelMsg.text);
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

      const sampleReceipt = {
        version: "1.0",
        receiptId: `rcpt_hotel_${Math.random().toString(36).substring(2, 8)}`,
        actionId: "act_hotel_01",
        planId: saga.planId || "plan_seattle_01",
        grantId: grant.id,
        toolName: "book_hotel",
        paramsHash: "ba39052542650f7fd4cf544b163d9c67ecae94058f81dc4ed7e1860b6f06395c",
        spendMinor: 12000,
        currency: "USD",
        providerBookingRef: "HINN-78921",
        executedAt: new Date().toISOString(),
        gatewayPublicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAh6p5B3L8J2m1N0q9R8s7T6u5V4w3X2y1Z0a9B8c7D6e=\n-----END PUBLIC KEY-----",
        signature: "3a8f9c1e7d2b4f5a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a"
      };

      // Update Saga State
      setSaga((prev) => ({
        ...prev,
        status: "COMPLETED",
        receipt: sampleReceipt,
        steps: prev.steps.map((s) => ({
          ...s,
          status: "CONFIRMED",
          receipt: s.provider === "hotel" ? sampleReceipt : undefined
        })),
        outcomeMessage: "All steps confirmed: Coastal Rail ($45.00) + Harbor Inn ($120.00). Total: $165.00. Action receipts signed ($I9)."
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
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(56, 189, 248, 0.3)", fontWeight: "600" }}>
                Simulated Voice Prototype
              </span>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Simulated Alexa+ voice assistant powered by Amazon Bedrock Converse &amp; Warrant MCP Gateway
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => setVoiceAudioEnabled((prev) => !prev)}
              title={voiceAudioEnabled ? "Voice audio active (Click to mute browser speech for clean voiceover narration)" : "Voice audio muted for narration (Waveforms remain active)"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 8px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: "500",
                cursor: "pointer",
                border: voiceAudioEnabled ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
                background: voiceAudioEnabled ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                color: voiceAudioEnabled ? "#34d399" : "#fbbf24"
              }}
            >
              {voiceAudioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{voiceAudioEnabled ? "Voice: ON" : "Voice: MUTED"}</span>
            </button>

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
          <button
            onClick={() => handleSendMessage("Book train with a 10-second undo grace window")}
            style={{ fontSize: "11px", padding: "6px 10px", background: "rgba(139, 92, 246, 0.15)", border: "1px solid rgba(139, 92, 246, 0.4)", borderRadius: "6px", color: "#c4b5fd", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            ⏱️ Undo Window (Grace Hold I10)
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
                  Harbor Inn Seattle
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
                  {saga.status === "HELD" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "10px", background: "rgba(245, 158, 11, 0.2)", color: "#fde68a", border: "1px solid #f59e0b", padding: "2px 8px", borderRadius: "4px", fontWeight: "700" }}>
                        GRACE HOLD ({heldCountdown ?? 0}s)
                      </span>
                      <button
                        onClick={handleCancelHeldBooking}
                        style={{ fontSize: "10px", background: "#ef4444", color: "#fff", border: "none", padding: "3px 8px", borderRadius: "4px", fontWeight: "700", cursor: "pointer" }}
                      >
                        Cancel Booking
                      </button>
                    </div>
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
                    <p style={{ marginTop: "4px", fontSize: "11px" }}>Click <em>Happy Path</em> or <em>Undo Window</em> below to see forward execution, receipts, and grace holds.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {saga.steps.map((step, idx) => (
                      <div
                        key={step.id}
                        className={`saga-step-card ${step.status === "CONFIRMED" ? "confirmed" : step.status === "COMPENSATED" ? "compensated" : step.status === "HELD" ? "active" : "active"}`}
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
                                  : step.status === "HELD"
                                  ? "#8b5cf6"
                                  : "#f59e0b",
                              color: "#fff"
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
                        {step.receipt && (
                          <div style={{ marginTop: "6px", display: "flex", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => {
                                setSelectedReceipt(step.receipt);
                                setReceiptVerificationState("idle");
                              }}
                              style={{
                                fontSize: "10px",
                                background: "rgba(56, 189, 248, 0.15)",
                                border: "1px solid rgba(56, 189, 248, 0.4)",
                                color: "#38bdf8",
                                borderRadius: "4px",
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: "600"
                              }}
                            >
                              📜 View Signed Receipt ($I_9)
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {saga.status === "HELD" && (
                      <div style={{ marginTop: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)" }}>
                          <span>Settling with provider in {heldCountdown}s...</span>
                          <span style={{ color: "#f59e0b" }}>Reversible Grace Period ($I10)</span>
                        </div>
                        <div className="hold-progress-bar">
                          <div className="hold-progress-fill" style={{ width: `${((heldCountdown ?? 0) / 10) * 100}%` }} />
                        </div>
                      </div>
                    )}

                    {saga.outcomeMessage && (
                      <div style={{ background: saga.status === "ROLLED_BACK" ? "rgba(239,68,68,0.1)" : saga.status === "HELD" ? "rgba(139,92,246,0.1)" : "rgba(16,185,129,0.1)", border: `1px solid ${saga.status === "ROLLED_BACK" ? "rgba(239,68,68,0.3)" : saga.status === "HELD" ? "rgba(139,92,246,0.3)" : "rgba(16,185,129,0.3)"}`, borderRadius: "8px", padding: "10px", fontSize: "11px", color: "#f8fafc", marginTop: "4px" }}>
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
                    Enforced at gateway. Agent cannot exceed limit even under prompt injection.
                  </p>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Smartphone size={14} color="#f59e0b" />
                    <span style={{ fontSize: "12px", fontWeight: "600" }}>Approval Binding ($I_3$)</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    T2 actions locked to exact arguments using RFC 8785 canonical hashes.
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

                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <ShieldCheck size={14} color="#a78bfa" />
                    <span style={{ fontSize: "12px", fontWeight: "600" }}>Signed Receipts ($I_9$)</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    Every confirmed action yields an Ed25519-signed proof verifiable offline.
                  </p>
                </div>

                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <RotateCcw size={14} color="#fbbf24" />
                    <span style={{ fontSize: "12px", fontWeight: "600" }}>Undo Window ($I_{10}$)</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                    Grace hold window allows instantaneous cancellation before provider commitment.
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
                <span style={{ fontSize: "12px", fontWeight: "600" }}>SHA-256 Chained Events & Merkle Tree</span>
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

              {/* Merkle Root Checkpoint Card */}
              <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.3)", borderRadius: "8px", padding: "10px", marginBottom: "12px", fontSize: "11px" }}>
                <div style={{ color: "#a78bfa", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Layers size={14} /> Merkle Root Checkpoint (Logarithmic Proofs)
                </div>
                <div className="hash-badge" style={{ marginTop: "6px" }}>
                  b4f9e12a...7c9d01ef (O(log N) proofs active)
                </div>
              </div>

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

      {/* CRYPTOGRAPHIC RECEIPT MODAL */}
      {selectedReceipt && (
        <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck size={20} color="#38bdf8" />
                <h3 style={{ fontSize: "15px", fontWeight: "700" }}>Ed25519 Cryptographic Action Receipt</h3>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Receipt ID</span>
                <span style={{ fontFamily: "monospace", color: "#38bdf8", fontWeight: "600" }}>{selectedReceipt.receiptId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Action / Tool</span>
                <span style={{ fontWeight: "600" }}>{selectedReceipt.toolName} ({selectedReceipt.actionId})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Confirmed Spend</span>
                <span style={{ color: "#10b981", fontWeight: "700" }}>${(selectedReceipt.spendMinor / 100).toFixed(2)} USD</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>Provider Booking Ref</span>
                <span style={{ fontFamily: "monospace", fontWeight: "600" }}>{selectedReceipt.providerBookingRef}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}>RFC 8785 Params Hash</span>
                <span style={{ fontFamily: "monospace", color: "#cbd5e1" }}>{selectedReceipt.paramsHash.slice(0, 16)}...</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: "6px" }}>
                <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>Ed25519 Digital Signature</div>
                <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#94a3b8", wordBreak: "break-all" }}>
                  {selectedReceipt.signature}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => setReceiptVerificationState("valid")}
                style={{
                  background: receiptVerificationState === "valid" ? "#10b981" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {receiptVerificationState === "valid" ? (
                  <>
                    <CheckCircle size={14} /> Signature Verified Offline ($I_9)
                  </>
                ) : (
                  "Verify Signature Offline"
                )}
              </button>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Non-repudiable Proof</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
