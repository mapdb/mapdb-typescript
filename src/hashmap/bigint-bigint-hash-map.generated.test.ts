// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.


import { describe, it, expect } from "vitest";
import { BigIntBigIntHashMap } from "./bigint-bigint-hash-map.js";

describe("BigIntBigIntHashMap generated", () => {
  it("put and get", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    m.set(2n, 2n);
    m.set(3n, 3n);
    expect(m.get(1n)).toBe(1n);
    expect(m.get(99n)).toBeUndefined();
    expect(m.size).toBe(3);
  });
  it("put overwrite", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    const old = m.set(1n, 2n);
    expect(old).toBe(1n);
    expect(m.get(1n)).toBe(2n);
  });
  it("remove", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    m.set(2n, 2n);
    const old = m.remove(1n);
    expect(old).toBe(1n);
    expect(m.size).toBe(1);
    expect(m.has(1n)).toBe(false);
  });
  it("containsKey", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    expect(m.has(1n)).toBe(true);
    expect(m.has(99n)).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    expect(m.getOrDefault(1n, 3n)).toBe(1n);
    expect(m.getOrDefault(99n, 3n)).toBe(3n);
  });
  it("clear and isEmpty", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select and reject", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    m.set(2n, 2n);
    m.set(3n, 3n);
    expect(m.select((_k, v) => v > 1n).size).toBe(2);
    expect(m.reject((_k, v) => v > 1n).size).toBe(1);
  });
  it("entries generator", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    m.set(2n, 2n);
    expect([...m.entries()].length).toBe(2);
  });
  it("keysToArray and valuesToArray", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    m.set(2n, 2n);
    expect(m.keysToArray().length).toBe(2);
    expect(m.valuesToArray().length).toBe(2);
  });
  it("injectInto", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    m.set(2n, 2n);
    const sum = m.injectInto(0n, (acc, _k, v) => acc + v);
    expect(sum).toBe(1n + 2n);
  });
  it("resize", () => {
    const m = new BigIntBigIntHashMap();
    for (let i = 0n; i < 100n; i += 1n) m.set(i, i * 10n);
    expect(m.size).toBe(100);
  });
  it("toString", () => {
    const m = new BigIntBigIntHashMap();
    m.set(1n, 1n);
    expect(m.toString()).not.toBe("");
  });
});
