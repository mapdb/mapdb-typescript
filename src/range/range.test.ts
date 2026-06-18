// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Range, BoundType } from "./range.js";

describe("Range contains", () => {
  it("closed", () => {
    const r = Range.closed(10, 20);
    expect(r.contains(10)).toBe(true);
    expect(r.contains(15)).toBe(true);
    expect(r.contains(20)).toBe(true);
    expect(r.contains(9)).toBe(false);
    expect(r.contains(21)).toBe(false);
  });

  it("open", () => {
    const r = Range.open(10, 20);
    expect(r.contains(10)).toBe(false);
    expect(r.contains(20)).toBe(false);
    expect(r.contains(11)).toBe(true);
    expect(r.contains(19)).toBe(true);
  });

  it("half-open", () => {
    const co = Range.closedOpen(10, 20);
    expect(co.contains(10)).toBe(true);
    expect(co.contains(20)).toBe(false);
    const oc = Range.openClosed(10, 20);
    expect(oc.contains(10)).toBe(false);
    expect(oc.contains(20)).toBe(true);
  });

  it("unbounded", () => {
    const all = Range.all();
    expect(all.contains(-2147483648)).toBe(true);
    expect(all.contains(0)).toBe(true);
    expect(all.contains(2147483647)).toBe(true);

    const al = Range.atLeast(10);
    expect(al.contains(10)).toBe(true);
    expect(al.contains(9)).toBe(false);

    const gt = Range.greaterThan(10);
    expect(gt.contains(10)).toBe(false);
    expect(gt.contains(11)).toBe(true);

    const lt = Range.lessThan(5);
    expect(lt.contains(4)).toBe(true);
    expect(lt.contains(5)).toBe(false);

    const am = Range.atMost(5);
    expect(am.contains(5)).toBe(true);
    expect(am.contains(6)).toBe(false);
  });
});

describe("Range bound types / endpoints", () => {
  it("half-open finite endpoints", () => {
    const r = Range.closedOpen(10, 20);
    expect(r.lowerBoundType()).toBe(BoundType.Closed);
    expect(r.upperBoundType()).toBe(BoundType.Open);
    expect(r.lowerEndpoint()).toBe(10);
    expect(r.upperEndpoint()).toBe(20);
    expect(r.hasLowerBound()).toBe(true);
    expect(r.hasUpperBound()).toBe(true);
  });

  it("all() is unbounded both sides", () => {
    const all = Range.all();
    expect(all.lowerBoundType()).toBeNull();
    expect(all.upperBoundType()).toBeNull();
    expect(all.lowerEndpoint()).toBeNull();
    expect(all.upperEndpoint()).toBeNull();
    expect(all.hasLowerBound()).toBe(false);
    expect(all.hasUpperBound()).toBe(false);
  });
});

describe("Range emptiness (cut-empty)", () => {
  it("open(1,2) is NOT empty (no DiscreteDomain), contains no integer", () => {
    const o = Range.open(1, 2);
    expect(o.isEmpty()).toBe(false);
    expect(o.contains(1)).toBe(false);
    expect(o.contains(2)).toBe(false);
  });

  it("closedOpen(v,v) and openClosed(v,v) both empty but DISTINCT", () => {
    const co = Range.closedOpen(5, 5);
    const oc = Range.openClosed(5, 5);
    expect(co.isEmpty()).toBe(true);
    expect(oc.isEmpty()).toBe(true);
    expect(co.equals(oc)).toBe(false);
    expect(co.contains(5)).toBe(false);
    expect(oc.contains(5)).toBe(false);
    expect(co.lowerBoundType()).toBe(BoundType.Closed);
    expect(co.upperBoundType()).toBe(BoundType.Open);
    expect(oc.lowerBoundType()).toBe(BoundType.Open);
    expect(oc.upperBoundType()).toBe(BoundType.Closed);
    // distinct hashes (consistent with structural inequality)
    expect(co.hashCode()).not.toBe(oc.hashCode());
  });

  it("empties at different positions are unequal", () => {
    expect(Range.closedOpen(5, 5).equals(Range.closedOpen(6, 6))).toBe(false);
  });

  it("singleton(v) is not empty", () => {
    const s = Range.singleton(5);
    expect(s.isEmpty()).toBe(false);
    expect(s.contains(5)).toBe(true);
    expect(s.contains(4)).toBe(false);
    expect(s.contains(6)).toBe(false);
  });

  it("unbounded ranges are never empty", () => {
    expect(Range.all().isEmpty()).toBe(false);
    expect(Range.atLeast(0).isEmpty()).toBe(false);
    expect(Range.atMost(0).isEmpty()).toBe(false);
    expect(Range.greaterThan(0).isEmpty()).toBe(false);
    expect(Range.lessThan(0).isEmpty()).toBe(false);
  });
});

describe("Range encloses (cut-defined)", () => {
  it("basic enclosure", () => {
    const big = Range.closed(10, 30);
    expect(big.encloses(Range.closed(15, 25))).toBe(true);
    expect(big.encloses(Range.closed(5, 25))).toBe(false);
    expect(big.encloses(Range.closedOpen(20, 20))).toBe(true);
  });

  it("[1,5) encloses empty@5 though 5 not contained", () => {
    const half = Range.closedOpen(1, 5);
    expect(half.encloses(Range.closedOpen(5, 5))).toBe(true);
    expect(half.contains(5)).toBe(false);
  });
});

describe("Range isConnected / intersection", () => {
  it("overlap -> present non-empty", () => {
    const a = Range.closed(10, 20);
    const b = Range.closed(15, 25);
    expect(a.isConnected(b)).toBe(true);
    const i = a.intersection(b)!;
    expect(i).not.toBeNull();
    expect(i.isEmpty()).toBe(false);
    expect(i.equals(Range.closed(15, 20))).toBe(true);
  });

  it("abut closedOpen -> present cut-empty (Below20,Below20)", () => {
    const a = Range.closedOpen(10, 20);
    const b = Range.closedOpen(20, 30);
    expect(a.isConnected(b)).toBe(true);
    const i = a.intersection(b)!;
    expect(i.isEmpty()).toBe(true);
    expect(i.equals(Range.closedOpen(20, 20))).toBe(true);
    expect(i.lowerBoundType()).toBe(BoundType.Closed);
    expect(i.upperBoundType()).toBe(BoundType.Open);
  });

  it("abut open/closed -> present cut-empty (Above20,Above20)", () => {
    const a = Range.closed(10, 20);
    const b = Range.open(20, 30);
    expect(a.isConnected(b)).toBe(true);
    const i = a.intersection(b)!;
    expect(i.isEmpty()).toBe(true);
    expect(i.equals(Range.openClosed(20, 20))).toBe(true);
    expect(i.lowerBoundType()).toBe(BoundType.Open);
    expect(i.upperBoundType()).toBe(BoundType.Closed);
  });

  it("disjoint -> null (not present-empty)", () => {
    const a = Range.closedOpen(10, 15);
    const b = Range.closedOpen(20, 25);
    expect(a.isConnected(b)).toBe(false);
    expect(a.intersection(b)).toBeNull();
  });

  it("lessThan(5) & atLeast(5) -> connected, present empty", () => {
    const a = Range.lessThan(5);
    const b = Range.atLeast(5);
    expect(a.isConnected(b)).toBe(true);
    const i = a.intersection(b)!;
    expect(i.isEmpty()).toBe(true);
    expect(i.equals(Range.closedOpen(5, 5))).toBe(true);
  });

  it("lessThan(5) & greaterThan(5) -> DISCONNECTED (5 is the gap)", () => {
    const a = Range.lessThan(5);
    const b = Range.greaterThan(5);
    expect(a.isConnected(b)).toBe(false);
    expect(a.intersection(b)).toBeNull();
  });
});

describe("Range span", () => {
  it("disjoint span", () => {
    const s = Range.closed(10, 15).span(Range.closed(20, 25));
    expect(s.equals(Range.closed(10, 25))).toBe(true);
    expect(s.lowerEndpoint()).toBe(10);
    expect(s.upperEndpoint()).toBe(25);
    expect(s.lowerBoundType()).toBe(BoundType.Closed);
    expect(s.upperBoundType()).toBe(BoundType.Closed);
  });

  it("unbounded span", () => {
    const s = Range.atLeast(10).span(Range.closed(0, 5));
    expect(s.equals(Range.atLeast(0))).toBe(true);
    expect(s.lowerEndpoint()).toBe(0);
    expect(s.upperEndpoint()).toBeNull();
    expect(s.lowerBoundType()).toBe(BoundType.Closed);
    expect(s.upperBoundType()).toBeNull();
  });
});

describe("Range bad-order constructors throw", () => {
  it("closed(5,1) throws RangeError", () => {
    expect(() => Range.closed(5, 1)).toThrow(RangeError);
  });

  it("open(3,3) throws RangeError", () => {
    expect(() => Range.open(3, 3)).toThrow(RangeError);
  });

  it("closedOpen(5,1) throws RangeError", () => {
    expect(() => Range.closedOpen(5, 1)).toThrow(RangeError);
  });
});

describe("Range equals / hash", () => {
  it("structural equality and consistent hash", () => {
    expect(Range.closed(1, 5).equals(Range.closed(1, 5))).toBe(true);
    expect(Range.closed(1, 5).hashCode()).toBe(Range.closed(1, 5).hashCode());
    expect(Range.closed(1, 5).equals(Range.closedOpen(1, 5))).toBe(false);
  });
});

describe("Range toString", () => {
  it("renders Guava-style notation", () => {
    expect(Range.closed(1, 5).toString()).toBe("[1, 5]");
    expect(Range.open(1, 5).toString()).toBe("(1, 5)");
    expect(Range.closedOpen(1, 5).toString()).toBe("[1, 5)");
    expect(Range.atLeast(1).toString()).toBe("[1, +∞)");
    expect(Range.lessThan(5).toString()).toBe("(-∞, 5)");
    expect(Range.all().toString()).toBe("(-∞, +∞)");
  });
});
