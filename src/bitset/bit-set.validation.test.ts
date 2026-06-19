// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { BitSet } from "./bit-set.js";
import { ImmutableBitSet } from "./immutable-bit-set.js";

describe("BitSet bit-index validation (cross-language usize/u32 contract)", () => {
  it("set/clearBit/flip/get/has/nextSetBit reject non-integer indices", () => {
    const bs = new BitSet();
    // Witness: 1.5 & 31 === 1, so set(1.5) silently aliased bit 1 before the fix.
    expect(() => bs.set(1.5)).toThrow(RangeError);
    expect(() => bs.clearBit(1.5)).toThrow(RangeError);
    expect(() => bs.flip(1.5)).toThrow(RangeError);
    expect(() => bs.get(1.5)).toThrow(RangeError);
    expect(() => bs.has(1.5)).toThrow(RangeError);
    expect(() => bs.nextSetBit(1.5)).toThrow(RangeError);
    expect(() => bs.set(NaN)).toThrow(RangeError);
  });

  it("set/get reject negative indices (no typed-port counterpart)", () => {
    const bs = new BitSet();
    expect(() => bs.set(-1)).toThrow(RangeError);
    expect(() => bs.get(-1)).toThrow(RangeError);
    expect(() => bs.flip(-1)).toThrow(RangeError);
    expect(() => bs.clearBit(-1)).toThrow(RangeError);
    expect(() => bs.nextSetBit(-1)).toThrow(RangeError);
  });

  it("rejects non-finite and unsafe-integer indices", () => {
    const bs = new BitSet();
    expect(() => bs.set(Infinity)).toThrow(RangeError);
    expect(() => bs.set(-Infinity)).toThrow(RangeError);
    // beyond 2^53 the integer is no longer exactly representable -> reject.
    expect(() => bs.set(2 ** 53)).toThrow(RangeError);
    // a large but safe integer (e.g. 2^32) is accepted (see generated witness).
  });

  it("still accepts valid non-negative integer indices", () => {
    const bs = new BitSet();
    bs.set(0);
    bs.set(5);
    bs.set(63);
    expect(bs.get(0)).toBe(true);
    expect(bs.get(5)).toBe(true);
    expect(bs.get(63)).toBe(true);
    expect(bs.get(1)).toBe(false);
    expect(bs.nextSetBit(1)).toBe(5);
  });

  it("ImmutableBitSet inherits the same validation via its delegate", () => {
    const ib = ImmutableBitSet.empty();
    expect(() => ib.get(1.5)).toThrow(RangeError);
    expect(() => ib.set(-1)).toThrow(RangeError);
  });
});
