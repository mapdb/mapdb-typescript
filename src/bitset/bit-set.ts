// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


/**
 * The word index of bit position `bit` in the Uint32Array backing store:
 * `floor(bit / 32)`.
 *
 * A bit index can range across the full u32 domain (`0 .. 2^32-1`), so `bit`
 * can exceed `2^31`. A signed/unsigned shift (`bit >> 5` / `bit >>> 5`) first
 * coerces `bit` to a 32-bit integer: for `bit >= 2^32` it wraps (e.g. `2^32`
 * becomes `0`, aliasing word 0), and for `bit` in `[2^31, 2^32)` a signed `>>`
 * goes negative. `Math.floor(bit / 32)` stays correct across the whole u32
 * domain. (The bit-within-word mask `1 << (bit & 31)` is coercion-safe because
 * the low 5 bits survive the int32 truncation unchanged.)
 */
export function wordIndex(bit: number): number {
  return Math.floor(bit / 32);
}

/**
 * Compact bit-packed storage for booleans, backed by a Uint32Array
 * (JavaScript bitwise operators work on 32-bit integers).
 *
 * O(1) set/clear/flip/get; cardinality and bit-wise ops are O(n/32).
 */
export class BitSet {
  private words: Uint32Array;
  private _bitLength: number;

  private static readonly BITS_PER_WORD = 32;

  constructor(nBits: number = 0) {
    const nWords = Math.ceil(nBits / BitSet.BITS_PER_WORD);
    this.words = new Uint32Array(nWords);
    this._bitLength = nBits;
  }

  /** Creates an empty BitSet (length 0, no bits set). */
  static empty(): BitSet {
    return new BitSet();
  }

  /** Creates a BitSet preallocated for `nBits` bits (all zero). */
  static withBitLength(nBits: number): BitSet {
    return new BitSet(nBits);
  }

  private wordIndex(bit: number): number {
    return wordIndex(bit);
  }
  private wordMask(bit: number): number {
    return 1 << (bit & 31);
  }

  private ensure(bit: number): void {
    const needed = this.wordIndex(bit) + 1;
    if (this.words.length < needed) {
      const bigger = new Uint32Array(needed);
      bigger.set(this.words);
      this.words = bigger;
    }
    if (bit + 1 > this._bitLength) this._bitLength = bit + 1;
  }

  /** Sets the bit at `index` to 1. */
  set(bit: number): void {
    this.ensure(bit);
    this.words[this.wordIndex(bit)] |= this.wordMask(bit);
  }

  /** Clears the bit at `index`. Out-of-range indices are no-ops. */
  clearBit(bit: number): void {
    const wi = this.wordIndex(bit);
    if (wi >= this.words.length) return;
    this.words[wi] &= ~this.wordMask(bit);
  }

  /** Flips the bit at `index`. */
  flip(bit: number): void {
    this.ensure(bit);
    this.words[this.wordIndex(bit)] ^= this.wordMask(bit);
  }

  /** Returns true if the bit at `index` is 1. Out-of-range returns false. */
  get(bit: number): boolean {
    const wi = this.wordIndex(bit);
    if (wi >= this.words.length) return false;
    return (this.words[wi] & this.wordMask(bit)) !== 0;
  }

  /** Returns true if the bit is set. Alias for `get`. */
  has(bit: number): boolean {
    return this.get(bit);
  }

  /** Logical bit length (tracks highest bit set + 1, or explicit prealloc). */
  get length(): number {
    return this._bitLength;
  }

  /** Number of set bits. */
  get cardinality(): number {
    if (this._bitLength === 0) return 0;
    const lastIdx = this.wordIndex(this._bitLength - 1);
    let count = 0;
    for (let i = 0; i < this.words.length; i++) {
      let w = this.words[i];
      if (i > lastIdx) continue;
      if (i === lastIdx) {
        const rem = this._bitLength - i * 32;
        const mask = rem === 32 ? 0xffffffff : (1 << rem) - 1;
        w = w & mask;
      }
      // Hamming weight (popcount) for a 32-bit word.
      w = w - ((w >>> 1) & 0x55555555);
      w = (w & 0x33333333) + ((w >>> 2) & 0x33333333);
      w = (w + (w >>> 4)) & 0x0f0f0f0f;
      count += (w * 0x01010101) >>> 24;
    }
    return count;
  }

  /** True if no bits are set. */
  get isEmpty(): boolean {
    return this.cardinality === 0;
  }

  /** Clears all bits; retains capacity. */
  clearAll(): void {
    for (let i = 0; i < this.words.length; i++) this.words[i] = 0;
  }

  /** True if any bit is set in both `this` and `other`. */
  intersects(other: BitSet): boolean {
    const min = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < min; i++) {
      if ((this.words[i] & other.words[i]) !== 0) return true;
    }
    return false;
  }

  /** In-place `this = this AND other`. */
  andInPlace(other: BitSet): void {
    for (let i = 0; i < this.words.length; i++) {
      const ow = i < other.words.length ? other.words[i] : 0;
      this.words[i] &= ow;
    }
  }

  /** In-place `this = this OR other`; extends length/capacity if needed. */
  orInPlace(other: BitSet): void {
    if (other.words.length > this.words.length) {
      const bigger = new Uint32Array(other.words.length);
      bigger.set(this.words);
      this.words = bigger;
    }
    if (other._bitLength > this._bitLength) this._bitLength = other._bitLength;
    for (let i = 0; i < other.words.length; i++)
      this.words[i] |= other.words[i];
  }

  /** In-place `this = this XOR other`. */
  xorInPlace(other: BitSet): void {
    if (other.words.length > this.words.length) {
      const bigger = new Uint32Array(other.words.length);
      bigger.set(this.words);
      this.words = bigger;
    }
    if (other._bitLength > this._bitLength) this._bitLength = other._bitLength;
    for (let i = 0; i < other.words.length; i++)
      this.words[i] ^= other.words[i];
  }

  /** In-place `this = this AND NOT other`. */
  andNotInPlace(other: BitSet): void {
    const min = Math.min(this.words.length, other.words.length);
    for (let i = 0; i < min; i++) this.words[i] &= ~other.words[i];
  }

  /** Returns the index of the next set bit at or after `from`, or -1. */
  nextSetBit(from: number): number {
    let wi = this.wordIndex(from);
    if (wi >= this.words.length) return -1;
    const offset = from & 31;
    let word = (this.words[wi] & (0xffffffff << offset)) >>> 0;
    while (true) {
      if (word !== 0) {
        // Count trailing zeros via de Bruijn sequence / simple loop.
        let t = 0;
        while ((word & 1) === 0) {
          word >>>= 1;
          t++;
        }
        return wi * 32 + t;
      }
      wi++;
      if (wi >= this.words.length) return -1;
      word = this.words[wi];
    }
  }

  /** Returns indices of set bits, ascending. */
  toArray(): number[] {
    const out: number[] = [];
    let bit = this.nextSetBit(0);
    while (bit >= 0) {
      out.push(bit);
      bit = this.nextSetBit(bit + 1);
    }
    return out;
  }

  /** Returns true if both BitSets have the same length and bits. */
  equals(other: BitSet): boolean {
    if (this._bitLength !== other._bitLength) return false;
    const n = Math.max(this.words.length, other.words.length);
    for (let i = 0; i < n; i++) {
      const a = i < this.words.length ? this.words[i] : 0;
      const b = i < other.words.length ? other.words[i] : 0;
      if (a !== b) return false;
    }
    return true;
  }

  /** String of set bit indices. */
  toString(): string {
    return `{${this.toArray().join(", ")}}`;
  }

  /** Iterates set bit indices in ascending order. */
  *[Symbol.iterator](): Generator<number> {
    let bit = this.nextSetBit(0);
    while (bit >= 0) {
      yield bit;
      bit = this.nextSetBit(bit + 1);
    }
  }
}
