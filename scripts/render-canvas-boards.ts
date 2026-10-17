import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const assetsDir = path.join(process.cwd(), "docs", "assets");
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. BOARD 4: 10/10 SCORECARD HTML
const board4Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0b0f19;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 32px;
    width: 1120px;
    height: 1580px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .card {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 20px;
    margin-bottom: 20px;
  }
  .title-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .shield-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #3b82f6, #10b981);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  h1 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #ffffff;
  }
  .subtitle {
    font-size: 13px;
    color: #94a3b8;
    margin-top: 3px;
  }
  .score-badge {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.4);
    color: #34d399;
    padding: 8px 16px;
    border-radius: 9999px;
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .score-badge::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 10px #10b981;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    flex: 1;
  }
  th {
    text-align: left;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    color: #94a3b8;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  td {
    padding: 13px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
  }
  tr:last-child td {
    border-bottom: none;
  }
  .id-col {
    font-weight: 700;
    color: #38bdf8;
    font-family: monospace;
    font-size: 12px;
  }
  .name-col {
    font-weight: 600;
    color: #f1f5f9;
  }
  .inv-tag {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }
  .pass-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 12px;
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 11px;
    color: #64748b;
  }
  .sample-pill {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="title-group">
      <div class="shield-icon">🛡️</div>
      <div>
        <h1>Warrant Siege Safety Scorecard</h1>
        <div class="subtitle">Adversarial verification of 10 architectural invariants over MCP Streamable HTTP</div>
      </div>
    </div>
    <div class="score-badge">11 of 11 Passed</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50px;">ID</th>
        <th>Attack Scenario</th>
        <th>Target Invariant</th>
        <th>Expected Safety Outcome</th>
        <th style="text-align: right;">Result</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="id-col">S1</td>
        <td class="name-col">Duplicate Submit Storm</td>
        <td><span class="inv-tag">I1 Idempotency</span></td>
        <td>10 concurrent requests; 1 booked, 0 duplicates</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S2</td>
        <td class="name-col">Mid-Plan Partial Failure</td>
        <td><span class="inv-tag">I4 Clean Residue</span></td>
        <td>Train drops; hotel auto-compensated ($0 residue)</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S3</td>
        <td class="name-col">Spend Cap Overflow</td>
        <td><span class="inv-tag">I2 Absolute Cap</span></td>
        <td>$300 trip rejected against $150 remaining budget</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S4</td>
        <td class="name-col">Approval Parameter Tampering</td>
        <td><span class="inv-tag">I3 Approval Bind</span></td>
        <td>Mutated args fail RFC 8785 canonical hash check</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S5</td>
        <td class="name-col">Response Prompt Injection</td>
        <td><span class="inv-tag">I5 Containment</span></td>
        <td>Jailbreak in provider text cannot escalate grants</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S6</td>
        <td class="name-col">Expired / Revoked Grant</td>
        <td><span class="inv-tag">I6 Temporal Boundary</span></td>
        <td>Actions denied with deterministic 403 Forbidden</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S7</td>
        <td class="name-col">Unapproved T2 Bypass</td>
        <td><span class="inv-tag">I3 Approval Bind</span></td>
        <td>High-risk hotel booking blocked without token</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S8</td>
        <td class="name-col">Ambiguous Network Timeout</td>
        <td><span class="inv-tag">I8 Reconciliation</span></td>
        <td>Provider state actively queried; no blind retry</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S9</td>
        <td class="name-col">Altered Receipt Tampering</td>
        <td><span class="inv-tag">I9 Signed Receipts</span></td>
        <td>Altered receipt rejected; detached Ed25519 signature fails</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S10</td>
        <td class="name-col">Undo During Hold Window</td>
        <td><span class="inv-tag">I10 Grace Hold</span></td>
        <td>Undo during hold cancelled with $0 spent (pre-settled)</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
      <tr>
        <td class="id-col">S11</td>
        <td class="name-col">Cross-User Plan & Budget Isolation</td>
        <td><span class="inv-tag">I6 User Boundary</span></td>
        <td>Cross-user access denied (403); budgets isolated across users</td>
        <td style="text-align: right;"><span class="pass-badge">✓ PASS</span></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <span>Verified via @warrant/siege CLI • Model Context Protocol 2025-11-25</span>
    <span class="sample-pill">Simulated Test Suite Verification</span>
  </div>
</div>
</body>
</html>`;

// 2. BOARD 5: ASSISTANT'S LIMITS HTML
const board5Html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0b0f19;
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 36px;
    width: 1400px;
    height: 1050px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .card {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 36px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 24px;
    margin-bottom: 28px;
  }
  .title-group {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .key-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #8b5cf6, #3b82f6);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
  }
  h1 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #ffffff;
  }
  .subtitle {
    font-size: 14px;
    color: #94a3b8;
    margin-top: 4px;
  }
  .oob-badge {
    background: rgba(139, 92, 246, 0.15);
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #c4b5fd;
    padding: 8px 16px;
    border-radius: 9999px;
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .oob-badge::before {
    content: "🔒";
    font-size: 12px;
  }
  .banner-notice {
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 28px;
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 13.5px;
    color: #e2e8f0;
    line-height: 1.5;
  }
  .banner-notice strong {
    color: #38bdf8;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    flex: 1;
  }
  .limit-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 22px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s;
  }
  .limit-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .limit-val {
    font-size: 32px;
    font-weight: 800;
    color: #ffffff;
    margin: 12px 0 8px 0;
    letter-spacing: -0.02em;
  }
  .limit-desc {
    font-size: 12.5px;
    color: #cbd5e1;
    line-height: 1.45;
  }
  .limit-meta {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 11px;
    font-weight: 600;
    color: #38bdf8;
    display: flex;
    justify-content: space-between;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 12px;
    color: #64748b;
  }
  .sample-pill {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
  }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="title-group">
      <div class="key-icon">⚙️</div>
      <div>
        <h1>Your Assistant's Limits</h1>
        <div class="subtitle">Out-of-band household authority defined exclusively by the account holder</div>
      </div>
    </div>
    <div class="oob-badge">Out-of-Band Control</div>
  </div>

  <div class="banner-notice">
    <div style="font-size: 22px;">🛡️</div>
    <div>
      <strong>Strict Out-of-Band Authority:</strong> Limits are configured directly on your mobile device via the Admin REST API. The voice assistant can <em>read</em> these constraints to answer questions, but can <strong>never alter, raise, or bypass</strong> them.
    </div>
  </div>

  <div class="grid">
    <!-- Card 1: Budget -->
    <div class="limit-card" style="border-top: 3px solid #10b981;">
      <div>
        <div class="limit-label">💰 Maximum Spend Cap</div>
        <div class="limit-val" style="color: #34d399;">$500.00</div>
        <div class="limit-desc">Total cumulative spend allowed across all multi-step travel and dining actions. Absolute minor-unit integer check.</div>
      </div>
      <div class="limit-meta">
        <span>Invariant: I2 Absolute Spend Cap</span>
        <span style="color: #10b981;">Hard Ceiling</span>
      </div>
    </div>

    <!-- Card 2: Approval Threshold -->
    <div class="limit-card" style="border-top: 3px solid #f59e0b;">
      <div>
        <div class="limit-label">📱 Approval Threshold</div>
        <div class="limit-val" style="color: #fbbf24;">$200.00</div>
        <div class="limit-desc">Any single action or booking above $200 requires explicit cryptographic approval sent to your personal phone.</div>
      </div>
      <div class="limit-meta">
        <span>Invariant: I3 Approval Binding</span>
        <span style="color: #f59e0b;">T2 High-Risk Gate</span>
      </div>
    </div>

    <!-- Card 3: Action Scopes -->
    <div class="limit-card" style="border-top: 3px solid #38bdf8;">
      <div>
        <div class="limit-label">🎯 Allowed Actions</div>
        <div class="limit-val" style="font-size: 24px; color: #38bdf8; font-family: monospace; padding-top: 8px;">hotel:*, train:*, dining:*</div>
        <div class="limit-desc">The assistant is restricted strictly to these tool categories. Administrative, financial transfer, and credential tools are disabled.</div>
      </div>
      <div class="limit-meta">
        <span>Invariant: I5 Output Containment</span>
        <span style="color: #38bdf8;">Scoped Granularly</span>
      </div>
    </div>

    <!-- Card 4: Undo Window -->
    <div class="limit-card" style="border-top: 3px solid #8b5cf6;">
      <div>
        <div class="limit-label">⏱️ Undo Grace Window</div>
        <div class="limit-val" style="color: #c4b5fd;">8 Seconds</div>
        <div class="limit-desc">High-risk actions enter an 8-second pre-settled hold before committing. Cancellation halts execution with $0 spent.</div>
      </div>
      <div class="limit-meta">
        <span>Invariant: I10 Grace-Hold Containment</span>
        <span style="color: #8b5cf6;">Instant Abort</span>
      </div>
    </div>

    <!-- Card 5: Expiration -->
    <div class="limit-card" style="border-top: 3px solid #ec4899;">
      <div>
        <div class="limit-label">⏳ Grant Expiration</div>
        <div class="limit-val" style="font-size: 26px; color: #f472b6;">24 Hours</div>
        <div class="limit-desc">Grant automatically expires at the end of the session. After expiration, all action requests return deterministic 403 Forbidden.</div>
      </div>
      <div class="limit-meta">
        <span>Invariant: I6 Temporal Boundary</span>
        <span style="color: #f472b6;">Auto-Revoke</span>
      </div>
    </div>

    <!-- Card 6: Audit Receipt Rule -->
    <div class="limit-card" style="border-top: 3px solid #06b6d4;">
      <div>
        <div class="limit-label">📜 Signed Action Receipts</div>
        <div class="limit-val" style="font-size: 24px; color: #22d3ee;">Ed25519 Detached</div>
        <div class="limit-desc">Every confirmed external provider effect emits an immutable, cryptographically verifiable receipt over RFC 8785 canonical data.</div>
      </div>
      <div class="limit-meta">
        <span>Invariant: I9 Receipt Authenticity</span>
        <span style="color: #06b6d4;">Tamper-Proof</span>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>Configured via Out-of-Band Admin Channel (Admin REST API) • Warrant Trust Gateway</span>
    <span class="sample-pill">Simulated Sample Limits (Configurable by User)</span>
  </div>
</div>
</body>
</html>`;

const tmpB4 = "/tmp/board4.html";
const tmpB5 = "/tmp/board5.html";

fs.writeFileSync(tmpB4, board4Html);
fs.writeFileSync(tmpB5, board5Html);

console.log("Rendering Board 4 to docs/assets/4-safety-scorecard.png...");
execSync(
  `google-chrome --headless --no-sandbox --disable-gpu --force-device-scale-factor=2 --window-size=1120,1580 --screenshot="${path.join(assetsDir, "4-safety-scorecard.png")}" ${tmpB4}`
);

console.log("Rendering Board 5 to docs/assets/5-assistants-limits.png...");
execSync(
  `google-chrome --headless --no-sandbox --disable-gpu --force-device-scale-factor=2 --window-size=1400,1050 --screenshot="${path.join(assetsDir, "5-assistants-limits.png")}" ${tmpB5}`
);

console.log("✅ Rendered high-res assets for Board 4 & Board 5!");
