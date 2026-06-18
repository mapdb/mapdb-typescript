// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Deterministic, byte-exact, cross-language hash pipeline (see
 * `spec/features/hash-pipeline.md`).
 *
 * This is the TypeScript port of a small, frozen primitive whose entire
 * contract is *bit-exactness across all five language ports*: every
 * `(input, seed)` produces the identical `hash32` / `hash64` / `positions`
 * bits in Rust, Go, TypeScript, Zig and Java.
 *
 * JavaScript `number` is an IEEE-754 `f64` and holds only 53 bits of integer
 * precision, so it CANNOT represent a 64-bit hash exactly. `hash64` is computed
 * as a pair of unsigned 32-bit lanes ({@link U64}); the full 64-bit value
 * `hi * 2**32 + lo` is NEVER formed. All `hash32` math uses `Math.imul` (the JS
 * 32-bit wrapping multiply) and `>>> 0` to renormalize each result.
 *
 * It is a separate, additive module — it does NOT touch the collections'
 * bucket hash (which keeps its native-hash carve-out). This module has NO
 * carve-out: every port must produce identical bits.
 */

/**
 * A 64-bit value carried as two unsigned 32-bit lanes. `hi` is the high 32
 * bits, `lo` the low 32 bits; both are kept normalized to `0 .. 2^32-1` with
 * `>>> 0`. The full 64-bit value is `hi * 2**32 + lo`, but that product is
 * never formed (it would lose precision).
 */
export interface U64 {
  hi: number;
  lo: number;
}

// MurmurHash3 `fmix32` finalizer constants (the published values).
const FMIX32_C1 = 0x85ebca6b;
const FMIX32_C2 = 0xc2b2ae35;

// MurmurHash3 `fmix64` finalizer constants (the published values), as lane
// pairs. NOTE: these are the MurmurHash3 `fmix64` constants with three `33`-bit
// shifts, NOT the SplitMix64 generator's final mix (`0xbf58476d1ce4e5b9` /
// `0x94d049bb133111eb`, shifts `30/27/31`) — a different function.
const FMIX64_C1: U64 = { hi: 0xff51afd7, lo: 0xed558ccd };
const FMIX64_C2: U64 = { hi: 0xc4ceb9fe, lo: 0x1a85ec53 };

/**
 * The fixed 32-bit salt for the second base hash of the double-hashing position
 * scheme (the 32-bit golden-ratio prime). Distinct from the 64-bit collection
 * Fibonacci constant `0x9E3779B97F4A7C15`. Carried as a {@link U64} whose high
 * lane is 0.
 */
export const SALT2: U64 = { hi: 0x00000000, lo: 0x9e3779b1 };

// ---- Lane primitives ------------------------------------------------------

/** Lane-wise XOR; each lane renormalized to unsigned 32-bit. */
export function xor64(a: U64, b: U64): U64 {
  return { hi: (a.hi ^ b.hi) >>> 0, lo: (a.lo ^ b.lo) >>> 0 };
}

/**
 * Logical right shift by `s` (`0 <= s < 64`). For the v1 shift `s = 33` this
 * gives `hi = 0`, `lo = h.hi >>> 1`, but the general case is implemented.
 */
export function shr64(h: U64, s: number): U64 {
  if (s === 0) return { hi: h.hi >>> 0, lo: h.lo >>> 0 };
  if (s < 32) {
    return {
      hi: h.hi >>> s,
      lo: ((h.lo >>> s) | (h.hi << (32 - s))) >>> 0,
    };
  }
  // s >= 32: the new hi is 0; new lo comes from the old hi shifted down.
  return { hi: 0, lo: (h.hi >>> (s - 32)) >>> 0 };
}

/**
 * Multiply two {@link U64} values mod 2^64, returning a {@link U64}.
 *
 * Schoolbook 16-bit-limb multiply. The full 64-bit product is never formed as a
 * JS number. The inter-column carry MUST be extracted with
 * `Math.floor(column / 0x10000)` — NEVER `>>> 16`: a column sum (`c1`/`c2`) can
 * exceed 2^32, and JS `>>>` first coerces its operand to a 32-bit unsigned int,
 * which would silently drop carry bit 16+. Columns >= 4 (weights >= 2^64) are
 * not computed — discarding them is precisely the mod-2^64 wraparound.
 */
export function mul64(a: U64, b: U64): U64 {
  // 16-bit limbs, least-significant first: a = a0 + a1<<16 + a2<<32 + a3<<48.
  const a0 = a.lo & 0xffff;
  const a1 = a.lo >>> 16;
  const a2 = a.hi & 0xffff;
  const a3 = a.hi >>> 16;
  const b0 = b.lo & 0xffff;
  const b1 = b.lo >>> 16;
  const b2 = b.hi & 0xffff;
  const b3 = b.hi >>> 16;

  // Each ai*bj < 2^32; a column sum is at most four such terms plus a carry,
  // bounded by ~2^34 << 2^53, so every value is exactly representable and
  // Math.floor(cN / 0x10000) extracts the FULL carry (all bits above bit 15).
  const c0 = a0 * b0; // column 0 (2^0)
  const c1 = Math.floor(c0 / 0x10000) + a0 * b1 + a1 * b0; // column 1 (2^16)
  const c2 = Math.floor(c1 / 0x10000) + a0 * b2 + a1 * b1 + a2 * b0; // column 2 (2^32)
  const c3 = Math.floor(c2 / 0x10000) + a0 * b3 + a1 * b2 + a2 * b1 + a3 * b0; // column 3 (2^48)

  const lo = ((c0 & 0xffff) | ((c1 & 0xffff) << 16)) >>> 0;
  const hi = ((c2 & 0xffff) | ((c3 & 0xffff) << 16)) >>> 0;
  return { hi, lo };
}

// ---- Named hashes ---------------------------------------------------------

/**
 * 32-bit named hash: the MurmurHash3 `fmix32` finalizer applied to one 32-bit
 * lane derived from `inputWord` (a u32) and a 32-bit fold of the 64-bit `seed`.
 *
 * The seed is folded with `seed ^ (seed >> 32)` (computed lane-wise) so two
 * seeds differing only in their high 32 bits still produce different hashes.
 * Seed `0` is an ordinary seed (XOR'd in; no special case). Every multiply uses
 * `Math.imul` and every result is renormalized to unsigned with `>>> 0`.
 */
export function hash32(inputWord: number, seed: U64): number {
  // seed32 = (seed ^ (seed >> 32)) as u32 == low lane XOR high lane.
  const seed32 = (seed.lo ^ seed.hi) >>> 0;
  let h = (inputWord ^ seed32) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, FMIX32_C1) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, FMIX32_C2) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/**
 * 64-bit named hash: the MurmurHash3 `fmix64` finalizer applied to
 * `inputWord ^ seed` in hi/lo lanes. The seed is mixed in first as a 64-bit
 * integer (no endianness, no special case for seed `0`). Literal transcription
 * of the spec finalizer onto the lane primitives.
 */
export function hash64(inputWord: U64, seed: U64): U64 {
  let h: U64 = {
    hi: (inputWord.hi ^ seed.hi) >>> 0,
    lo: (inputWord.lo ^ seed.lo) >>> 0,
  };
  h = xor64(h, shr64(h, 33));
  h = mul64(h, FMIX64_C1);
  h = xor64(h, shr64(h, 33));
  h = mul64(h, FMIX64_C2);
  h = xor64(h, shr64(h, 33));
  return h;
}

// ---- Per-type input-word encoders ----------------------------------------

/**
 * Encode an `i32` element to the `hash32` input word: a two's-complement bit
 * reinterpret to u32 (NOT a sign-extend). `>>> 0` reinterprets the JS i32 bits
 * as unsigned 32-bit.
 */
export function encodeI32Word32(value: number): number {
  return value >>> 0;
}

/**
 * Encode an `i32` element to the `hash64` input word: reinterpret to u32 then
 * ZERO-extend to u64 (high lane always 0; the seed supplies the high-word
 * entropy). NOT a sign-extend.
 */
export function encodeI32Word64(value: number): U64 {
  return { hi: 0, lo: value >>> 0 };
}

/**
 * Fold a raw byte slice into the `hash32` input word: read 4 bytes at a time as
 * little-endian u32 lanes, XOR-combine, zero-pad a sub-lane tail to the LOW
 * bytes, then XOR in `len(bytes) mod 2^32`.
 */
export function encodeBytesWord32(bytes: Uint8Array): number {
  let word = 0;
  const n = bytes.length;
  const full = n - (n % 4);
  for (let i = 0; i < full; i += 4) {
    const lane =
      (bytes[i] |
        (bytes[i + 1] << 8) |
        (bytes[i + 2] << 16) |
        (bytes[i + 3] << 24)) >>>
      0;
    word = (word ^ lane) >>> 0;
  }
  if (full < n) {
    // Tail goes in the LOW bytes of its lane; remaining high bytes are 0.
    let lane = 0;
    for (let j = 0; j < n - full; j++) {
      lane = (lane | (bytes[full + j] << (8 * j))) >>> 0;
    }
    word = (word ^ lane) >>> 0;
  }
  // Length reduced mod 2^32 before the XOR.
  return (word ^ (n >>> 0)) >>> 0;
}

/**
 * Fold a raw byte slice into the `hash64` input word: read 8 bytes at a time as
 * little-endian u64 lanes, XOR-combine, zero-pad a sub-lane tail to the LOW
 * bytes, then XOR in `len(bytes) mod 2^64`. Lane math only — no 64-bit number
 * is ever formed.
 */
export function encodeBytesWord64(bytes: Uint8Array): U64 {
  let word: U64 = { hi: 0, lo: 0 };
  const n = bytes.length;
  const full = n - (n % 8);
  for (let i = 0; i < full; i += 8) {
    const lo =
      (bytes[i] |
        (bytes[i + 1] << 8) |
        (bytes[i + 2] << 16) |
        (bytes[i + 3] << 24)) >>>
      0;
    const hi =
      (bytes[i + 4] |
        (bytes[i + 5] << 8) |
        (bytes[i + 6] << 16) |
        (bytes[i + 7] << 24)) >>>
      0;
    word = xor64(word, { hi, lo });
  }
  if (full < n) {
    // Tail goes in the LOW bytes of its 8-byte lane.
    let lo = 0;
    let hi = 0;
    for (let j = 0; j < n - full; j++) {
      const b = bytes[full + j];
      if (j < 4) {
        lo = (lo | (b << (8 * j))) >>> 0;
      } else {
        hi = (hi | (b << (8 * (j - 4)))) >>> 0;
      }
    }
    word = xor64(word, { hi, lo });
  }
  // Length reduced mod 2^64 before the XOR. n < 2^32 always here, so hi=0.
  return xor64(word, { hi: 0, lo: n >>> 0 });
}

// ---- Typed convenience hashes --------------------------------------------

/** `hash32` of an `i32` element (reinterpret encoding). */
export function hash32I32(value: number, seed: U64): number {
  return hash32(encodeI32Word32(value), seed);
}

/** `hash32` of a raw byte slice (little-endian fold encoding). */
export function hash32Bytes(bytes: Uint8Array, seed: U64): number {
  return hash32(encodeBytesWord32(bytes), seed);
}

/** `hash64` of an `i32` element (reinterpret + zero-extend encoding). */
export function hash64I32(value: number, seed: U64): U64 {
  return hash64(encodeI32Word64(value), seed);
}

/** `hash64` of a raw byte slice (little-endian fold encoding). */
export function hash64Bytes(bytes: Uint8Array, seed: U64): U64 {
  return hash64(encodeBytesWord64(bytes), seed);
}

// ---- Derived positions (Kirsch–Mitzenmacher double hashing) --------------

/**
 * Derive `k` array positions over a table of size `m` from two base hashes
 * `h1`/`h2`, combined linearly: `p_i = (h1 + i*h2) mod m`, all 32-bit wrapping,
 * unsigned modulo. Returned in derivation order `p_0 … p_{k-1}`.
 *
 * The whole path is 32-bit only (no lanes): `Math.imul(i, h2)` wraps the
 * multiply, `>>> 0` keeps `combined` unsigned, and `% m` on two unsigned u32
 * values is an unsigned modulo (JS `%` on values < 2^32 is exact and unsigned
 * once both operands are `>>> 0`-normalized).
 */
export function positionsFromHashes(
  h1: number,
  h2: number,
  m: number,
  k: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    // i*h2 wraps mod 2^32 (Math.imul); h1 + that wraps mod 2^32 (`>>> 0`).
    const combined = (((h1 >>> 0) + Math.imul(i, h2)) >>> 0) % (m >>> 0);
    out.push(combined);
  }
  return out;
}

/**
 * Derive `k` array positions for `input` over a table of size `m` using
 * Kirsch–Mitzenmacher double hashing. `h1 = hash32(input, 0)`,
 * `h2 = hash32(input, SALT2)`; then {@link positionsFromHashes}.
 */
export function positions(input: Uint8Array, m: number, k: number): number[] {
  const h1 = hash32Bytes(input, { hi: 0, lo: 0 });
  const h2 = hash32Bytes(input, SALT2);
  return positionsFromHashes(h1, h2, m, k);
}

// ---- HyperLogLog split (pre-stated for the HLL feature) ------------------

/** Count leading zeros of an unsigned 32-bit value (0 => 32). */
function clz32(x: number): number {
  return Math.clz32(x >>> 0);
}

/** Count leading zeros of a {@link U64} (all-zero => 64). */
function clz64(x: U64): number {
  return x.hi === 0 ? 32 + clz32(x.lo) : clz32(x.hi);
}

/**
 * Pre-stated HyperLogLog split: from a single 64-bit hash, derive a
 * `[register_index, leading_zero_run]` pair. `p = log2(number of registers)`,
 * `4 <= p <= 18`. Only `hash64(input, 0)` is locked here; HLL itself is a
 * separate later feature.
 *
 * - `idx` = the top `p` bits of the hash (the register index).
 * - `rho` = `clz64(w) + 1`, the 1-based leading-zero run of the remaining bits
 *   shifted up with a guard bit set at position `p - 1`.
 */
export function hllSplit(input: Uint8Array, p: number): [number, number] {
  const x = hash64Bytes(input, { hi: 0, lo: 0 });
  // idx = (x >> (64 - p)) as u32. Since p <= 18 < 32, the top p bits live in
  // the hi lane: x >> (64 - p) == x.hi >>> (32 - p).
  const idx = (x.hi >>> (32 - p)) >>> 0;
  // w = (x << p) | (1 << (p - 1)); p <= 18 < 32 so this is a sub-32 left shift.
  const w = shl64(x, p);
  const guardLo = (1 << (p - 1)) >>> 0;
  const wGuarded: U64 = { hi: w.hi, lo: (w.lo | guardLo) >>> 0 };
  const rho = clz64(wGuarded) + 1;
  return [idx, rho];
}

/** Logical left shift by `s` (`0 <= s < 64`). Internal helper for hllSplit. */
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
