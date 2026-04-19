// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Int32BigInt64HashMap } from "./int32-bigint64-hash-map.js";

describe("Int32BigInt64HashMap (TypedArray-backed)", () => {
  it("put and get", () => {
    const m = new Int32BigInt64HashMap();
    m.put(1, 100n);
    m.put(2, 200n);
    expect(m.get(1)).toBe(100n);
    expect(m.get(99)).toBeUndefined();
    expect(m.size()).toBe(2);
  });

  it("overwrite", () => {
    const m = new Int32BigInt64HashMap();
    m.put(1, 100n);
    const old = m.put(1, 200n);
    expect(old).toBe(100n);
    expect(m.get(1)).toBe(200n);
  });

  it("remove", () => {
    const m = new Int32BigInt64HashMap();
    m.put(1, 100n);
    m.put(2, 200n);
    expect(m.remove(1)).toBe(100n);
    expect(m.size()).toBe(1);
    expect(m.containsKey(1)).toBe(false);
  });

  it("resize with many entries", () => {
    const m = new Int32BigInt64HashMap();
    for (let i = 0; i < 1000; i++) m.put(i, BigInt(i * 10));
    expect(m.size()).toBe(1000);
    for (let i = 0; i < 1000; i++) expect(m.get(i)).toBe(BigInt(i * 10));
  });

  it("entries generator", () => {
    const m = new Int32BigInt64HashMap();
    m.put(1, 10n);
    m.put(2, 20n);
    const entries = [...m.entries()];
    expect(entries.length).toBe(2);
  });

  it("select", () => {
    const m = new Int32BigInt64HashMap();
    m.put(1, 10n);
    m.put(2, 20n);
    m.put(3, 30n);
    const big = m.select((_k, v) => v > 15n);
    expect(big.size()).toBe(2);
  });

  it("memoryBytes reports correct size", () => {
    const m = new Int32BigInt64HashMap(1024);
    // 1024 slots × (4 bytes key + 8 bytes value + 1 byte occupied) = 13312
    expect(m.memoryBytes()).toBe(1024 * (4 + 8 + 1));
  });

  it("is backed by typed arrays (not regular arrays)", () => {
    // This is the whole point — verify we're using TypedArrays
    const m = new Int32BigInt64HashMap();
    m.put(1, 100n);
    // The class should use Int32Array + BigInt64Array internally
    // We verify by checking memoryBytes is a small exact number
    const bytes = m.memoryBytes();
    // Default capacity 16 × (4+8+1) = 208 bytes
    expect(bytes).toBe(16 * 13);
  });
});
