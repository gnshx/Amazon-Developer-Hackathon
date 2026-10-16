import { createHash } from "node:crypto";

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) Implementation.
 * Ensures deterministic string representation regardless of key order, whitespace, or runtime hashing.
 */
export function canonicalizeJson(data: unknown): string {
  if (data === null || data === undefined) {
    return "null";
  }

  if (typeof data === "boolean") {
    return data ? "true" : "false";
  }

  if (typeof data === "number") {
    if (!Number.isFinite(data)) {
      throw new Error(`Cannot canonicalize non-finite number: ${data}`);
    }
    // Handle -0 normalization to 0 per RFC 8785
    if (Object.is(data, -0)) {
      return "0";
    }
    return JSON.stringify(data);
  }

  if (typeof data === "string") {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    const serializedElements = data.map((item) => canonicalizeJson(item));
    return `[${serializedElements.join(",")}]`;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    // Sort keys lexicographically by UTF-16 code unit values
    const sortedKeys = Object.keys(obj).sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });

    const entries: string[] = [];
    for (const key of sortedKeys) {
      const val = obj[key];
      // Skip undefined fields in object serialization just like JSON.stringify
      if (val === undefined || typeof val === "symbol" || typeof val === "function") {
        continue;
      }
      entries.push(`${JSON.stringify(key)}:${canonicalizeJson(val)}`);
    }

    return `{${entries.join(",")}}`;
  }

  throw new Error(`Unsupported type for canonicalization: ${typeof data}`);
}

/**
 * Computes the deterministic SHA-256 hash of any JSON-serializable structure.
 */
export function canonicalSha256(data: unknown): string {
  const canonical = canonicalizeJson(data);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
