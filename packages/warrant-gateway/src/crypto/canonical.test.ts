import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { canonicalizeJson, canonicalSha256 } from "./canonical.js";

describe("RFC 8785 Canonical JSON & SHA-256", () => {
  it("normalizes dictionary key ordering deterministically", () => {
    const objA = {
      price: 15000,
      hotel_id: "grand_plaza",
      guest: {
        last_name: "Smith",
        first_name: "Alice"
      },
      nights: 2
    };

    const objB = {
      nights: 2,
      hotel_id: "grand_plaza",
      price: 15000,
      guest: {
        first_name: "Alice",
        last_name: "Smith"
      }
    };

    const canonA = canonicalizeJson(objA);
    const canonB = canonicalizeJson(objB);

    expect(canonA).toBe(canonB);
    expect(canonicalSha256(objA)).toBe(canonicalSha256(objB));
  });

  it("handles primitives correctly per RFC 8785", () => {
    expect(canonicalizeJson(null)).toBe("null");
    expect(canonicalizeJson(true)).toBe("true");
    expect(canonicalizeJson(false)).toBe("false");
    expect(canonicalizeJson(42)).toBe("42");
    expect(canonicalizeJson(-0)).toBe("0");
    expect(canonicalizeJson("hello world")).toBe('"hello world"');
    expect(canonicalizeJson([1, 2, 3])).toBe("[1,2,3]");
  });

  it("produces distinct hashes when values differ by a single character or number", () => {
    const original = { hotel: "plaza", price: 15000 };
    const tampered = { hotel: "plaza", price: 15001 };

    expect(canonicalSha256(original)).not.toBe(canonicalSha256(tampered));
  });

  it("property test: key permutations produce identical canonical output", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        (strVal, intVal, boolVal) => {
          const dict1 = { a: strVal, b: intVal, c: boolVal };
          const dict2 = { c: boolVal, a: strVal, b: intVal };
          const dict3 = { b: intVal, c: boolVal, a: strVal };

          const hash1 = canonicalSha256(dict1);
          const hash2 = canonicalSha256(dict2);
          const hash3 = canonicalSha256(dict3);

          return hash1 === hash2 && hash2 === hash3;
        }
      ),
      { numRuns: 200 }
    );
  });
});
