// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberTreeSet } from "./number-tree-set.js";

describe("NumberTreeSet", () => {
  it("add and contains", () => {
    const s = new NumberTreeSet();
    s.add(3);
    s.add(1);
    s.add(2);
    expect(s.size()).toBe(3);
    expect(s.contains(2)).toBe(true);
    expect(s.contains(99)).toBe(false);
  });

  it("add duplicate returns false", () => {
    const s = new NumberTreeSet();
    expect(s.add(1)).toBe(true);
    expect(s.add(1)).toBe(false);
    expect(s.size()).toBe(1);
  });

  it("sorted iteration", () => {
    const s = NumberTreeSet.of([50, 10, 30, 20, 40]);
    expect([...s.values()]).toEqual([10, 20, 30, 40, 50]);
  });

  it("min and max", () => {
    const s = NumberTreeSet.of([30, 10, 50]);
    expect(s.min()).toBe(10);
    expect(s.max()).toBe(50);
  });

  it("floor and ceiling", () => {
    const s = NumberTreeSet.of([10, 20, 30]);
    expect(s.floor(25)).toBe(20);
    expect(s.ceiling(25)).toBe(30);
  });

  it("union and intersect", () => {
    const a = NumberTreeSet.of([1, 2, 3]);
    const b = NumberTreeSet.of([3, 4, 5]);
    expect(a.union(b).size()).toBe(5);
    expect(a.intersect(b).size()).toBe(1);
    expect(a.difference(b).size()).toBe(2);
  });

  it("remove", () => {
    const s = NumberTreeSet.of([1, 2, 3, 4, 5]);
    s.remove(3);
    expect(s.size()).toBe(4);
    expect(s.contains(3)).toBe(false);
    const values = [...s.values()];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
