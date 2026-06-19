// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Native tests for the compact immutable sorted map / set. These cover the
// obligations the cross-language JSON suite cannot express (construction traps,
// snapshot independence, iterator key-order pairing, signed-edge brackets,
// round-trip identity, mutators-throw) per spec/features/sorted-table-map.md
// §"Native-only". Mirrors the Rust reference tests (mapdb-rust commit 840ddf1,
// src/immutable_sorted/tests.rs).

import { describe, expect, test } from "vitest";

import {
  ImmutableSortedMap,
  ImmutableSortedSet,
} from "./immutable-sorted-map.js";
import { Range } from "../range/range.js";

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

// ── Construction traps (native-only; RESERVED expect_panic) ──────────

describe("construction traps", () => {
  test("map unsorted (out-of-order) input throws", () => {
    expect(() =>
      ImmutableSortedMap.fromSorted([10, 30, 20], [1, 3, 2]),
    ).toThrow(/strictly ascending/);
  });

  test("map duplicate key throws (no last-wins / dedup)", () => {
    expect(() =>
      ImmutableSortedMap.fromSorted([10, 20, 20, 30], [1, 2, 99, 3]),
    ).toThrow(/strictly ascending/);
  });

  test("map keys/values length mismatch throws", () => {
    expect(() => ImmutableSortedMap.fromSorted([10, 20, 30], [1, 2])).toThrow(
      /length mismatch/,
    );
  });

  test("set unsorted input throws", () => {
    expect(() => ImmutableSortedSet.fromSorted([10, 30, 20])).toThrow(
      /strictly ascending/,
    );
  });

  test("set duplicate throws", () => {
    expect(() => ImmutableSortedSet.fromSorted([10, 20, 20])).toThrow(
      /strictly ascending/,
    );
  });

  test("non-i32 key (out of range / non-integer) throws", () => {
    expect(() => ImmutableSortedMap.fromSorted([INT_MIN - 1], [0])).toThrow(
      /signed 32-bit integer/,
    );
    expect(() => ImmutableSortedSet.fromSorted([1.5])).toThrow(
      /signed 32-bit integer/,
    );
  });
});

// ── Empty + single (valid, not a trap) ───────────────────────────────

describe("empty + single", () => {
  test("empty map is valid and every query is absence", () => {
    const m = ImmutableSortedMap.fromSorted([], []);
    expect(m.size).toBe(0);
    expect(m.length).toBe(0);
    expect(m.isEmpty()).toBe(true);
    expect(m.get(5)).toBeUndefined();
    expect(m.containsKey(5)).toBe(false);
    expect(m.firstKey()).toBeUndefined();
    expect(m.lastKey()).toBeUndefined();
    expect(m.floorKey(5)).toBeUndefined();
    expect(m.ceilingKey(5)).toBeUndefined();
    expect(m.lowerKey(5)).toBeUndefined();
    expect(m.higherKey(5)).toBeUndefined();
    expect(m.rank(5)).toBe(0);
    expect(m.selectKey(0)).toBeUndefined();
    expect(m.keys()).toEqual([]);
    expect(m.descendingKeys()).toEqual([]);
    expect(m.rangeKeys(Range.all())).toEqual([]);
  });

  test("empty set is valid", () => {
    const s = ImmutableSortedSet.fromSorted([]);
    expect(s.isEmpty()).toBe(true);
    expect(s.first()).toBeUndefined();
    expect(s.floor(0)).toBeUndefined();
    expect(s.rank(0)).toBe(0);
    expect(s.select(0)).toBeUndefined();
  });

  test("single-element map is valid", () => {
    const m = ImmutableSortedMap.fromSorted([7], [700]);
    expect(m.get(7)).toBe(700);
    expect(m.floorKey(7)).toBe(7);
    expect(m.ceilingKey(7)).toBe(7);
    expect(m.lowerKey(7)).toBeUndefined();
    expect(m.higherKey(7)).toBeUndefined();
    expect(m.rank(6)).toBe(0);
    expect(m.rank(7)).toBe(0);
    expect(m.rank(8)).toBe(1);
    expect(m.selectKey(0)).toBe(7);
    expect(m.selectKey(1)).toBeUndefined();
  });
});

// ── values() / entries() key-order pairing (native-only obligation) ──

test("values() and entries() pair with keys, NOT value-sorted", () => {
  // Deliberately NON-monotonic values: a port that sorts values independently
  // would mis-pair. keys ascending {10,20,30}; values {300,100,200}.
  const m = ImmutableSortedMap.fromSorted([10, 20, 30], [300, 100, 200]);

  expect(m.keys()).toEqual([10, 20, 30]);
  expect(m.values()).toEqual([300, 100, 200]); // NOT [100,200,300]

  // Zip-and-assert: values[i] is the value of keys[i].
  const keys = m.keys();
  const values = m.values();
  for (let i = 0; i < keys.length; i++) {
    expect(m.get(keys[i])).toBe(values[i]);
  }

  expect(m.entries()).toEqual([
    [10, 300],
    [20, 100],
    [30, 200],
  ]);

  // get_<k> sees the right value (the cross-language oracle for misalignment).
  expect(m.get(10)).toBe(300);
  expect(m.get(20)).toBe(100);
  expect(m.get(30)).toBe(200);
});

// ── Snapshot independence from a mutated source buffer ───────────────

test("construction takes an independent snapshot (map)", () => {
  const keys = [10, 20, 30];
  const values = [100, 200, 300];
  const m = ImmutableSortedMap.fromSorted(keys, values);

  // Mutate the caller's source arrays AFTER construction.
  keys[0] = 999;
  values[1] = -1;
  keys.push(40);

  expect(m.size).toBe(3);
  expect(m.get(10)).toBe(100);
  expect(m.get(20)).toBe(200);
  expect(m.firstKey()).toBe(10);
  expect(m.containsKey(999)).toBe(false);
  expect(m.containsKey(40)).toBe(false);
});

test("construction takes an independent snapshot (set)", () => {
  const elems = [1, 2, 3];
  const s = ImmutableSortedSet.fromSorted(elems);
  elems[0] = 99;
  elems.push(4);
  expect(s.size).toBe(3);
  expect(s.contains(1)).toBe(true);
  expect(s.contains(99)).toBe(false);
});

test("returned arrays are independent snapshots (mutating them is harmless)", () => {
  const m = ImmutableSortedMap.fromSorted([1, 2, 3], [10, 20, 30]);
  const ks = m.keys();
  ks[0] = 999;
  expect(m.keys()).toEqual([1, 2, 3]); // internal state unchanged
});

// ── select(rank(k)) == k round-trip identity ─────────────────────────

test("select(rank(k)) === k round-trip", () => {
  const keys = [-100, -1, 0, 1, 42, 1000];
  const m = ImmutableSortedMap.fromSorted(keys, [1, 2, 3, 4, 5, 6]);
  for (const k of keys) {
    const r = m.rank(k);
    expect(m.selectKey(r)).toBe(k);
    expect(m.rank(m.selectKey(r)!)).toBe(r);
  }
  // rank on absent keys is the lower-bound index.
  expect(m.rank(-101)).toBe(0);
  expect(m.rank(500)).toBe(5);
  expect(m.rank(100000)).toBe(6);
});

// ── Sortedness / parallel-array invariants post-build ────────────────

test("stored arrays are strictly ascending and aligned", () => {
  const m = ImmutableSortedMap.fromSorted(
    [10, 20, 30, 40, 50],
    [1, 2, 3, 4, 5],
  );
  const keys = m.keys();
  for (let i = 1; i < keys.length; i++) {
    expect(keys[i - 1] < keys[i]).toBe(true);
  }
  for (let i = 0; i < keys.length; i++) {
    expect(m.selectEntry(i)![1]).toBe(m.get(keys[i]));
  }
});

// ── Signed extremes (INT_MIN / INT_MAX) ──────────────────────────────

test("signed extremes: lookup / nav / rank / select", () => {
  const keys = [INT_MIN, -1, 0, 1, INT_MAX];
  const m = ImmutableSortedMap.fromSorted(keys, [10, 20, 30, 40, 50]);

  expect(m.get(INT_MIN)).toBe(10);
  expect(m.get(INT_MAX)).toBe(50);

  expect(m.floorKey(INT_MIN)).toBe(INT_MIN);
  expect(m.lowerKey(INT_MIN)).toBeUndefined();
  expect(m.higherKey(-1)).toBe(0);
  expect(m.ceilingKey(INT_MAX)).toBe(INT_MAX);
  expect(m.higherKey(INT_MAX)).toBeUndefined();

  expect(m.rank(0)).toBe(2);
  expect(m.rank(INT_MIN)).toBe(0);
  expect(m.rank(INT_MAX)).toBe(4);
  expect(m.selectKey(0)).toBe(INT_MIN);
  expect(m.selectKey(4)).toBe(INT_MAX);
  expect(m.selectKey(5)).toBeUndefined();
  expect(m.descendingKeys()).toEqual([INT_MAX, 1, 0, -1, INT_MIN]);
});

test("range brackets at signed extremes do no ±1 endpoint arithmetic", () => {
  const keys = [INT_MIN, -1, 0, 1, INT_MAX];
  const m = ImmutableSortedMap.fromSorted(keys, [10, 20, 30, 40, 50]);

  // Open bound at INT_MIN: greaterThan(MIN) excludes MIN, no `MIN - 1`.
  expect(m.rangeKeys(Range.greaterThan(INT_MIN))).toEqual([-1, 0, 1, INT_MAX]);
  // Open bound at INT_MAX: lessThan(MAX) excludes MAX, no `MAX + 1`.
  expect(m.rangeKeys(Range.lessThan(INT_MAX))).toEqual([INT_MIN, -1, 0, 1]);
  // Closed both ends spanning the full signed range.
  expect(m.rangeKeys(Range.closed(INT_MIN, INT_MAX))).toEqual([
    INT_MIN,
    -1,
    0,
    1,
    INT_MAX,
  ]);
  // Singleton at the extreme.
  expect(m.rangeKeys(Range.singleton(INT_MAX))).toEqual([INT_MAX]);
});

// ── Range membership == range.contains (discrete-empty is NOT an error) ─

test("open range over adjacent ints is empty, not an error", () => {
  const m = ImmutableSortedMap.fromSorted([1, 2], [10, 20]);
  expect(m.rangeKeys(Range.open(1, 2))).toEqual([]);
  // cut-empty range matches nothing.
  expect(m.rangeKeys(Range.closedOpen(5, 5))).toEqual([]);
});

test("range query yields a contiguous slice (map)", () => {
  const keys = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const vals = keys.map((k) => k * 10);
  const m = ImmutableSortedMap.fromSorted(keys, vals);
  expect(m.rangeKeys(Range.closedOpen(30, 70))).toEqual([30, 40, 50, 60]);
  expect(m.descendingRangeKeys(Range.closedOpen(30, 70))).toEqual([
    60, 50, 40, 30,
  ]);
  expect(m.rangeEntries(Range.closed(40, 50))).toEqual([
    [40, 400],
    [50, 500],
  ]);
  expect(m.rangeKeys(Range.atLeast(80))).toEqual([80, 90, 100]);
  expect(m.rangeKeys(Range.atMost(30))).toEqual([10, 20, 30]);
  expect(m.rangeKeys(Range.all()).length).toBe(10);
});

// ── Large flat-array parity (paging-invariance is trivial for flat) ──

test("large flat lookup parity (10k entries)", () => {
  const n = 10000;
  const keys = Array.from({ length: n }, (_, i) => i);
  const vals = keys.map((k) => k * 7);
  const m = ImmutableSortedMap.fromSorted(keys, vals);
  expect(m.size).toBe(n);
  for (const probe of [
    0, 1023, 1024, 1025, 4095, 4096, 4097, 8191, 8192, 9999,
  ]) {
    expect(m.get(probe)).toBe(probe * 7);
    expect(m.rank(probe)).toBe(probe);
    expect(m.selectKey(probe)).toBe(probe);
    expect(m.floorKey(probe)).toBe(probe);
    expect(m.ceilingKey(probe)).toBe(probe);
  }
  expect(m.get(10000)).toBeUndefined();
  expect(m.rank(10000)).toBe(10000);
  expect(m.selectKey(10000)).toBeUndefined();
  expect(m.rangeKeys(Range.closedOpen(4090, 4100)).length).toBe(10);
});

// ── Set surface mirrors the map ──────────────────────────────────────

test("set full surface", () => {
  const s = ImmutableSortedSet.fromSorted([10, 20, 30, 40, 50]);
  expect(s.size).toBe(5);
  expect(s.contains(30)).toBe(true);
  expect(s.contains(25)).toBe(false);
  expect(s.first()).toBe(10);
  expect(s.last()).toBe(50);
  expect(s.floor(25)).toBe(20);
  expect(s.ceiling(25)).toBe(30);
  expect(s.lower(10)).toBeUndefined();
  expect(s.higher(50)).toBeUndefined();
  expect(s.rank(30)).toBe(2);
  expect(s.select(0)).toBe(10);
  expect(s.select(5)).toBeUndefined();
  expect(s.elements()).toEqual([10, 20, 30, 40, 50]);
  expect(s.descendingElements()).toEqual([50, 40, 30, 20, 10]);
  expect(s.rangeElements(Range.closedOpen(20, 50))).toEqual([20, 30, 40]);
  expect(s.descendingRangeElements(Range.closedOpen(20, 50))).toEqual([
    40, 30, 20,
  ]);
});

// ── Inherited mutators throw (TS immutability contract) ──────────────

describe("mutators throw", () => {
  test("map mutators throw", () => {
    const m = ImmutableSortedMap.fromSorted([1, 2], [10, 20]);
    expect(() => m.set(3, 30)).toThrow(/immutable/);
    expect(() => m.put(3, 30)).toThrow(/immutable/);
    expect(() => m.remove(1)).toThrow(/immutable/);
    expect(() => m.clear()).toThrow(/immutable/);
    // State unchanged.
    expect(m.size).toBe(2);
    expect(m.get(1)).toBe(10);
  });

  test("set mutators throw", () => {
    const s = ImmutableSortedSet.fromSorted([1, 2]);
    expect(() => s.add(3)).toThrow(/immutable/);
    expect(() => s.remove(1)).toThrow(/immutable/);
    expect(() => s.clear()).toThrow(/immutable/);
    expect(s.size).toBe(2);
    expect(s.contains(1)).toBe(true);
  });
});

// ── floor/ceiling/lower/higher strictness on a small map ─────────────

test("nav strictness on {10,20,30}", () => {
  const m = ImmutableSortedMap.fromSorted([10, 20, 30], [1, 2, 3]);
  expect(m.floorKey(25)).toBe(20);
  expect(m.ceilingKey(25)).toBe(30);
  expect(m.floorKey(10)).toBe(10);
  expect(m.lowerKey(10)).toBeUndefined();
  expect(m.higherKey(30)).toBeUndefined();
  expect(m.ceilingKey(5)).toBe(10);
  // entry forms carry the value.
  expect(m.floorEntry(25)).toEqual([20, 2]);
  expect(m.ceilingEntry(25)).toEqual([30, 3]);
  expect(m.firstEntry()).toEqual([10, 1]);
  expect(m.lastEntry()).toEqual([30, 3]);
});

describe("ImmutableSorted i32 query / index validation (v1)", () => {
  test("map key queries reject non-i32 keys (witness: get(1.5))", () => {
    const m = ImmutableSortedMap.fromSorted([10, 20, 30], [1, 2, 3]);
    // The typed ports take an i32 key; 1.5 would silently binary-search to a miss.
    expect(() => m.get(1.5)).toThrow(RangeError);
    expect(() => m.containsKey(1.5)).toThrow(RangeError);
    expect(() => m.hasKey(NaN)).toThrow(RangeError);
    expect(() => m.floorKey(1.5)).toThrow(RangeError);
    expect(() => m.ceilingKey(1.5)).toThrow(RangeError);
    expect(() => m.lowerKey(1.5)).toThrow(RangeError);
    expect(() => m.higherKey(1.5)).toThrow(RangeError);
    expect(() => m.rank(1.5)).toThrow(RangeError);
    expect(() => m.get(2147483648)).toThrow(RangeError); // INT32_MAX + 1
    expect(() => m.get(-2147483649)).toThrow(RangeError); // INT32_MIN - 1
    // valid i32 keys still answer
    expect(m.get(20)).toBe(2);
    expect(m.floorKey(25)).toBe(20);
  });

  test("set element queries reject non-i32 elements", () => {
    const s = ImmutableSortedSet.fromSorted([1, 5, 9]);
    expect(() => s.contains(2.5)).toThrow(RangeError);
    expect(() => s.has(2.5)).toThrow(RangeError);
    expect(() => s.floor(2.5)).toThrow(RangeError);
    expect(() => s.ceiling(2.5)).toThrow(RangeError);
    expect(() => s.lower(2.5)).toThrow(RangeError);
    expect(() => s.higher(2.5)).toThrow(RangeError);
    expect(() => s.rank(2.5)).toThrow(RangeError);
    expect(s.contains(5)).toBe(true);
  });

  test("select/selectKey/selectEntry return absence (no trap) for out-of-domain index", () => {
    // spec/features/rank-select.md §"Exact semantics": signed-index ports (TS
    // `number`) MUST return absence for `i < 0` and MUST NOT trap; out-of-domain
    // `i` (negative or non-integer) is absence, exactly like `i >= size`.
    const m = ImmutableSortedMap.fromSorted([10, 20, 30], [1, 2, 3]);
    const s = ImmutableSortedSet.fromSorted([10, 20, 30]);
    expect(m.selectKey(-1)).toBeUndefined();
    expect(m.selectKey(1.5)).toBeUndefined();
    expect(m.selectEntry(-1)).toBeUndefined();
    expect(s.select(-1)).toBeUndefined();
    expect(s.select(1.5)).toBeUndefined();
    // in-range and out-of-range (>= size) non-negative integers behave as before
    expect(m.selectKey(0)).toBe(10);
    expect(m.selectKey(99)).toBeUndefined();
    expect(s.select(99)).toBeUndefined();
  });
});
