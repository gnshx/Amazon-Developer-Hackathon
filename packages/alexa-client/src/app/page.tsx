"use client";

import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Lock,
  RotateCcw
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "agent";
  text: string;
  timestamp: string;
  spokenSummary?: string;
  planId?: string;
}

type ScreenTab = "console" | "approval" | "failure" | "scorecard" | "limits";

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

export default function WarrantApplication() {
  const [activeScreen, setActiveScreen] = useState<ScreenTab>("console");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as ScreenTab;
      if (tabParam && ["console", "approval", "failure", "scorecard", "limits"].includes(tabParam)) {
        setActiveScreen(tabParam);
      }
    }
  }, []);
  const [inputText, setInputText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceAudioEnabled, setVoiceAudioEnabled] = useState(true);

  // Household Grant Limits (Screen 5 defaults: $500 cap, $200 threshold, 8s undo)
  const [grant, setGrant] = useState({
    id: "grant_household_01",
    budgetMinor: 50000, // $500.00
    approvalThresholdMinor: 20000, // $200.00
    spentMinor: 0,
    expiresText: "In 2 hours",
    undoWindowSeconds: 8,
    scopes: ["hotels", "trains"]
  });

  // Current Plan State
  const [planState, setPlanState] = useState<{
    status: "idle" | "proposed" | "approved" | "failed_rolled_back" | "cancelled";
    totalMinor: number;
    trainPriceMinor: number;
    hotelPriceMinor: number;
    hotelStatus: "needs_approval" | "approved" | "cancelled";
    fingerprint: string;
    undoCountdown: number | null;
    receipt?: any;
  }>({
    status: "proposed",
    totalMinor: 45000, // $450
    trainPriceMinor: 9000, // $90
    hotelPriceMinor: 36000, // $360
    hotelStatus: "needs_approval",
    fingerprint: "9f2ca41e8d47b59c2317fa10b981dc4ed7e1860b6f06395c",
    undoCountdown: null
  });

  // Messages
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m_user_initial",
      sender: "user",
      text: "Plan a weekend trip to Chicago. Hotel and train, under $500.",
      timestamp: "6:08 PM"
    },
    {
      id: "m_agent_initial",
      sender: "agent",
      text: "I found a plan for $450. The hotel needs your approval, so I sent a request to your phone.",
      spokenSummary: "I found a plan for $450. The hotel needs your approval, so I sent a request to your phone.",
      timestamp: "6:08 PM"
    }
  ]);

  // Speech helper
  const speakVoice = (text: string) => {
    setIsSpeaking(true);
    if (!voiceAudioEnabled) {
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

  // Actions
  const handleApprove = async () => {
    setPlanState((prev) => ({
      ...prev,
      status: "approved",
      hotelStatus: "approved",
      undoCountdown: grant.undoWindowSeconds
    }));

    const agentMsg: Message = {
      id: `m_${Date.now()}`,
      sender: "agent",
      text: "Approved on your phone! Harbor Inn ($360) and Chicago train ($90) are confirmed for $450 total. Your 8-second undo window is now active.",
      spokenSummary: "Approved! Your Chicago train and hotel are confirmed for $450 total.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages((prev) => [...prev, agentMsg]);
    speakVoice(agentMsg.spokenSummary || agentMsg.text);

    // Countdown timer for 8s undo window
    let secondsLeft = grant.undoWindowSeconds;
    const interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        setPlanState((prev) => ({ ...prev, undoCountdown: null }));
      } else {
        setPlanState((prev) => ({ ...prev, undoCountdown: secondsLeft }));
      }
    }, 1000);
  };

  const handleDecline = () => {
    setPlanState((prev) => ({
      ...prev,
      status: "cancelled",
      hotelStatus: "cancelled"
    }));

    const agentMsg: Message = {
      id: `m_${Date.now()}`,
      sender: "agent",
      text: "Booking cancelled as requested. $0 was charged and no provider reservations were created.",
      spokenSummary: "Booking cancelled. No money was moved.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages((prev) => [...prev, agentMsg]);
    speakVoice(agentMsg.spokenSummary || agentMsg.text);
    setActiveScreen("console");
  };

  const handleCancelUndo = () => {
    setPlanState((prev) => ({
      ...prev,
      status: "cancelled",
      hotelStatus: "cancelled",
      undoCountdown: null
    }));

    const agentMsg: Message = {
      id: `m_${Date.now()}`,
      sender: "agent",
      text: "Cancelled within the 8-second undo grace window (Invariant I10). $0 was charged, zero provider bookings exist.",
      spokenSummary: "Undo confirmed. Nothing charged and no bookings left.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages((prev) => [...prev, agentMsg]);
    speakVoice(agentMsg.spokenSummary || agentMsg.text);
  };

  const handleSendMessage = (text?: string) => {
    const prompt = text || inputText;
    if (!prompt.trim()) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      sender: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    const lower = prompt.toLowerCase();

    // SCENARIO: Trip to Chicago ($450 Plan)
    if (lower.includes("chicago") || lower.includes("happy path")) {
      setTimeout(() => {
        setPlanState({
          status: "proposed",
          totalMinor: 45000,
          trainPriceMinor: 9000,
          hotelPriceMinor: 36000,
          hotelStatus: "needs_approval",
          fingerprint: "9f2ca41e8d47b59c2317fa10b981dc4ed7e1860b6f06395c",
          undoCountdown: null
        });
        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: "I found a plan for $450. The hotel needs your approval, so I sent a request to your phone.",
          spokenSummary: "I found a plan for $450. The hotel needs your approval, so I sent a request to your phone.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
      }, 700);
    }
    // SCENARIO: Train payment declined (Rollback S2 / I4)
    else if (lower.includes("decline") || lower.includes("fail") || lower.includes("rollback")) {
      setTimeout(() => {
        setPlanState((prev) => ({
          ...prev,
          status: "failed_rolled_back",
          hotelStatus: "cancelled"
        }));
        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: "Train payment was declined by the provider. Warrant automatically cancelled the hotel reservation in reverse order. Nothing charged, no bookings left.",
          spokenSummary: "Train payment was declined. The hotel was cancelled. Nothing was charged.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
      }, 700);
    }
    // SCENARIO: Exceed budget cap ($600 Trip)
    else if (lower.includes("600") || lower.includes("over budget") || lower.includes("budget")) {
      setTimeout(() => {
        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: "I cannot propose this plan: $600 exceeds your household budget limit of $500 (Invariant I2 Absolute Spend Cap). 0 minor units spent.",
          spokenSummary: "That trip exceeds your $500 budget limit. No booking was made.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
      }, 700);
    }
    // Generic fallback
    else {
      setTimeout(() => {
        const agentMsg: Message = {
          id: `a_${Date.now()}`,
          sender: "agent",
          text: `I've checked your household grant. You have $500 budget available for hotels and trains.`,
          spokenSummary: "Your household grant is active with $500 available for hotels and trains.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, agentMsg]);
        setIsLoading(false);
        speakVoice(agentMsg.spokenSummary || agentMsg.text);
      }, 600);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      {/* 1. TOP HEADER */}
      <header className="site-header">
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <span className="brand-title">Warrant</span>

          {/* Screen Navigation Tabs */}
          <nav className="nav-tabs">
            <button
              onClick={() => setActiveScreen("console")}
              className={`nav-tab-btn ${activeScreen === "console" ? "active" : ""}`}
            >
              1. Assistant console
            </button>
            <button
              onClick={() => setActiveScreen("approval")}
              className={`nav-tab-btn ${activeScreen === "approval" ? "active" : ""}`}
            >
              2. Phone approval
            </button>
            <button
              onClick={() => setActiveScreen("failure")}
              className={`nav-tab-btn ${activeScreen === "failure" ? "active" : ""}`}
            >
              3. When something fails
            </button>
            <button
              onClick={() => setActiveScreen("scorecard")}
              className={`nav-tab-btn ${activeScreen === "scorecard" ? "active" : ""}`}
            >
              4. Safety scorecard
            </button>
            <button
              onClick={() => setActiveScreen("limits")}
              className={`nav-tab-btn ${activeScreen === "limits" ? "active" : ""}`}
            >
              5. Your limits
            </button>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Audio Mute / Narration Mode Toggle */}
          <button
            onClick={() => setVoiceAudioEnabled((prev) => !prev)}
            title={voiceAudioEnabled ? "Voice audio active (Click to mute browser speech for clean voiceover narration)" : "Voice audio muted for narration (Waveforms remain active)"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              border: voiceAudioEnabled ? "1px solid rgba(15, 118, 110, 0.3)" : "1px solid rgba(180, 83, 9, 0.3)",
              background: voiceAudioEnabled ? "var(--bg-teal-light)" : "var(--bg-amber-light)",
              color: voiceAudioEnabled ? "var(--text-teal)" : "var(--text-amber)"
            }}
          >
            {voiceAudioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{voiceAudioEnabled ? "Voice: ON" : "Voice: MUTED"}</span>
          </button>

          {/* Voice Wave Visualizer when speaking */}
          {isSpeaking && (
            <div className="audio-visualizer">
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
              <div className="audio-bar" />
            </div>
          )}

          {/* Prototype Badge */}
          <span className="pill-badge">
            Simulated Alexa+ client · demo data
          </span>
        </div>
      </header>

      {/* 2. BODY CONTENT ROUTED ACCORDING TO SCREEN TAB */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ========================================================
            SCREEN 1: ASSISTANT CONSOLE (Matches "1 Assistant console.png")
            ======================================================== */}
        {activeScreen === "console" && (
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", height: "calc(100vh - 68px)" }}>
            {/* LEFT COLUMN: ASSISTANT */}
            <div style={{ padding: "36px 44px", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRight: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <span className="section-label">ASSISTANT</span>

                {/* User Message Bubble (Dark Charcoal) */}
                <div style={{ alignSelf: "flex-end", maxWidth: "85%", background: "var(--bubble-user)", color: "#ffffff", padding: "16px 22px", borderRadius: "20px", fontSize: "16px", lineHeight: "1.45" }}>
                  Plan a weekend trip to Chicago. Hotel and train, under $500.
                </div>

                {/* Assistant Message Bubble (White Card) */}
                <div style={{ alignSelf: "flex-start", maxWidth: "90%", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", padding: "18px 24px", borderRadius: "20px", fontSize: "16px", lineHeight: "1.45", color: "var(--text-main)" }}>
                  {planState.status === "failed_rolled_back" ? (
                    <span>Train payment declined by provider. Warrant automatically cancelled the hotel reservation in reverse order. Nothing charged, no bookings left.</span>
                  ) : planState.status === "approved" ? (
                    <span>Approved! Harbor Inn ($360) and Chicago train ($90) are confirmed for $450 total. Your 8-second undo window is now active.</span>
                  ) : (
                    <span>I found a plan for $450. The hotel needs your approval, so I sent a request to your phone.</span>
                  )}
                </div>

                {/* Plan Items Breakdown Card (White Card) */}
                <div className="warrant-card" style={{ padding: "4px 20px" }}>
                  {/* Row 1: Train */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--border-divider)", fontSize: "15px" }}>
                    <span>Train, Fri 6:10 PM</span>
                    <span>
                      <strong style={{ fontWeight: "700" }}>$90</strong> · <span style={{ color: "var(--text-muted)" }}>Auto-approved</span>
                    </span>
                  </div>

                  {/* Row 2: Hotel */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", fontSize: "15px" }}>
                    <span>Harbor Inn, 2 nights</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span>
                        <strong style={{ fontWeight: "700" }}>$360</strong> ·{" "}
                        {planState.hotelStatus === "approved" ? (
                          <span style={{ color: "var(--text-teal)", fontWeight: "600" }}>Approved</span>
                        ) : planState.hotelStatus === "cancelled" ? (
                          <span style={{ color: "var(--text-red)", fontWeight: "600" }}>Cancelled</span>
                        ) : (
                          <span style={{ color: "var(--text-amber)", fontWeight: "600" }}>Needs your approval</span>
                        )}
                      </span>
                      {planState.hotelStatus === "needs_approval" && (
                        <button
                          onClick={() => setActiveScreen("approval")}
                          style={{
                            fontSize: "12px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-teal)",
                            background: "var(--bg-teal-light)",
                            color: "var(--text-teal)",
                            cursor: "pointer",
                            fontWeight: "600"
                          }}
                        >
                          Review on phone →
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Undo Grace Window Banner (if active) */}
                {planState.undoCountdown !== null && (
                  <div style={{ background: "var(--bg-amber-light)", border: "1px solid #fde68a", borderRadius: "14px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "13.5px", color: "var(--text-amber)" }}>
                      ⏱️ <strong>Undo Grace Window:</strong> {planState.undoCountdown}s remaining before final settlement.
                    </div>
                    <button
                      onClick={handleCancelUndo}
                      style={{ fontSize: "12px", padding: "6px 14px", background: "#b91c1c", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
                    >
                      Cancel ($0 spent)
                    </button>
                  </div>
                )}

                {/* Quick Scenario Pills for Video Demonstration */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                  <button
                    onClick={() => handleSendMessage("Plan Chicago trip under $500")}
                    style={{ fontSize: "11.5px", padding: "6px 12px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "9999px", color: "var(--text-main)", cursor: "pointer" }}
                  >
                    Trip to Chicago ($450 Plan)
                  </button>
                  <button
                    onClick={() => handleSendMessage("Simulate train decline rollback")}
                    style={{ fontSize: "11.5px", padding: "6px 12px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "9999px", color: "var(--text-red)", cursor: "pointer" }}
                  >
                    Train Decline (Rollback S2)
                  </button>
                  <button
                    onClick={() => handleSendMessage("Book $600 trip over budget")}
                    style={{ fontSize: "11.5px", padding: "6px 12px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "9999px", color: "var(--text-amber)", cursor: "pointer" }}
                  >
                    Over Budget ($600 Trip S3)
                  </button>
                  <button
                    onClick={() => {
                      handleApprove();
                    }}
                    style={{ fontSize: "11.5px", padding: "6px 12px", background: "var(--bg-teal-light)", border: "1px solid var(--border-teal)", borderRadius: "9999px", color: "var(--text-teal)", cursor: "pointer", fontWeight: "600" }}
                  >
                    Approve &amp; Start 8s Undo (I10)
                  </button>
                </div>
              </div>

              {/* Bottom Input Area */}
              <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputText)}
                  placeholder="Ask or say something"
                  style={{
                    flex: 1,
                    background: "#ffffff",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "14px",
                    padding: "16px 20px",
                    fontSize: "15px",
                    color: "var(--text-main)",
                    outline: "none"
                  }}
                />
                <button
                  onClick={() => handleSendMessage(inputText)}
                  className="btn-teal"
                  style={{ padding: "0 28px", fontSize: "15px" }}
                >
                  Speak
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: WHAT WARRANT IS DOING */}
            <div style={{ padding: "36px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                <span className="section-label">WHAT WARRANT IS DOING</span>

                {/* Step 1 */}
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--accent-teal)", marginTop: "4px", flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "4px" }}>Checked your grant</h3>
                    <p style={{ fontSize: "14.5px", color: "var(--text-muted)", lineHeight: "1.4" }}>Budget $500, expires in 2 hours, allowed: hotels and trains.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--accent-teal)", marginTop: "4px", flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "4px" }}>Searched options</h3>
                    <p style={{ fontSize: "14.5px", color: "var(--text-muted)", lineHeight: "1.4" }}>Read-only. No money moved.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--accent-teal)", marginTop: "4px", flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "4px" }}>Proposed a plan</h3>
                    <p style={{ fontSize: "14.5px", color: "var(--text-muted)", lineHeight: "1.4" }}>Total $450. Nothing is booked yet.</p>
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: planState.hotelStatus === "approved" ? "var(--accent-teal)" : planState.hotelStatus === "cancelled" ? "var(--text-red)" : "#c2410c",
                    marginTop: "4px",
                    flexShrink: 0
                  }} />
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "4px" }}>
                      {planState.hotelStatus === "approved" ? "Approval confirmed on phone" : planState.hotelStatus === "cancelled" ? "Plan cancelled / rolled back" : "Waiting for your approval"}
                    </h3>
                    <p style={{ fontSize: "14.5px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      {planState.hotelStatus === "approved" ? "Harbor Inn committed; receipt minted." : planState.hotelStatus === "cancelled" ? "No money moved." : "The hotel booking is paused until you approve on your phone."}
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: planState.hotelStatus === "approved" ? "var(--accent-teal)" : "#a8a29e", marginTop: "4px", flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "4px" }}>Book and verify</h3>
                    <p style={{ fontSize: "14.5px", color: "var(--text-muted)", lineHeight: "1.4" }}>Every step is recorded. If one fails, earlier steps are undone.</p>
                  </div>
                </div>
              </div>

              {/* Bottom Progress Bar: Budget if approved */}
              <div style={{ marginTop: "32px", paddingTop: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", fontSize: "15px" }}>
                  <span style={{ color: "var(--text-main)" }}>Budget if approved</span>
                  <span style={{ color: "var(--text-main)" }}>
                    <strong style={{ fontWeight: "700" }}>${planState.hotelStatus === "cancelled" ? "0" : "450"}</strong> of $500
                  </span>
                </div>
                <div style={{ height: "8px", width: "100%", background: "#e5e0d8", borderRadius: "9999px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: planState.hotelStatus === "cancelled" ? "0%" : "90%", background: "var(--accent-teal)", borderRadius: "9999px", transition: "width 0.4s ease" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            SCREEN 2: PHONE APPROVAL (Matches "2 Phone approval.png")
            ======================================================== */}
        {activeScreen === "approval" && (
          <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "40px 20px" }}>
            <div style={{ width: "100%", maxWidth: "460px", display: "flex", flexDirection: "column", gap: "22px" }}>
              {/* Badge */}
              <div>
                <span className="pill-badge pill-badge-amber">
                  Approval needed
                </span>
              </div>

              {/* Title */}
              <h1 style={{ fontSize: "38px", fontWeight: "700", letterSpacing: "-0.02em", color: "var(--text-main)" }}>
                Book Harbor Inn?
              </h1>

              {/* White Details Card */}
              <div className="warrant-card" style={{ padding: "8px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--border-divider)", fontSize: "16px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Dates</span>
                  <span style={{ fontWeight: "500", color: "var(--text-main)" }}>Oct 30 to Nov 1</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--border-divider)", fontSize: "16px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total price</span>
                  <span style={{ fontWeight: "700", color: "var(--text-main)" }}>$360</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--border-divider)", fontSize: "16px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Asked by</span>
                  <span style={{ fontWeight: "500", color: "var(--text-main)" }}>Your assistant</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", fontSize: "16px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Why you are asked</span>
                  <span style={{ fontWeight: "500", color: "var(--text-main)" }}>Over your $200 limit</span>
                </div>
              </div>

              {/* Locked Details Box (Soft Teal) */}
              <div style={{ background: "var(--bg-teal-light)", border: "1px solid var(--border-teal)", borderRadius: "16px", padding: "18px 22px" }}>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-teal)", marginBottom: "4px" }}>
                  These exact details are locked
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "13.5px", color: "var(--text-teal)" }}>
                  fingerprint 9f2c...a41e
                </div>
              </div>

              {/* Explanatory Copy */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "15px", color: "var(--text-main)", lineHeight: "1.45" }}>
                <p>
                  After this, you have <strong style={{ fontWeight: "700" }}>$50</strong> left of your $500 budget.
                </p>
                <p style={{ color: "var(--text-muted)" }}>
                  If any detail changes after you approve, this approval stops working and you will be asked again.
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
                <button
                  onClick={() => {
                    handleApprove();
                    setActiveScreen("console");
                  }}
                  className="btn-teal"
                  style={{ width: "100%", padding: "16px", fontSize: "16px" }}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    handleDecline();
                    setActiveScreen("console");
                  }}
                  className="btn-secondary"
                  style={{ width: "100%", padding: "16px", fontSize: "16px" }}
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            SCREEN 3: WHEN SOMETHING FAILS (Matches "3 When something fails.png")
            ======================================================== */}
        {activeScreen === "failure" && (
          <div style={{ flex: 1, padding: "40px 60px", display: "flex", flexDirection: "column", gap: "32px", maxWidth: "1300px", margin: "0 auto", width: "100%" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "36px", fontWeight: "700", letterSpacing: "-0.02em", color: "var(--text-main)", marginBottom: "6px" }}>
                  When something fails
                </h1>
                <p style={{ fontSize: "16px", color: "var(--text-muted)" }}>
                  Example: the train payment is declined after the hotel was already booked.
                </p>
              </div>
              <span className="pill-badge">Sample data</span>
            </div>

            {/* 4 Process Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
              {/* Step 1 */}
              <div className="warrant-card" style={{ padding: "20px 22px", borderTop: "3px solid var(--accent-teal)" }}>
                <span className="section-label">STEP 1</span>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", marginTop: "10px", marginBottom: "4px" }}>Hotel booked</h3>
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>$360 confirmed</p>
              </div>

              {/* Step 2 */}
              <div className="warrant-card" style={{ padding: "20px 22px", borderTop: "3px solid var(--text-red)" }}>
                <span className="section-label">STEP 2</span>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", marginTop: "10px", marginBottom: "4px" }}>Train payment declined</h3>
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>The plan stops here</p>
              </div>

              {/* Step 3 */}
              <div className="warrant-card" style={{ padding: "20px 22px", borderTop: "3px solid #c2410c" }}>
                <span className="section-label">STEP 3</span>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", marginTop: "10px", marginBottom: "4px" }}>Rolling back</h3>
                <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Hotel is cancelled</p>
              </div>

              {/* Result */}
              <div className="warrant-card" style={{ padding: "20px 22px", background: "var(--bg-teal-light)", borderTop: "3px solid var(--accent-teal)" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-teal)" }}>RESULT</span>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text-main)", marginTop: "10px", marginBottom: "4px" }}>Clean state</h3>
                <p style={{ fontSize: "14px", color: "var(--text-teal)", fontWeight: "500" }}>Nothing charged. No bookings left.</p>
              </div>
            </div>

            {/* Audit Trail Card */}
            <div className="warrant-card" style={{ padding: "28px 32px" }}>
              <span className="section-label" style={{ display: "block", marginBottom: "16px" }}>AUDIT TRAIL</span>

              <div style={{ fontFamily: "var(--font-mono)", fontSize: "14px", display: "flex", flexDirection: "column", gap: "10px", color: "var(--text-main)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "60px 180px 1fr" }}>
                  <span style={{ color: "var(--text-muted)" }}>#41</span>
                  <span>plan.started</span>
                  <span style={{ color: "var(--text-muted)" }}>9f2c...a41e</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "60px 180px 1fr" }}>
                  <span style={{ color: "var(--text-muted)" }}>#42</span>
                  <span>hotel.booked</span>
                  <span style={{ color: "var(--text-muted)" }}>b81d...07c2</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "60px 180px 1fr", color: "var(--text-red)" }}>
                  <span>#43</span>
                  <span style={{ fontWeight: "600" }}>train.declined</span>
                  <span>3e55...c9a0</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "60px 180px 1fr" }}>
                  <span style={{ color: "var(--text-muted)" }}>#44</span>
                  <span>hotel.cancelled</span>
                  <span style={{ color: "var(--text-muted)" }}>d402...1fe8</span>
                </div>
              </div>

              <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--border-divider)", fontSize: "14px", color: "var(--text-teal)", fontWeight: "500" }}>
                Chain verified: every entry is linked to the one before it, so edits would show.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            SCREEN 4: SAFETY SCORECARD (Matches "4 Safety scorecard.png")
            ======================================================== */}
        {activeScreen === "scorecard" && (
          <div style={{ flex: 1, padding: "40px 60px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px", margin: "0 auto", width: "100%" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "38px", fontWeight: "700", letterSpacing: "-0.02em", color: "var(--text-main)", marginBottom: "6px" }}>
                  Safety scorecard
                </h1>
                <p style={{ fontSize: "16px", color: "var(--text-muted)" }}>
                  Sample view of the attack harness results
                </p>
              </div>
              <span className="pill-badge pill-badge-teal" style={{ padding: "8px 18px", fontSize: "14px" }}>
                10 of 10 passed
              </span>
            </div>

            {/* Scorecard Rows Card */}
            <div className="warrant-card" style={{ padding: "4px 28px" }}>
              {[
                { title: "Duplicate submit: one booking only", status: "Pass" },
                { title: "Failure mid-plan: fully rolled back", status: "Pass" },
                { title: "Over budget: blocked", status: "Pass" },
                { title: "Changed after approval: rejected", status: "Pass" },
                { title: "Injected instruction: ignored", status: "Pass" },
                { title: "Expired grant: blocked", status: "Pass" },
                { title: "No approval: blocked", status: "Pass" },
                { title: "Timeout: resolved, no duplicate", status: "Pass" },
                { title: "Altered receipt: signature rejected", status: "Pass" },
                { title: "Undo during hold: cancelled, $0 spent", status: "Pass" }
              ].map((row, idx, arr) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 0",
                    borderBottom: idx === arr.length - 1 ? "none" : "1px solid var(--border-divider)",
                    fontSize: "16px",
                    color: "var(--text-main)"
                  }}
                >
                  <span>{row.title}</span>
                  <span style={{ color: "var(--text-teal)", fontWeight: "700" }}>{row.status}</span>
                </div>
              ))}
            </div>

            {/* Footer Copy */}
            <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>
              Mockup with sample results. In the real harness, each row links to the audit evidence for that test.
            </p>
          </div>
        )}

        {/* ========================================================
            SCREEN 5: YOUR ASSISTANT'S LIMITS (Matches "5 Your limits.png")
            ======================================================== */}
        {activeScreen === "limits" && (
          <div style={{ flex: 1, padding: "40px 60px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px", margin: "0 auto", width: "100%" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "38px", fontWeight: "700", letterSpacing: "-0.02em", color: "var(--text-main)", marginBottom: "6px" }}>
                  Your assistant's limits
                </h1>
                <p style={{ fontSize: "16px", color: "var(--text-muted)" }}>
                  You set these on your phone. The assistant can read them but can never change them.
                </p>
              </div>
              <span className="pill-badge">Sample data</span>
            </div>

            {/* White Limits Configuration Card */}
            <div className="warrant-card" style={{ padding: "8px 28px" }}>
              {/* Total Budget */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: "1px solid var(--border-divider)" }}>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "3px" }}>Total budget</h3>
                  <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>The most it can spend in total</p>
                </div>
                <span style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-main)" }}>$500</span>
              </div>

              {/* Ask Me Above */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: "1px solid var(--border-divider)" }}>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "3px" }}>Ask me above</h3>
                  <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Anything bigger needs your approval</p>
                </div>
                <span style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-main)" }}>$200</span>
              </div>

              {/* Allowed Actions */}
              <div style={{ padding: "18px 0", borderBottom: "1px solid var(--border-divider)" }}>
                <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "10px" }}>Allowed actions</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span className="pill-badge pill-badge-teal">Hotels</span>
                  <span className="pill-badge pill-badge-teal">Trains</span>
                  <span className="pill-badge" style={{ color: "var(--text-muted)" }}>Restaurants (off)</span>
                </div>
              </div>

              {/* Expires */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: "1px solid var(--border-divider)" }}>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "3px" }}>Expires</h3>
                  <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Access ends on its own</p>
                </div>
                <span style={{ fontSize: "19px", fontWeight: "700", color: "var(--text-main)" }}>In 2 hours</span>
              </div>

              {/* Undo Window */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0" }}>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: "600", color: "var(--text-main)", marginBottom: "3px" }}>Undo window</h3>
                  <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Time to cancel before it is final</p>
                </div>
                <span style={{ fontSize: "19px", fontWeight: "700", color: "var(--text-main)" }}>8 seconds</span>
              </div>
            </div>

            {/* Teal Explanatory Box */}
            <div style={{ background: "var(--bg-teal-light)", border: "1px solid var(--border-teal)", borderRadius: "16px", padding: "18px 22px", fontSize: "15px", color: "var(--text-teal)", lineHeight: "1.45" }}>
              The assistant never sees a way to raise its own budget or turn on new actions. Only you can, from this screen.
            </div>

            {/* Save Limits Button */}
            <button
              onClick={() => setActiveScreen("console")}
              className="btn-teal"
              style={{ width: "100%", padding: "16px", fontSize: "16px" }}
            >
              Save limits
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
