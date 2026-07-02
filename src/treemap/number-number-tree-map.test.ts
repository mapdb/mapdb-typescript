// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberNumberTreeMap } from "./number-number-tree-map.js";
import { Range } from "../range/range.js";

describe("NumberNumberTreeMap", () => {
  it("put and get", () => {
    const m = new NumberNumberTreeMap();
    m.set(3, 30);
    m.set(1, 10);
    m.set(2, 20);
    expect(m.get(2)).toBe(20);
    expect(m.get(99)).toBeUndefined();
    expect(m.size).toBe(3);
  });

  it("sorted iteration", () => {
    const m = new NumberNumberTreeMap();
    m.set(50, 500);
    m.set(10, 100);
    m.set(30, 300);
    m.set(20, 200);
    m.set(40, 400);

    const keys = [...m.keys()];
    expect(keys).toEqual([10, 20, 30, 40, 50]);
  });

  it("min and max", () => {
    const m = new NumberNumberTreeMap();
    m.set(30, 300);
    m.set(10, 100);
    m.set(50, 500);
    expect(m.min()).toEqual([10, 100]);
    expect(m.max()).toEqual([50, 500]);
  });

  it("floor and ceiling", () => {
    const m = new NumberNumberTreeMap();
    m.set(10, 100);
    m.set(20, 200);
    m.set(30, 300);
    expect(m.floor(25)).toEqual([20, 200]);
    expect(m.ceiling(25)).toEqual([30, 300]);
    expect(m.floor(10)).toEqual([10, 100]);
    expect(m.ceiling(30)).toEqual([30, 300]);
  });

  it("remove", () => {
    const m = new NumberNumberTreeMap();
    for (let i = 1; i <= 20; i++) m.set(i, i * 10);
    for (let i = 1; i <= 20; i += 2) m.remove(i);
    expect(m.size).toBe(10);
    const keys = [...m.keys()];
    for (const k of keys) {
      expect(k % 2).toBe(0);
    }
    // verify still sorted
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toBeGreaterThan(keys[i - 1]);
    }
  });

  it("rangeKeys", () => {
    const m = new NumberNumberTreeMap();
    for (let i = 1; i <= 10; i++) m.set(i, i * 10);
    const keys = [...m.rangeKeys(3, 7)].map(([k]) => k);
    expect(keys).toEqual([3, 4, 5, 6]);
  });

  it("large insert/delete", () => {
    const m = new NumberNumberTreeMap();
    for (let i = 0; i < 1000; i++) m.set(i, i);
    expect(m.size).toBe(1000);
    for (let i = 0; i < 500; i++) m.remove(i);
    expect(m.size).toBe(500);
    // verify sorted
    const keys = [...m.keys()];
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toBeGreaterThan(keys[i - 1]);
    }
  });

  it("empty map", () => {
    const m = new NumberNumberTreeMap();
    expect(m.isEmpty()).toBe(true);
    expect(m.min()).toBeUndefined();
    expect(m.max()).toBeUndefined();
    expect(m.size).toBe(0);
  });

  it("select", () => {
    const m = new NumberNumberTreeMap();
    m.set(1, 10);
    m.set(2, 20);
    m.set(3, 30);
    const big = m.select((_k, v) => v > 15);
    expect(big.size).toBe(2);
    // result should also be sorted
    const keys = [...big.keys()];
    expect(keys).toEqual([2, 3]);
  });
});

describe("NumberNumberTreeMap NavigableMap surface", () => {
  const I32_MIN = -2147483648;
  const I32_MAX = 2147483647;
  const mapOf = (keys: number[]): NumberNumberTreeMap => {
    const m = new NumberNumberTreeMap();
    for (const k of keys) m.set(k, k * 10);
    return m;
  };

  it("floor/ceiling/lower/higher strictness (inclusive vs strict, absent ends)", () => {
    const m = mapOf([10, 20, 30]);
    expect(m.floorKey(25)).toBe(20);
    expect(m.ceilingKey(25)).toBe(30);
    expect(m.floorKey(10)).toBe(10);
    expect(m.lowerKey(10)).toBeUndefined();
    expect(m.higherKey(30)).toBeUndefined();
    expect(m.ceilingKey(5)).toBe(10);
    expect(m.floorEntry(25)).toEqual([20, 200]);
    expect(m.higherEntry(25)).toEqual([30, 300]);
    expect(m.firstKey()).toBe(10);
    expect(m.lastKey()).toBe(30);
  });

  it("nav empty -> undefined", () => {
    const m = mapOf([]);
    expect(m.floorKey(5)).toBeUndefined();
    expect(m.higherKey(5)).toBeUndefined();
    expect(m.firstKey()).toBeUndefined();
    expect(m.lastKey()).toBeUndefined();
  });

  it("nav signed extremes + descending", () => {
    const m = mapOf([I32_MIN, -1, 0, 1, I32_MAX]);
    expect(m.floorKey(I32_MIN)).toBe(I32_MIN);
    expect(m.lowerKey(I32_MIN)).toBeUndefined();
    expect(m.higherKey(-1)).toBe(0);
    expect(m.ceilingKey(I32_MAX)).toBe(I32_MAX);
    expect(m.higherKey(I32_MAX)).toBeUndefined();
    expect(m.descendingKeys()).toEqual([I32_MAX, 1, 0, -1, I32_MIN]);
  });

  it("poll first/last on single then empty (no trap)", () => {
    const m = mapOf([]);
    m.set(7, 700);
    expect(m.pollFirstEntry()).toEqual([7, 700]);
    expect(m.pollFirstEntry()).toBeUndefined();
    expect(m.pollLastEntry()).toBeUndefined();
    expect(m.isEmpty()).toBe(true);
  });

  it("range + open(1,2)=empty + removeRange count", () => {
    const m = mapOf([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(m.rangeKeysIn(Range.closedOpen(30, 70))).toEqual([30, 40, 50, 60]);
    expect(m.descendingRangeKeys(Range.closedOpen(30, 70))).toEqual([
      60, 50, 40, 30,
    ]);
    const two = mapOf([1, 2]);
    expect(two.rangeKeysIn(Range.open(1, 2))).toEqual([]);
    expect(m.removeRange(Range.closedOpen(30, 70))).toBe(4);
    expect(m.removeRange(Range.closedOpen(30, 70))).toBe(0);
    expect([...m.keys()]).toEqual([10, 20, 70, 80, 90, 100]);
  });

  it("subMap is an independent snapshot", () => {
    const m = mapOf([10, 20, 30, 40, 50]);
    const snap = m.subMap(Range.closed(20, 40));
    expect([...snap.keys()]).toEqual([20, 30, 40]);
    snap.set(99, 990);
    snap.remove(20);
    expect(m.has(20)).toBe(true);
    expect(m.has(99)).toBe(false);
    m.remove(30);
    expect(snap.has(30)).toBe(true);
  });
});
