# Warrant: Official Demo Video Script (2:42 Target)

**Target Runtime:** 2 minutes 42 seconds (162 seconds)  
**Track:** Amazon Developer Hackathon, Alexa+ Track  
**Pacing:** Deliberate, measured speech with pauses for on-screen action (~87 words per minute overall)  
**Total Word Count:** 234 words  
**Persistent Watermark (All Screens):**  
`Simulated Alexa+ client and providers · Amazon Bedrock (Nova Pro)`

---

## Shot-by-Shot Scene Breakdown

| Time | Screen | Caption | Spoken Line |
|---|---|---|---|
| **0:00 – 0:12** | Assistant console, live request, real-time MCP tool trace | Limited. Approved. Undoable. | Voice assistants are starting to book and buy for us, with no screen to check first. Warrant keeps every action limited, approved and undoable. |
| **0:12 – 0:50** | Plan proposed, phone approval card, booking confirmed, Ed25519 receipt modal; 8-second undo countdown plays silently | Approval locked to exact details | Anything above your limit needs approval on your phone. The approval is tied to a hash of the exact details, so if a date or price changes afterwards, it stops working. Every action gets a signed receipt anyone can verify offline. |
| **0:50 – 1:10** | Terminal / Inspector: one real tamper attempt submitted | Changed after approval? Rejected. | Here an agent tries to change the price after approval. The gateway rejects it. |
| **1:10 – 1:40** | Provider panel: Train declines, hotel automatically cancelled, provider bookings list empty | Step two failed. Step one undone. | When the train declines, the hotel booking is cancelled automatically. Nothing is charged and no booking is left. |
| **1:40 – 2:15** | Pre-recorded terminal: `npm run test:siege` green (11/11), then `npm run test:mutation` shows Scenario S4 red | Break a protection. The test goes red. | How do we know the protections work? Warrant Siege runs 11 attack scenarios. Switch off the approval check and the scorecard turns red. Switch it back on and it's green. |
| **2:15 – 2:30** | README compliance checklist showing Done and Not done rows, or MCP tools/list payload | Tested against Alexa+ MCP checklist | It speaks MCP over Streamable HTTP, ties limits to the signed-in user, and anyone can run the harness against their own server. |
| **2:30 – 2:42** | Title card with GitHub links and Simulated note | Limits you set. Proof you can check. | Warrant: limits you set, approval tied to the exact action, and receipts anyone can verify. |

---

## Recording Guidelines for Best Results

1. **Clip-by-Clip Recording:** Record each of the 7 scenes as an independent clip. Do not try to record the full 2:42 in a single continuous take.
2. **Narration Audio:** Record the human voiceover separately on a clean microphone, then lay it over the video track.
3. **Muted Legibility:** Ensure on-screen captions use large bold type (high contrast white text on dark pill background) so the core message is understood with the sound off.
4. **Resolution & Sizing:** Use 125% to 150% browser zoom in Chrome/Firefox. Hide browser bookmarks bar, notification popups, and OS taskbar icons.
5. **Mutation Scene (Take 2):** Pre-record `npm run test:mutation` in terminal with a clean font (size 16pt+). Do at least two takes to guarantee clean capture of the RED S4 detection.

