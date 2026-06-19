// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BitSet, wordIndex } from "./bit-set.js";

describe("BitSet generated", () => {
  it("set and get", () => {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    bs.set(10);
    expect(bs.get(0)).toBe(true);
    expect(bs.get(5)).toBe(true);
    expect(bs.get(10)).toBe(true);
    expect(bs.get(1)).toBe(false);
  });

  it("clearBit", () => {
    const bs = new BitSet();
    bs.set(5);
    expect(bs.get(5)).toBe(true);
    bs.clearBit(5);
    expect(bs.get(5)).toBe(false);
  });

  it("flip", () => {
    const bs = new BitSet();
    bs.set(5);
    expect(bs.get(5)).toBe(true);
    bs.flip(5);
    expect(bs.get(5)).toBe(false);
    bs.flip(5);
    expect(bs.get(5)).toBe(true);
  });

  it("empty BitSet", () => {
    const bs = new BitSet();
    expect(bs.isEmpty).toBe(true);
    expect(bs.cardinality).toBe(0);
  });

  it("cardinality", () => {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    bs.set(10);
    expect(bs.cardinality).toBe(3);
  });

  it("length", () => {
    const bs = new BitSet(100);
    expect(bs.length).toBe(100);
    bs.set(150);
    expect(bs.length).toBe(151);
  });

  it("clearAll", () => {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    bs.set(10);
    expect(bs.cardinality).toBe(3);
    bs.clearAll();
    expect(bs.cardinality).toBe(0);
    expect(bs.isEmpty).toBe(true);
  });

  it("intersects", () => {
    const bs1 = new BitSet();
    bs1.set(0);
    bs1.set(5);
    const bs2 = new BitSet();
    bs2.set(5);
    bs2.set(10);
    expect(bs1.intersects(bs2)).toBe(true);
    const bs3 = new BitSet();
    bs3.set(20);
    expect(bs1.intersects(bs3)).toBe(false);
  });

  it("andInPlace", () => {
    const bs1 = new BitSet();
    bs1.set(0);
    bs1.set(5);
    bs1.set(10);
    const bs2 = new BitSet();
    bs2.set(5);
    bs2.set(10);
    bs2.set(15);
    bs1.andInPlace(bs2);
    expect(bs1.cardinality).toBe(2);
    expect(bs1.get(0)).toBe(false);
    expect(bs1.get(5)).toBe(true);
    expect(bs1.get(10)).toBe(true);
  });

  it("orInPlace", () => {
    const bs1 = new BitSet();
    bs1.set(0);
    bs1.set(5);
    const bs2 = new BitSet();
    bs2.set(5);
    bs2.set(10);
    bs1.orInPlace(bs2);
    expect(bs1.cardinality).toBe(3);
    expect(bs1.get(0)).toBe(true);
    expect(bs1.get(5)).toBe(true);
    expect(bs1.get(10)).toBe(true);
  });

  it("xorInPlace", () => {
    const bs1 = new BitSet();
    bs1.set(0);
    bs1.set(5);
    const bs2 = new BitSet();
    bs2.set(5);
    bs2.set(10);
    bs1.xorInPlace(bs2);
    expect(bs1.cardinality).toBe(2);
    expect(bs1.get(0)).toBe(true);
    expect(bs1.get(5)).toBe(false);
    expect(bs1.get(10)).toBe(true);
  });

  it("andNotInPlace", () => {
    const bs1 = new BitSet();
    bs1.set(0);
    bs1.set(5);
    bs1.set(10);
    const bs2 = new BitSet();
    bs2.set(5);
    bs1.andNotInPlace(bs2);
    expect(bs1.cardinality).toBe(2);
    expect(bs1.get(0)).toBe(true);
    expect(bs1.get(5)).toBe(false);
    expect(bs1.get(10)).toBe(true);
  });

  it("nextSetBit", () => {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    bs.set(10);
    expect(bs.nextSetBit(0)).toBe(0);
    expect(bs.nextSetBit(1)).toBe(5);
    expect(bs.nextSetBit(6)).toBe(10);
    expect(bs.nextSetBit(11)).toBe(-1);
  });

  it("toArray", () => {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    bs.set(10);
    expect(bs.toArray()).toEqual([0, 5, 10]);
  });

  it("equals", () => {
    const bs1 = new BitSet();
    bs1.set(0);
    bs1.set(5);
    const bs2 = new BitSet();
    bs2.set(0);
    bs2.set(5);
    const bs3 = new BitSet();
    bs3.set(0);
    expect(bs1.equals(bs2)).toBe(true);
    expect(bs1.equals(bs3)).toBe(false);
  });

  it("toString", () => {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    expect(bs.toString()).toBe("{0, 5}");
  });

  it("large BitSet operations", () => {
    const bs = new BitSet();
    for (let i = 0; i < 1000; i += 2) {
      bs.set(i); // set even bits
    }
    expect(bs.cardinality).toBe(500);
    expect(bs.get(0)).toBe(true);
    expect(bs.get(1)).toBe(false);
    expect(bs.get(999)).toBe(false);
  });
});

describe("BitSet — wordIndex() is u32-safe (no signed/unsigned-shift aliasing)", () => {
  it("small positions agree with bit >>> 5 and bit >> 5", () => {
    for (const i of [0, 1, 31, 32, 33, 63, 64, 100, 1000, 0x7fffffff]) {
      expect(wordIndex(i)).toBe(Math.floor(i / 32));
      expect(wordIndex(i)).toBe(i >>> 5); // unsigned shift still correct < 2^31
      expect(wordIndex(i)).toBe(i >> 5); // signed shift still correct < 2^31
      expect(wordIndex(i)).toBeGreaterThanOrEqual(0);
    }
  });

  it("2^32 maps to word 2^27, not word 0 (the aliasing bug)", () => {
    const i = 2 ** 32;
    // `i >>> 5` coerces i to int32 first: 2^32 -> 0 -> 0, aliasing word 0.
    expect(i >>> 5).toBe(0); // documents the wrong (coerced) result
    expect(wordIndex(i)).toBe(2 ** 27); // 134217728
    expect(wordIndex(i)).toBe(Math.floor(i / 32));
    expect(wordIndex(i)).toBeGreaterThan(0);
  });

  it("positions across the whole u32 domain stay non-negative and correct", () => {
    for (const i of [
      0x80000000, // 2^31
      0x80000001,
      0xc0000000,
      0xffffffff, // 2^32-1
      2 ** 32, // 2^32
      2 ** 32 + 5,
    ]) {
      const wi = wordIndex(i);
      expect(wi).toBe(Math.floor(i / 32));
      expect(wi).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(wi)).toBe(true);
    }
  });

  it("index-math witness: set(2^32) does not alias bit 0 (helper-level)", () => {
    // The dense backing store cannot allocate 2^27 words cheaply, so we assert
    // the word-index math directly: bit 0 and bit 2^32 live in different words,
    // and within-word masks differ where expected. This is the math that drives
    // set/get/clearBit/flip/nextSetBit, so it being correct means none of them
    // alias across the u32 boundary.
    const zero = 0;
    const huge = 2 ** 32;
    expect(wordIndex(huge)).not.toBe(wordIndex(zero));
    // The within-word mask IS coercion-safe (low 5 bits survive), so both map to
    // bit 0 within their respective words — aliasing is prevented purely by the
    // word index now differing.
    expect(1 << (huge & 31)).toBe(1 << (zero & 31));
    expect(wordIndex(huge)).toBe(2 ** 27);
  });
});

describe("BitSet — end-to-end large index >= 2^31 (no aliasing)", () => {
  it("set(2^32) records the real index, does NOT alias bit 0 (the witness)", () => {
    // THE witness for the u32 aliasing bug: bit 2^32 lives in word
    // floor(2^32/32) = 2^27 = 134217728 -> a ~512 MiB Uint32Array (allocates in
    // a few hundred ms). On the original `bit >>> 5`, 2^32 coerces to int32 = 0,
    // so `set(2^32)` would set word 0 / bit 0 -> get(0) wrongly true, toArray()
    // -> [0], nextSetBit(2^32) -> 0. With floor(bit/32) the bit lands at its real
    // index and bit 0 is untouched.
    const bit = 2 ** 32;
    const bs = new BitSet();
    bs.set(bit);
    expect(bs.get(bit)).toBe(true);
    expect(bs.get(0)).toBe(false); // would be TRUE under the aliasing bug
    expect(bs.cardinality).toBe(1);
    expect(bs.toArray()).toEqual([bit]); // would be [0] under the bug
    expect(bs.nextSetBit(0)).toBe(bit);
    expect(bs.nextSetBit(bit)).toBe(bit); // would be 0 under the bug
    expect(bs.nextSetBit(bit + 1)).toBe(-1);
  });

  it("set(2^31) — a >= 2^31 index in the u32 domain — round-trips correctly", () => {
    // bit 2^31 lives in word 2^31/32 = 2^26 = 67108864 -> a ~256 MiB Uint32Array.
    // Proves the full set/get/toArray/nextSetBit path across the 2^31 boundary.
    const bit = 2 ** 31;
    const bs = new BitSet();
    bs.set(bit);
    expect(bs.get(bit)).toBe(true);
    expect(bs.get(0)).toBe(false);
    expect(bs.get(bit - 1)).toBe(false);
    expect(bs.cardinality).toBe(1);
    expect(bs.toArray()).toEqual([bit]);
    expect(bs.nextSetBit(0)).toBe(bit);
    expect(bs.nextSetBit(bit + 1)).toBe(-1);
  });
});
