// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Range } from "./range.js";
import { RangeMap } from "./range-map.js";

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

// Structural-equality assertion for an asMapOfRanges() projection.
function expectEntries(
  m: RangeMap<number, number>,
  expected: [Range<number>, number][],
): void {
  const got = m.asMapOfRanges();
  expect(got.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(got[i][0].equals(expected[i][0])).toBe(true);
    expect(got[i][1]).toBe(expected[i][1]);
  }
}

describe("RangeMap put (last-writer-wins, no coalesce)", () => {
  it("basic disjoint puts", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closed(8, 9), 200);
    expectEntries(m, [
      [Range.closedOpen(1, 5), 100],
      [Range.closed(8, 9), 200],
    ]);
    expect(m.get(3)).toBe(100);
    expect(m.get(6)).toBeUndefined();
    expect(m.get(8)).toBe(200);
  });

  it("overwrite clips the earlier entry", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closedOpen(3, 9), 200);
    expectEntries(m, [
      [Range.closedOpen(1, 3), 100],
      [Range.closedOpen(3, 9), 200],
    ]);
    expect(m.get(2)).toBe(100);
    expect(m.get(4)).toBe(200);
    expect(m.get(8)).toBe(200);
  });

  it("a straddled entry SPLITS into two fragments", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 9), 100);
    m.put(Range.closedOpen(3, 5), 200);
    expectEntries(m, [
      [Range.closedOpen(1, 3), 100],
      [Range.closedOpen(3, 5), 200],
      [Range.closedOpen(5, 9), 100],
    ]);
    expect(m.get(2)).toBe(100);
    expect(m.get(4)).toBe(200);
    expect(m.get(6)).toBe(100);
  });

  it("put does NOT coalesce equal abutting values", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closedOpen(5, 9), 100);
    // TWO entries, equal value, NOT merged.
    expectEntries(m, [
      [Range.closedOpen(1, 5), 100],
      [Range.closedOpen(5, 9), 100],
    ]);
    expect(m.get(5)).toBe(100);
  });

  it("put(emptyRange) is a no-op", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(5, 5), 100);
    expect(m.isEmpty()).toBe(true);
    expectEntries(m, []);
  });
});

describe("RangeMap putCoalescing (equal-value merge)", () => {
  it("merges an equal-valued abutting neighbour", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.putCoalescing(Range.closedOpen(5, 9), 100);
    expectEntries(m, [[Range.closedOpen(1, 9), 100]]);
  });

  it("does NOT merge a different-valued neighbour (same as plain put)", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.putCoalescing(Range.closedOpen(5, 9), 200);
    expectEntries(m, [
      [Range.closedOpen(1, 5), 100],
      [Range.closedOpen(5, 9), 200],
    ]);
  });

  it("merges on BOTH sides (bridges two equal-valued entries)", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closedOpen(9, 12), 100);
    m.putCoalescing(Range.closedOpen(5, 9), 100);
    expectEntries(m, [[Range.closedOpen(1, 12), 100]]);
  });

  it("putCoalescing(emptyRange) is a no-op", () => {
    const m = new RangeMap<number, number>();
    m.putCoalescing(Range.closedOpen(5, 5), 100);
    expect(m.isEmpty()).toBe(true);
  });
});

describe("RangeMap remove (split)", () => {
  it("splits a straddled entry, both fragments keep the value", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 9), 100);
    m.remove(Range.closedOpen(4, 7));
    expectEntries(m, [
      [Range.closedOpen(1, 4), 100],
      [Range.closedOpen(7, 9), 100],
    ]);
    expect(m.get(5)).toBeUndefined();
  });

  it("remove(emptyRange) is a no-op", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 9), 100);
    m.remove(Range.closedOpen(5, 5));
    expectEntries(m, [[Range.closedOpen(1, 9), 100]]);
  });
});

describe("RangeMap getEntry / span", () => {
  it("getEntry returns the covering (range, value)", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    const e = m.getEntry(3);
    expect(e).toBeDefined();
    expect(e![0].equals(Range.closedOpen(1, 5))).toBe(true);
    expect(e![1]).toBe(100);
    expect(m.getEntry(6)).toBeUndefined();
  });

  it("span over all entries; undefined on empty", () => {
    const m = new RangeMap<number, number>();
    expect(m.span()).toBeUndefined();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closed(8, 9), 200);
    // span lower = Below(1) (closed 1), upper = Above(9) (closed 9) => [1,9].
    expect(m.span()!.equals(Range.closed(1, 9))).toBe(true);
    expect(m.span()!.lowerEndpoint()).toBe(1);
    expect(m.span()!.upperEndpoint()).toBe(9);
  });
});

describe("RangeMap subRangeMap (snapshot, clipped)", () => {
  it("clips entries to the view", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closed(8, 9), 200);
    const sub = m.subRangeMap(Range.closedOpen(3, 6));
    expectEntries(sub, [[Range.closedOpen(3, 5), 100]]);
  });

  it("is an independent snapshot — mutating it does not touch the parent", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    const sub = m.subRangeMap(Range.closedOpen(2, 4));
    sub.put(Range.closed(100, 200), 999);
    sub.clear();
    expectEntries(m, [[Range.closedOpen(1, 5), 100]]);
  });
});

describe("RangeMap signed extremes (no ±1)", () => {
  it("puts spanning INT_MIN/INT_MAX resolve without overflow", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(INT_MIN, 0), 1);
    m.put(Range.closed(0, INT_MAX), 2);
    expect(m.get(INT_MIN)).toBe(1);
    expect(m.get(0)).toBe(2);
    expect(m.get(INT_MAX)).toBe(2);
  });
});

describe("RangeMap clear / isEmpty", () => {
  it("clear empties the map", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 9), 100);
    m.clear();
    expect(m.isEmpty()).toBe(true);
    expectEntries(m, []);
  });
});

describe("RangeMap point-query i32 validation (v1)", () => {
  it("get / getEntry reject non-i32 query points", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(0, 10), 100);
    expect(() => m.get(2.5)).toThrow(RangeError);
    expect(() => m.getEntry(2.5)).toThrow(RangeError);
    expect(() => m.get(NaN)).toThrow(RangeError);
    // valid i32 points still answer
    expect(m.get(3)).toBe(100);
    expect(m.getEntry(3)).toBeDefined();
  });
});
