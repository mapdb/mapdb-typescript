// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberNumberListMultimap } from "./multimap/number-number-list-multimap.js";
import { NumberNumberSetMultimap } from "./multimap/number-number-set-multimap.js";
import { BigIntBigIntListMultimap } from "./multimap/bigint-bigint-list-multimap.js";
import { Int32ArrayList } from "./typed/arraylist/int32-array-list.js";
import { Int32ArrayStack } from "./typed/stack/int32-array-stack.js";
import { HashMap } from "./object/hashmap.js";
import { HashSet } from "./object/hashset.js";
import { PumpNotSortedError } from "./internal/pump.js";

describe("Multimap pump (fromSorted)", () => {
  it("list multimap groups runs == per-op set", () => {
    const pairs: [number, number][] = [
      [1, 10],
      [1, 11],
      [2, 20],
      [3, 30],
      [3, 31],
    ];
    const pumped = NumberNumberListMultimap.fromSorted(pairs);
    const incr = new NumberNumberListMultimap();
    for (const [k, v] of pairs) incr.set(k, v);
    expect(pumped.size).toBe(incr.size);
    expect(pumped.get(1)).toEqual([10, 11]);
    expect(pumped.get(3)).toEqual([30, 31]);
    expect(pumped.keysCount).toBe(3);
  });

  it("set multimap dedups values within a key run", () => {
    const mm = NumberNumberSetMultimap.fromSorted([
      [1, 10],
      [1, 10],
      [1, 11],
    ]);
    expect(mm.get(1).slice().sort()).toEqual([10, 11]);
    expect(mm.getCount(1)).toBe(2);
  });

  it("out-of-order keys throw", () => {
    expect(() =>
      NumberNumberListMultimap.fromSorted([
        [2, 0],
        [1, 0],
      ]),
    ).toThrow(PumpNotSortedError);
  });

  it("bigint list multimap", () => {
    const mm = BigIntBigIntListMultimap.fromSorted([
      [1n, 10n],
      [1n, 11n],
      [2n, 20n],
    ]);
    expect(mm.get(1n)).toEqual([10n, 11n]);
    expect(mm.size).toBe(3);
  });
});

describe("List / Stack pump (one allocation)", () => {
  it("Int32ArrayList bulkLoad == per-op add", () => {
    const vals = [5, 4, 3, 2, 1];
    const list = Int32ArrayList.bulkLoad(vals);
    expect(list.size).toBe(5);
    expect([...Array(5).keys()].map((i) => list.get(i))).toEqual(vals);
  });
  it("Int32ArrayList bulkLoad empty", () => {
    expect(Int32ArrayList.bulkLoad([]).size).toBe(0);
  });
  it("Int32ArrayStack bulkLoad keeps last value on top", () => {
    const s = Int32ArrayStack.bulkLoad([1, 2, 3]);
    expect(s.size).toBe(3);
    expect(s.pop()).toBe(3);
  });
});

describe("Object collections pump (native, convenience)", () => {
  it("HashMap.bulkLoad delegates to Map", () => {
    const m = HashMap.bulkLoad([
      ["a", 1],
      ["b", 2],
    ]);
    expect(m.get("a")).toBe(1);
    expect(m.size).toBe(2);
  });
  it("HashSet.bulkLoad dedups", () => {
    const s = HashSet.bulkLoad(["a", "a", "b"]);
    expect(s.size).toBe(2);
  });
});
