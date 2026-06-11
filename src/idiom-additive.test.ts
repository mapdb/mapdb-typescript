// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// v2 idiom pass (BREAKING): every collection has a [Symbol.iterator] with the
// idiomatic yield shape, every map type exposes `has(key)` (replacing the old
// `containsKey`) and every set type exposes `has(value)` (replacing the old
// `contains`). These tests pin the new behaviour on a representative class from
// each family touched, proving the shape matches the classes that already had
// an iterator.

import { describe, it, expect } from "vitest";

import { Int8Int8HashMap } from "./typed/hashmap/int8-int8-hash-map.js";
import { NumberNumberHashMap } from "./hashmap/number-number-hash-map.js";
import { NumberObjectHashMap } from "./hashmap/number-object-hash-map.js";
import { NumberNumberHashBiMap } from "./hashmap/number-number-hash-bi-map.js";
import { ImmutableNumberNumberHashMap } from "./hashmap/immutable-number-number-hash-map.js";
import { NumberNumberTreeMap } from "./treemap/number-number-tree-map.js";
import { NumberNumberListMultimap } from "./multimap/number-number-list-multimap.js";
import { Multimap } from "./multimap/multimap.js";
import { Int8HashSet } from "./typed/hashset/int8-hash-set.js";
import { Int8HashBag } from "./typed/bag/int8-hash-bag.js";
import { Int8ArrayList } from "./typed/arraylist/int8-array-list.js";
import { NumberTreeSet } from "./treeset/number-tree-set.js";
import { BitSet } from "./bitset/bit-set.js";
import { ImmutableBitSet } from "./bitset/immutable-bit-set.js";

describe("idiom pass — maps yield [key, value] pairs like a JS Map", () => {
  it("typed hash map: spread + for-of yield [k, v]", () => {
    const m = new Int8Int8HashMap();
    m.set(1, 10);
    m.set(2, 20);
    const pairs = [...m].sort((a, b) => a[0] - b[0]);
    expect(pairs).toEqual([
      [1, 10],
      [2, 20],
    ]);
    const seen: Array<[number, number]> = [];
    for (const [k, v] of m) seen.push([k, v]);
    expect(seen.sort((a, b) => a[0] - b[0])).toEqual([
      [1, 10],
      [2, 20],
    ]);
    // delegates to the exact same traversal as entries()
    expect([...m].sort((a, b) => a[0] - b[0])).toEqual(
      [...m.entries()].sort((a, b) => a[0] - b[0]),
    );
  });

  it("nontyped number hash map iterator matches entries()", () => {
    const m = new NumberNumberHashMap();
    m.set(5, 50);
    m.set(6, 60);
    expect([...m].sort((a, b) => a[0] - b[0])).toEqual(
      [...m.entries()].sort((a, b) => a[0] - b[0]),
    );
  });

  it("object-keyed hash map iterator matches entries()", () => {
    const m = new NumberObjectHashMap<string>();
    m.set(1, "a");
    m.set(2, "b");
    expect(new Map([...m])).toEqual(
      new Map([
        [1, "a"],
        [2, "b"],
      ]),
    );
  });

  it("immutable nontyped map iterator matches entries()", () => {
    const base = new NumberNumberHashMap();
    base.set(7, 70);
    const im = new ImmutableNumberNumberHashMap(base);
    expect([...im]).toEqual([...im.entries()]);
  });

  it("bi-map already iterated [k, v] — still does (consistency anchor)", () => {
    const m = new NumberNumberHashBiMap();
    m.set(1, 100);
    m.set(2, 200);
    expect([...m].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 100],
      [2, 200],
    ]);
  });

  it("tree map: iterator yields [k, v] in ascending key order, == entries()", () => {
    const m = new NumberNumberTreeMap();
    m.set(3, 30);
    m.set(1, 10);
    m.set(2, 20);
    expect([...m]).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
    expect([...m]).toEqual([...m.entries()]);
  });
});

describe("idiom pass — multimaps yield one [key, value] tuple per value", () => {
  it("generated list multimap iterator matches existing entries() shape", () => {
    const mm = new NumberNumberListMultimap();
    mm.set(1, 10);
    mm.set(1, 11);
    mm.set(2, 20);
    const sort = (a: [number, number], b: [number, number]) =>
      a[0] - b[0] || a[1] - b[1];
    expect([...mm].sort(sort)).toEqual([...mm.entries()].sort(sort));
    expect([...mm].sort(sort)).toEqual([
      [1, 10],
      [1, 11],
      [2, 20],
    ]);
  });

  it("hand-written Multimap aggregator gained an iterator (== entries())", () => {
    const mm = new Multimap<number, number>();
    mm.set(1, 10);
    mm.set(1, 11);
    mm.set(2, 20);
    const sort = (a: [number, number], b: [number, number]) =>
      a[0] - b[0] || a[1] - b[1];
    expect([...mm].sort(sort)).toEqual([...mm.entries()].sort(sort));
  });
});

describe("idiom pass — sets/bags/lists are iterable (yield elements)", () => {
  it("typed hash set: for-of and spread yield elements (== values())", () => {
    const s = new Int8HashSet();
    s.add(1);
    s.add(2);
    s.add(3);
    expect([...s].sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect([...s].sort((a, b) => a - b)).toEqual(
      [...s.values()].sort((a, b) => a - b),
    );
  });

  it("typed bag: iterator yields each item repeated by occurrence count", () => {
    const b = new Int8HashBag();
    b.add(1);
    b.add(1);
    b.add(2);
    expect([...b].sort((a, b2) => a - b2)).toEqual([1, 1, 2]);
    expect([...b]).toEqual([...b.toArray()]);
  });

  it("typed array list: iterator yields elements in order", () => {
    const l = new Int8ArrayList();
    l.add(10);
    l.add(20);
    l.add(30);
    expect([...l]).toEqual([10, 20, 30]);
  });

  it("bit set: iterator yields set bit indices ascending (== toArray)", () => {
    const b = new BitSet();
    b.set(5);
    b.set(1);
    b.set(64);
    expect([...b]).toEqual([1, 5, 64]);
    expect([...b]).toEqual(b.toArray());
    // mutable has(bit) alias mirrors get(bit)
    expect(b.has(5)).toBe(true);
    expect(b.has(2)).toBe(false);
    expect(b.has(5)).toBe(b.get(5));
  });

  it("immutable bit set: iterator yields set bit indices ascending", () => {
    const b = new BitSet();
    b.set(2);
    b.set(40);
    const imm = new ImmutableBitSet(b);
    expect([...imm]).toEqual([2, 40]);
    expect([...imm]).toEqual(imm.toArray());
  });
});

describe("idiom pass — has() is the membership method (replaced containsKey/contains)", () => {
  it("map has(key) reports key membership", () => {
    const m = new Int8Int8HashMap();
    m.set(1, 10);
    expect(m.has(1)).toBe(true);
    expect(m.has(99)).toBe(false);
    expect(m.has(1)).toBe(m.has(1));
  });

  it("tree map has(key) reports key membership", () => {
    const m = new NumberNumberTreeMap();
    m.set(7, 70);
    expect(m.has(7)).toBe(true);
    expect(m.has(8)).toBe(false);
    expect(m.has(7)).toBe(true);
  });

  it("multimap has(key) reports key membership", () => {
    const mm = new NumberNumberListMultimap();
    mm.set(1, 10);
    expect(mm.has(1)).toBe(true);
    expect(mm.has(2)).toBe(false);
    expect(mm.has(1)).toBe(true);
  });

  it("bi-map has(key) reports key membership", () => {
    const m = new NumberNumberHashBiMap();
    m.set(1, 100);
    expect(m.has(1)).toBe(true);
    expect(m.has(2)).toBe(false);
    expect(m.has(1)).toBe(true);
  });

  it("set has(value) reports value membership", () => {
    const s = new Int8HashSet();
    s.add(5);
    expect(s.has(5)).toBe(true);
    expect(s.has(6)).toBe(false);
    expect(s.has(5)).toBe(true);
    expect(s.has(5)).toBe(s.has(5));
  });

  it("tree set has(value) reports value membership", () => {
    const s = new NumberTreeSet();
    s.add(5);
    expect(s.has(5)).toBe(true);
    expect(s.has(6)).toBe(false);
    expect(s.has(5)).toBe(true);
  });

  it("bag has(value) reports value membership", () => {
    const b = new Int8HashBag();
    b.add(5);
    expect(b.has(5)).toBe(true);
    expect(b.has(6)).toBe(false);
    expect(b.has(5)).toBe(true);
  });
});
