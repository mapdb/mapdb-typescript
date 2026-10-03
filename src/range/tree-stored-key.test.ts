// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, expect, it } from "vitest";
import { totalCmpNumber } from "../internal/float-order.js";
import { TreeMap } from "../object/treemap.js";
import { TreeSet } from "../object/treeset.js";
import { NumberNumberTreeMap } from "../treemap/number-number-tree-map.js";
import { NumberTreeSet } from "../treeset/number-tree-set.js";
import { CutKind, Range } from "./range.js";

describe("tree ranges over stored number keys", () => {
  const keys = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    2,
    1.5,
    0,
    -0,
    -1,
    Number.NEGATIVE_INFINITY,
  ];
  const bounded = Range.closed(0, 2);

  it("keeps the public i32 point-query contract", () => {
    expect(() => bounded.contains(1.5)).toThrow(RangeError);
    expect(bounded.contains(0)).toBe(true);
    expect(Range.singleton(0).contains(-0)).toBe(true);
    // Stored keys filter with the tree's total order: -0 sits below the
    // canonicalized +0 endpoint (owner ruling 2026-10-02).
    expect(Range.singleton(0).containsStoredKey(-0)).toBe(false);
    expect(Range.singleton(0).containsStoredKey(0)).toBe(true);
    expect(Range.lessThan(0).containsStoredKey(-0)).toBe(true);
  });

  it("slices and removes from primitive map and set in total order", () => {
    const map = new NumberNumberTreeMap();
    const set = new NumberTreeSet();
    for (const key of keys) {
      map.set(key, 1);
      set.add(key);
    }
    expect(map.rangeKeysIn(bounded)).toEqual([0, 1.5, 2]);
    expect(map.rangeEntriesIn(bounded)).toEqual([
      [0, 1],
      [1.5, 1],
      [2, 1],
    ]);
    expect([...map.subMap(bounded).keys()]).toEqual([0, 1.5, 2]);
    expect(set.rangeElements(bounded)).toEqual([0, 1.5, 2]);
    expect(map.removeRange(bounded)).toBe(3);
    expect(set.removeRange(bounded)).toBe(3);
    expect([...set.values()].some(Number.isNaN)).toBe(true);
  });

  it("slices and removes from object map and set", () => {
    const map = new TreeMap<number, number>(totalCmpNumber);
    const set = new TreeSet<number>(totalCmpNumber);
    for (const key of keys) {
      map.set(key, 1);
      set.add(key);
    }
    expect(map.rangeKeys(bounded)).toEqual([0, 1.5, 2]);
    expect(map.rangeEntries(bounded)).toEqual([
      [0, 1],
      [1.5, 1],
      [2, 1],
    ]);
    expect([...map.subMap(bounded).keys()]).toEqual([0, 1.5, 2]);
    expect(set.rangeElements(bounded)).toEqual([0, 1.5, 2]);
    expect(map.removeRange(bounded)).toBe(3);
    expect(set.removeRange(bounded)).toBe(3);
    expect([...set].some(Number.isNaN)).toBe(true);
  });

  it("applies open, singleton and unbounded cuts to mixed keys", () => {
    const primitive = new NumberNumberTreeMap();
    const object = new TreeMap<number, number>(totalCmpNumber);
    const set = new NumberTreeSet();
    for (const key of keys) {
      primitive.set(key, 1);
      object.set(key, 1);
      set.add(key);
    }
    const cases: [Range<number>, number[]][] = [
      [Range.open(0, 2), [1.5]],
      [Range.singleton(0), [0]],
      [Range.lessThan(0), [Number.NEGATIVE_INFINITY, -1, -0]],
      [Range.atLeast(0), [0, 1.5, 2, Number.POSITIVE_INFINITY, Number.NaN]],
      [Range.closedOpen(0, 0), []],
      [Range.all(), [...keys].sort(totalCmpNumber)],
    ];
    for (const [range, expected] of cases) {
      expect(primitive.rangeKeysIn(range)).toEqual(expected);
      expect(object.rangeKeys(range)).toEqual(expected);
      expect(set.rangeElements(range)).toEqual(expected);
    }
  });

  it("filters with the object tree's own comparator", () => {
    // A custom comparator that equates signed zero stores -0 as the key-0
    // representative; get(0) and the range filter must agree with it.
    const cmp = (a: number, b: number): number => (a < b ? -1 : a > b ? 1 : 0);
    const map = new TreeMap<number, number>(cmp);
    map.set(-0, 1);
    expect(map.get(0)).toBe(1);
    expect(map.rangeKeys(Range.singleton(0))).toEqual([-0]);
  });

  it("canonicalizes a raw -0 cut in fromCutsInternal", () => {
    const r = Range.fromCutsInternal<number>(
      { kind: CutKind.Below, value: -0 },
      { kind: CutKind.Below, value: +0 },
    );
    expect(r.isEmpty()).toBe(true);
    expect(r.containsStoredKey(-0)).toBe(false);
  });
});
