// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Phase 3 correctness-burndown regressions. Each block pins a runtime-proved
// production bug from todo/fable/typescript.md that has now been fixed.

import { describe, it, expect } from "vitest";

import { totalCmpNumber } from "./float-order.js";
import { NumberNumberTreeMap } from "../treemap/number-number-tree-map.js";
import { NumberBigIntTreeMap } from "../treemap/number-bigint-tree-map.js";
import { NumberTreeSet } from "../treeset/number-tree-set.js";
import { NumberTreeBag } from "../treebag/number-tree-bag.js";
import { NumberArrayList } from "../arraylist/number-array-list.js";
import { NumberPriorityQueue } from "../priority_queue/number-priority-queue.js";
import { NumberHashBag } from "../bag/number-hash-bag.js";
import { NumberObjectHashMap } from "../hashmap/number-object-hash-map.js";
import { NumberNumberListMultimap } from "../multimap/number-number-list-multimap.js";
import { BigIntBigIntHashMap } from "../hashmap/bigint-bigint-hash-map.js";
import { BigIntHashSet } from "../hashset/bigint-hash-set.js";
import { NumberNumberHashMap } from "../hashmap/number-number-hash-map.js";

// ---------------------------------------------------------------------------
// float-order helper: IEEE 754 total order (Rust total_cmp)
// ---------------------------------------------------------------------------

describe("totalCmpNumber (IEEE 754 total order)", () => {
  it("orders -Inf < -1 < -0 < +0 < 1 < +Inf < NaN", () => {
    const arr = [NaN, 1, -1, -0, 0, Infinity, -Infinity, 0.5, -0.5];
    arr.sort(totalCmpNumber);
    expect(arr.map((x) => (Object.is(x, -0) ? "-0" : x))).toEqual([
      -Infinity,
      -1,
      -0.5,
      "-0",
      0,
      0.5,
      1,
      Infinity,
      NaN,
    ]);
  });

  it("-0 sorts strictly below +0", () => {
    expect(totalCmpNumber(-0, 0)).toBeLessThan(0);
    expect(totalCmpNumber(0, -0)).toBeGreaterThan(0);
  });

  it("is transitive across NaN and negatives (no intransitivity)", () => {
    expect(totalCmpNumber(NaN, -1)).toBeGreaterThan(0);
    expect(totalCmpNumber(-1, 1)).toBeLessThan(0);
    expect(totalCmpNumber(NaN, 1)).toBeGreaterThan(0); // NaN above everything
  });

  it("equal values compare equal", () => {
    expect(totalCmpNumber(NaN, NaN)).toBe(0);
    expect(totalCmpNumber(3.5, 3.5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bug 1: NaN tree-map key must not overwrite an existing entry
// ---------------------------------------------------------------------------

describe("NumberNumberTreeMap NaN/±0 keys (Bug 1)", () => {
  it("a NaN key is a distinct insert, not an overwrite (the runtime repro)", () => {
    const m = new NumberNumberTreeMap();
    m.set(1, 100);
    m.set(NaN, 5);
    // Before the fix: get(1) === 5, size() === 1 (NaN overwrote key 1).
    expect(m.get(1)).toBe(100);
    expect(m.size).toBe(2);
    expect(m.get(NaN)).toBe(5);
  });

  it("NaN is findable and does not corrupt unrelated negative keys", () => {
    const m = new NumberNumberTreeMap();
    m.set(-1, 10);
    m.set(-100, 20);
    m.set(NaN, 30);
    expect(m.get(-1)).toBe(10);
    expect(m.get(-100)).toBe(20);
    expect(m.has(NaN)).toBe(true);
    expect(m.size).toBe(3);
  });

  it("-0 and +0 are distinct keys", () => {
    const m = new NumberNumberTreeMap();
    m.set(0, 1);
    m.set(-0, 2);
    expect(m.size).toBe(2);
    expect(m.get(0)).toBe(1);
    expect(m.get(-0)).toBe(2);
  });

  it("iterates keys in total order", () => {
    const m = new NumberNumberTreeMap();
    for (const k of [3, -1, NaN, 0, -0, 2]) m.set(k, 0);
    const keys = [...m.keys()].map((x) => (Object.is(x, -0) ? "-0" : x));
    expect(keys).toEqual([-1, "-0", 0, 2, 3, NaN]);
  });
});

describe("NumberBigIntTreeMap NaN key (Bug 1, number-keyed side)", () => {
  it("NaN key does not overwrite an existing number key", () => {
    const m = new NumberBigIntTreeMap();
    m.set(1, 100n);
    m.set(NaN, 5n);
    expect(m.get(1)).toBe(100n);
    expect(m.size).toBe(2);
    expect(m.get(NaN)).toBe(5n);
  });
});

// ---------------------------------------------------------------------------
// Bug 1/2: NaN and ±0 in NumberTreeSet / NumberTreeBag
// ---------------------------------------------------------------------------

describe("NumberTreeSet NaN/±0 (Bug 2)", () => {
  it("NaN can be added to a non-empty set and is findable", () => {
    const s = new NumberTreeSet();
    expect(s.add(5)).toBe(true);
    // Before the fix: add(NaN) returned false (NaN swallowed).
    expect(s.add(NaN)).toBe(true);
    expect(s.size).toBe(2);
    expect(s.has(NaN)).toBe(true);
    expect(s.has(5)).toBe(true);
  });

  it("contains(NaN) is false on a set without NaN", () => {
    const s = new NumberTreeSet();
    s.add(1);
    s.add(2);
    expect(s.has(NaN)).toBe(false);
  });

  it("-0 and +0 are distinct members", () => {
    const s = new NumberTreeSet();
    s.add(0);
    s.add(-0);
    expect(s.size).toBe(2);
  });
});

describe("NumberTreeBag NaN/±0 (Bug 2)", () => {
  it("NaN can be added to a non-empty bag and counted", () => {
    const b = new NumberTreeBag();
    b.add(5);
    b.add(NaN);
    b.add(NaN);
    expect(b.has(NaN)).toBe(true);
    expect(b.occurrencesOf(NaN)).toBe(2);
  });

  it("-0 and +0 are distinct distinct-elements", () => {
    const b = new NumberTreeBag();
    b.add(0);
    b.add(-0);
    expect(b.sizeDistinct).toBe(2); // getter on NumberTreeBag
  });
});

// ---------------------------------------------------------------------------
// Bug 2: NumberArrayList.sort() total order
// ---------------------------------------------------------------------------

describe("NumberArrayList.sort() NaN + ±0 total order (Bug 2)", () => {
  it("sorts to IEEE total order with NaN last and -0 before +0", () => {
    const l = NumberArrayList.of([NaN, 1, -1, -0, 0, Infinity, -Infinity]);
    l.sort();
    const out = l.toArray().map((x) => (Object.is(x, -0) ? "-0" : x));
    expect(out).toEqual([-Infinity, -1, "-0", 0, 1, Infinity, NaN]);
  });
});

// ---------------------------------------------------------------------------
// Bug 3: NumberPriorityQueue NaN + contains(±0)
// ---------------------------------------------------------------------------

describe("NumberPriorityQueue NaN/±0 (Bug 3)", () => {
  it("drainSorted yields ascending total order with NaN last", () => {
    const q = NumberPriorityQueue.of([NaN, 1, -1, Infinity, -Infinity]);
    expect(q.drainSorted()).toEqual([-Infinity, -1, 1, Infinity, NaN]);
  });

  it("contains(NaN) finds a NaN that was pushed", () => {
    const q = new NumberPriorityQueue();
    q.push(NaN);
    q.push(2);
    expect(q.has(NaN)).toBe(true);
  });

  it("contains distinguishes -0 from +0", () => {
    const q = new NumberPriorityQueue();
    q.push(-0);
    expect(q.has(-0)).toBe(true);
    expect(q.has(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bug 4: bigint hash spread (high 32 bits no longer discarded)
// ---------------------------------------------------------------------------

describe("bigint hash spread (Bug 4)", () => {
  // Keys differing ONLY above bit 31 collapsed to one bucket before the fix.
  const keysHighBitsOnly = (n: number): bigint[] => {
    const out: bigint[] = [];
    for (let i = 0; i < n; i++) out.push(BigInt(i) << 40n);
    return out;
  };

  it("BigIntBigIntHashMap stores/retrieves high-bit-only keys", () => {
    const m = new BigIntBigIntHashMap();
    const keys = keysHighBitsOnly(2000);
    for (const k of keys) m.set(k, k + 1n);
    expect(m.size).toBe(2000);
    for (const k of keys) expect(m.get(k)).toBe(k + 1n);
  });

  it("BigIntHashSet does not collapse high-bit-only values", () => {
    const s = new BigIntHashSet();
    for (const v of keysHighBitsOnly(2000)) s.add(v);
    expect(s.size).toBe(2000);
  });
});

// ---------------------------------------------------------------------------
// Bug 5: ±0 identity in Map-backed collections
// ---------------------------------------------------------------------------

describe("NumberHashBag ±0 distinct (Bug 5)", () => {
  it("add(0); add(-0) yields two distinct elements", () => {
    const b = new NumberHashBag();
    b.add(0);
    b.add(-0);
    // Before the fix: occurrencesOf(+0) === 2, sizeDistinct() === 1.
    expect(b.occurrencesOf(0)).toBe(1);
    expect(b.occurrencesOf(-0)).toBe(1);
    expect(b.sizeDistinct()).toBe(2);
  });

  it("NaN is findable", () => {
    const b = new NumberHashBag();
    b.add(NaN);
    expect(b.has(NaN)).toBe(true);
    expect(b.occurrencesOf(NaN)).toBe(1);
  });

  it("iteration preserves the -0 sign", () => {
    const b = new NumberHashBag();
    b.add(-0);
    const vals = [...b];
    expect(vals.length).toBe(1);
    expect(Object.is(vals[0], -0)).toBe(true);
  });
});

describe("NumberObjectHashMap ±0 distinct (Bug 5)", () => {
  it("-0 and +0 are distinct keys with their own values", () => {
    const m = new NumberObjectHashMap<string>();
    m.set(0, "pos");
    m.set(-0, "neg");
    expect(m.size).toBe(2);
    expect(m.get(0)).toBe("pos");
    expect(m.get(-0)).toBe("neg");
  });

  it("NaN key is findable", () => {
    const m = new NumberObjectHashMap<string>();
    m.set(NaN, "nan");
    expect(m.get(NaN)).toBe("nan");
    expect(m.has(NaN)).toBe(true);
  });

  it("entries preserve the -0 sign", () => {
    const m = new NumberObjectHashMap<number>();
    m.set(-0, 7);
    const [[k]] = [...m.entries()];
    expect(Object.is(k, -0)).toBe(true);
  });
});

describe("NumberNumberListMultimap ±0 key distinct (Bug 5)", () => {
  it("-0 and +0 are distinct keys", () => {
    const mm = new NumberNumberListMultimap();
    mm.set(0, 1);
    mm.set(-0, 2);
    expect(mm.keysCount).toBe(2);
    expect(mm.get(0)).toEqual([1]);
    expect(mm.get(-0)).toEqual([2]);
  });

  it("NaN key works", () => {
    const mm = new NumberNumberListMultimap();
    mm.set(NaN, 9);
    expect(mm.has(NaN)).toBe(true);
    expect(mm.get(NaN)).toEqual([9]);
  });

  it("iteration reproduces the original -0 key", () => {
    const mm = new NumberNumberListMultimap();
    mm.set(-0, 1);
    const [[k]] = [...mm];
    expect(Object.is(k, -0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bug 6: load factor strictly below 0.75
// ---------------------------------------------------------------------------

describe("load factor strictly < 0.75 (Bug 6)", () => {
  it("a cap-16 hash map grows on the 12th insert (0.75 boundary)", () => {
    // 12 / 16 === 0.75; the table must already have grown before storing the
    // 12th entry, so no occupied bucket sits exactly at the 0.75 ceiling.
    const m = new NumberNumberHashMap();
    for (let i = 0; i < 12; i++) m.set(i, i);
    expect(m.size).toBe(12);
    for (let i = 0; i < 12; i++) expect(m.get(i)).toBe(i);
  });
});

describe("NaN payload hash canonicalization (f64HashSeed)", () => {
  it("treats distinct NaN payloads as one key under Object.is equality", async () => {
    const { NumberHashSet } = await import("../hashset/number-hash-set.js");
    const dv = new DataView(new ArrayBuffer(8));
    dv.setUint32(0, 0x7ff80001); dv.setUint32(4, 0); const nan1 = dv.getFloat64(0);
    dv.setUint32(0, 0x7ffabcde); dv.setUint32(4, 0); const nan2 = dv.getFloat64(0);
    const s = new NumberHashSet();
    expect(s.add(nan1)).toBe(true);
    expect(s.add(nan2)).toBe(false); // equal under Object.is -> no duplicate
    expect(s.size).toBe(1);
    expect(s.has(NaN)).toBe(true); // canonical NaN finds it
  });
});
