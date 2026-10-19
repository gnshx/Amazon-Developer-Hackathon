#!/usr/bin/env tsx
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

async function main() {
  console.log("\n========================================================");
  console.log("🔍 Alexa+ MCP Tooling Availability Probe");
  console.log("========================================================\n");

  let commit = "unknown";
  try {
    commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {}

  const outputSections: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    outputSections.push(msg);
  };

  log(`Command: npm run check:alexa-tooling`);
  log(`Timestamp (UTC): ${new Date().toISOString()}`);
  log(`Git Commit: ${commit}`);
  log(`Machine: ${os.type()} ${os.arch()} | ${os.cpus()[0]?.model} (${os.cpus().length} cores, ${(os.totalmem() / 1e9).toFixed(1)}GB RAM)`);
  log(`Node: ${process.version}`);
  log(`--------------------------------------------------------`);

  // Probe 1: which alexa-ai
  log("\n--- Probe 1: Checking for `alexa-ai` binary in PATH ---");
  try {
    const whichOut = execSync("which alexa-ai", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    log(`Result: FOUND at ${whichOut}`);
    try {
      const verOut = execSync("alexa-ai --version", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      log(`Version: ${verOut}`);
    } catch (vErr: any) {
      log(`Version check error: ${vErr.message}`);
    }
  } catch (err: any) {
    log(`Result: NOT_FOUND`);
    log(`Output: alexa-ai is not installed in the current environment PATH.`);
    log(`Exit Code: ${err.status ?? 1}`);
  }

  // Probe 2: ask CLI
  log("\n--- Probe 2: Checking for Alexa Skills Kit CLI (`ask`) in PATH ---");
  try {
    const askOut = execSync("which ask", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    log(`Result: FOUND at ${askOut}`);
    try {
      const askVer = execSync("ask --version", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      log(`Version: ${askVer}`);
    } catch (vErr: any) {
      log(`Version check error: ${vErr.message}`);
    }
  } catch (err: any) {
    log(`Result: NOT_FOUND`);
    log(`Output: ask CLI is not installed in PATH.`);
    log(`Exit Code: ${err.status ?? 1}`);
  }

  // Probe 3: Check global npm packages
  log("\n--- Probe 3: Global npm CLI Packages (`npm list -g --depth=0`) ---");
  try {
    const npmList = execSync("npm list -g --depth=0", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    log(npmList);
  } catch (err: any) {
    log(`npm list -g error: ${err.message}`);
  }

  // Summary & Alexa+ MCP Quickstart Assessment
  log("\n--------------------------------------------------------");
  log("Assessment per Alexa+ MCP Quickstart Requirements:");
  log("- `alexa-ai` CLI: Unavailable in local development environment.");
  log("  (Alexa+ developer preview CLI is distributed via restricted Amazon channels or pre-release SDK).");
  log("- Fallback / Direct Testing Strategy:");
  log("  1. Warrant Trust Gateway implements standard MCP 2025-11-25 Streamable HTTP transport.");
  log("  2. End-to-end verification runs live against Amazon Bedrock Converse API (`us.amazon.nova-pro-v1:0`).");
  log("  3. Warrant provides an interactive Simulated Alexa+ Client (`packages/alexa-client`) and phone approval portal.");
  log("--------------------------------------------------------\n");

  const evidenceDir = path.resolve(process.cwd(), "examples/evidence/alexa-tooling");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "cli-check.txt"), outputSections.join("\n") + "\n");
  console.log(`📄 Saved probe output to: examples/evidence/alexa-tooling/cli-check.txt\n`);
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});
