// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashset`.


import { describe, it, expect } from "vitest";
import { BigInt64HashSet } from "./bigint64-hash-set.js";

describe("BigInt64HashSet generated", () => {
  it("add and contains", () => {
    const s = new BigInt64HashSet();
    s.add(1n);
    s.add(2n);
    s.add(3n);
    expect(s.size).toBe(3);
    expect(s.has(2n)).toBe(true);
    expect(s.has(99n)).toBe(false);
  });
  it("add duplicate", () => {
    const s = new BigInt64HashSet();
    expect(s.add(1n)).toBe(s); // add returns the set for chaining
    s.add(1n);
    expect(s.size).toBe(1);
  });
  it("remove", () => {
    const s = new BigInt64HashSet();
    s.add(1n);
    s.add(2n);
    expect(s.remove(1n)).toBe(true);
    expect(s.has(1n)).toBe(false);
    expect(s.remove(99n)).toBe(false);
  });
  it("isEmpty and clear", () => {
    const s = new BigInt64HashSet();
    expect(s.isEmpty()).toBe(true);
    s.add(1n);
    expect(s.isEmpty()).toBe(false);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });
  it("union", () => {
    const a = new BigInt64HashSet();
    a.add(1n);
    a.add(2n);
    const b = new BigInt64HashSet();
    b.add(2n);
    b.add(3n);
    expect(a.union(b).size).toBe(3);
  });
  it("intersect", () => {
    const a = new BigInt64HashSet();
    a.add(1n);
    a.add(2n);
    const b = new BigInt64HashSet();
    b.add(2n);
    b.add(3n);
    expect(a.intersect(b).size).toBe(1);
  });
  it("difference", () => {
    const a = new BigInt64HashSet();
    a.add(1n);
    a.add(2n);
    const b = new BigInt64HashSet();
    b.add(2n);
    b.add(3n);
    expect(a.difference(b).size).toBe(1);
  });
  it("select", () => {
    const s = new BigInt64HashSet();
    s.add(1n);
    s.add(2n);
    s.add(3n);
    expect(s.select((v) => v > 1n).size).toBe(2);
  });
  it("memoryBytes", () => {
    const s = new BigInt64HashSet(64);
    expect(s.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const s = new BigInt64HashSet();
    s.add(1n);
    expect(s.toString()).not.toBe("");
  });
});
