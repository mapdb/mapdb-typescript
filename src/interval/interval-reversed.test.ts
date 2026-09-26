// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberInterval } from "./number-interval.js";
import { BigIntInterval } from "./bigint-interval.js";

// algorithms.md §"Reversed() starts from the last element, and panics at
// minimum step": reversed() is `get(size-1), ..., get(0)`, so its `from` is
// the last element actually produced, not the constructor's `to`. The
// pre-2026-09-26 form `{from: to, to: from, step: -step}` gave
// `fromToBy(0, 10, 3).reversed()` = 10, 7, 4, 1 instead of 9, 6, 3, 0.
// Cross-language pin: cross-language-validation/scenarios/22-interval/reversed_*.

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

// [from, to, step, expected reversed sequence]
const numberCases: [number, number, number, number[]][] = [
  [0, 10, 3, [9, 6, 3, 0]],
  [10, 0, -3, [1, 4, 7, 10]],
  [0, 5, I32_MAX, [0]],
  [-7, 9, 5, [8, 3, -2, -7]],
  [0, 9, 3, [9, 6, 3, 0]], // on-grid `to`: unchanged by the fix
  [5, 5, 1, [5]],
  [1, 5, 1, [5, 4, 3, 2, 1]],
  // Max boundary: to = i32::MAX off the grid, found without wrapping.
  [2147483640, I32_MAX, 3, [2147483646, 2147483643, 2147483640]],
  // Min boundary, descending: to = i32::MIN off the grid.
  [-2147483641, I32_MIN, -3, [-2147483647, -2147483644, -2147483641]],
  // Step MIN+1 negates fine; only step MIN traps.
  [0, -2147483647, -2147483647, [-2147483647, 0]],
  // Full int32 span with the maximum step.
  [I32_MIN, I32_MAX, I32_MAX, [2147483646, -1, I32_MIN]],
];

describe("NumberInterval ReversedOffGridKeepsElements", () => {
  it("reverses from the last element actually produced", () => {
    for (const [from, to, step, want] of numberCases) {
      const source = NumberInterval.fromToBy(from, to, step);
      const rev = source.reversed();
      expect(rev.toArray(), `(${from},${to},${step})`).toEqual(want);
      expect(rev.from()).toBe(want[0]);
      expect(rev.to()).toBe(from);
      expect(rev.step()).toBe(-step);
      expect(rev.get(0)).toBe(want[0]);
      expect(rev.get(rev.size - 1)).toBe(from);
    }
  });

  it("has the same size and element set as the source", () => {
    for (const [from, to, step] of numberCases) {
      const source = NumberInterval.fromToBy(from, to, step);
      const rev = source.reversed();
      expect(rev.size).toBe(source.size);
      expect(rev.isEmpty()).toBe(false);
      const probes = [
        from,
        to,
        ...source.toArray(),
        ...source.toArray().map((v) => v + 1),
        ...source.toArray().map((v) => v - 1),
        0,
        I32_MIN,
        I32_MAX,
      ].filter((v) => v >= I32_MIN && v <= I32_MAX);
      for (const v of probes) {
        expect(rev.has(v), `has(${v}) of (${from},${to},${step})`).toBe(
          source.has(v),
        );
      }
    }
  });

  it("reversed twice gives the source sequence, to normalised", () => {
    for (const [from, to, step] of numberCases) {
      const source = NumberInterval.fromToBy(from, to, step);
      const twice = source.reversed().reversed();
      expect(twice.toArray()).toEqual(source.toArray());
      expect(twice.from()).toBe(from);
      expect(twice.step()).toBe(step);
      expect(twice.to()).toBe(source.get(source.size - 1));
    }
    expect(NumberInterval.fromToBy(0, 10, 3).reversed().reversed().to()).toBe(
      9,
    );
  });

  it("still traps at the minimum step before computing anything", () => {
    const min = NumberInterval.fromToBy(0, I32_MIN, I32_MIN);
    expect(() => min.reversed()).toThrow(/minimum step/);
  });
});

// [from, to, step, expected reversed sequence]
const bigintCases: [bigint, bigint, bigint, bigint[]][] = [
  [0n, 10n, 3n, [9n, 6n, 3n, 0n]],
  [10n, 0n, -3n, [1n, 4n, 7n, 10n]],
  [0n, 5n, 2147483647n, [0n]],
  [-7n, 9n, 5n, [8n, 3n, -2n, -7n]],
  [0n, 9n, 3n, [9n, 6n, 3n, 0n]],
  [5n, 5n, 1n, [5n]],
  [1n, 5n, 1n, [5n, 4n, 3n, 2n, 1n]],
  [2147483640n, 2147483647n, 3n, [2147483646n, 2147483643n, 2147483640n]],
  [-2147483641n, -2147483648n, -3n, [-2147483647n, -2147483644n, -2147483641n]],
  // Beyond int32, at and past the i64 edges: exact in bigint, off-grid `to`.
  [
    9223372036854775800n,
    9223372036854775807n,
    3n,
    [9223372036854775806n, 9223372036854775803n, 9223372036854775800n],
  ],
  [2n ** 70n, 2n ** 70n + 10n, 4n, [2n ** 70n + 8n, 2n ** 70n + 4n, 2n ** 70n]],
  [
    -(2n ** 63n) + 7n,
    -(2n ** 63n),
    -3n,
    [-(2n ** 63n) + 1n, -(2n ** 63n) + 4n, -(2n ** 63n) + 7n],
  ],
];

describe("BigIntInterval ReversedOffGridKeepsElements", () => {
  it("reverses from the last element actually produced", () => {
    for (const [from, to, step, want] of bigintCases) {
      const source = BigIntInterval.fromToBy(from, to, step);
      const rev = source.reversed();
      expect(rev.toArray(), `(${from},${to},${step})`).toEqual(want);
      expect(rev.from()).toBe(want[0]);
      expect(rev.to()).toBe(from);
      expect(rev.step()).toBe(-step);
      expect(rev.get(0)).toBe(want[0]);
      expect(rev.get(rev.size - 1)).toBe(from);
    }
  });

  it("has the same size and element set as the source", () => {
    for (const [from, to, step, want] of bigintCases) {
      const source = BigIntInterval.fromToBy(from, to, step);
      const rev = source.reversed();
      expect(rev.size).toBe(source.size);
      expect(rev.isEmpty()).toBe(false);
      const probes = [from, to, ...want, ...want.map((v) => v + 1n), 0n];
      for (const v of probes) {
        expect(rev.has(v), `has(${v}) of (${from},${to},${step})`).toBe(
          source.has(v),
        );
      }
    }
  });

  it("reversed twice gives the source sequence, to normalised", () => {
    for (const [from, to, step, want] of bigintCases) {
      const source = BigIntInterval.fromToBy(from, to, step);
      const twice = source.reversed().reversed();
      expect(twice.from()).toBe(from);
      expect(twice.step()).toBe(step);
      expect(twice.to()).toBe(want[0]);
      expect(twice.toArray()).toEqual(source.toArray());
    }
    expect(
      BigIntInterval.fromToBy(0n, 10n, 3n).reversed().reversed().to(),
    ).toBe(9n);
  });
});
