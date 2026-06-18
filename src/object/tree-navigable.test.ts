// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { TreeMap } from "./treemap.js";
import { TreeSet } from "./treeset.js";
import { naturalComparator, reverseComparator } from "./strategy.js";
import { Range } from "../range/range.js";

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

function mapOf(keys: number[]): TreeMap<number, number> {
  const m = new TreeMap<number, number>(naturalComparator<number>());
  for (const k of keys) m.set(k, k * 10);
  return m;
}

function setOf(elems: number[]): TreeSet<number> {
  const s = new TreeSet<number>(naturalComparator<number>());
  for (const e of elems) s.add(e);
  return s;
}

describe("TreeMap NavigableMap surface", () => {
  it("floor/ceiling/lower/higher strictness incl. inclusive vs strict", () => {
    const m = mapOf([10, 20, 30]);
    expect(m.floorKey(25)).toBe(20);
    expect(m.ceilingKey(25)).toBe(30);
    expect(m.floorKey(10)).toBe(10); // inclusive
    expect(m.lowerKey(10)).toBeUndefined(); // strict, nothing below
    expect(m.higherKey(30)).toBeUndefined(); // strict, nothing above
    expect(m.ceilingKey(5)).toBe(10);
    expect(m.lowerKey(25)).toBe(20);
    expect(m.higherKey(25)).toBe(30);
    // entry forms carry value = key*10
    expect(m.floorEntry(25)).toEqual({ key: 20, value: 200 });
    expect(m.ceilingEntry(25)).toEqual({ key: 30, value: 300 });
    expect(m.firstKey()).toBe(10);
    expect(m.lastKey()).toBe(30);
    expect(m.firstEntry()).toEqual({ key: 10, value: 100 });
    expect(m.lastEntry()).toEqual({ key: 30, value: 300 });
  });

  it("nav on empty map returns undefined for every form", () => {
    const m = mapOf([]);
    expect(m.floorKey(5)).toBeUndefined();
    expect(m.ceilingKey(5)).toBeUndefined();
    expect(m.lowerKey(5)).toBeUndefined();
    expect(m.higherKey(5)).toBeUndefined();
    expect(m.firstKey()).toBeUndefined();
    expect(m.lastKey()).toBeUndefined();
    expect(m.firstEntry()).toBeUndefined();
    expect(m.lastEntry()).toBeUndefined();
  });

  it("nav on negative and i32 MIN/MAX keys", () => {
    const m = mapOf([I32_MIN, -1, 0, 1, I32_MAX]);
    expect(m.floorKey(I32_MIN)).toBe(I32_MIN);
    expect(m.lowerKey(I32_MIN)).toBeUndefined();
    expect(m.higherKey(-1)).toBe(0);
    expect(m.ceilingKey(I32_MAX)).toBe(I32_MAX);
    expect(m.higherKey(I32_MAX)).toBeUndefined();
    expect(m.descendingKeys()).toEqual([I32_MAX, 1, 0, -1, I32_MIN]);
  });

  it("poll first/last empties the map and then returns undefined (no trap)", () => {
    const m = mapOf([10, 20, 30]);
    expect(m.pollFirstEntry()).toEqual({ key: 10, value: 100 });
    expect(m.pollLastEntry()).toEqual({ key: 30, value: 300 });
    expect(m.size).toBe(1);
    expect(m.pollFirstEntry()).toEqual({ key: 20, value: 200 });
    expect(m.pollFirstEntry()).toBeUndefined();
    expect(m.pollLastEntry()).toBeUndefined();
  });

  it("poll on a single-element map returns the entry then undefined", () => {
    const m = mapOf([]);
    m.set(7, 700);
    expect(m.pollFirstEntry()).toEqual({ key: 7, value: 700 });
    expect(m.pollFirstEntry()).toBeUndefined();
    expect(m.isEmpty()).toBe(true);
  });

  it("range slice + descending over a closed_open range", () => {
    const m = mapOf([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(m.rangeKeys(Range.closedOpen(30, 70))).toEqual([30, 40, 50, 60]);
    expect(m.descendingRangeKeys(Range.closedOpen(30, 70))).toEqual([
      60, 50, 40, 30,
    ]);
    expect(m.rangeEntries(Range.closedOpen(30, 50))).toEqual([
      [30, 300],
      [40, 400],
    ]);
    expect(m.descendingEntries()).toEqual([
      [100, 1000],
      [90, 900],
      [80, 800],
      [70, 700],
      [60, 600],
      [50, 500],
      [40, 400],
      [30, 300],
      [20, 200],
      [10, 100],
    ]);
  });

  it("open(1,2) over i32 matches nothing (membership = contains, not cut-empty)", () => {
    const m = mapOf([1, 2]);
    expect(m.rangeKeys(Range.open(1, 2))).toEqual([]);
    expect(m.removeRange(Range.open(1, 2))).toBe(0);
    expect(m.size).toBe(2);
  });

  it("removeRange returns the count removed; a no-op repeat returns 0", () => {
    const m = mapOf([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(m.removeRange(Range.closedOpen(30, 70))).toBe(4);
    expect(m.removeRange(Range.closedOpen(30, 70))).toBe(0); // no-op
    expect([...m.keys()]).toEqual([10, 20, 70, 80, 90, 100]);
  });

  it("subMap is an independent snapshot (mutate either side, the other unchanged)", () => {
    const m = mapOf([10, 20, 30, 40, 50]);
    const snap = m.subMap(Range.closed(20, 40));
    expect([...snap.keys()]).toEqual([20, 30, 40]);
    // Mutate snapshot — original unchanged.
    snap.set(99, 990);
    snap.remove(20);
    expect(m.has(20)).toBe(true);
    expect(m.has(99)).toBe(false);
    // Mutate original — snapshot unchanged.
    m.remove(30);
    expect(snap.has(30)).toBe(true);
  });

  it("subMap preserves the source (reverse) comparator / ordering", () => {
    const m = new TreeMap<number, number>(reverseComparator<number>());
    for (const k of [10, 20, 30, 40, 50]) m.set(k, k * 10);
    // Source iterates descending under the reverse comparator.
    expect([...m.keys()]).toEqual([50, 40, 30, 20, 10]);
    const sub = m.subMap(Range.closedOpen(20, 50)); // {20,30,40}
    // The snapshot must also be reverse-ordered, proving the comparator
    // carried (NOT reset to natural i32 order).
    expect([...sub.keys()]).toEqual([40, 30, 20]);
    sub.remove(30);
    expect(m.has(30)).toBe(true); // independence
  });
});

describe("TreeSet NavigableSet surface", () => {
  it("floor/ceiling/lower/higher strictness incl. inclusive vs strict", () => {
    const s = setOf([10, 20, 30]);
    expect(s.floor(25)).toBe(20);
    expect(s.ceiling(25)).toBe(30);
    expect(s.floor(10)).toBe(10);
    expect(s.lower(10)).toBeUndefined();
    expect(s.higher(30)).toBeUndefined();
    expect(s.ceiling(5)).toBe(10);
    expect(s.first()).toBe(10);
    expect(s.last()).toBe(30);
  });

  it("nav on empty set returns undefined", () => {
    const s = setOf([]);
    expect(s.floor(5)).toBeUndefined();
    expect(s.ceiling(5)).toBeUndefined();
    expect(s.lower(5)).toBeUndefined();
    expect(s.higher(5)).toBeUndefined();
    expect(s.first()).toBeUndefined();
    expect(s.last()).toBeUndefined();
  });

  it("nav on negative and i32 MIN/MAX elements + descending", () => {
    const s = setOf([I32_MIN, -1, 0, 1, I32_MAX]);
    expect(s.floor(I32_MIN)).toBe(I32_MIN);
    expect(s.lower(I32_MIN)).toBeUndefined();
    expect(s.higher(-1)).toBe(0);
    expect(s.ceiling(I32_MAX)).toBe(I32_MAX);
    expect(s.higher(I32_MAX)).toBeUndefined();
    expect(s.descending()).toEqual([I32_MAX, 1, 0, -1, I32_MIN]);
  });

  it("poll first/last then empty returns undefined (no trap)", () => {
    const s = setOf([10, 20, 30]);
    expect(s.pollFirst()).toBe(10);
    expect(s.pollLast()).toBe(30);
    expect(s.pollFirst()).toBe(20);
    expect(s.pollFirst()).toBeUndefined();
    expect(s.pollLast()).toBeUndefined();
  });

  it("range + descending iteration", () => {
    const s = setOf([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(s.rangeElements(Range.closedOpen(30, 70))).toEqual([30, 40, 50, 60]);
    expect(s.descendingRangeElements(Range.closedOpen(30, 70))).toEqual([
      60, 50, 40, 30,
    ]);
    expect(s.rangeElements(Range.openClosed(30, 70))).toEqual([40, 50, 60, 70]);
    expect(s.rangeElements(Range.atLeast(80))).toEqual([80, 90, 100]);
  });

  it("open(1,2) over i32 matches nothing", () => {
    const s = setOf([1, 2]);
    expect(s.rangeElements(Range.open(1, 2))).toEqual([]);
  });

  it("removeRange returns count; no-op repeat returns 0", () => {
    const s = setOf([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(s.removeRange(Range.closedOpen(30, 70))).toBe(4);
    expect(s.removeRange(Range.closedOpen(30, 70))).toBe(0);
    expect(s.toArray()).toEqual([10, 20, 70, 80, 90, 100]);
  });

  it("subSet is an independent snapshot", () => {
    const s = setOf([10, 20, 30, 40, 50]);
    const snap = s.subSet(Range.closed(20, 40));
    expect(snap.toArray()).toEqual([20, 30, 40]);
    snap.add(99);
    snap.remove(20);
    expect(s.has(20)).toBe(true);
    expect(s.has(99)).toBe(false);
    s.remove(30);
    expect(snap.has(30)).toBe(true);
  });

  it("subSet preserves the source (reverse) comparator / ordering", () => {
    const s = new TreeSet<number>(reverseComparator<number>());
    for (const k of [10, 20, 30, 40, 50]) s.add(k);
    expect(s.toArray()).toEqual([50, 40, 30, 20, 10]);
    const sub = s.subSet(Range.closedOpen(20, 50)); // {20,30,40}
    expect(sub.toArray()).toEqual([40, 30, 20]);
    sub.remove(30);
    expect(s.has(30)).toBe(true);
  });
});

// Deterministic xorshift (mirrors the Rust/Go invariant tests) so the
// randomized size-invariant test never relies on external randomness.
function makeRand(seed: bigint): () => bigint {
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
}

describe("TreeMap order statistics (rank / select)", () => {
  it("rank of present and absent keys (lower-bound index)", () => {
    const m = mapOf([10, 20, 30, 40, 50]);
    expect(m.rank(10)).toBe(0);
    expect(m.rank(30)).toBe(2);
    expect(m.rank(50)).toBe(4);
    expect(m.rank(5)).toBe(0); // before min
    expect(m.rank(25)).toBe(2); // between 20 and 30
    expect(m.rank(55)).toBe(5); // past max -> size
  });

  it("selectKey / selectEntry by 0-based index", () => {
    const m = mapOf([10, 20, 30, 40, 50]); // value = key*10
    expect(m.selectKey(0)).toBe(10);
    expect(m.selectKey(2)).toBe(30);
    expect(m.selectKey(4)).toBe(50);
    expect(m.selectKey(5)).toBeUndefined(); // == size
    expect(m.selectKey(999)).toBeUndefined();
    expect(m.selectEntry(0)).toEqual([10, 100]);
    expect(m.selectEntry(2)).toEqual([30, 300]);
    expect(m.selectEntry(5)).toBeUndefined();
  });

  it("negative index returns undefined (no trap)", () => {
    const m = mapOf([10, 20, 30]);
    expect(m.selectKey(-1)).toBeUndefined();
    expect(m.selectEntry(-1)).toBeUndefined();
    expect(m.selectKey(-100)).toBeUndefined();
  });

  it("empty and single-element edges", () => {
    const empty = mapOf([]);
    expect(empty.rank(5)).toBe(0);
    expect(empty.selectKey(0)).toBeUndefined();

    const single = mapOf([]);
    single.set(7, 70);
    expect(single.rank(6)).toBe(0);
    expect(single.rank(7)).toBe(0);
    expect(single.rank(8)).toBe(1);
    expect(single.selectKey(0)).toBe(7);
    expect(single.selectEntry(0)).toEqual([7, 70]);
    expect(single.selectKey(1)).toBeUndefined();
  });

  it("signed i32 extremes", () => {
    const m = mapOf([I32_MIN, -1, 0, 1, I32_MAX]);
    expect(m.rank(I32_MIN)).toBe(0);
    expect(m.rank(0)).toBe(2);
    expect(m.rank(I32_MAX)).toBe(4);
    expect(m.selectKey(0)).toBe(I32_MIN);
    expect(m.selectKey(4)).toBe(I32_MAX);
    expect(m.selectKey(5)).toBeUndefined();
  });

  it("stale subtree sizes after remove are detected", () => {
    const m = mapOf([10, 20, 30, 40, 50]);
    expect(m.remove(30)).toBe(300);
    expect([...m.keys()]).toEqual([10, 20, 40, 50]);
    expect(m.rank(40)).toBe(2);
    expect(m.rank(35)).toBe(2);
    expect(m.selectKey(2)).toBe(40);
    expect(m.selectKey(4)).toBeUndefined();
    m.checkSizeInvariant();
  });

  it("round-trip selectKey(rank(k))==k and rank(selectKey(i))==i", () => {
    const m = mapOf([10, 20, 30, 40, 50, -7, 0, 99]);
    for (const k of [...m.keys()]) {
      expect(m.selectKey(m.rank(k))).toBe(k);
    }
    for (let i = 0; i < m.size; i++) {
      const k = m.selectKey(i)!;
      expect(m.rank(k)).toBe(i);
    }
    expect(m.selectKey(m.size)).toBeUndefined();
  });

  it("order statistics follow the comparator (reverse order)", () => {
    const m = new TreeMap<number, number>(reverseComparator<number>());
    for (const k of [10, 20, 30, 40, 50]) m.set(k, k * 10);
    expect(m.selectKey(0)).toBe(50);
    expect(m.selectKey(4)).toBe(10);
    expect(m.rank(50)).toBe(0);
    expect(m.rank(10)).toBe(4);
    m.checkSizeInvariant();
  });

  it("subtree-size invariant holds over randomized insert/remove", () => {
    const m = new TreeMap<number, number>(naturalComparator<number>());
    const oracle = new Set<number>();
    const rand = makeRand(0x9e3779b97f4a7c15n);
    for (let step = 0; step < 4000; step++) {
      const key = Number(rand() % 200n);
      if (rand() % 2n === 0n) {
        m.set(key, key * 10);
        oracle.add(key);
      } else {
        m.remove(key);
        oracle.delete(key);
      }
      m.checkSizeInvariant();
      expect(m.size).toBe(oracle.size);
    }
    const sorted = [...oracle].sort((a, b) => a - b);
    sorted.forEach((k, i) => {
      expect(m.rank(k)).toBe(i);
      expect(m.selectKey(i)).toBe(k);
    });
    expect(m.selectKey(sorted.length)).toBeUndefined();
  });
});

describe("TreeSet order statistics (rank / select)", () => {
  it("rank / select basics with present & absent ranks", () => {
    const s = setOf([10, 20, 30, 40, 50]);
    expect(s.rank(10)).toBe(0);
    expect(s.rank(30)).toBe(2);
    expect(s.rank(50)).toBe(4);
    expect(s.rank(5)).toBe(0);
    expect(s.rank(25)).toBe(2);
    expect(s.rank(55)).toBe(5);
    expect(s.select(0)).toBe(10);
    expect(s.select(2)).toBe(30);
    expect(s.select(4)).toBe(50);
    expect(s.select(5)).toBeUndefined(); // == size
    expect(s.select(-1)).toBeUndefined(); // negative -> undefined, no trap
  });

  it("empty and single-element edges", () => {
    const empty = setOf([]);
    expect(empty.rank(5)).toBe(0);
    expect(empty.select(0)).toBeUndefined();

    const s = setOf([7]);
    expect(s.rank(6)).toBe(0);
    expect(s.rank(7)).toBe(0);
    expect(s.rank(8)).toBe(1);
    expect(s.select(0)).toBe(7);
    expect(s.select(1)).toBeUndefined();
  });

  it("signed i32 extremes", () => {
    const s = setOf([I32_MIN, -1, 0, 1, I32_MAX]);
    expect(s.rank(I32_MIN)).toBe(0);
    expect(s.rank(0)).toBe(2);
    expect(s.rank(I32_MAX)).toBe(4);
    expect(s.select(0)).toBe(I32_MIN);
    expect(s.select(4)).toBe(I32_MAX);
    expect(s.select(5)).toBeUndefined();
  });

  it("rank / select after remove + round-trip identity", () => {
    const s = setOf([10, 20, 30, 40, 50]);
    expect(s.remove(30)).toBe(true);
    expect(s.rank(40)).toBe(2);
    expect(s.rank(35)).toBe(2);
    expect(s.select(2)).toBe(40);
    expect(s.select(4)).toBeUndefined();
    for (const x of s.toArray()) expect(s.select(s.rank(x))).toBe(x);
    for (let i = 0; i < s.size; i++) expect(s.rank(s.select(i)!)).toBe(i);
    s.checkSizeInvariant();
  });

  it("selectWhere is the predicate filter (rename of functional select)", () => {
    const s = setOf([1, 2, 3, 4, 5]);
    expect(s.selectWhere((v) => v % 2 === 0).toArray()).toEqual([2, 4]);
  });
});
