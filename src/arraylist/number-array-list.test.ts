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
    expect(l.size).toBe(3);
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
    expect(values).toEqual([
      [0, 10],
      [1, 20],
      [2, 30],
    ]);
  });
  describe("remove (by value)", () => {
    it("removes only the first occurrence", () => {
      const l = NumberArrayList.of([1, 2, 1]);
      expect(l.remove(1)).toBe(true);
      expect(l.toArray()).toEqual([2, 1]);
      expect(l.size).toBe(2);
    });

    it("returns false and leaves the list unchanged for an absent value", () => {
      const l = NumberArrayList.of([1, 2, 1]);
      expect(l.remove(99)).toBe(false);
      expect(l.toArray()).toEqual([1, 2, 1]);
      expect(l.size).toBe(3);
    });

    it("returns false on an empty list", () => {
      const l = new NumberArrayList();
      expect(l.remove(0)).toBe(false);
      expect(l.isEmpty()).toBe(true);
      expect(l.size).toBe(0);
    });

    it("removes the last element and empties the list", () => {
      const l = NumberArrayList.of([7]);
      expect(l.remove(7)).toBe(true);
      expect(l.isEmpty()).toBe(true);
      expect(l.toArray()).toEqual([]);
      expect(l.remove(7)).toBe(false);
    });

    it("removes a tail element without disturbing the head", () => {
      const l = NumberArrayList.of([1, 2, 3]);
      expect(l.remove(3)).toBe(true);
      expect(l.toArray()).toEqual([1, 2]);
    });

    it("matches NaN like indexOf does (Object.is equality)", () => {
      const l = NumberArrayList.of([1, NaN, NaN]);
      expect(l.indexOf(NaN)).toBe(1);
      expect(l.remove(NaN)).toBe(true);
      expect(l.size).toBe(2);
      expect(Number.isNaN(l.get(1))).toBe(true);
      expect(l.remove(NaN)).toBe(true);
      expect(l.toArray()).toEqual([1]);
      expect(l.remove(NaN)).toBe(false);
    });

    it("keeps -0 and +0 distinct, like indexOf", () => {
      const l = NumberArrayList.of([0, -0]);
      expect(l.indexOf(-0)).toBe(1);
      expect(l.remove(-0)).toBe(true);
      expect(l.toArray()).toEqual([0]);
      expect(Object.is(l.get(0), 0)).toBe(true);
      expect(l.remove(-0)).toBe(false);
      expect(l.remove(0)).toBe(true);
      expect(l.isEmpty()).toBe(true);
    });

    it("appends after a removal without resurrecting the removed value", () => {
      const l = NumberArrayList.of([5, 6]);
      expect(l.remove(5)).toBe(true);
      l.add(9);
      expect(l.toArray()).toEqual([6, 9]);
    });
  });
});
