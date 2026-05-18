// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { NumberTreeSet } from "./number-tree-set.js";

describe("NumberTreeSet generated", () => {
  it("add and contains", () => {
    const s = new NumberTreeSet();
    s.add(3);
    s.add(1);
    s.add(2);
    expect(s.size()).toBe(3);
    expect(s.contains(2)).toBe(true);
    expect(s.contains(99)).toBe(false);
  });
  it("duplicate", () => {
    const s = new NumberTreeSet();
    expect(s.add(1)).toBe(true);
    expect(s.add(1)).toBe(false);
  });
  it("remove", () => {
    const s = new NumberTreeSet();
    s.add(1);
    s.add(2);
    expect(s.remove(1)).toBe(true);
    expect(s.contains(1)).toBe(false);
  });
  it("min and max", () => {
    const s = new NumberTreeSet();
    s.add(3);
    s.add(1);
    expect(s.min()).toBe(1);
    expect(s.max()).toBe(3);
  });
  it("sorted iteration", () => {
    const s = new NumberTreeSet();
    s.add(3);
    s.add(1);
    s.add(2);
    const vals = [...s.values()];
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i] >= vals[i - 1]).toBe(true);
    }
  });
  it("clear", () => {
    const s = new NumberTreeSet();
    s.add(1);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });
  it("toString", () => {
    const s = new NumberTreeSet();
    s.add(1);
    expect(s.toString()).not.toBe("");
  });
});
