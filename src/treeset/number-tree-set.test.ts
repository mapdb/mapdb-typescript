// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberTreeSet } from "./number-tree-set.js";
import { Range } from "../range/range.js";

describe("NumberTreeSet", () => {
  it("add and contains", () => {
    const s = new NumberTreeSet();
    s.add(3);
    s.add(1);
    s.add(2);
    expect(s.size).toBe(3);
    expect(s.has(2)).toBe(true);
    expect(s.has(99)).toBe(false);
  });

  it("add duplicate keeps size at 1", () => {
    const s = new NumberTreeSet();
    expect(s.add(1)).toBe(s); // add returns the set for chaining
    s.add(1);
    expect(s.size).toBe(1);
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
    expect(a.union(b).size).toBe(5);
    expect(a.intersect(b).size).toBe(1);
    expect(a.difference(b).size).toBe(2);
  });

  it("remove", () => {
    const s = NumberTreeSet.of([1, 2, 3, 4, 5]);
    s.remove(3);
    expect(s.size).toBe(4);
    expect(s.has(3)).toBe(false);
    const values = [...s.values()];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe("NumberTreeSet NavigableSet surface", () => {
  const I32_MIN = -2147483648;
  const I32_MAX = 2147483647;

  it("floor/ceiling/lower/higher strictness (inclusive vs strict, absent ends)", () => {
    const s = NumberTreeSet.of([10, 20, 30]);
    expect(s.floor(25)).toBe(20);
    expect(s.ceiling(25)).toBe(30);
    expect(s.floor(10)).toBe(10);
    expect(s.lower(10)).toBeUndefined();
    expect(s.higher(30)).toBeUndefined();
    expect(s.ceiling(5)).toBe(10);
    expect(s.first()).toBe(10);
    expect(s.last()).toBe(30);
  });

  it("nav empty -> undefined", () => {
    const s = new NumberTreeSet();
    expect(s.floor(5)).toBeUndefined();
    expect(s.higher(5)).toBeUndefined();
    expect(s.first()).toBeUndefined();
    expect(s.last()).toBeUndefined();
  });

  it("nav signed extremes + descending", () => {
    const s = NumberTreeSet.of([I32_MIN, -1, 0, 1, I32_MAX]);
    expect(s.floor(I32_MIN)).toBe(I32_MIN);
    expect(s.lower(I32_MIN)).toBeUndefined();
    expect(s.higher(-1)).toBe(0);
    expect(s.ceiling(I32_MAX)).toBe(I32_MAX);
    expect(s.higher(I32_MAX)).toBeUndefined();
    expect(s.descending()).toEqual([I32_MAX, 1, 0, -1, I32_MIN]);
  });

  it("poll first/last on single then empty (no trap)", () => {
    const s = NumberTreeSet.of([7]);
    expect(s.pollFirst()).toBe(7);
    expect(s.pollFirst()).toBeUndefined();
    expect(s.pollLast()).toBeUndefined();
    expect(s.isEmpty()).toBe(true);
  });

  it("range + open(1,2)=empty + removeRange count", () => {
    const s = NumberTreeSet.of([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(s.rangeElements(Range.closedOpen(30, 70))).toEqual([30, 40, 50, 60]);
    expect(s.descendingRangeElements(Range.closedOpen(30, 70))).toEqual([
      60, 50, 40, 30,
    ]);
    expect(NumberTreeSet.of([1, 2]).rangeElements(Range.open(1, 2))).toEqual(
      [],
    );
    expect(s.removeRange(Range.closedOpen(30, 70))).toBe(4);
    expect(s.removeRange(Range.closedOpen(30, 70))).toBe(0);
    expect(s.toArray()).toEqual([10, 20, 70, 80, 90, 100]);
  });

  it("subSet is an independent snapshot", () => {
    const s = NumberTreeSet.of([10, 20, 30, 40, 50]);
    const snap = s.subSet(Range.closed(20, 40));
    expect(snap.toArray()).toEqual([20, 30, 40]);
    snap.add(99);
    snap.remove(20);
    expect(s.has(20)).toBe(true);
    expect(s.has(99)).toBe(false);
    s.remove(30);
    expect(snap.has(30)).toBe(true);
  });
});

describe("NumberTreeSet order statistics (rank / select)", () => {
  const I32_MIN = -2147483648;
  const I32_MAX = 2147483647;

  const makeRand = (seed: bigint): (() => bigint) => {
    let state = seed;
    const MASK = (1n << 64n) - 1n;
    return () => {
      let x = state;
      x ^= (x << 13n) & MASK;
      x ^= x >> 7n;
      x ^= (x << 17n) & MASK;
      state = x & MASK;
      return state;
    };
  };

  it("rank present & absent, select by index, negative -> undefined", () => {
    const s = NumberTreeSet.of([10, 20, 30, 40, 50]);
    expect(s.rank(10)).toBe(0);
    expect(s.rank(30)).toBe(2);
    expect(s.rank(50)).toBe(4);
    expect(s.rank(5)).toBe(0);
    expect(s.rank(25)).toBe(2);
    expect(s.rank(55)).toBe(5);
    expect(s.select(0)).toBe(10);
    expect(s.select(2)).toBe(30);
    expect(s.select(4)).toBe(50);
    expect(s.select(5)).toBeUndefined();
    expect(s.select(-1)).toBeUndefined();
  });

  it("empty / single edges", () => {
    const empty = new NumberTreeSet();
    expect(empty.rank(5)).toBe(0);
    expect(empty.select(0)).toBeUndefined();
    const s = NumberTreeSet.of([7]);
    expect(s.rank(6)).toBe(0);
    expect(s.rank(7)).toBe(0);
    expect(s.rank(8)).toBe(1);
    expect(s.select(0)).toBe(7);
    expect(s.select(1)).toBeUndefined();
  });

  it("signed i32 extremes", () => {
    const s = NumberTreeSet.of([I32_MIN, -1, 0, 1, I32_MAX]);
    expect(s.rank(I32_MIN)).toBe(0);
    expect(s.rank(0)).toBe(2);
    expect(s.rank(I32_MAX)).toBe(4);
    expect(s.select(0)).toBe(I32_MIN);
    expect(s.select(4)).toBe(I32_MAX);
    expect(s.select(5)).toBeUndefined();
  });

  it("rank/select after remove + round trip identity", () => {
    const s = NumberTreeSet.of([10, 20, 30, 40, 50]);
    s.remove(30);
    expect(s.rank(40)).toBe(2);
    expect(s.rank(35)).toBe(2);
    expect(s.select(2)).toBe(40);
    expect(s.select(4)).toBeUndefined();
    for (const x of s.toArray()) expect(s.select(s.rank(x))).toBe(x);
    for (let i = 0; i < s.size; i++) expect(s.rank(s.select(i)!)).toBe(i);
    s.checkSizeInvariant();
  });

  it("selectWhere is the predicate filter (rename of functional select)", () => {
    const s = NumberTreeSet.of([1, 2, 3, 4, 5]);
    expect(s.selectWhere((v) => v % 2 === 0).toArray()).toEqual([2, 4]);
  });

  it("subtree-size invariant over randomized insert/remove", () => {
    const s = new NumberTreeSet();
    const oracle = new Set<number>();
    const rand = makeRand(0x9e3779b97f4a7c15n);
    for (let step = 0; step < 4000; step++) {
      const v = Number(rand() % 200n);
      if (rand() % 2n === 0n) {
        s.add(v);
        oracle.add(v);
      } else {
        s.remove(v);
        oracle.delete(v);
      }
      s.checkSizeInvariant();
      expect(s.size).toBe(oracle.size);
    }
    const sorted = [...oracle].sort((a, b) => a - b);
    sorted.forEach((v, i) => {
      expect(s.rank(v)).toBe(i);
      expect(s.select(i)).toBe(v);
    });
    expect(s.select(sorted.length)).toBeUndefined();
  });
});
