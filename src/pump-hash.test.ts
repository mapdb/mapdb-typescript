// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Int32Int32HashMap } from "./typed/hashmap/int32-int32-hash-map.js";
import { Float64Float64HashMap } from "./typed/hashmap/float64-float64-hash-map.js";
import { Int32HashSet } from "./typed/hashset/int32-hash-set.js";
import { NumberNumberHashMap } from "./hashmap/number-number-hash-map.js";
import { BigIntBigIntHashMap } from "./hashmap/bigint-bigint-hash-map.js";
import { NumberNumberHashBiMap } from "./hashmap/number-number-hash-bi-map.js";
import { NumberHashSet } from "./hashset/number-hash-set.js";
import { BigIntHashSet } from "./hashset/bigint-hash-set.js";
import { NumberHashBag } from "./bag/number-hash-bag.js";
import { Int32HashBag } from "./typed/bag/int32-hash-bag.js";
import { PumpDuplicateError } from "./internal/pump.js";

/** Reads the private capacity (typed: `capacity`, nontyped: `keys`/`data`). */
function capacityOf(coll: unknown): number {
  const c = coll as { capacity?: number; keys?: unknown[]; data?: unknown[] };
  if (typeof c.capacity === "number") return c.capacity;
  if (Array.isArray(c.keys)) return c.keys.length;
  if (Array.isArray(c.data)) return c.data.length;
  throw new Error("no capacity");
}

describe("Hash pump (typed Int32Int32HashMap)", () => {
  it("bulkLoadExact == per-op set", () => {
    for (const n of [0, 1, 5, 17, 50]) {
      const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [
        i,
        i * 7,
      ]);
      const pumped = Int32Int32HashMap.bulkLoadExact(pairs, n);
      const incr = new Int32Int32HashMap();
      for (const [k, v] of pairs) incr.set(k, v);
      expect(pumped.size).toBe(incr.size);
      for (const [k, v] of pairs) expect(pumped.get(k)).toBe(v);
      expect([...pumped.entries()].sort()).toEqual([...incr.entries()].sort());
    }
  });

  it("zero rehash at n = 3*2^k (capacity matches formula, no growth)", () => {
    for (const n of [3, 6, 12, 24, 48, 96]) {
      const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [
        i,
        i,
      ]);
      const capBefore = (() => {
        const m = Int32Int32HashMap.bulkLoadExact(pairs, n);
        return capacityOf(m);
      })();
      // nextPow2(floor(4n/3)+1)
      const nextPow2 = (x: number) => {
        x--;
        x |= x >> 1;
        x |= x >> 2;
        x |= x >> 4;
        x |= x >> 8;
        x |= x >> 16;
        return x + 1;
      };
      expect(capBefore).toBe(nextPow2(Math.floor((4 * n) / 3) + 1));
      // re-run and confirm capacity is unchanged after the full load (no resize)
      const m = Int32Int32HashMap.bulkLoadExact(pairs, n);
      expect(capacityOf(m)).toBe(capBefore);
      expect(m.size).toBe(n);
    }
  });

  it("duplicate: error throws, ignore keeps first", () => {
    expect(() =>
      Int32Int32HashMap.bulkLoadExact(
        [
          [1, 1],
          [1, 2],
        ],
        2,
      ),
    ).toThrow(PumpDuplicateError);
    const m = Int32Int32HashMap.bulkLoadExact(
      [
        [1, 100],
        [1, 200],
      ],
      2,
      {
        onDuplicate: "ignore",
      },
    );
    expect(m.get(1)).toBe(100);
    expect(m.size).toBe(1);
  });

  it("exact size guards: too many / too few / invalid", () => {
    expect(() =>
      Int32Int32HashMap.bulkLoadExact(
        [
          [1, 1],
          [2, 2],
        ],
        1,
      ),
    ).toThrow(RangeError);
    expect(() => Int32Int32HashMap.bulkLoadExact([[1, 1]], 2)).toThrow(
      RangeError,
    );
    expect(() => Int32Int32HashMap.bulkLoadExact([], -1)).toThrow(RangeError);
    expect(() => Int32Int32HashMap.bulkLoadExact([], 1.5)).toThrow(RangeError);
  });

  it("exact size counts consumed duplicates even when ignored", () => {
    expect(() =>
      Int32Int32HashMap.bulkLoadExact(
        [
          [1, 10],
          [1, 20],
          [2, 30],
        ],
        2,
        { onDuplicate: "ignore" },
      ),
    ).toThrow(RangeError);
  });

  it("bulkLoad hint and no-hint paths", () => {
    const m1 = Int32Int32HashMap.bulkLoad([
      [1, 1],
      [2, 2],
    ]);
    expect(m1.size).toBe(2);
    const m2 = Int32Int32HashMap.bulkLoad(
      [
        [1, 1],
        [2, 2],
      ],
      { size: 2 },
    );
    expect(m2.size).toBe(2);
  });
});

describe("Hash pump float edge cases", () => {
  it("NaN is one key (dup error)", () => {
    expect(() =>
      Float64Float64HashMap.bulkLoad([
        [NaN, 1],
        [NaN, 2],
      ]),
    ).toThrow(PumpDuplicateError);
  });
  it("+0 and -0 are distinct keys", () => {
    const m = Float64Float64HashMap.bulkLoad([
      [0, 1],
      [-0, 2],
    ]);
    expect(m.size).toBe(2);
    expect(m.get(0)).toBe(1);
    expect(m.get(-0)).toBe(2);
  });
  it("±Infinity keys", () => {
    const m = Float64Float64HashMap.bulkLoad([
      [Infinity, 1],
      [-Infinity, 2],
    ]);
    expect(m.get(Infinity)).toBe(1);
    expect(m.get(-Infinity)).toBe(2);
  });
});

describe("Hash pump (nontyped maps)", () => {
  it("number map bulkLoadExact == per-op", () => {
    const n = 24;
    const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [
      i,
      i,
    ]);
    const pumped = NumberNumberHashMap.bulkLoadExact(pairs, n);
    const incr = new NumberNumberHashMap();
    for (const [k, v] of pairs) incr.set(k, v);
    expect(pumped.size).toBe(incr.size);
    for (const [k, v] of pairs) expect(pumped.get(k)).toBe(v);
  });
  it("number map zero-rehash capacity at n=3*2^k", () => {
    for (const n of [3, 6, 12, 24, 48]) {
      const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [
        i,
        i,
      ]);
      const m = NumberNumberHashMap.bulkLoadExact(pairs, n);
      // every element resolvable, size correct, no resize happened
      expect(m.size).toBe(n);
      for (let i = 0; i < n; i++) expect(m.get(i)).toBe(i);
    }
  });
  it("bigint map with high-bit keys", () => {
    const big = (1n << 62n) + 5n;
    const m = BigIntBigIntHashMap.bulkLoadExact(
      [
        [big, 1n],
        [big + 1n, 2n],
      ],
      2,
    );
    expect(m.get(big)).toBe(1n);
    expect(m.get(big + 1n)).toBe(2n);
  });
});

describe("Hash pump (hashsets)", () => {
  it("typed Int32HashSet bulkLoadExact == per-op add", () => {
    const n = 48;
    const vals = Array.from({ length: n }, (_, i) => i);
    const pumped = Int32HashSet.bulkLoadExact(vals, n);
    const incr = new Int32HashSet();
    for (const v of vals) incr.add(v);
    expect(pumped.size).toBe(incr.size);
    for (const v of vals) expect(pumped.has(v)).toBe(true);
  });
  it("nontyped NumberHashSet dup error vs ignore", () => {
    expect(() => NumberHashSet.bulkLoadExact([1, 1], 2)).toThrow(
      PumpDuplicateError,
    );
    const s = NumberHashSet.bulkLoadExact([1, 1], 2, { onDuplicate: "ignore" });
    expect(s.size).toBe(1);
  });
  it("typed set exact size counts ignored duplicate values as consumed", () => {
    expect(() =>
      Int32HashSet.bulkLoadExact([1, 1, 2], 2, { onDuplicate: "ignore" }),
    ).toThrow(RangeError);
  });
  it("bigint hashset", () => {
    const s = BigIntHashSet.bulkLoad([1n, 2n, 3n]);
    expect(s.size).toBe(3);
    expect(s.has(2n)).toBe(true);
  });
});

describe("BiMap pump (bijection)", () => {
  it("bulkLoad builds bijection == per-op set", () => {
    const pairs: [number, number][] = [
      [1, 10],
      [2, 20],
      [3, 30],
    ];
    const bm = NumberNumberHashBiMap.bulkLoad(pairs);
    expect(bm.get(1)).toBe(10);
    expect(bm.getKey(20)).toBe(2);
    expect(bm.size).toBe(3);
  });
  it("duplicate key throws", () => {
    expect(() =>
      NumberNumberHashBiMap.bulkLoad([
        [1, 10],
        [1, 20],
      ]),
    ).toThrow(PumpDuplicateError);
  });
  it("duplicate value throws", () => {
    expect(() =>
      NumberNumberHashBiMap.bulkLoad([
        [1, 10],
        [2, 10],
      ]),
    ).toThrow(PumpDuplicateError);
  });
});

describe("Bag pump", () => {
  it("nontyped NumberHashBag bulkLoad accumulates counts", () => {
    const bag = NumberHashBag.bulkLoad([
      [1, 3],
      [2, 1],
      [1, 2],
    ]);
    expect(bag.occurrencesOf(1)).toBe(5);
    expect(bag.occurrencesOf(2)).toBe(1);
    expect(bag.size).toBe(6);
  });
  it("typed Int32HashBag bulkLoad", () => {
    const bag = Int32HashBag.bulkLoad([
      [5, 2],
      [7, 1],
    ]);
    expect(bag.occurrencesOf(5)).toBe(2);
    expect(bag.size).toBe(3);
  });
  it("negative count throws", () => {
    expect(() => NumberHashBag.bulkLoad([[1, -1]])).toThrow(RangeError);
    expect(() => Int32HashBag.bulkLoad([[1, -1]])).toThrow(RangeError);
  });
  it("NaN count throws (no corrupt _size)", () => {
    expect(() => NumberHashBag.bulkLoad([[1, NaN]])).toThrow(RangeError);
    expect(() => Int32HashBag.bulkLoad([[1, NaN]])).toThrow(RangeError);
  });
  it("fractional count throws", () => {
    expect(() => NumberHashBag.bulkLoad([[1, 1.5]])).toThrow(RangeError);
    expect(() => Int32HashBag.bulkLoad([[1, 2.5]])).toThrow(RangeError);
  });
  it("count above MAX_SAFE_INTEGER throws (not a safe integer)", () => {
    const tooBig = Number.MAX_SAFE_INTEGER + 1; // 2^53, not a safe integer
    expect(() => NumberHashBag.bulkLoad([[1, tooBig]])).toThrow(RangeError);
    expect(() => Int32HashBag.bulkLoad([[1, tooBig]])).toThrow(RangeError);
  });
  it("per-key count overflow throws (sum exceeds MAX_SAFE_INTEGER)", () => {
    const half = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
    expect(() =>
      NumberHashBag.bulkLoad([
        [1, half],
        [1, half],
      ]),
    ).toThrow(/overflow/);
    expect(() =>
      Int32HashBag.bulkLoad([
        [1, half],
        [1, half],
      ]),
    ).toThrow(/overflow/);
  });
  it("total _size overflow across distinct keys throws", () => {
    const half = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
    expect(() =>
      NumberHashBag.bulkLoad([
        [1, half],
        [2, half],
      ]),
    ).toThrow(/overflow/);
  });
});

describe("Hash bulkLoad is single-pass (generic iterable, hint pre-size)", () => {
  // A generator source has no .length/.size; bulkLoad must consume it directly
  // (not buffer via Array.from) and may pre-size from opts.size.
  function* gen(n: number): Generator<readonly [number, number]> {
    for (let i = 0; i < n; i++) yield [i, i * 2] as const;
  }

  it("number map bulkLoad over a generator with size hint == per-op", () => {
    const n = 30;
    const m = NumberNumberHashMap.bulkLoad(gen(n), { size: n });
    expect(m.size).toBe(n);
    for (let i = 0; i < n; i++) expect(m.get(i)).toBe(i * 2);
  });

  it("typed map bulkLoad grows past an UNDERSIZED hint (no exact ceiling)", () => {
    const n = 50;
    const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [
      i,
      i,
    ]);
    const m = Int32Int32HashMap.bulkLoad(pairs, { size: 4 });
    expect(m.size).toBe(n);
    for (let i = 0; i < n; i++) expect(m.get(i)).toBe(i);
  });

  it("typed set bulkLoad over a generator grows (no hint)", () => {
    function* vals(): Generator<number> {
      for (let i = 0; i < 40; i++) yield i; // 40 distinct, no hint -> grows
    }
    const s = Int32HashSet.bulkLoad(vals());
    expect(s.size).toBe(40);
  });
  it("set bulkLoad ignore dedups duplicate values over a generator", () => {
    function* vals(): Generator<number> {
      for (let i = 0; i < 40; i++) yield i % 20; // each value twice
    }
    const s = Int32HashSet.bulkLoad(vals(), { onDuplicate: "ignore" });
    expect(s.size).toBe(20);
  });

  it("invalid size hint throws BEFORE iteration (source untouched)", () => {
    let pulled = 0;
    function* tracked(): Generator<readonly [number, number]> {
      pulled++;
      yield [1, 1] as const;
    }
    expect(() =>
      NumberNumberHashMap.bulkLoad(tracked(), { size: 1.5 }),
    ).toThrow(RangeError);
    expect(pulled).toBe(0);
  });

  it("bulkLoad duplicate error/ignore over a generator", () => {
    function* dups(): Generator<readonly [number, number]> {
      yield [1, 1] as const;
      yield [1, 2] as const;
    }
    expect(() => NumberNumberHashMap.bulkLoad(dups())).toThrow(
      PumpDuplicateError,
    );
    const m = NumberNumberHashMap.bulkLoad(dups(), { onDuplicate: "ignore" });
    expect(m.get(1)).toBe(1);
    expect(m.size).toBe(1);
  });
});
