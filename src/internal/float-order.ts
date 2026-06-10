// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Shared scratch view: write an f64, read its two 32-bit halves. Single
// 8-byte buffer reused across calls (single-threaded JS — safe).
const _scratchF64 = new Float64Array(1);
const _scratchI32 = new Int32Array(_scratchF64.buffer);

// Word indices for the high and low 32 bits of the f64, detected once so the
// comparator is correct on both little- and big-endian hosts. We write a value
// whose high word is non-zero and low word is zero (2 has exponent bits set,
// mantissa 0) and see which Int32 slot is non-zero.
_scratchF64[0] = 2;
const _HI = _scratchI32[1] !== 0 ? 1 : 0;
const _LO = _HI ^ 1;

/**
 * IEEE 754 total order comparator for JS numbers, bit-identical to Rust's
 * `f64::total_cmp` (sign-flip then signed 64-bit integer compare on the IEEE
 * bit pattern). Returns negative, zero, or positive.
 *
 * This is a TRUE total order (transitive, antisymmetric, total):
 *  - all NaNs sort to one end (above +Infinity for the canonical positive NaN,
 *    below -Infinity for a sign-bit NaN), never compare "equal" to a real key;
 *  - -0 sorts strictly below +0;
 *  - otherwise it agrees with natural numeric ordering.
 *
 * Required by the tree collections (red-black binary search invariant) and by
 * any sort that must not invoke undefined behaviour on a NaN comparator.
 */
export function totalCmpNumber(a: number, b: number): number {
  // Reinterpret each f64 as a signed 64-bit integer split into hi:lo i32 words.
  _scratchF64[0] = a;
  let aHi = _scratchI32[_HI];
  const aLo = _scratchI32[_LO];
  _scratchF64[0] = b;
  let bHi = _scratchI32[_HI];
  const bLo = _scratchI32[_LO];

  // Sign-flip: if the sign bit (top bit of hi word) is set, flip all bits
  // except the sign bit. Arithmetic shift of the hi word by 31 yields all-ones
  // for negatives / all-zeros for non-negatives; >>> 1 keeps the sign bit fixed
  // so the mask is 0x7FFFFFFF (hi) for negatives, applied to both words.
  const aMaskHi = aHi >> 31; // arithmetic: 0 or -1 (0xFFFFFFFF)
  const aMaskLo = aMaskHi; // low word gets the full mask for negatives
  aHi ^= aMaskHi >>> 1; // hi: flip all but the sign bit
  const aLoT = (aLo ^ aMaskLo) >>> 0; // lo: flip all bits for negatives
  const aHiT = aHi >>> 0;

  const bMaskHi = bHi >> 31;
  const bMaskLo = bMaskHi;
  bHi ^= bMaskHi >>> 1;
  const bLoT = (bLo ^ bMaskLo) >>> 0;
  const bHiT = bHi >>> 0;

  // Compare as signed 64-bit: hi word signed, lo word unsigned tiebreak.
  // Reinterpret transformed hi as signed for the high comparison.
  const aHiS = aHiT | 0;
  const bHiS = bHiT | 0;
  if (aHiS < bHiS) return -1;
  if (aHiS > bHiS) return 1;
  if (aLoT < bLoT) return -1;
  if (aLoT > bLoT) return 1;
  return 0;
}

/**
 * Sentinel used as a native-`Map` key to represent -0 distinctly from +0.
 *
 * Native `Map` uses SameValueZero, which collapses -0 and +0 to one slot (but
 * keeps NaN findable). The open-addressing collections in this package use
 * Object.is keying, where -0 and +0 are DISTINCT. To make the Map-backed
 * collections agree, route every number key through {@link mapKeyOf}: -0 maps
 * to this unique sentinel, every other value (including +0 and NaN) maps to
 * itself. Store the original key alongside the value if you need to iterate it.
 */
export const NEG_ZERO_KEY: unique symbol = Symbol("mapdb.negZero");

/** Map-key for a number with Object.is identity: -0 distinct from +0. */
export function mapKeyOf(value: number): number | typeof NEG_ZERO_KEY {
  return Object.is(value, -0) ? NEG_ZERO_KEY : value;
}

/**
 * A 32-bit seed derived from a number's full IEEE 754 f64 bit pattern, XOR-
 * folding the two 32-bit halves together. This is not injective (64->32 bits),
 * but it distinguishes -0 from +0 and gives fractional values distinct seeds —
 * unlike `key | 0`, which truncates 0.1..0.9, ±0 and NaN all to bucket 0. Feed
 * the result into the avalanche mixer in each set's hash().
 *
 * NaN is canonicalized to a single fixed seed: the hash tables use `Object.is`
 * equality, under which every NaN compares equal, so equal keys MUST hash equal
 * — hashing distinct NaN payloads to distinct seeds would scatter equal keys
 * into different probe chains (duplicate inserts, missed lookups).
 */
const NAN_HASH_SEED = 0x7ff80000 | 0;
export function f64HashSeed(value: number): number {
  if (Number.isNaN(value)) return NAN_HASH_SEED;
  _scratchF64[0] = value;
  return (_scratchI32[_LO] ^ _scratchI32[_HI]) | 0;
}
