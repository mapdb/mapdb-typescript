// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Bloom filter — approximate set membership on the deterministic hash pipeline
 * (see `spec/features/bloom.md`).
 *
 * This is the TypeScript port of the first end-user collection of the
 * probabilistic wave. It rides directly on the deterministic hash pipeline
 * ({@link module:../hash/hash}): it uses {@link positions}
 * (Kirsch–Mitzenmacher double-hashing) to pick `k` bit indices in an `m`-bit
 * array. Because `positions()` is **bit-identical across all five ports**, the
 * bit array after a given add-sequence is bit-identical too — that bit array is
 * the cross-language oracle.
 *
 * ## Element encoding (the #1 trap)
 *
 * An `i32` element `v` is reinterpreted to `u32`, encoded to **4 little-endian
 * bytes**, and fed to the hash pipeline's **byte-input** `positions(bytes, m,
 * k)` path — the exact path the `12-hash-pipeline/positions_*` scenarios drive,
 * which **folds in the byte length**. This is NOT the scalar `hash32I32` path:
 * for `v = 7` the byte-path input word is `0x07 ^ 4 = 0x03`. Worked example:
 * `withParams(16, 4)` then `add(7)` lights bits `{0, 2, 7, 9}` →
 * `toBytes() = [0x85, 0x02]` → `"0x8502"`, `bitCount() === 4`.
 *
 * ## Guarantees
 *
 * - **No false negative.** `add(v)` then `mightContain(v)` is always `true`.
 * - **Idempotent / order-independent.** The bit array depends only on the *set*
 *   of added elements (bit-set is OR, never a toggle or a counter).
 * - **Deterministic.** Identical `(m, k)` + add-sequence ⇒ identical bits on all
 *   five ports.
 */

import { positions } from "../hash/hash.js";

/**
 * A Bloom filter over `i32` elements with `m` bits and `k` hash functions, both
 * fixed at construction. The bit array is stored as a `Uint8Array` byte array;
 * the internal word width is not observable — only {@link Bloom.toBytes} (the
 * LSB-first, ascending-byte serialization) is the cross-language form, and using
 * bytes makes that serialization host-endianness-independent by construction.
 */
export class Bloom {
  /** Number of bits in the array (`m`, `1 ..= 2^32-1`). */
  private readonly _mBits: number;
  /** Number of hash functions / positions set per element. */
  private readonly _k: number;
  /**
   * The bit array, exactly `ceil(m / 8)` bytes; bit `i` lives in byte `i >> 3`
   * at bit position `i & 7` (LSB-first within a byte). The unused high bits of
   * the final byte are always `0` — no `positions` index ever reaches them.
   */
  private readonly bytes: Uint8Array;

  private constructor(mBits: number, k: number, bytes: Uint8Array) {
    this._mBits = mBits;
    this._k = k;
    this.bytes = bytes;
  }

  /**
   * Canonical, fully-deterministic constructor: explicit bit count `mBits` and
   * hash count `k`. The filter starts empty (all bits `0`).
   *
   * `mBits === 0` is **invalid** and throws (a 0-bit array can hold nothing and
   * every `positions` modulo would be by zero). `k === 0` is degenerate but
   * **legal** (see {@link Bloom.mightContain}).
   *
   * @throws if `mBits` is not an integer in `1 ..= 2^32-1`, or `k` is not an
   *   integer in `0 ..= 2^32-1`.
   */
  static withParams(mBits: number, k: number): Bloom {
    if (!Number.isInteger(mBits) || mBits < 1 || mBits > 0xffffffff) {
      throw new RangeError(
        `Bloom.withParams: m_bits must be an integer in [1, 2^32-1], got ${mBits}`,
      );
    }
    if (!Number.isInteger(k) || k < 0 || k > 0xffffffff) {
      throw new RangeError(
        `Bloom.withParams: k must be an integer in [0, 2^32-1], got ${k}`,
      );
    }
    const nBytes = Math.ceil(mBits / 8);
    return new Bloom(mBits, k, new Uint8Array(nBytes));
  }

  /**
   * Convenience constructor sizing the filter from an expected element count `n`
   * and a target false-positive probability `p`, using the standard Bloom
   * formulas:
   *
   * ```text
   * m = ceil( -n * ln(p) / (ln 2)^2 )
   * k = max( 1, round( (m / n) * ln 2 ) )      # round-half-away-from-zero
   * ```
   *
   * then delegates to {@link Bloom.withParams}. This is **native-test-only**: it
   * never appears in the shared cross-language scenarios (the float derivation
   * could drift by a ULP across libms — quarantined to native tests against the
   * pinned integer table in `spec/features/bloom.md`).
   *
   * @throws if `n < 1`, `p <= 0`, `p >= 1`, `NaN`, or `±Infinity` (they would
   *   divide by zero, take `ln` of a non-positive value, or yield a non-finite
   *   `m`), or if the derived `m` is out of `u32` range.
   */
  static optimal(nExpected: number, p: number): Bloom {
    if (!Number.isInteger(nExpected) || nExpected < 1) {
      throw new RangeError(
        `Bloom.optimal: n_expected must be an integer >= 1, got ${nExpected}`,
      );
    }
    if (!Number.isFinite(p) || p <= 0 || p >= 1) {
      throw new RangeError(
        `Bloom.optimal: p must be finite and in (0, 1), got ${p}`,
      );
    }
    const n = nExpected;
    const ln2 = Math.LN2;
    const mF = Math.ceil((-n * Math.log(p)) / (ln2 * ln2));
    if (!Number.isFinite(mF) || mF < 1 || mF > 0xffffffff) {
      throw new RangeError(`Bloom.optimal: derived m out of range: ${mF}`);
    }
    const m = mF;
    // round-half-away-from-zero (JS Math.round rounds half UP, not away from
    // zero, but k_f here is always >= 0 so the two agree); clamp to >= 1.
    const kF = Math.round((m / n) * ln2);
    const k = Math.max(1, kF);
    return Bloom.withParams(m, k);
  }

  /** The bit count `m` (a construction parameter). */
  mBits(): number {
    return this._mBits;
  }

  /** The hash count `k` (a construction parameter). */
  k(): number {
    return this._k;
  }

  /**
   * Add an `i32` element: set the `k` bits for `v` (idempotent). With `k === 0`
   * this sets no bits.
   */
  add(v: number): void {
    const enc = encodeI32(v);
    for (const p of positions(enc, this._mBits, this._k)) {
      this.setBit(p);
    }
  }

  /**
   * `mightContain` — the canonical name. Returns `false` ⇒ definitely absent;
   * `true` ⇒ possibly present (may be a false positive). **Never** returns
   * `false` for an element that was added (no false negative).
   *
   * With `k === 0` the AND over zero positions is **vacuously true**, so this
   * returns `true` for every element (an all-false-positive filter).
   */
  mightContain(v: number): boolean {
    const enc = encodeI32(v);
    for (const p of positions(enc, this._mBits, this._k)) {
      if (!this.getBit(p)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Idiomatic alias for {@link Bloom.mightContain} (what the JSON suite's
   * `contains_<v>` keys probe). The result is **approximate** membership.
   */
  contains(v: number): boolean {
    return this.mightContain(v);
  }

  /**
   * `true` iff no bit is set (equivalently: nothing has been added, or only
   * `k === 0` adds). Equal to `bitCount() === 0`.
   */
  isEmpty(): boolean {
    for (let i = 0; i < this.bytes.length; i++) {
      if (this.bytes[i] !== 0) return false;
    }
    return true;
  }

  /**
   * The number of set bits (popcount of the whole bit array). The zeroed tail
   * bits never contribute (no `positions` index reaches them).
   */
  bitCount(): number {
    let count = 0;
    for (let i = 0; i < this.bytes.length; i++) {
      count += popcount8(this.bytes[i]);
    }
    return count;
  }

  /**
   * The sorted-ascending indices of the set bits — a human-legible alternate
   * oracle to {@link Bloom.toBytes} (drives the `set_bits` scenario assertion).
   */
  setBits(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.bytes.length; i++) {
      let b = this.bytes[i];
      while (b !== 0) {
        const j = 31 - Math.clz32(b & -b); // index of lowest set bit
        out.push(i * 8 + j);
        b &= b - 1; // clear lowest set bit
      }
    }
    return out;
  }

  /**
   * Bitwise OR of two filters with **identical `(m, k)`**, returning a new
   * filter. The result's membership is the union of the two filters' membership
   * (no false negatives lost).
   *
   * @throws if the two filters have mismatched `(m, k)` (a filter built with
   *   different parameters has an incompatible bit array; ORing them is
   *   meaningless).
   */
  union(other: Bloom): Bloom {
    if (this._mBits !== other._mBits || this._k !== other._k) {
      throw new Error(
        `Bloom.union: parameter mismatch (${this._mBits}, ${this._k}) vs (${other._mBits}, ${other._k})`,
      );
    }
    const out = new Uint8Array(this.bytes.length);
    for (let i = 0; i < out.length; i++) {
      out[i] = this.bytes[i] | other.bytes[i];
    }
    return new Bloom(this._mBits, this._k, out);
  }

  /**
   * The serialized bit array (`spec/features/bloom.md` §"Serialized bit-array
   * form"): length exactly `ceil(m / 8)` bytes; **LSB-first** bit order within
   * each byte (bit `i` ⇒ `byte[i >> 3] |= 1 << (i & 7)`); ascending byte order;
   * **little-endian on every host** (the byte array IS the canonical form);
   * unused tail bits `0`.
   *
   * Returns a fresh copy so callers cannot mutate the filter's internal state.
   */
  toBytes(): Uint8Array {
    return this.bytes.slice();
  }

  /**
   * The serialized bit array rendered as a single lower-case `0x`-prefixed hex
   * string, two hex digits per byte, byte 0 first (the JSON suite's `bytes`
   * convention). An empty 16-bit filter is `"0x0000"`.
   */
  toHex(): string {
    let s = "0x";
    for (let i = 0; i < this.bytes.length; i++) {
      s += this.bytes[i].toString(16).padStart(2, "0");
    }
    return s;
  }

  // ---- internal bit ops --------------------------------------------------

  private setBit(i: number): void {
    this.bytes[i >> 3] |= 1 << (i & 7);
  }

  private getBit(i: number): boolean {
    return (this.bytes[i >> 3] & (1 << (i & 7))) !== 0;
  }
}

/**
 * Encode an `i32` element to the **4 little-endian bytes** the hash pipeline's
 * byte-input `positions` path consumes: a two's-complement bit reinterpret to
 * `u32` (NOT a sign-extend), least-significant byte first. `v = 1` →
 * `[0x01,0x00,0x00,0x00]`, `v = -1` → `[0xff,0xff,0xff,0xff]`,
 * `INT_MIN` → `[0x00,0x00,0x00,0x80]`.
 */
function encodeI32(v: number): Uint8Array {
  // The element surface is `i32`; an out-of-range or non-integer JS `number`
  // is rejected rather than silently coerced by `>>> 0` (which would map 1.5 ->
  // 1, 2^31 -> INT_MIN's bytes, 2^32-1 -> -1's bytes, NaN/Inf -> 0). The Rust
  // reference `i32` is type-enforced; this is the dynamic-typing equivalent.
  if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) {
    throw new RangeError(`Bloom: element must be an i32, got ${v}`);
  }
  const u = v >>> 0; // reinterpret i32 bits as u32 (NOT sign-extend)
  return new Uint8Array([
    u & 0xff,
    (u >>> 8) & 0xff,
    (u >>> 16) & 0xff,
    u >>> 24,
  ]);
}

/** Population count of an 8-bit value (0..255). */
function popcount8(b: number): number {
  let x = b & 0xff;
  x = x - ((x >> 1) & 0x55);
  x = (x & 0x33) + ((x >> 2) & 0x33);
  return (x + (x >> 4)) & 0x0f;
}
