// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * HyperLogLog distinct-count cardinality sketch (see
 * `spec/features/hyperloglog.md`).
 *
 * ## Float-quarantine ruling (the heart of this feature)
 *
 * HyperLogLog has two observable surfaces:
 *
 * 1. The **integer register array** (`m = 2^p` bytes, each the max `rho` seen).
 *    This is **exact integer state**, a pure-integer function of
 *    `(p, add-sequence)` through the hash pipeline, and is the **cross-language
 *    oracle** — all ports MUST produce the byte-identical array. The shared JSON
 *    scenarios assert ONLY this (via `register_hex`, `nonzero_registers`,
 *    `max_register`, `register_at_N`).
 *
 * 2. The **`number` (f64) estimate** ({@link HyperLogLog.estimate}). It is a
 *    function of `ln` / `2^x` / division / summation and **cannot** be required
 *    to agree bit-for-bit across language libm implementations. It is tested
 *    **natively** against a documented tolerance — never in the shared oracle.
 *    There is **no `estimate` assertion key**.
 *
 * `add`, `merge`, and the register array use **zero floating point** (only
 * `hash64`, lane shifts, `max`, byte packing); the float appears only inside
 * `estimate()`, a read-only projection that never writes a register.
 */

import { type U64, hash64, encodeI32Word64 } from "../hash/hash.js";

/** Minimum legal precision (`m = 16`). */
export const MIN_PRECISION = 4;
/** Maximum legal precision (`m = 262144`); the v1 ceiling matching `hll_split`. */
export const MAX_PRECISION = 18;

/** The 4-byte ASCII magic that version-tags the serialized form (`"HLL1"`). */
const MAGIC = Uint8Array.of(0x48, 0x4c, 0x4c, 0x31); // "HLL1"

// ---- Lane helpers (bit-exact, mirrored from the hash pipeline) -------------

/** Count leading zeros of an unsigned 32-bit value (`0 => 32`). */
function clz32(x: number): number {
  return Math.clz32(x >>> 0);
}

/** Count leading zeros of a {@link U64} (all-zero => 64). */
function clz64(x: U64): number {
  // The high lane decides: a nonzero hi means the leading 1 lives there, so the
  // run is `clz32(hi)`; an all-zero hi means the whole top 32 bits are zero and
  // the run is `32 + clz32(lo)`.
  return x.hi === 0 ? 32 + clz32(x.lo) : clz32(x.hi);
}

/** Logical left shift by `s` (`0 <= s < 64`). */
function shl64(h: U64, s: number): U64 {
  if (s === 0) return { hi: h.hi >>> 0, lo: h.lo >>> 0 };
  if (s < 32) {
    return {
      hi: ((h.hi << s) | (h.lo >>> (32 - s))) >>> 0,
      lo: (h.lo << s) >>> 0,
    };
  }
  return { hi: (h.lo << (s - 32)) >>> 0, lo: 0 };
}

// ---- The (index, rho) split ------------------------------------------------

/**
 * Split a 64-bit hash into `[register_index, rho]` per the hash pipeline's
 * pre-stated `hll_split` (top `p` bits → index; remaining bits + guard bit →
 * `clz64 + 1`). Pure integer; the guard bit guarantees `w != 0` so `clz64` is
 * never invoked on `0`.
 */
function split(x: U64, p: number): [number, number] {
  // idx = (x >> (64 - p)) as u32. Since 4 <= p <= 18 < 32, the top p bits live
  // entirely in the hi lane: x >> (64 - p) == x.hi >>> (32 - p). A LOGICAL
  // (unsigned) shift — `>>> 0` keeps the result unsigned.
  const idx = (x.hi >>> (32 - p)) >>> 0;
  // GUARD BIT: w = (x << p) | (1 << (p - 1)). If the remaining (64 - p) bits are
  // all zero, w = 1 << (p - 1), clz64(w) = 64 - p, so rho = 64 - p + 1 (its max)
  // and clz64 never sees 0. p - 1 <= 17 < 32, so the guard bit lives in the LOW
  // lane.
  const w = shl64(x, p);
  const guardLo = (1 << (p - 1)) >>> 0;
  const wGuarded: U64 = { hi: w.hi, lo: (w.lo | guardLo) >>> 0 };
  const rho = clz64(wGuarded) + 1;
  return [idx, rho];
}

/** Errors thrown by the HyperLogLog surface (construction / merge / decode). */
export class HllError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HllError";
  }
}

/**
 * A HyperLogLog distinct-count sketch.
 *
 * Built by {@link HyperLogLog.withPrecision}; updated by {@link add} /
 * {@link merge}; the register array (the oracle) is read via {@link registers} /
 * {@link nonzeroRegisters}; the quarantined float answer is {@link estimate};
 * serialized via {@link toBytes} / {@link fromBytes}.
 */
export class HyperLogLog {
  private readonly p: number;
  /** `m = 2^p` registers, each the max `rho` seen for that index (0 = empty). */
  private readonly reg: Uint8Array;

  private constructor(p: number, reg: Uint8Array) {
    this.p = p;
    this.reg = reg;
  }

  /**
   * Construct an empty sketch with `m = 2^p` zeroed registers. `p` must be in
   * `4 ..= 18`; otherwise {@link HllError} (never a silent clamp — a clamp
   * would let two ports build differently-sized arrays from the same nominal
   * `p`).
   */
  static withPrecision(p: number): HyperLogLog {
    if (!Number.isInteger(p) || p < MIN_PRECISION || p > MAX_PRECISION) {
      throw new HllError(
        `precision ${p} out of range ${MIN_PRECISION}..=${MAX_PRECISION}`,
      );
    }
    const m = 1 << p;
    return new HyperLogLog(p, new Uint8Array(m));
  }

  /** The precision `p` (`log2(m)`). */
  precision(): number {
    return this.p;
  }

  /** The register count `m = 2^p`. */
  registerCount(): number {
    return this.reg.length;
  }

  /** The per-`p` maximum possible `rho` (and the `fromBytes` byte ceiling). */
  private static rhoCeiling(p: number): number {
    return 64 - p + 1;
  }

  /**
   * Add an `i32` element. The item is encoded with the hash pipeline's `i32`
   * rule — reinterpret to `u32`, **zero-extend** to `u64` (NOT sign-extend) —
   * then `hash64(word, seed = 0)`, then the split, then
   * `register[idx] = max(register[idx], rho)`. **Pure integer.**
   */
  add(item: number): void {
    // i32 -> u32 reinterpret -> zero-extend to u64 (high 32 bits always 0).
    const word = encodeI32Word64(item | 0);
    const x = hash64(word, { hi: 0, lo: 0 });
    const [idx, rho] = split(x, this.p);
    if (rho > this.reg[idx]) {
      this.reg[idx] = rho;
    }
  }

  /** The raw register array (the cross-language oracle bytes), as a copy. */
  registers(): Uint8Array {
    return this.reg.slice();
  }

  /** The count of registers `> 0` (`= m - V`, where `V` is the zero count). */
  nonzeroRegisters(): number {
    let n = 0;
    for (let i = 0; i < this.reg.length; i++) {
      if (this.reg[i] > 0) n++;
    }
    return n;
  }

  /** The maximum register value (largest `rho` seen); `0` for a fresh sketch. */
  maxRegister(): number {
    let max = 0;
    for (let i = 0; i < this.reg.length; i++) {
      if (this.reg[i] > max) max = this.reg[i];
    }
    return max;
  }

  /**
   * Merge `other` into `self` by element-wise register **max** (the union's
   * register `j` is the max over both input sets). Requires identical `p` (else
   * {@link HllError}). Commutative, associative, idempotent. **Pure integer.**
   */
  merge(other: HyperLogLog): void {
    if (this.p !== other.p) {
      throw new HllError(`merge precision mismatch: ${this.p} != ${other.p}`);
    }
    for (let i = 0; i < this.reg.length; i++) {
      if (other.reg[i] > this.reg[i]) {
        this.reg[i] = other.reg[i];
      }
    }
  }

  /**
   * Estimate the distinct cardinality (the **quarantined `number`/f64**,
   * native-only and tolerance-tested — never in the shared oracle).
   *
   * Original HyperLogLog estimator (Flajolet–Fusy–Gandouet–Meunier 2007) with
   * the small-range linear-counting correction and the **`2^64`** large-range
   * correction (this HLL consumes a 64-bit `hash64`, so the hash space is
   * `2^64`, NOT the 2007 paper's `2^32`).
   */
  estimate(): number {
    const m = this.reg.length;
    const alpha = HyperLogLog.alphaM(this.p);

    // Z = sum 2^(-register[j]); register[j] == 0 contributes 2^0 = 1.
    let z = 0;
    let v = 0; // count of empty registers
    for (let i = 0; i < m; i++) {
      const r = this.reg[i];
      if (r === 0) v++;
      z += 1 / 2 ** r;
    }
    const e = (alpha * m * m) / z;

    // Small-range (linear counting): E small AND there are empties (V > 0).
    if (e <= 2.5 * m && v > 0) {
      return m * Math.log(m / v);
    }

    // Large-range correction near the HASH-SPACE ceiling (2^64, NOT 2^32).
    const two64 = 18446744073709551616; // 2^64, exactly representable.
    if (e > (1 / 30) * two64) {
      return -two64 * Math.log(1 - e / two64);
    }

    return e;
  }

  /**
   * The HLL bias constant `alpha_m`: pinned piecewise literals for small `m`,
   * closed form for `m >= 128`.
   */
  private static alphaM(p: number): number {
    switch (p) {
      case 4:
        return 0.673; // m = 16
      case 5:
        return 0.697; // m = 32
      case 6:
        return 0.709; // m = 64
      default:
        return 0.7213 / (1 + 1.079 / (1 << p)); // m >= 128
    }
  }

  /**
   * Serialize to the v1 wire form: 5-byte header (`"HLL1"` + `p`) followed by
   * one byte per register in index order. Total length `5 + 2^p`.
   */
  toBytes(): Uint8Array {
    const out = new Uint8Array(5 + this.reg.length);
    out.set(MAGIC, 0);
    out[4] = this.p;
    out.set(this.reg, 5);
    return out;
  }

  /**
   * Deserialize from the v1 wire form. Rejects (single set of MUST rules so no
   * two ports disagree on validity): too short, bad magic, `p` out of range,
   * length `!= 5 + 2^p`, or any register byte `> 64 - p + 1`.
   */
  static fromBytes(bytes: Uint8Array): HyperLogLog {
    if (bytes.length < 5) {
      throw new HllError(
        `serialized HLL too short: ${bytes.length} bytes (need >= 5)`,
      );
    }
    if (
      bytes[0] !== MAGIC[0] ||
      bytes[1] !== MAGIC[1] ||
      bytes[2] !== MAGIC[2] ||
      bytes[3] !== MAGIC[3]
    ) {
      throw new HllError(
        `bad HLL magic: ${[bytes[0], bytes[1], bytes[2], bytes[3]]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")} (expected "HLL1")`,
      );
    }
    const p = bytes[4];
    if (p < MIN_PRECISION || p > MAX_PRECISION) {
      throw new HllError(
        `precision ${p} out of range ${MIN_PRECISION}..=${MAX_PRECISION}`,
      );
    }
    const m = 1 << p;
    const expected = 5 + m;
    if (bytes.length !== expected) {
      throw new HllError(
        `HLL length mismatch: expected ${expected}, got ${bytes.length}`,
      );
    }
    const ceiling = HyperLogLog.rhoCeiling(p);
    const reg = bytes.slice(5);
    for (let i = 0; i < reg.length; i++) {
      if (reg[i] > ceiling) {
        throw new HllError(
          `register[${i}] = ${reg[i]} exceeds per-p ceiling ${ceiling}`,
        );
      }
    }
    return new HyperLogLog(p, reg);
  }
}
