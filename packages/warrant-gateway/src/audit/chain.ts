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
