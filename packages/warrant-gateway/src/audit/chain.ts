import { createHash } from "node:crypto";
import { AuditEvent, AuditEventType } from "../types.js";
import { canonicalizeJson } from "../crypto/canonical.js";

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Computes the deterministic SHA-256 hash of an audit event chained to its predecessor.
 */
export function computeAuditEventHash(
  prevHash: string,
  seq: number,
  timestamp: string,
  eventType: AuditEventType,
  refId: string,
  payloadCanonical: string
): string {
  const content = `${prevHash}|${seq}|${timestamp}|${eventType}|${refId}|${payloadCanonical}`;
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Creates a new AuditEvent object with computed cryptographic hash.
 */
export function createAuditEvent(
  prevEvent: AuditEvent | null,
  eventType: AuditEventType,
  refId: string,
  payload: Record<string, unknown>,
  timestamp: string = new Date().toISOString()
): AuditEvent {
  const seq = prevEvent ? prevEvent.seq + 1 : 1;
  const prevHash = prevEvent ? prevEvent.hash : GENESIS_HASH;
  const payloadCanonical = canonicalizeJson(payload);
  const hash = computeAuditEventHash(prevHash, seq, timestamp, eventType, refId, payloadCanonical);

  return {
    seq,
    timestamp,
    eventType,
    refId,
    payloadCanonical,
    prevHash,
    hash
  };
}

export interface ChainVerificationResult {
  valid: boolean;
  eventCount: number;
  genesisHash: string;
  tipHash: string;
  error?: {
    seq: number;
    reason: string;
    expectedHash?: string;
    actualHash?: string;
  };
}

/**
 * Verifies the cryptographic continuity of an audit event chain from genesis to tip (Invariant I7).
 */
export function verifyAuditChain(events: AuditEvent[]): ChainVerificationResult {
  if (events.length === 0) {
    return {
      valid: true,
      eventCount: 0,
      genesisHash: GENESIS_HASH,
      tipHash: GENESIS_HASH
    };
  }

  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedSeq = i + 1;

    // Check sequence continuity
    if (event.seq !== expectedSeq) {
      return {
        valid: false,
        eventCount: events.length,
        genesisHash: GENESIS_HASH,
        tipHash: events[events.length - 1].hash,
        error: {
          seq: event.seq,
          reason: `Broken sequence: expected seq ${expectedSeq}, got ${event.seq}`
        }
      };
    }

    // Check predecessor hash link
    if (event.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        eventCount: events.length,
        genesisHash: GENESIS_HASH,
        tipHash: events[events.length - 1].hash,
        error: {
          seq: event.seq,
          reason: `Invalid prevHash link at seq ${event.seq}. Expected ${expectedPrevHash}, found ${event.prevHash}`
        }
      };
    }

    // Recompute and verify self hash
    const recomputedHash = computeAuditEventHash(
      event.prevHash,
      event.seq,
      event.timestamp,
      event.eventType,
      event.refId,
      event.payloadCanonical
    );

    if (recomputedHash !== event.hash) {
      return {
        valid: false,
        eventCount: events.length,
        genesisHash: GENESIS_HASH,
        tipHash: events[events.length - 1].hash,
        error: {
          seq: event.seq,
          reason: `Cryptographic hash mismatch at seq ${event.seq}. Data has been tampered with.`,
          expectedHash: recomputedHash,
          actualHash: event.hash
        }
      };
    }

    expectedPrevHash = event.hash;
  }

  return {
    valid: true,
    eventCount: events.length,
    genesisHash: GENESIS_HASH,
    tipHash: events[events.length - 1].hash
  };
}

// ================= Merkle Tree Checkpointing =================

export interface MerkleProofStep {
  position: "left" | "right";
  hash: string;
}

export interface MerkleProof {
  seq: number;
  leafHash: string;
  root: string;
  proof: MerkleProofStep[];
}

export function sha256Pair(a: string, b: string): string {
  return createHash("sha256").update(a + b, "utf8").digest("hex");
}

/**
 * Computes a binary Merkle tree root over an arbitrary list of SHA-256 hashes.
 */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return GENESIS_HASH;
  if (hashes.length === 1) return hashes[0];

  let currentLevel = [...hashes];
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      nextLevel.push(sha256Pair(left, right));
    }
    currentLevel = nextLevel;
  }
  return currentLevel[0];
}

/**
 * Generates an O(log N) Merkle inclusion proof for a specific event sequence.
 */
export function generateMerkleProof(events: AuditEvent[], targetSeq: number): MerkleProof {
  if (events.length === 0) {
    throw new Error("Cannot generate Merkle proof on empty audit log");
  }
  const targetIndex = targetSeq - 1;
  if (targetIndex < 0 || targetIndex >= events.length) {
    throw new Error(`Invalid event sequence ${targetSeq} for audit log of size ${events.length}`);
  }

  const leafHash = events[targetIndex].hash;
  const proof: MerkleProofStep[] = [];
  let currentLevel = events.map((e) => e.hash);
  let currentIndex = targetIndex;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

      if (i === currentIndex || i + 1 === currentIndex) {
        if (currentIndex % 2 === 0) {
          // Current is left, sibling is right
          proof.push({ position: "right", hash: right });
        } else {
          // Current is right, sibling is left
          proof.push({ position: "left", hash: left });
        }
      }

      nextLevel.push(sha256Pair(left, right));
    }

    currentIndex = Math.floor(currentIndex / 2);
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];
  return {
    seq: targetSeq,
    leafHash,
    root,
    proof
  };
}

/**
 * Verifies an O(log N) Merkle inclusion proof offline against an expected root hash.
 */
export function verifyMerkleProof(leafHash: string, proof: MerkleProofStep[], expectedRoot: string): boolean {
  let curr = leafHash;
  for (const step of proof) {
    if (step.position === "left") {
      curr = sha256Pair(step.hash, curr);
    } else {
      curr = sha256Pair(curr, step.hash);
    }
  }
  return curr === expectedRoot;
}

