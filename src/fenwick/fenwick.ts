// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Fenwick tree / Binary Indexed Tree (prefix & range sums).
 *
 * A fixed-size index structure with O(log n) point-update and O(log n)
 * prefix/range sum over signed `i32` element values accumulated in a wrapping
 * `i64` accumulator. See `spec/features/fenwick.md` for the pinned design.
 *
 * Pinned invariants realized here:
 * - **Indexing**: the public API is 0-based (`0 .. n-1`); the BIT is classically
 *   1-based internally (`internal = public + 1`). The 1-based index is never
 *   observable. The backing array is length `n + 1` with slot 0 unused.
 * - **Ranges**: `prefixSum(i)` is the INCLUSIVE prefix `[0..=i]`;
 *   `rangeSum(lo, hi)` is the INCLUSIVE closed range `[lo..=hi]`;
 *   `total() === prefixSum(n-1)` (and `0n` for the empty tree).
 * - **Accumulator**: each slot and every sum is a wrapping two's-complement
 *   `i64`. Because the `i64` range exceeds JS `number`'s `2^53` safe-integer
 *   limit, the accumulator is carried as a `BigInt` masked to a signed 64-bit
 *   range with `BigInt.asIntN(64, …)` after every add/subtract; the per-element
 *   `i32` operand widens to `bigint` and does NOT re-wrap at `i32`, so `get`
 *   returns a `bigint`.
 * - **Out-of-range**: mutators (`update`/`set`), `get`, and `prefixSum` throw a
 *   `RangeError` on an out-of-domain index (both `i < 0` and `i >= n`).
 *   `rangeSum` validates BOTH endpoints first (out-of-domain endpoint throws),
 *   THEN returns `0n` for an empty `lo > hi` range. `withSize(-1)` throws.
 */

/** Signed 64-bit minimum (`-2^63`). */
const I64_MIN = -9223372036854775808n;
/** Signed 64-bit maximum (`2^63 - 1`). */
const I64_MAX = 9223372036854775807n;
/** Signed 32-bit minimum (`-2^31`). */
const I32_MIN = -2147483648;
/** Signed 32-bit maximum (`2^31 - 1`). */
const I32_MAX = 2147483647;

/** Wrap a `bigint` into the signed 64-bit two's-complement range. */
function wrap64(x: bigint): bigint {
  return BigInt.asIntN(64, x);
}

/**
 * Low bit `j & -j` over a 1-based index (`j >= 1`). On a non-negative `number`
 * this is exact for the BIT navigation range (`j <= n`, `n` a JS array length).
 */
function lowbit(j: number): number {
  return j & -j;
}

/** Validate that `i` is a usable public 0-based index (`0 <= i < n`). */
function checkIndex(i: number, n: number, who: string): void {
  if (!Number.isInteger(i)) {
    throw new RangeError(`FenwickTree.${who} index ${i} is not an integer`);
  }
  if (i < 0 || i >= n) {
    throw new RangeError(`FenwickTree.${who} index ${i} out of range 0..${n}`);
  }
}

/** Validate and narrow an `i32` element operand (`delta`/`value`). */
function checkI32(v: number, who: string): void {
  if (!Number.isInteger(v)) {
    throw new RangeError(`FenwickTree.${who} value ${v} is not an integer`);
  }
  if (v < I32_MIN || v > I32_MAX) {
    throw new RangeError(
      `FenwickTree.${who} value ${v} out of i32 range [-2147483648, 2147483647]`,
    );
  }
}

/**
 * A Fenwick tree (Binary Indexed Tree) over `i32` element values with a
 * wrapping `i64` accumulator carried as `BigInt`. Fixed size; no resize.
 *
 * The backing array `tree` has length `n + 1`: slot `0` is the unused BIT
 * terminator and `tree[1 .. n]` are the 1-based partial sums.
 */
export class FenwickTree {
  /** 1-based partial sums; `tree[0]` unused. Length is `n + 1`. */
  private readonly tree: bigint[];
  /** Public size `n` (number of valid 0-based indices). */
  private readonly n: number;

  private constructor(tree: bigint[], n: number) {
    this.tree = tree;
    this.n = n;
  }

  /**
   * Construct an all-zero tree of size `n`. `withSize(0)` is a valid empty tree
   * (`total() === 0n`, `isEmpty === true`).
   *
   * @throws RangeError if `n < 0` or `n` is not an integer.
   */
  static withSize(n: number): FenwickTree {
    if (!Number.isInteger(n)) {
      throw new RangeError(`FenwickTree.withSize size ${n} is not an integer`);
    }
    if (n < 0) {
      throw new RangeError(`FenwickTree.withSize negative size ${n}`);
    }
    return new FenwickTree(new Array<bigint>(n + 1).fill(0n), n);
  }

  /**
   * Build from an initial `i32` array; the tree has `size === values.length`
   * and `get(i) === values[i]`. Uses the O(n) in-place build (it produces the
   * identical tree as `withSize(len)` then `update(i, values[i])`).
   *
   * @throws RangeError if any element is outside the `i32` range.
   */
  static fromValues(values: Int32Array | number[]): FenwickTree {
    const n = values.length;
    const tree = new Array<bigint>(n + 1).fill(0n);
    // Seed each 1-based slot with the (widened) element value.
    for (let i = 0; i < n; i++) {
      const v = values[i];
      checkI32(v, "fromValues");
      tree[i + 1] = BigInt(v);
    }
    // O(n) in-place build: push each slot's running sum to its parent.
    // Over the 1-based array: parent = i + (i & -i).
    for (let i = 1; i <= n; i++) {
      const parent = i + lowbit(i);
      if (parent <= n) {
        tree[parent] = wrap64(tree[parent] + tree[i]);
      }
    }
    return new FenwickTree(tree, n);
  }

  /** Number of valid 0-based indices. */
  size(): number {
    return this.n;
  }

  /** Alias for {@link size} (the family's list-style length accessor). */
  length(): number {
    return this.n;
  }

  /** True iff the tree is empty (`n === 0`). */
  isEmpty(): boolean {
    return this.n === 0;
  }

  /**
   * Add `delta` (`i32`, widened to `i64`) to the value at 0-based index `i`.
   *
   * @throws RangeError if `i` is out of `0 .. n-1`, or `delta` is not an i32.
   */
  update(i: number, delta: number): void {
    checkIndex(i, this.n, "update");
    checkI32(delta, "update");
    this.addInternal(i, BigInt(delta));
  }

  /**
   * Point-assign: make the value at `i` equal `value` (`i32`).
   *
   * Implemented as a Fenwick difference-add computed in wrapping `i64`
   * (`delta = BigInt(value) - get(i)`), NOT routed through the `i32` `update`
   * signature — so the internal delta stays exact even when the current slot
   * value already exceeds `i32`.
   *
   * @throws RangeError if `i` is out of `0 .. n-1`, or `value` is not an i32.
   */
  set(i: number, value: number): void {
    checkIndex(i, this.n, "set");
    checkI32(value, "set");
    const delta = wrap64(BigInt(value) - this.get(i));
    this.addInternal(i, delta);
  }

  /**
   * The single logical value currently at 0-based index `i`, as `bigint`.
   * Equivalent to `rangeSum(i, i)`.
   *
   * @throws RangeError if `i` is out of `0 .. n-1`.
   */
  get(i: number): bigint {
    checkIndex(i, this.n, "get");
    // get(i) === prefixSum(i) - prefixSum(i-1); prefixSum(-1) := 0.
    if (i === 0) {
      return this.prefixSumInternal(0);
    }
    return wrap64(this.prefixSumInternal(i) - this.prefixSumInternal(i - 1));
  }

  /**
   * Inclusive prefix sum `Σ values[0..=i]`, as wrapping `i64` `bigint`.
   *
   * @throws RangeError if `i` is out of `0 .. n-1`.
   */
  prefixSum(i: number): bigint {
    checkIndex(i, this.n, "prefixSum");
    return this.prefixSumInternal(i);
  }

  /**
   * Inclusive range sum `Σ values[lo..=hi]`, as wrapping `i64` `bigint`.
   *
   * Validates BOTH endpoints first: `lo` and `hi` must be valid public indices
   * (`0 <= . < n`). Only after both are valid, if `lo > hi` the range is empty
   * and returns `0n`.
   *
   * @throws RangeError if `lo` or `hi` is out of `0 .. n-1` (out-of-domain
   *   endpoint). On the empty tree every call throws (no valid endpoint exists).
   */
  rangeSum(lo: number, hi: number): bigint {
    checkIndex(lo, this.n, "rangeSum");
    checkIndex(hi, this.n, "rangeSum");
    // Both endpoints valid; an empty closed range (lo > hi) is a defined 0.
    if (lo > hi) {
      return 0n;
    }
    // rangeSum = prefixSum(hi) - prefixSum(lo-1); prefixSum(-1) := 0.
    const upper = this.prefixSumInternal(hi);
    const lower = lo === 0 ? 0n : this.prefixSumInternal(lo - 1);
    return wrap64(upper - lower);
  }

  /**
   * Grand total `Σ` of all values, `=== prefixSum(n-1)` for `n >= 1`, and `0n`
   * for the empty tree.
   */
  total(): bigint {
    if (this.n === 0) {
      return 0n;
    }
    return this.prefixSumInternal(this.n - 1);
  }

  /**
   * The canonical 1-based BIT projection: a length-`n` `bigint` array where
   * element `j-1` (0-based in the returned array) is the partial sum the tree
   * stores for the 1-based index `j` — i.e. `tree[1 .. n]`. This is the
   * layout-independent secondary determinism oracle.
   */
  canonicalTree(): bigint[] {
    return this.tree.slice(1, this.n + 1);
  }

  // ---- internals (1-based BIT navigation) ---------------------------------

  /** Add a wrapping-`i64` `delta` at 0-based index `i` (caller validated). */
  private addInternal(i: number, delta: bigint): void {
    let j = i + 1; // public -> 1-based BIT
    while (j <= this.n) {
      this.tree[j] = wrap64(this.tree[j] + delta);
      j += lowbit(j);
    }
  }

  /** Inclusive prefix sum for 0-based index `i` (caller guarantees `i < n`). */
  private prefixSumInternal(i: number): bigint {
    let acc = 0n;
    let j = i + 1; // public -> 1-based BIT
    while (j > 0) {
      acc = wrap64(acc + this.tree[j]);
      j -= lowbit(j);
    }
    return acc;
  }
}

export { I64_MIN, I64_MAX };
