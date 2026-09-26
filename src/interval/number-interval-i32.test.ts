// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberInterval } from "./number-interval.js";

// astra25 22 TS-2 / TS-3: NumberInterval is the Interval<i32> surface but
// enforced nothing, so `fromTo(2**53, 2**53 + 2)` iterated forever (the
// cursor `2**53 + 1` rounds back to `2**53`) and `fromToBy(0, 10, 3).size`
// was the fraction 4.333…, letting `get(4)` return 12, a non-member.
// Every regression here is bounded: the hang input is rejected at
// construction, and enumeration is asserted against a fixed list.

describe("NumberInterval int32 domain", () => {
  it("rejects the 2^53 hang input at construction instead of looping", () => {
    expect(() => NumberInterval.fromTo(2 ** 53, 2 ** 53 + 2)).toThrow(
      RangeError,
    );
    expect(() => NumberInterval.fromToBy(2 ** 53, 2 ** 53 + 2, 1)).toThrow(
      RangeError,
    );
  });

  it("rejects non-int32 endpoints and steps on every factory", () => {
    const bad = [2.5, NaN, Infinity, -Infinity, 2147483648, -2147483649];
    for (const v of bad) {
      expect(() => NumberInterval.fromTo(v, 0)).toThrow(RangeError);
      expect(() => NumberInterval.fromTo(0, v)).toThrow(RangeError);
      expect(() => NumberInterval.fromToBy(v, 0, 1)).toThrow(RangeError);
      expect(() => NumberInterval.fromToBy(0, v, 1)).toThrow(RangeError);
      expect(() => NumberInterval.oneTo(v)).toThrow(RangeError);
      expect(() => NumberInterval.zeroTo(v)).toThrow(RangeError);
    }
    expect(() => NumberInterval.fromToBy(0, 10, 0.5)).toThrow(RangeError);
    expect(() => NumberInterval.fromToBy(0, 10, NaN)).toThrow(RangeError);
    // The pre-existing sign/zero checks still apply after the domain check.
    expect(() => NumberInterval.fromToBy(0, 10, 0)).toThrow(/zero/);
    expect(() => NumberInterval.fromToBy(0, 10, -1)).toThrow(/positive/);
  });

  it("size truncates to the integer element count (TS-3)", () => {
    const up = NumberInterval.fromToBy(0, 10, 3);
    expect(up.size).toBe(4);
    expect(up.toArray()).toEqual([0, 3, 6, 9]);
    expect(up.get(3)).toBe(9);
    expect(() => up.get(4)).toThrow(RangeError);
    expect(up.has(12)).toBe(false);

    const down = NumberInterval.fromToBy(10, 0, -4);
    expect(down.size).toBe(3);
    expect(down.toArray()).toEqual([10, 6, 2]);
    expect(() => down.get(3)).toThrow(RangeError);
  });

  it("has rejects non-integer queries before any arithmetic (codex r1)", () => {
    const up = NumberInterval.fromTo(-2147483648, 2147483647);
    const down = NumberInterval.fromTo(2147483647, -2147483648);
    const tiny = [Number.EPSILON, -Number.EPSILON, Number.MIN_VALUE, 0.5, 2.5];
    for (const iv of [up, down]) {
      for (const q of tiny) expect(iv.has(q)).toBe(false);
      for (const q of [
        NaN,
        Infinity,
        -Infinity,
        2 ** 53,
        2147483648,
        -2147483649,
      ])
        expect(iv.has(q)).toBe(false);
      expect(iv.has(0)).toBe(true);
      expect(iv.has(-2147483648)).toBe(true);
      expect(iv.has(2147483647)).toBe(true);
      expect(iv.includes(1)).toBe(true);
      expect(iv.includes(Number.EPSILON)).toBe(false);
    }
    const stepped = NumberInterval.fromToBy(0, 10, 3);
    expect(stepped.has(3.0000000001)).toBe(false);
    expect(stepped.has(3)).toBe(true);
    expect(stepped.has(4)).toBe(false);
  });

  it("get rejects fractional indexes", () => {
    const iv = NumberInterval.fromTo(0, 3);
    expect(() => iv.get(1.5)).toThrow(RangeError);
    expect(() => iv.get(NaN)).toThrow(RangeError);
    expect(iv.get(1)).toBe(1);
  });

  it("int32 boundaries enumerate exactly and terminate", () => {
    expect(NumberInterval.fromTo(2147483646, 2147483647).toArray()).toEqual([
      2147483646, 2147483647,
    ]);
    expect(NumberInterval.fromTo(-2147483648, -2147483647).toArray()).toEqual([
      -2147483648, -2147483647,
    ]);
    // Full-width span with the maximum positive step: three exact elements.
    const wide = NumberInterval.fromToBy(-2147483648, 2147483647, 2147483647);
    expect(wide.size).toBe(3);
    expect(wide.toArray()).toEqual([-2147483648, -1, 2147483646]);
    expect(wide.has(-1)).toBe(true);
    expect(wide.has(0)).toBe(false);
    // Minimum step (already covered for size) also enumerates by index.
    const min = NumberInterval.fromToBy(0, -2147483648, -2147483648);
    expect(min.toArray()).toEqual([0, -2147483648]);
    expect(() => min.reversed()).toThrow(/minimum step/);
  });

  it("empty and singleton intervals are unchanged", () => {
    expect(NumberInterval.fromTo(5, 5).toArray()).toEqual([5]);
    expect(NumberInterval.fromToBy(5, 5, -3).toArray()).toEqual([5]);
    expect(NumberInterval.fromTo(3, 1).toArray()).toEqual([3, 2, 1]);
    expect(NumberInterval.fromTo(1, 5).reversed().toArray()).toEqual([
      5, 4, 3, 2, 1,
    ]);
  });
});
