// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberArrayList } from "./number-array-list.js";

describe("NumberArrayList", () => {
  it("add and get", () => {
    const l = new NumberArrayList();
    l.add(10);
    l.add(20);
    l.add(30);
    expect(l.size()).toBe(3);
    expect(l.get(1)).toBe(20);
  });

  it("sort", () => {
    const l = NumberArrayList.of([30, 10, 20]);
    l.sort();
    expect(l.toArray()).toEqual([10, 20, 30]);
  });

  it("select", () => {
    const l = NumberArrayList.of([1, 2, 3, 4, 5]);
    const evens = l.select((v) => v % 2 === 0);
    expect(evens.toArray()).toEqual([2, 4]);
  });

  it("sum, min, max", () => {
    const l = NumberArrayList.of([1, 2, 3, 4, 5]);
    expect(l.sum()).toBe(15);
    expect(l.min()).toBe(1);
    expect(l.max()).toBe(5);
  });

  it("entries generator", () => {
    const l = NumberArrayList.of([10, 20, 30]);
    const values = [...l.entries()];
    expect(values).toEqual([10, 20, 30]);
  });
});
