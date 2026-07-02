// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Count-Min Sketch — a `d×w` integer counter matrix giving a one-sided
 * **over**-estimate of an element's frequency, riding the deterministic hash
 * pipeline (see `spec/features/count-min.md`).
 *
 * The counter matrix after a given add-sequence is the cross-language oracle:
 * because the `d` column indices are exactly {@link positions}`(encodeI32(item),
 * w, d)` — bit-identical across all five ports — the entire matrix, every
 * `estimate`, and `total` are bit-identical too. **No floating point** appears
 * in the deterministic surface (the only float, {@link CountMin.optimal}, is
 * native-test-only and never used by the shared scenarios).
 *
 * Pinned rulings:
 * - **Row-hash derivation:** the column touched in row `r` is the `r`-th of
 *   `positions(encodeI32(item), m = w, k = d)` in derivation order
 *   (`c_r = (h1 + r*h2) mod w`). Repeated column numbers across rows touch
 *   **distinct** counters (one counter array per row) — NOT de-duplicated.
 * - **`estimate` = MIN over the `d` rows** (never average/sum/median/row-0).
 *   The empty MIN (`d = 0`) is `u64::MAX = 2^64 - 1`.
 * - **Overflow SATURATES at `u64::MAX`** (does NOT wrap) — a deliberate
 *   departure from the collections' wrapping contract, required by the
 *   no-under-estimate guarantee.
 * - **`add(item, count)` increments by `count`** (plain CMS, no conservative
 *   update); `addOne` ≡ `add(item, 1)`.
 * - **Element encoding:** `i32` → reinterpret `u32` → 4 LE bytes → the byte
 *   `positions` path (length fold applied), identical to Bloom.
 *
 * **u64 counters are carried as `bigint`** (a plain `number` loses precision
 * above `2^53` and is non-conforming).
 */

import { positions } from "../hash/hash.js";

/** `u64::MAX = 2^64 - 1`, the saturating ceiling for counters and `total`. */
const U64_MAX = 0xffffffffffffffffn;

/** Saturating `u64` add: `min(a + b, u64::MAX)`, never wrapping. */
function saturatingAddU64(a: bigint, b: bigint): bigint {
  const c = a + b;
  return c > U64_MAX ? U64_MAX : c;
}

/**
 * Reject an element that is not a signed 32-bit integer. The element surface is
 * `i32` (spec §"Element encoding"); a non-integer or out-of-`[-2^31, 2^31-1]`
 * value has no `i32` counterpart and would be silently remapped by the
 * `value >>> 0` reinterpret (e.g. `2147483648`, `1.5`, `NaN`, `Infinity`).
 * Mirrors the Bloom / Range i32 guard.
 */
function checkI32Item(value: number): void {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new RangeError(
      `CountMin: item must be a signed 32-bit integer, got ${String(value)}`,
    );
  }
}

/**
 * Encode an `i32` element to its little-endian 4-byte form (two's-complement
 * bit reinterpret, NOT sign-extend), the input the byte `positions` path
 * consumes. `1 → [01,00,00,00]`, `-1 → [ff,ff,ff,ff]`,
 * `INT_MIN → [00,00,00,80]`.
 */
function encodeI32(value: number): Uint8Array {
  const u = value >>> 0;
  return new Uint8Array([
    u & 0xff,
    (u >>> 8) & 0xff,
    (u >>> 16) & 0xff,
    (u >>> 24) & 0xff,
  ]);
}

/**
 * A Count-Min Sketch over a flat row-major `bigint[]` matrix of `d*w` counters.
 *
 * Construct with {@link CountMin.withParams} (the only constructor the
 * cross-language scenarios use) or the native-only {@link CountMin.optimal}.
 */
export class CountMin {
  /** The depth `d` (rows / hash functions = the `k` argument to `positions`). */
  private readonly d: number;
  /** The width `w` (columns per row = the `m` argument to `positions`). */
  private readonly w: number;
  /**
   * Flat row-major matrix: counter `matrix[r*w + col]` is row `r`, column
   * `col`. Length is exactly `d*w`.
   */
  private readonly matrix: bigint[];
  /** Running sum of every `count` argument (the stream length `N`), saturating. */
  private totalCount: bigint;

  private constructor(d: number, w: number) {
    this.d = d;
    this.w = w;
    this.matrix = new Array<bigint>(d * w).fill(0n);
    this.totalCount = 0n;
  }

  /**
   * Construct a `d×w` sketch with all counters zero. `d` is the depth (rows /
   * hash functions = the `k` argument to `positions`); `w` is the width
   * (columns per row = the `m` argument to `positions`).
   *
   * @throws if `w === 0` (a zero-column row holds nothing and every modulo
   * would divide by zero) — identical to Bloom's `m = 0` ruling. `d === 0` is
   * legal and degenerate (an empty matrix; `estimate` returns `u64::MAX`).
   */
  static withParams(d: number, w: number): CountMin {
    if (!Number.isInteger(d) || !Number.isInteger(w) || d < 0 || w < 0) {
      throw new Error("CountMin.withParams requires non-negative integer d, w");
    }
    if (w === 0) {
      throw new Error("CountMin width w must be non-zero");
    }
    return new CountMin(d, w);
  }

  /**
   * Native-only convenience constructor sizing the sketch from a target
   * additive error `epsilon` (relative to the total) and failure probability
   * `delta` using the standard Count-Min formulas
   * `w = ceil(e/epsilon)`, `d = ceil(ln(1/delta))`, then delegating to
   * {@link CountMin.withParams}.
   *
   * **Float-quarantined: never used by the cross-language scenarios** (the
   * `ln`/`e`/`ceil` derivation can drift across libm implementations). It is
   * native-tested against the pinned integer table.
   *
   * @throws unless `0 < epsilon < 1` and `0 < delta < 1`; values `<= 0`, `>= 1`,
   * `NaN`, or `±Infinity` are invalid and trap (they would divide by zero, take
   * `ln` of a non-positive value, or yield a non-finite `(d, w)`).
   */
  static optimal(epsilon: number, delta: number): CountMin {
    if (!(epsilon > 0 && epsilon < 1)) {
      throw new Error(
        `CountMin.optimal requires 0 < epsilon < 1, got ${epsilon}`,
      );
    }
    if (!(delta > 0 && delta < 1)) {
      throw new Error(`CountMin.optimal requires 0 < delta < 1, got ${delta}`);
    }
    const w = Math.ceil(Math.E / epsilon);
    const d = Math.ceil(Math.log(1 / delta));
    if (!Number.isFinite(w) || !Number.isFinite(d) || w < 1 || d < 1) {
      throw new Error("CountMin.optimal produced a non-finite (d, w)");
    }
    return CountMin.withParams(d, w);
  }

  /**
   * The `d` column indices for `item`, one per row, in derivation order:
   * `positions(encodeI32(item), m = w, k = d)`. `c_r` (the `r`-th element) is
   * the column touched in row `r`.
   */
  private columns(item: number): number[] {
    // Element encoding: i32 -> reinterpret u32 -> 4 LE bytes -> byte positions
    // path (length fold applied), identical to Bloom. The item MUST be a valid
    // i32 (a non-integer / out-of-range value would be silently remapped by the
    // `value >>> 0` reinterpret).
    checkI32Item(item);
    return positions(encodeI32(item), this.w, this.d);
  }

  /**
   * Increment the `d` selected counters (one per row) by `count`, saturating at
   * `u64::MAX`. `add(item, count)` is **not** observably five `addOne` calls
   * but yields the identical counters (increments are commutative).
   * `count === 0n` is legal: a no-op on the counters that still updates `total`
   * (by 0). Plain CMS — increments **all** `d` counters (no conservative
   * update).
   *
   * @throws if `count` is negative (frequencies are non-negative; v1 has no
   * decrement) or exceeds `u64::MAX`.
   */
  add(item: number, count: bigint): void {
    if (count < 0n || count > U64_MAX) {
      throw new Error(`CountMin.add count out of u64 range: ${count}`);
    }
    const cols = this.columns(item);
    for (let r = 0; r < cols.length; r++) {
      const idx = r * this.w + cols[r];
      this.matrix[idx] = saturatingAddU64(this.matrix[idx], count);
    }
    this.totalCount = saturatingAddU64(this.totalCount, count);
  }

  /** Convenience for `add(item, 1n)`; identical bits. */
  addOne(item: number): void {
    this.add(item, 1n);
  }

  /**
   * The frequency estimate for `item`: the **MIN** over the `d` rows of the
   * selected counter. Never under-estimates (within the `u64` domain). For
   * `d === 0` the MIN over zero rows is the empty-min identity `u64::MAX`.
   */
  estimate(item: number): bigint {
    const cols = this.columns(item);
    let min = U64_MAX;
    for (let r = 0; r < cols.length; r++) {
      const idx = r * this.w + cols[r];
      const v = this.matrix[idx];
      if (v < min) min = v;
    }
    return min;
  }

  /**
   * The running sum of every `count` argument ever added (the stream length
   * `N`), saturating at `u64::MAX`.
   */
  total(): bigint {
    return this.totalCount;
  }

  /** The depth `d` (number of rows / hash functions). */
  depth(): number {
    return this.d;
  }

  /** The width `w` (number of columns per row). */
  width(): number {
    return this.w;
  }

  /**
   * The full counter matrix as `d*w` values, **row-major** (row 0 first,
   * column 0 first within a row). Dense (all cells, including zeros).
   */
  toCounters(): bigint[] {
    return this.matrix.slice();
  }
}
