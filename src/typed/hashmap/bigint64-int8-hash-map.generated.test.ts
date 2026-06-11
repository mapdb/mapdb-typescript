// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.


import { describe, it, expect } from "vitest";
import { BigInt64Int8HashMap } from "./bigint64-int8-hash-map.js";

describe("BigInt64Int8HashMap generated", () => {
  it("put and get", () => {
    const m = new BigInt64Int8HashMap();
    m.set(1n, 1);
    m.set(2n, 2);
    m.set(3n, 3);
    expect(m.get(1n)).toBe(1);
    expect(m.get(99n)).toBeUndefined();
    expect(m.size()).toBe(3);
  });
  it("put overwrite", () => {
    const m = new BigInt64Int8HashMap();
    m.set(1n, 1);
    const old = m.set(1n, 2);
    expect(old).toBe(1);
    expect(m.get(1n)).toBe(2);
  });
  it("remove", () => {
    const m = new BigInt64Int8HashMap();
    m.set(1n, 1);
    m.set(2n, 2);
    expect(m.remove(1n)).toBe(1);
    expect(m.size()).toBe(1);
    expect(m.has(1n)).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new BigInt64Int8HashMap();
    m.set(1n, 1);
    expect(m.getOrDefault(1n, 3)).toBe(1);
    expect(m.getOrDefault(99n, 3)).toBe(3);
  });
  it("isEmpty and clear", () => {
    const m = new BigInt64Int8HashMap();
    expect(m.isEmpty()).toBe(true);
    m.set(1n, 1);
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select", () => {
    const m = new BigInt64Int8HashMap();
    m.set(1n, 1);
    m.set(2n, 2);
    m.set(3n, 3);
    expect(m.select((_k, v) => v > 1).size()).toBe(2);
  });
  it("anySatisfy / allSatisfy", () => {
    const m = new BigInt64Int8HashMap();
    m.set(1n, 1);
    m.set(2n, 2);
    expect(m.anySatisfy((_k, v) => v === 2)).toBe(true);
    expect(m.allSatisfy((_k, v) => v > 0)).toBe(true);
  });
  it("resize", () => {
    const m = new BigInt64Int8HashMap();
    for (let i = 0n; i < 100n; i += 1n) m.set(i, Number(i) * 10);
    expect(m.size()).toBe(100);
  });
  it("memoryBytes", () => {
    const m = new BigInt64Int8HashMap(64);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const m = new BigInt64Int8HashMap();
    m.set(1n, 1);
    expect(m.toString()).not.toBe("");
  });
});
