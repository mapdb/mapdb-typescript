// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.


import { describe, it, expect } from "vitest";
import { Int32BigInt64HashMap } from "./int32-bigint64-hash-map.js";

describe("Int32BigInt64HashMap generated", () => {
  it("set and get", () => {
    const m = new Int32BigInt64HashMap();
    m.set(1, 1n);
    m.set(2, 2n);
    m.set(3, 3n);
    expect(m.get(1)).toBe(1n);
    expect(m.get(99)).toBeUndefined();
    expect(m.size).toBe(3);
  });
  it("set overwrite", () => {
    const m = new Int32BigInt64HashMap();
    m.set(1, 1n);
    expect(m.set(1, 2n)).toBe(m); // set returns the map for chaining
    expect(m.get(1)).toBe(2n);
  });
  it("remove", () => {
    const m = new Int32BigInt64HashMap();
    m.set(1, 1n);
    m.set(2, 2n);
    expect(m.remove(1)).toBe(1n);
    expect(m.size).toBe(1);
    expect(m.has(1)).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new Int32BigInt64HashMap();
    m.set(1, 1n);
    expect(m.getOrDefault(1, 3n)).toBe(1n);
    expect(m.getOrDefault(99, 3n)).toBe(3n);
  });
  it("isEmpty and clear", () => {
    const m = new Int32BigInt64HashMap();
    expect(m.isEmpty()).toBe(true);
    m.set(1, 1n);
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select", () => {
    const m = new Int32BigInt64HashMap();
    m.set(1, 1n);
    m.set(2, 2n);
    m.set(3, 3n);
    expect(m.select((_k, v) => v > 1n).size).toBe(2);
  });
  it("anySatisfy / allSatisfy", () => {
    const m = new Int32BigInt64HashMap();
    m.set(1, 1n);
    m.set(2, 2n);
    expect(m.anySatisfy((_k, v) => v === 2n)).toBe(true);
    expect(m.allSatisfy((_k, v) => v > 0n)).toBe(true);
  });
  it("resize", () => {
    const m = new Int32BigInt64HashMap();
    for (let i = 0; i < 100; i += 1) m.set(i, BigInt(i) * 10n);
    expect(m.size).toBe(100);
  });
  it("memoryBytes", () => {
    const m = new Int32BigInt64HashMap(64);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const m = new Int32BigInt64HashMap();
    m.set(1, 1n);
    expect(m.toString()).not.toBe("");
  });
});
