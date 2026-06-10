// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.


import { describe, it, expect } from "vitest";
import { BigInt64BigInt64HashMap } from "./bigint64-bigint64-hash-map.js";

describe("BigInt64BigInt64HashMap generated", () => {
  it("put and get", () => {
    const m = new BigInt64BigInt64HashMap();
    m.put(1n, 1n);
    m.put(2n, 2n);
    m.put(3n, 3n);
    expect(m.get(1n)).toBe(1n);
    expect(m.get(99n)).toBeUndefined();
    expect(m.size()).toBe(3);
  });
  it("put overwrite", () => {
    const m = new BigInt64BigInt64HashMap();
    m.put(1n, 1n);
    const old = m.put(1n, 2n);
    expect(old).toBe(1n);
    expect(m.get(1n)).toBe(2n);
  });
  it("remove", () => {
    const m = new BigInt64BigInt64HashMap();
    m.put(1n, 1n);
    m.put(2n, 2n);
    expect(m.remove(1n)).toBe(1n);
    expect(m.size()).toBe(1);
    expect(m.containsKey(1n)).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new BigInt64BigInt64HashMap();
    m.put(1n, 1n);
    expect(m.getOrDefault(1n, 3n)).toBe(1n);
    expect(m.getOrDefault(99n, 3n)).toBe(3n);
  });
  it("isEmpty and clear", () => {
    const m = new BigInt64BigInt64HashMap();
    expect(m.isEmpty()).toBe(true);
    m.put(1n, 1n);
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select", () => {
    const m = new BigInt64BigInt64HashMap();
    m.put(1n, 1n);
    m.put(2n, 2n);
    m.put(3n, 3n);
    expect(m.select((_k, v) => v > 1n).size()).toBe(2);
  });
  it("anySatisfy / allSatisfy", () => {
    const m = new BigInt64BigInt64HashMap();
    m.put(1n, 1n);
    m.put(2n, 2n);
    expect(m.anySatisfy((_k, v) => v === 2n)).toBe(true);
    expect(m.allSatisfy((_k, v) => v > 0n)).toBe(true);
  });
  it("resize", () => {
    const m = new BigInt64BigInt64HashMap();
    for (let i = 0n; i < 100n; i += 1n) m.put(i, i * 10n);
    expect(m.size()).toBe(100);
  });
  it("memoryBytes", () => {
    const m = new BigInt64BigInt64HashMap(64);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const m = new BigInt64BigInt64HashMap();
    m.put(1n, 1n);
    expect(m.toString()).not.toBe("");
  });
});
