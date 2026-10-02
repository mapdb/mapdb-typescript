// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Cardinality overflow (bags) — refused, not wrapped (algorithms.md).
// Any add whose resulting total size would exceed Number.MAX_SAFE_INTEGER
// throws RangeError before any mutation; reaching exactly the maximum is
// allowed; a refused bulk add adds nothing. Iteration is observed through
// the (value, count) view plus a bounded iterator prefix: expanding 2^53
// occurrences is not feasible.

import { describe, it, expect } from "vitest";
import { NumberHashBag } from "./number-hash-bag.js";
import { BigIntHashBag } from "./bigint-hash-bag.js";
import { ImmutableNumberHashBag } from "./immutable-number-hash-bag.js";
import { ImmutableBigIntHashBag } from "./immutable-bigint-hash-bag.js";
import { HashBag } from "../object/hashbag.js";
import { NumberTreeBag } from "../treebag/number-tree-bag.js";
import { BigIntTreeBag } from "../treebag/bigint-tree-bag.js";
import { Int8HashBag } from "../typed/bag/int8-hash-bag.js";
import { Int16HashBag } from "../typed/bag/int16-hash-bag.js";
import { Int32HashBag } from "../typed/bag/int32-hash-bag.js";
import { Float32HashBag } from "../typed/bag/float32-hash-bag.js";
import { Float64HashBag } from "../typed/bag/float64-hash-bag.js";
import { BigInt64HashBag } from "../typed/bag/bigint64-hash-bag.js";
import { ImmutableInt32HashBag } from "../typed/bag/immutable_int32-hash-bag.js";

const MAX = Number.MAX_SAFE_INTEGER;

/** Uniform view over a bag that supports addOccurrences. */
interface CountedBag<V> {
  add(value: V): unknown;
  addOccurrences(value: V, occurrences: number): void;
  occurrencesOf(value: V): number;
  readonly size: number;
  forEachWithOccurrences(f: (value: V, count: number) => void): void;
  [Symbol.iterator](): Iterator<V>;
}

/** The first `n` iterated values; bounded, so a huge bag is never expanded. */
function iterPrefix<V>(bag: CountedBag<V>, n: number): V[] {
  const out: V[] = [];
  const it = bag[Symbol.iterator]();
  while (out.length < n) {
    const r = it.next();
    if (r.done) break;
    out.push(r.value);
  }
  return out;
}

function snapshot<V>(bag: CountedBag<V>, distinct: () => number) {
  const pairs: [V, number][] = [];
  bag.forEachWithOccurrences((v, c) => pairs.push([v, c]));
  return { size: bag.size, distinct: distinct(), pairs, prefix: iterPrefix(bag, 2) };
}

interface Family<V> {
  name: string;
  make: () => CountedBag<V>;
  distinct: (bag: CountedBag<V>) => number;
  a: V;
  b: V;
}

const sd = (bag: unknown) => (bag as { sizeDistinct(): number }).sizeDistinct();

const families: Family<unknown>[] = [
  {
    name: "NumberHashBag",
    make: () => new NumberHashBag(),
    distinct: sd,
    a: 1,
    b: 2,
  },
  {
    name: "BigIntHashBag",
    make: () => new BigIntHashBag(),
    distinct: sd,
    a: 1n,
    b: 2n,
  },
  {
    name: "HashBag<string>",
    make: () => new HashBag<string>(),
    distinct: sd,
    a: "a",
    b: "b",
  },
  {
    name: "Int8HashBag",
    make: () => new Int8HashBag(),
    distinct: sd,
    a: 1,
    b: 2,
  },
  {
    name: "Int16HashBag",
    make: () => new Int16HashBag(),
    distinct: sd,
    a: 1,
    b: 2,
  },
  {
    name: "Int32HashBag",
    make: () => new Int32HashBag(),
    distinct: sd,
    a: 1,
    b: 2,
  },
  {
    name: "Float32HashBag",
    make: () => new Float32HashBag(),
    distinct: sd,
    a: 1.5,
    b: 2.5,
  },
  {
    name: "Float64HashBag",
    make: () => new Float64HashBag(),
    distinct: sd,
    a: 1.5,
    b: 2.5,
  },
  {
    name: "BigInt64HashBag",
    make: () => new BigInt64HashBag(),
    distinct: sd,
    a: 1n,
    b: 2n,
  },
] as Family<unknown>[];

describe.each(families)("$name cardinality overflow", (f) => {
  it("reaching exactly MAX_SAFE_INTEGER is allowed", () => {
    const bag = f.make();
    bag.addOccurrences(f.a, MAX - 1);
    bag.addOccurrences(f.b, 1);
    expect(bag.size).toBe(MAX);
    expect(bag.occurrencesOf(f.a)).toBe(MAX - 1);
    expect(bag.occurrencesOf(f.b)).toBe(1);

    const single = f.make();
    single.addOccurrences(f.a, MAX);
    expect(single.size).toBe(MAX);
    expect(single.occurrencesOf(f.a)).toBe(MAX);
  });

  it("one more on an existing value is refused, bag unchanged", () => {
    const bag = f.make();
    bag.addOccurrences(f.a, MAX - 1);
    bag.addOccurrences(f.b, 1);
    const before = snapshot(bag, () => f.distinct(bag));
    expect(() => bag.addOccurrences(f.a, 1)).toThrow(RangeError);
    expect(() => bag.add(f.a)).toThrow(RangeError);
    expect(() => bag.addOccurrences(f.b, MAX)).toThrow(RangeError);
    expect(snapshot(bag, () => f.distinct(bag))).toEqual(before);
    expect(bag.occurrencesOf(f.a)).toBe(MAX - 1);
  });

  it("one more on a new value is refused, bag unchanged", () => {
    const bag = f.make();
    bag.addOccurrences(f.a, MAX);
    const before = snapshot(bag, () => f.distinct(bag));
    expect(() => bag.add(f.b)).toThrow(RangeError);
    expect(() => bag.addOccurrences(f.b, 1)).toThrow(RangeError);
    expect(snapshot(bag, () => f.distinct(bag))).toEqual(before);
    expect(bag.occurrencesOf(f.b)).toBe(0);
    expect(f.distinct(bag)).toBe(1);
  });

  it("a single huge add past the limit is refused on a partly filled bag", () => {
    const bag = f.make();
    bag.addOccurrences(f.a, 10);
    const before = snapshot(bag, () => f.distinct(bag));
    // 2^53 - 10 would be exact; 2^53 - 9 overflows by one.
    expect(() => bag.addOccurrences(f.b, MAX - 9)).toThrow(RangeError);
    // Far above 2^53, where `size + n` would lose precision.
    expect(() => bag.addOccurrences(f.b, 2 ** 60)).toThrow(RangeError);
    expect(snapshot(bag, () => f.distinct(bag))).toEqual(before);
    bag.addOccurrences(f.b, MAX - 10);
    expect(bag.size).toBe(MAX);
  });

  it("non-integer occurrences are refused, bag unchanged", () => {
    const bag = f.make();
    bag.add(f.a);
    const before = snapshot(bag, () => f.distinct(bag));
    expect(() => bag.addOccurrences(f.a, 1.5)).toThrow(RangeError);
    expect(() => bag.addOccurrences(f.a, NaN)).toThrow(RangeError);
    expect(() => bag.addOccurrences(f.a, Infinity)).toThrow(RangeError);
    expect(snapshot(bag, () => f.distinct(bag))).toEqual(before);
  });
});

describe("bag negative occurrences keep their existing contract", () => {
  it("number/bigint/typed bags throw RangeError", () => {
    expect(() => new NumberHashBag().addOccurrences(1, -1)).toThrow(RangeError);
    expect(() => new BigIntHashBag().addOccurrences(1n, -1)).toThrow(
      RangeError,
    );
    expect(() => new Int32HashBag().addOccurrences(1, -1)).toThrow(RangeError);
  });
  it("object HashBag treats a non-positive count as a no-op", () => {
    const bag = new HashBag<string>();
    bag.addOccurrences("a", -1);
    expect(bag.size).toBe(0);
    expect(bag.sizeDistinct()).toBe(0);
  });
});

describe("bulk adds are checked as a whole", () => {
  it("bulkLoad refuses an overflowing batch", () => {
    const batch: [number, number][] = [
      [1, MAX],
      [2, 1],
    ];
    expect(() => NumberHashBag.bulkLoad(batch)).toThrow(RangeError);
    expect(() => Int32HashBag.bulkLoad(batch)).toThrow(RangeError);
    expect(() =>
      BigIntHashBag.bulkLoad([
        [1n, MAX],
        [2n, 1],
      ]),
    ).toThrow(RangeError);
    expect(NumberHashBag.bulkLoad([[1, MAX]]).size).toBe(MAX);
  });

  it("immutable copies of a full bag succeed", () => {
    const n = new NumberHashBag();
    n.addOccurrences(1, MAX);
    expect(new ImmutableNumberHashBag(n).size).toBe(MAX);
    const b = new BigIntHashBag();
    b.addOccurrences(1n, MAX);
    expect(new ImmutableBigIntHashBag(b).size).toBe(MAX);
    const t = new Int32HashBag();
    t.addOccurrences(1, MAX);
    expect(ImmutableInt32HashBag.fromMutable(t).size).toBe(MAX);
  });

  it("tree bag pump refuses an overflowing batch", () => {
    expect(() => NumberTreeBag.buildFromSortedRuns([1, 2], [MAX, 1])).toThrow(
      RangeError,
    );
    expect(() => BigIntTreeBag.buildFromSortedRuns([1n, 2n], [MAX, 1])).toThrow(
      RangeError,
    );
  });
});

describe.each([
  {
    name: "NumberTreeBag",
    build: (counts: number[]) =>
      NumberTreeBag.buildFromSortedRuns([1, 5], counts),
    a: 1,
    mid: 3,
  },
  {
    name: "BigIntTreeBag",
    build: (counts: number[]) =>
      BigIntTreeBag.buildFromSortedRuns([1n, 5n], counts),
    a: 1n,
    mid: 3n,
  },
] as {
  name: string;
  build: (counts: number[]) => NumberTreeBag;
  a: number;
  mid: number;
}[])("$name cardinality overflow", (f) => {
  const snap = (bag: NumberTreeBag) => {
    const pairs: [number, number][] = [];
    bag.forEachWithOccurrences((v, c) => pairs.push([v, c]));
    return { size: bag.size, distinct: bag.sizeDistinct, pairs };
  };

  it("add up to exactly MAX_SAFE_INTEGER is allowed", () => {
    const bag = f.build([MAX - 3, 1]);
    bag.add(f.a);
    bag.add(f.mid);
    expect(bag.size).toBe(MAX);
    expect(bag.occurrencesOf(f.a)).toBe(MAX - 2);
    expect(bag.sizeDistinct).toBe(3);
  });

  it("add past MAX_SAFE_INTEGER is refused, bag unchanged", () => {
    const bag = f.build([MAX - 1, 1]);
    const before = snap(bag);
    expect(() => bag.add(f.a)).toThrow(RangeError);
    expect(() => bag.add(f.mid)).toThrow(RangeError);
    expect(snap(bag)).toEqual(before);
    expect(bag.has(f.mid)).toBe(false);
  });
});
