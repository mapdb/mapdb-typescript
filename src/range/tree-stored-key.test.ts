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
import { Range } from "./range.js";

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
    expect([...map.keys()].some((x) => Object.is(x, -0))).toBe(true);
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
    expect([...map.keys()].some((x) => Object.is(x, -0))).toBe(true);
    expect([...set].some(Number.isNaN)).toBe(true);
  });
});
