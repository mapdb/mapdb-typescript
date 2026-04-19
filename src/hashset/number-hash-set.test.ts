// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberHashSet } from "./number-hash-set.js";

describe("NumberHashSet", () => {
  it("add and contains", () => {
    const s = new NumberHashSet();
    expect(s.add(1)).toBe(true);
    expect(s.add(2)).toBe(true);
    expect(s.add(1)).toBe(false); // duplicate
    expect(s.contains(1)).toBe(true);
    expect(s.contains(99)).toBe(false);
    expect(s.size()).toBe(2);
  });

  it("union and intersect", () => {
    const a = NumberHashSet.of([1, 2, 3]);
    const b = NumberHashSet.of([3, 4, 5]);
    expect(a.union(b).size()).toBe(5);
    expect(a.intersect(b).size()).toBe(1);
    expect(a.difference(b).size()).toBe(2);
  });

  it("select", () => {
    const s = NumberHashSet.of([1, 2, 3, 4, 5]);
    const evens = s.select((v) => v % 2 === 0);
    expect(evens.size()).toBe(2);
  });
});
