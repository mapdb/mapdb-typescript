// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Int32HashSet } from "./int32-hash-set.js";

describe("Int32HashSet (TypedArray-backed)", () => {
  it("add and contains", () => {
    const s = new Int32HashSet();
    expect(s.add(1)).toBe(true);
    expect(s.add(2)).toBe(true);
    expect(s.add(1)).toBe(false);
    expect(s.contains(1)).toBe(true);
    expect(s.contains(99)).toBe(false);
    expect(s.size()).toBe(2);
  });

  it("union and intersect", () => {
    const a = new Int32HashSet();
    a.add(1);
    a.add(2);
    a.add(3);
    const b = new Int32HashSet();
    b.add(3);
    b.add(4);
    b.add(5);
    expect(a.union(b).size()).toBe(5);
    expect(a.intersect(b).size()).toBe(1);
    expect(a.difference(b).size()).toBe(2);
  });

  it("remove", () => {
    const s = new Int32HashSet();
    s.add(1);
    s.add(2);
    s.add(3);
    expect(s.remove(2)).toBe(true);
    expect(s.size()).toBe(2);
    expect(s.contains(2)).toBe(false);
  });
});
