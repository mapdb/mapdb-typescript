// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { Int32HashSet } from "./int32-hash-set.js";

describe("Int32HashSet generated", () => {
  it("add and contains", () => {
    const s = new Int32HashSet();
    s.add(1);
    s.add(2);
    s.add(3);
    expect(s.size()).toBe(3);
    expect(s.contains(2)).toBe(true);
    expect(s.contains(99)).toBe(false);
  });
  it("add duplicate", () => {
    const s = new Int32HashSet();
    expect(s.add(1)).toBe(true);
    expect(s.add(1)).toBe(false);
    expect(s.size()).toBe(1);
  });
  it("remove", () => {
    const s = new Int32HashSet();
    s.add(1);
    s.add(2);
    expect(s.remove(1)).toBe(true);
    expect(s.contains(1)).toBe(false);
    expect(s.remove(99)).toBe(false);
  });
  it("isEmpty and clear", () => {
    const s = new Int32HashSet();
    expect(s.isEmpty()).toBe(true);
    s.add(1);
    expect(s.isEmpty()).toBe(false);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });
  it("union", () => {
    const a = new Int32HashSet();
    a.add(1);
    a.add(2);
    const b = new Int32HashSet();
    b.add(2);
    b.add(3);
    expect(a.union(b).size()).toBe(3);
  });
  it("intersect", () => {
    const a = new Int32HashSet();
    a.add(1);
    a.add(2);
    const b = new Int32HashSet();
    b.add(2);
    b.add(3);
    expect(a.intersect(b).size()).toBe(1);
  });
  it("difference", () => {
    const a = new Int32HashSet();
    a.add(1);
    a.add(2);
    const b = new Int32HashSet();
    b.add(2);
    b.add(3);
    expect(a.difference(b).size()).toBe(1);
  });
  it("select", () => {
    const s = new Int32HashSet();
    s.add(1);
    s.add(2);
    s.add(3);
    expect(s.select((v) => v > 1).size()).toBe(2);
  });
  it("memoryBytes", () => {
    const s = new Int32HashSet(64);
    expect(s.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const s = new Int32HashSet();
    s.add(1);
    expect(s.toString()).not.toBe("");
  });
});
