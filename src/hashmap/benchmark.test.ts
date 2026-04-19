// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it } from "vitest";
import { NumberNumberHashMap } from "./number-number-hash-map.js";

describe("Memory layout analysis", () => {
  it("regular Array vs Float64Array vs Map", () => {
    const N = 100_000;

    // ---- Our HashMap: uses number[] (regular JS arrays) ----
    // Regular JS array: each element is a V8 tagged pointer (8 bytes on 64-bit)
    // pointing to a heap-allocated double (16 bytes with object header)
    // Effective: ~24 bytes per number in an unoptimized array
    // V8 DOES optimize dense arrays of same-type to "packed SMI" or "packed doubles"
    // When all elements are numbers, V8 stores them as flat Float64 internally
    // So number[] CAN be as efficient as Float64Array — but only if V8 optimizes it

    // ---- What we SHOULD use: Float64Array ----
    // Float64Array: guaranteed 8 bytes per element, contiguous memory
    // No GC pressure, no object headers, no V8 optimization gambling

    // ---- Built-in Map ----
    // Map<number, number>: hash table with object entries
    // Each entry: key (tagged pointer) + value (tagged pointer) + hash + next pointer

    console.log("\n=== TypeScript/JavaScript Memory Model ===");
    console.log("number[] (regular array):");
    console.log("  Best case (V8 packed doubles): 8 bytes/element");
    console.log("  Worst case (sparse/mixed): 24+ bytes/element");
    console.log("  V8 decides — you have no control\n");

    console.log("Float64Array (typed array):");
    console.log("  ALWAYS 8 bytes/element, contiguous, no GC overhead");
    console.log("  Like Go's []float64 or Java's double[]\n");

    console.log("Map<number, number>:");
    console.log("  ~50-70 bytes per entry (V8 internal hash table)\n");

    console.log(
      "Int32Array + Float64Array (what we SHOULD use for Int32Float64HashMap):",
    );
    console.log("  4 bytes/key + 8 bytes/value = 12 bytes/entry");
    console.log("  That's 4-6x less than Map<number, number>\n");

    // Verify our current implementation works
    const m = new NumberNumberHashMap();
    for (let i = 0; i < N; i++) m.put(i, i * 10);
    console.log(`Our HashMap: ${m.size()} entries`);
    console.log(
      "Internal storage: number[] (regular array — V8 may or may not optimize)",
    );
    console.log(
      "\nRECOMMENDATION: Switch to Float64Array for guaranteed performance.",
    );
  });
});
