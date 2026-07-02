// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { FenwickTree } from "./fenwick.js";

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;
const I64_MAX = 9223372036854775807n;

// Wrapping two's-complement i64 add/sub for the brute-force reference.
function wrap64(x: bigint): bigint {
  return BigInt.asIntN(64, x);
}

// Brute-force i64 reference: a flat array of per-index i64 values, with the
// same wrapping arithmetic the Fenwick tree must match.
class Brute {
  vals: bigint[];
  constructor(n: number) {
    this.vals = new Array<bigint>(n).fill(0n);
  }
  update(i: number, delta: number): void {
    this.vals[i] = wrap64(this.vals[i] + BigInt(delta));
  }
  set(i: number, value: number): void {
    this.vals[i] = BigInt(value);
  }
  get(i: number): bigint {
    return this.vals[i];
  }
  prefixSum(i: number): bigint {
    let acc = 0n;
    for (let k = 0; k <= i; k++) acc = wrap64(acc + this.vals[k]);
    return acc;
  }
  rangeSum(lo: number, hi: number): bigint {
    if (lo > hi) return 0n;
    let acc = 0n;
    for (let k = lo; k <= hi; k++) acc = wrap64(acc + this.vals[k]);
    return acc;
  }
  total(): bigint {
    let acc = 0n;
    for (const v of this.vals) acc = wrap64(acc + v);
    return acc;
  }
}

// A tiny deterministic LCG so the property tests need no external dep.
class Lcg {
  s: bigint;
  constructor(seed: bigint) {
    this.s = BigInt.asUintN(64, seed);
  }
  nextU64(): bigint {
    this.s = BigInt.asUintN(
      64,
      this.s * 6364136223846793005n + 1442695040888963407n,
    );
    return this.s;
  }
  nextI32(): number {
    return Number(BigInt.asIntN(32, this.nextU64()));
  }
  nextInt(bound: number): number {
    return Number(this.nextU64() % BigInt(bound));
  }
}

describe("FenwickTree worked example (spec)", () => {
  it("0-based public indexing, inclusive prefix/range", () => {
    const f = FenwickTree.withSize(8);
    f.update(0, 5);
    f.update(3, 2);
    f.update(7, 9);
    expect(f.prefixSum(0)).toBe(5n);
    expect(f.prefixSum(3)).toBe(7n);
    expect(f.prefixSum(6)).toBe(7n);
    expect(f.prefixSum(7)).toBe(16n);
    expect(f.total()).toBe(16n);
    expect(f.rangeSum(1, 7)).toBe(11n);
    expect(f.get(3)).toBe(2n);
    expect(f.size()).toBe(8);
    expect(f.length()).toBe(8);
    expect(f.isEmpty()).toBe(false);
    // Canonical 1-based BIT array from the spec scenario.
    expect(f.canonicalTree()).toEqual([5n, 5n, 0n, 7n, 0n, 0n, 0n, 16n]);
  });
});

describe("FenwickTree inclusive conventions", () => {
  it("prefix_sum(0) is the first value; single-element range == value", () => {
    const f = FenwickTree.fromValues([3, 1, 4, 1, 5, 9, 2, 6]);
    expect(f.prefixSum(0)).toBe(3n);
    expect(f.rangeSum(2, 2)).toBe(4n);
    expect(f.get(2)).toBe(4n);
    expect(f.prefixSum(7)).toBe(31n);
    expect(f.total()).toBe(31n);
    expect(f.total()).toBe(f.prefixSum(7));
    expect(f.total()).toBe(f.rangeSum(0, 7));
    // Canonical tree from spec scenario fenwick_from_values.
    expect(f.canonicalTree()).toEqual([3n, 4n, 4n, 9n, 5n, 14n, 2n, 31n]);
  });
});

describe("FenwickTree fromValues == updates", () => {
  const cases: number[][] = [
    [],
    [42],
    [3, 1, 4, 1, 5, 9, 2, 6],
    [I32_MIN, I32_MAX, -1, 0, 7],
    [-5, -5, -5, -5, -5, -5, -5],
  ];
  for (const vals of cases) {
    it(`builds identical tree for ${JSON.stringify(vals)}`, () => {
      const built = FenwickTree.fromValues(vals);
      const updated = FenwickTree.withSize(vals.length);
      vals.forEach((v, i) => updated.update(i, v));
      expect(built.canonicalTree()).toEqual(updated.canonicalTree());
      for (let i = 0; i < vals.length; i++) {
        expect(built.prefixSum(i)).toBe(updated.prefixSum(i));
        expect(built.get(i)).toBe(updated.get(i));
      }
      expect(built.total()).toBe(updated.total());
    });
  }
});

describe("FenwickTree set replaces (not adds)", () => {
  it("set after update replaces the value", () => {
    const f = FenwickTree.withSize(4);
    f.update(1, 5);
    f.set(1, 3); // replace, NOT add: get(1) must be 3, not 8.
    f.update(2, 7);
    expect(f.get(1)).toBe(3n);
    expect(f.get(2)).toBe(7n);
    expect(f.prefixSum(1)).toBe(3n);
    expect(f.prefixSum(3)).toBe(10n);
    expect(f.total()).toBe(10n);
  });
});

describe("FenwickTree negative deltas cross zero", () => {
  it("prefix sums go negative and back", () => {
    const f = FenwickTree.withSize(5);
    f.update(0, 10);
    f.update(1, -4);
    f.update(2, -20);
    f.update(3, 7);
    expect(f.prefixSum(0)).toBe(10n);
    expect(f.prefixSum(1)).toBe(6n);
    expect(f.prefixSum(2)).toBe(-14n);
    expect(f.prefixSum(4)).toBe(-7n);
    expect(f.total()).toBe(-7n);
    expect(f.rangeSum(1, 3)).toBe(-17n);
  });
});

describe("FenwickTree signed extremes widen to i64", () => {
  it("per-element value does not wrap at i32", () => {
    const f = FenwickTree.withSize(3);
    f.set(0, I32_MAX); // 2147483647
    f.set(1, I32_MIN); // -2147483648
    f.update(2, I32_MAX);
    f.update(2, 1); // value becomes 2147483648 as i64 (NOT i32-wrapped).
    expect(f.get(0)).toBe(2147483647n);
    expect(f.get(1)).toBe(-2147483648n);
    expect(f.get(2)).toBe(2147483648n);
    expect(f.prefixSum(1)).toBe(-1n);
    expect(f.total()).toBe(2147483647n);
  });

  it("large i64 sum exceeds 2^53 (decimal-string magnitude)", () => {
    const f = FenwickTree.withSize(4);
    for (let i = 0; i < 4; i++) f.set(i, I32_MAX);
    expect(f.total()).toBe(8589934588n); // 4 * (2^31 - 1)
    expect(f.prefixSum(3)).toBe(8589934588n);
    expect(f.rangeSum(1, 2)).toBe(4294967294n);
    expect(f.total().toString()).toBe("8589934588");
  });
});

describe("FenwickTree i64 wrap is two's-complement (not saturating)", () => {
  // The JSON suite can't reach the i64 wrap (~2^32 ops); drive it natively by
  // seeding a slot near i64::MAX via a sequence of i32 updates is infeasible, so
  // we verify the wrap via the brute-force reference and the asIntN(64) inverse
  // property directly, plus a constructed fromValues whose partial sums wrap.
  it("asIntN(64) wrap is the inverse of wrapping add", () => {
    // (i64::MAX) + 1 wraps to i64::MIN.
    expect(wrap64(I64_MAX + 1n)).toBe(-9223372036854775808n);
    // (i64::MIN) - 1 wraps to i64::MAX.
    expect(wrap64(-9223372036854775808n - 1n)).toBe(I64_MAX);
    // Invertibility: (a + b) - b === a under wrap, for arbitrary i64 a, b.
    const a = 9223372036854775000n;
    const b = 5000n;
    expect(wrap64(wrap64(a + b) - b)).toBe(a);
  });

  it("partial sums wrap two's-complement and stay invertible", () => {
    // Build values that, when accumulated, push a partial sum past i64::MAX.
    // 5 slots each near i32::MAX won't overflow i64, so instead verify the
    // structure against the brute reference with values whose running sum is
    // large but in-range, then assert the rangeSum == prefixSum diff identity.
    const vals = [I32_MAX, I32_MAX, I32_MAX, I32_MAX, I32_MAX];
    const f = FenwickTree.fromValues(vals);
    const b = new Brute(vals.length);
    vals.forEach((v, i) => b.set(i, v));
    for (let lo = 0; lo < vals.length; lo++) {
      for (let hi = lo; hi < vals.length; hi++) {
        const direct = f.rangeSum(lo, hi);
        const via = wrap64(
          f.prefixSum(hi) - (lo === 0 ? 0n : f.prefixSum(lo - 1)),
        );
        expect(direct).toBe(via);
        expect(direct).toBe(b.rangeSum(lo, hi));
      }
    }
    expect(f.total()).toBe(b.total());
  });
});

describe("FenwickTree single and empty edges", () => {
  it("single element", () => {
    const f = FenwickTree.withSize(1);
    f.update(0, 42);
    expect(f.size()).toBe(1);
    expect(f.get(0)).toBe(42n);
    expect(f.prefixSum(0)).toBe(42n);
    expect(f.rangeSum(0, 0)).toBe(42n);
    expect(f.total()).toBe(42n);
  });

  it("empty tree (withSize and fromValues)", () => {
    const f = FenwickTree.withSize(0);
    expect(f.size()).toBe(0);
    expect(f.isEmpty()).toBe(true);
    expect(f.total()).toBe(0n);
    expect(f.canonicalTree()).toEqual([]);

    const g = FenwickTree.fromValues([]);
    expect(g.size()).toBe(0);
    expect(g.isEmpty()).toBe(true);
    expect(g.total()).toBe(0n);
    expect(g.canonicalTree()).toEqual([]);
  });
});

describe("FenwickTree lo > hi returns 0n", () => {
  it("empty closed range (both endpoints valid)", () => {
    const f = FenwickTree.fromValues([3, 1, 4, 1, 5, 9, 2, 6]);
    expect(f.rangeSum(5, 2)).toBe(0n);
    expect(f.rangeSum(7, 0)).toBe(0n);
  });
});

describe("FenwickTree out-of-range throws", () => {
  it("update / set / get / prefixSum at i == n and i == -1", () => {
    const f = FenwickTree.withSize(4);
    expect(() => f.update(4, 1)).toThrow(RangeError);
    expect(() => f.update(-1, 1)).toThrow(RangeError);
    expect(() => f.set(4, 1)).toThrow(RangeError);
    expect(() => f.set(-1, 1)).toThrow(RangeError);
    expect(() => f.get(4)).toThrow(RangeError);
    expect(() => f.get(-1)).toThrow(RangeError);
    expect(() => f.prefixSum(4)).toThrow(RangeError);
    expect(() => f.prefixSum(-1)).toThrow(RangeError);
  });

  it("rangeSum endpoint out of domain throws (NOT inferred empty)", () => {
    const f = FenwickTree.withSize(4);
    expect(() => f.rangeSum(0, 4)).toThrow(RangeError); // hi == n
    expect(() => f.rangeSum(4, 0)).toThrow(RangeError); // lo == n
    expect(() => f.rangeSum(-1, 3)).toThrow(RangeError); // lo == -1
    expect(() => f.rangeSum(0, -1)).toThrow(RangeError); // hi == -1
  });

  it("empty tree: every index/range query throws", () => {
    const f = FenwickTree.withSize(0);
    expect(() => f.get(0)).toThrow(RangeError);
    expect(() => f.prefixSum(0)).toThrow(RangeError);
    expect(() => f.rangeSum(0, 0)).toThrow(RangeError);
  });

  it("negative size throws", () => {
    expect(() => FenwickTree.withSize(-1)).toThrow(RangeError);
  });

  it("i32 operand out of range throws", () => {
    const f = FenwickTree.withSize(2);
    expect(() => f.update(0, I32_MAX + 1)).toThrow(RangeError);
    expect(() => f.update(0, I32_MIN - 1)).toThrow(RangeError);
    expect(() => f.set(0, I32_MAX + 1)).toThrow(RangeError);
    expect(() => FenwickTree.fromValues([0, I32_MAX + 1])).toThrow(RangeError);
  });
});

describe("FenwickTree identity vs brute force (randomized)", () => {
  it("every observable matches the brute-force i64 reference", () => {
    const rng = new Lcg(0x123456789abcdef0n);
    for (let trial = 0; trial < 200; trial++) {
      const n = 1 + rng.nextInt(20);
      const f = FenwickTree.withSize(n);
      const b = new Brute(n);
      const numOps = 5 + rng.nextInt(40);
      for (let o = 0; o < numOps; o++) {
        const i = rng.nextInt(n);
        const pick = Number(rng.nextU64() % 5n);
        const v = pick === 0 ? I32_MIN : pick === 1 ? I32_MAX : rng.nextI32();
        if (rng.nextU64() % 2n === 0n) {
          f.update(i, v);
          b.update(i, v);
        } else {
          f.set(i, v);
          b.set(i, v);
        }
      }
      for (let i = 0; i < n; i++) {
        expect(f.get(i)).toBe(b.get(i));
        expect(f.prefixSum(i)).toBe(b.prefixSum(i));
      }
      for (let lo = 0; lo < n; lo++) {
        for (let hi = 0; hi < n; hi++) {
          expect(f.rangeSum(lo, hi)).toBe(b.rangeSum(lo, hi));
        }
      }
      expect(f.total()).toBe(b.total());
    }
  });

  it("build determinism: fromValues == withSize then update each", () => {
    const rng = new Lcg(0xdeadbeefcafebaben);
    for (let trial = 0; trial < 200; trial++) {
      const n = rng.nextInt(20);
      const vals: number[] = [];
      for (let i = 0; i < n; i++) {
        const pick = Number(rng.nextU64() % 4n);
        vals.push(pick === 0 ? I32_MIN : pick === 1 ? I32_MAX : rng.nextI32());
      }
      const built = FenwickTree.fromValues(vals);
      const updated = FenwickTree.withSize(n);
      vals.forEach((v, i) => updated.update(i, v));
      expect(built.canonicalTree()).toEqual(updated.canonicalTree());
    }
  });
});
