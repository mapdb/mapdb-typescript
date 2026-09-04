// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Range, BoundType } from "./range.js";
import { RangeSet } from "./range-set.js";

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

// Build a RangeSet from a list of ranges, in order.
function rs(ranges: Range<number>[]): RangeSet<number> {
  const s = new RangeSet<number>();
  s.addAll(ranges);
  return s;
}

// Structural-equality assertion for an asRanges() projection.
function expectRanges(s: RangeSet<number>, expected: Range<number>[]): void {
  const got = s.asRanges();
  expect(got.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(got[i].equals(expected[i])).toBe(true);
  }
}

describe("RangeSet add / coalesce", () => {
  it("coalesces overlapping ranges", () => {
    const s = rs([Range.closed(1, 5), Range.closed(3, 9)]);
    expectRanges(s, [Range.closed(1, 9)]);
    expect(s.contains(4)).toBe(true);
    expect(s.contains(10)).toBe(false);
    expect(s.span()!.equals(Range.closed(1, 9))).toBe(true);
  });

  it("coalesces abutting ranges (cut-touch)", () => {
    // [1,3) & [3,5) touch at Below(3) -> single [1,5).
    const s = rs([Range.closedOpen(1, 3), Range.closedOpen(3, 5)]);
    expectRanges(s, [Range.closedOpen(1, 5)]);
    expect(s.contains(3)).toBe(true);
    expect(s.contains(5)).toBe(false);
    // The merged upper cut is the OUTER one: Below(5) (open).
    expect(s.asRanges()[0].upperBoundType()).toBe(BoundType.Open);
  });

  it("does NOT merge (1,3) & (3,5) — value 3 is the gap", () => {
    const s = rs([Range.open(1, 3), Range.open(3, 5)]);
    expectRanges(s, [Range.open(1, 3), Range.open(3, 5)]);
    expect(s.contains(3)).toBe(false);
  });

  it("does NOT merge [1,3] & [4,5] — no integer-adjacency in the cut model", () => {
    // Below(4) > Above(3); the cut model has no successor reasoning.
    const s = rs([Range.closed(1, 3), Range.closed(4, 5)]);
    expectRanges(s, [Range.closed(1, 3), Range.closed(4, 5)]);
  });

  it("add(emptyRange) is a no-op (both cut-empty forms)", () => {
    const s = new RangeSet<number>();
    s.add(Range.closedOpen(5, 5));
    expect(s.isEmpty()).toBe(true);
    s.add(Range.openClosed(5, 5));
    expect(s.isEmpty()).toBe(true);
    expectRanges(s, []);
  });

  it("add(open(1,2)) STORES a cut-non-empty range with no integer", () => {
    const s = rs([Range.open(1, 2)]);
    expect(s.isEmpty()).toBe(false);
    expectRanges(s, [Range.open(1, 2)]);
    expect(s.contains(1)).toBe(false);
    expect(s.contains(2)).toBe(false);
  });

  it("addAll is order-independent (normal form invariant)", () => {
    const a = rs([
      Range.closed(1, 5),
      Range.closed(4, 11),
      Range.closedOpen(10, 12),
    ]);
    const b = rs([
      Range.closedOpen(10, 12),
      Range.closed(4, 11),
      Range.closed(1, 5),
    ]);
    const av = a.asRanges();
    const bv = b.asRanges();
    expect(av.length).toBe(bv.length);
    for (let i = 0; i < av.length; i++) {
      expect(av[i].equals(bv[i])).toBe(true);
    }
  });
});

describe("RangeSet remove", () => {
  it("splits a straddled range", () => {
    const s = rs([Range.closed(1, 9)]);
    s.remove(Range.closedOpen(4, 7));
    expectRanges(s, [Range.closedOpen(1, 4), Range.closed(7, 9)]);
  });

  it("remove(emptyRange) is a no-op", () => {
    const s = rs([Range.closed(1, 9)]);
    s.remove(Range.closedOpen(5, 5));
    expectRanges(s, [Range.closed(1, 9)]);
  });

  it("abutment alone does not split", () => {
    // remove([5,9)) abuts [1,5) at Below(5) -> no change.
    const s = rs([Range.closedOpen(1, 5)]);
    s.remove(Range.closedOpen(5, 9));
    expectRanges(s, [Range.closedOpen(1, 5)]);
  });
});

describe("RangeSet point queries", () => {
  it("contains / rangeContaining", () => {
    const s = rs([Range.closedOpen(1, 5), Range.closed(8, 9)]);
    expect(s.contains(3)).toBe(true);
    expect(s.contains(6)).toBe(false);
    expect(s.rangeContaining(3)!.equals(Range.closedOpen(1, 5))).toBe(true);
    expect(s.rangeContaining(6)).toBeUndefined();
  });
});

describe("RangeSet encloses / enclosesAll", () => {
  it("encloses is single-range", () => {
    const s = rs([Range.closedOpen(1, 3), Range.closedOpen(5, 9)]);
    // No single stored range encloses [2,6).
    expect(s.encloses(Range.closedOpen(2, 6))).toBe(false);
    expect(s.encloses(Range.closedOpen(1, 2))).toBe(true);
    expect(
      s.enclosesAll([Range.closedOpen(1, 2), Range.closedOpen(5, 8)]),
    ).toBe(true);
    expect(
      s.enclosesAll([Range.closedOpen(1, 2), Range.closedOpen(2, 6)]),
    ).toBe(false);
  });
});

describe("RangeSet intersects (cut algebra)", () => {
  it("cut-non-empty overlap -> true; cut-empty / abut -> false", () => {
    const s = rs([Range.closedOpen(1, 3), Range.closedOpen(5, 9)]);
    expect(s.intersects(Range.closedOpen(2, 6))).toBe(true);
    // cut-empty query -> false.
    expect(s.intersects(Range.closedOpen(5, 5))).toBe(false);
    // abutment -> false ([3,5) abuts [5,9) at Below(5)).
    const s2 = rs([Range.closedOpen(5, 9)]);
    expect(s2.intersects(Range.closedOpen(3, 5))).toBe(false);
  });

  it("intersects(open(1,2)) vs stored (1,2) is TRUE (cut-non-empty, no i32)", () => {
    const s = rs([Range.open(1, 2)]);
    expect(s.intersects(Range.open(1, 2))).toBe(true);
  });
});

describe("RangeSet complement", () => {
  it("basic: {[1,5]} -> {(-inf,1), (5,+inf)} with boundary flip", () => {
    const c = rs([Range.closed(1, 5)]).complement();
    expectRanges(c, [Range.lessThan(1), Range.greaterThan(5)]);
  });

  it("complement({all()}) is empty", () => {
    expect(rs([Range.all()]).complement().isEmpty()).toBe(true);
  });

  it("complement({}) is {all()}", () => {
    const c = new RangeSet<number>().complement();
    expectRanges(c, [Range.all()]);
  });

  it("complement(lessThan(10)) = {[10,+inf)} — no spurious leading gap", () => {
    const c = rs([Range.lessThan(10)]).complement();
    expectRanges(c, [Range.atLeast(10)]);
  });

  it("complement is an involution over fixed sets", () => {
    const cases: Range<number>[][] = [
      [Range.closed(1, 5)],
      [Range.open(1, 3), Range.open(3, 5)],
      [Range.lessThan(10)],
      [Range.closed(INT_MIN, 0), Range.openClosed(0, INT_MAX)],
      [],
      [Range.all()],
    ];
    for (const ranges of cases) {
      const s = rs(ranges);
      const cc = s.complement().complement();
      const a = s.asRanges();
      const b = cc.asRanges();
      expect(b.length).toBe(a.length);
      for (let i = 0; i < a.length; i++) {
        expect(b[i].equals(a[i])).toBe(true);
      }
    }
  });
});

describe("RangeSet subRangeSet (snapshot, clipped)", () => {
  it("clips stored ranges to the view", () => {
    const s = rs([Range.closedOpen(1, 5), Range.closed(8, 9)]);
    const sub = s.subRangeSet(Range.closedOpen(3, 6));
    expectRanges(sub, [Range.closedOpen(3, 5)]);
  });

  it("is an independent snapshot — mutating it does not touch the parent", () => {
    const s = rs([Range.closedOpen(1, 5)]);
    const sub = s.subRangeSet(Range.closedOpen(2, 4));
    sub.add(Range.closed(100, 200));
    expectRanges(s, [Range.closedOpen(1, 5)]);
  });

  it("complement is an independent snapshot too", () => {
    const s = rs([Range.closed(1, 5)]);
    const c = s.complement();
    c.clear();
    expectRanges(s, [Range.closed(1, 5)]);
  });
});

describe("RangeSet signed extremes (no ±1)", () => {
  it("coalesces [MIN,0] & (0,MAX] at Above(0); complement flanks the edges", () => {
    const s = new RangeSet<number>();
    s.add(Range.closed(INT_MIN, 0));
    s.add(Range.openClosed(0, INT_MAX));
    // [MIN,0] and (0,MAX] abut at Above(0) -> coalesce to [MIN, MAX].
    expectRanges(s, [Range.closed(INT_MIN, INT_MAX)]);
    expect(s.contains(INT_MIN)).toBe(true);
    expect(s.contains(INT_MAX)).toBe(true);
    expect(s.span()!.equals(Range.closed(INT_MIN, INT_MAX))).toBe(true);
    // [MIN,MAX] is NOT all() — its complement is the two flanking gaps.
    expectRanges(s.complement(), [
      Range.lessThan(INT_MIN),
      Range.greaterThan(INT_MAX),
    ]);
    // all() over the whole domain DOES complement to empty.
    const whole = rs([Range.all()]);
    expect(whole.complement().isEmpty()).toBe(true);
  });
});

describe("RangeSet clear / span / isEmpty", () => {
  it("clear empties the set", () => {
    const s = rs([Range.closed(1, 9)]);
    s.clear();
    expect(s.isEmpty()).toBe(true);
    expectRanges(s, []);
  });

  it("span() is undefined on empty", () => {
    expect(new RangeSet<number>().span()).toBeUndefined();
  });
});

describe("RangeSet normal-form invariant", () => {
  it("after a deterministic op sequence: ascending, pairwise non-connected, non-empty", () => {
    const s = new RangeSet<number>();
    for (const r of [
      Range.closed(1, 5),
      Range.closedOpen(10, 12),
      Range.closedOpen(12, 15),
      Range.open(20, 25),
      Range.closed(4, 11),
    ]) {
      s.add(r);
    }
    const v = s.asRanges();
    for (let i = 0; i + 1 < v.length; i++) {
      // ascending by lower cut (compareCutsNumeric < 0).
      expect(
        Range.compareCutsNumeric(v[i].lowerCut(), v[i + 1].lowerCut()),
      ).toBeLessThan(0);
      // pairwise non-connected (maximally merged).
      expect(v[i].isConnected(v[i + 1])).toBe(false);
    }
    expect(v.every((r) => !r.isEmpty())).toBe(true);
  });
});

describe("RangeSet add coalesces chains (single ascending pass)", () => {
  it("add coalesces whole run from either direction", () => {
    // Ascending: [1,2),[2,3),[3,4) — each add merges as it lands.
    const asc = rs([
      Range.closedOpen(1, 2),
      Range.closedOpen(2, 3),
      Range.closedOpen(3, 4),
    ]);
    expectRanges(asc, [Range.closedOpen(1, 4)]);
    // Same three, the leftmost slot added last: [1,2) bridges nothing on the
    // left and the already-merged [2,4) on the right — identical result.
    const last = rs([
      Range.closedOpen(2, 3),
      Range.closedOpen(3, 4),
      Range.closedOpen(1, 2),
    ]);
    expectRanges(last, [Range.closedOpen(1, 4)]);
    // A middle add bridges BOTH sides in one pass.
    const s = rs([Range.closedOpen(1, 3), Range.closedOpen(5, 7)]);
    expect(s.asRanges().length).toBe(2);
    s.add(Range.closedOpen(3, 5));
    expectRanges(s, [Range.closedOpen(1, 7)]);
  });

  it("add rejoins fragments left behind by remove", () => {
    const s = rs([Range.closedOpen(0, 10)]);
    s.remove(Range.closedOpen(3, 7));
    expectRanges(s, [Range.closedOpen(0, 3), Range.closedOpen(7, 10)]);
    s.add(Range.closedOpen(3, 7));
    expectRanges(s, [Range.closedOpen(0, 10)]);
  });
});

describe("RangeSet point-query i32 validation (v1)", () => {
  it("contains / rangeContaining reject non-i32 query points", () => {
    const s = new RangeSet<number>();
    s.add(Range.open(1, 5));
    expect(() => s.contains(2.5)).toThrow(RangeError);
    expect(() => s.rangeContaining(2.5)).toThrow(RangeError);
    expect(() => s.contains(NaN)).toThrow(RangeError);
    // valid i32 points still answer
    expect(s.contains(3)).toBe(true);
    expect(s.rangeContaining(3)).toBeDefined();
  });
});
