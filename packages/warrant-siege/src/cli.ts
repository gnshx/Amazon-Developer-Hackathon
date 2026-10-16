#!/usr/bin/env node
import { Command } from "commander";
import { SiegeRunner } from "./runner.js";
import { generateScorecardHtml, generateScorecardJson } from "./reporter.js";
import * as path from "node:path";

const program = new Command();

program
  .name("warrant-siege")
  .description("Adversarial safety test harness and automated scorecard generator for voice agent gateways")
  .version("1.0.0")
  .option("-t, --target <url>", "Target Warrant Gateway MCP URL", "http://localhost:8000/mcp")
  .option("-a, --admin <url>", "Target Warrant Gateway Admin API URL", "http://localhost:8000/admin")
  .option("-o, --out <path>", "Path to write HTML scorecard", "./scorecard.html")
  .option("-j, --json <path>", "Path to write JSON scorecard", "./scorecard.json")
  .action(async (options) => {
    console.log("\n========================================================");
    console.log("🛡️  WARRANT SIEGE: Adversarial Voice Gateway Harness");
    console.log("========================================================");
    console.log(`Target MCP:  ${options.target}`);
    console.log(`Admin API:   ${options.admin}`);
    console.log(`HTML Report: ${options.out}`);
    console.log(`JSON Report: ${options.json}`);
    console.log("--------------------------------------------------------\n");

    const runner = new SiegeRunner(options.target, options.admin);

    try {
      console.log("Executing 8 Core Adversarial Scenarios (S1 – S8)...\n");
      const scorecard = await runner.runAll();

      for (const res of scorecard.results) {
        const mark = res.passed ? "✅ [PASS]" : "❌ [FAIL]";
        console.log(`${mark} ${res.scenarioId}: ${res.name} (${res.durationMs}ms)`);
        console.log(`      ↳ Invariant: ${res.targetInvariant} | ${res.assertion}`);
      }

      console.log("\n--------------------------------------------------------");
      console.log("Architectural Invariants Verification:");
      for (const [id, inv] of Object.entries(scorecard.invariants)) {
        const mark = inv.satisfied ? "✅ SATISFIED" : "❌ BREACHED";
        console.log(`  ${id} [${mark}]: ${inv.name}`);
      }

      console.log("\nCryptographic Audit Trail:");
      console.log(`  Tip Hash: ${scorecard.auditProofHash}`);

      const htmlPath = path.resolve(process.cwd(), options.out);
      const jsonPath = path.resolve(process.cwd(), options.json);

      await generateScorecardHtml(scorecard, htmlPath);
      await generateScorecardJson(scorecard, jsonPath);

      console.log("\n========================================================");
      console.log(`Scorecard: ${scorecard.passedScenarios}/${scorecard.totalScenarios} Scenarios Passed`);
      console.log(`HTML Scorecard saved to: ${htmlPath}`);
      console.log(`JSON Scorecard saved to: ${jsonPath}`);
      console.log("========================================================\n");

      if (scorecard.allInvariantsSatisfied) {
        console.log("🎉 ALL INVARIANTS SATISFIED. Gateway certified safe.\n");
        process.exit(0);
      } else {
        console.error("⚠️ SAFETY FAILURE: One or more invariants were breached.\n");
        process.exit(1);
      }
    } catch (err: any) {
      console.error("\n❌ Siege Execution Error:", err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
