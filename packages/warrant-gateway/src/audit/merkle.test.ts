import { describe, it, expect } from "vitest";
import {
  computeMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  sha256Pair,
  GENESIS_HASH,
  createAuditEvent
} from "./chain.js";
import { AuditEvent } from "../types.js";

describe("Merkle Root Checkpointing & Inclusion Proofs", () => {
  it("computes deterministic roots for 0, 1, and 2 leaves", () => {
    expect(computeMerkleRoot([])).toBe(GENESIS_HASH);

    const h1 = "a".repeat(64);
    expect(computeMerkleRoot([h1])).toBe(h1);

    const h2 = "b".repeat(64);
    const expectedPair = sha256Pair(h1, h2);
    expect(computeMerkleRoot([h1, h2])).toBe(expectedPair);
  });

  it("handles odd numbers of leaves by duplicating the last node", () => {
    const h1 = "1".repeat(64);
    const h2 = "2".repeat(64);
    const h3 = "3".repeat(64);

    const level1_left = sha256Pair(h1, h2);
    const level1_right = sha256Pair(h3, h3);
    const expectedRoot = sha256Pair(level1_left, level1_right);

    expect(computeMerkleRoot([h1, h2, h3])).toBe(expectedRoot);
  });

  it("generates and verifies inclusion proofs for any leaf in an audit chain", () => {
    // Build a mock chain of 7 events
    const events: AuditEvent[] = [];
    let prev: AuditEvent | null = null;

    for (let i = 1; i <= 7; i++) {
      const event = createAuditEvent(prev, "GRANT_CREATED", `grant_${i}`, { index: i });
      events.push(event);
      prev = event;
    }

    const root = computeMerkleRoot(events.map((e) => e.hash));

    // Verify proof for every single event
    for (let seq = 1; seq <= 7; seq++) {
      const proofObj = generateMerkleProof(events, seq);
      expect(proofObj.seq).toBe(seq);
      expect(proofObj.root).toBe(root);
      expect(proofObj.leafHash).toBe(events[seq - 1].hash);

      const isValid = verifyMerkleProof(proofObj.leafHash, proofObj.proof, root);
      expect(isValid).toBe(true);
    }
  });

  it("rejects tampered leaf hashes or modified proof siblings", () => {
    const events: AuditEvent[] = [];
    let prev: AuditEvent | null = null;
    for (let i = 1; i <= 5; i++) {
      const event = createAuditEvent(prev, "PLAN_PROPOSED", `plan_${i}`, { cost: i * 100 });
      events.push(event);
      prev = event;
    }

    const root = computeMerkleRoot(events.map((e) => e.hash));
    const proofObj = generateMerkleProof(events, 3);

    // 1. Pristine proof is valid
    expect(verifyMerkleProof(proofObj.leafHash, proofObj.proof, root)).toBe(true);

    // 2. Tampered leaf hash fails
    const tamperedLeaf = "f".repeat(64);
    expect(verifyMerkleProof(tamperedLeaf, proofObj.proof, root)).toBe(false);

    // 3. Tampered sibling hash fails
    const tamperedProof = proofObj.proof.map((p, idx) =>
      idx === 0 ? { ...p, hash: "0".repeat(64) } : p
    );
    expect(verifyMerkleProof(proofObj.leafHash, tamperedProof, root)).toBe(false);

    // 4. Incorrect root fails
    const falseRoot = "9".repeat(64);
    expect(verifyMerkleProof(proofObj.leafHash, proofObj.proof, falseRoot)).toBe(false);
  });
});
