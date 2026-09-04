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

  it("put COALESCES equal abutting values", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closedOpen(5, 9), 100);
    // ONE entry: equal value and abutting, so plain put merges them.
    // Guava's TreeRangeMap leaves two here; this is the divergence.
    expectEntries(m, [[Range.closedOpen(1, 9), 100]]);
    expect(m.get(5)).toBe(100);
  });

  it("put(emptyRange) is a no-op", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(5, 5), 100);
    expect(m.isEmpty()).toBe(true);
    expectEntries(m, []);
  });

  it("put cut-empty range at an abutment is a no-op", () => {
    // The empty check runs BEFORE clipping and coalescing: a cut-empty range
    // sitting exactly on the [1,5)/[5,9) seam must neither clip nor merge.
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closedOpen(5, 9), 200);
    const expected: [Range<number>, number][] = [
      [Range.closedOpen(1, 5), 100],
      [Range.closedOpen(5, 9), 200],
    ];
    m.put(Range.closedOpen(5, 5), 100); // (Below(5), Below(5))
    expectEntries(m, expected);
    m.put(Range.openClosed(5, 5), 200); // (Above(5), Above(5))
    expectEntries(m, expected);
    m.put(Range.closedOpen(3, 3), 999); // inside an entry, foreign value
    expectEntries(m, expected);
  });
});

describe("RangeMap put coalescing (equal-value merge)", () => {
  it("does NOT merge a different-valued neighbour", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closedOpen(5, 9), 200);
    expectEntries(m, [
      [Range.closedOpen(1, 5), 100],
      [Range.closedOpen(5, 9), 200],
    ]);
  });

  it("merges on BOTH sides (bridges two equal-valued entries)", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 5), 100);
    m.put(Range.closedOpen(9, 12), 100);
    m.put(Range.closedOpen(5, 9), 100);
    expectEntries(m, [[Range.closedOpen(1, 12), 100]]);
  });

  it("a chain never forms — each put merges as it lands", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 2), 7);
    m.put(Range.closedOpen(2, 3), 7);
    expectEntries(m, [[Range.closedOpen(1, 3), 7]]);
    m.put(Range.closedOpen(3, 4), 7);
    expectEntries(m, [[Range.closedOpen(1, 4), 7]]);
  });

  it("is order-independent (mirror of the chain case)", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(2, 3), 7);
    m.put(Range.closedOpen(3, 4), 7);
    m.put(Range.closedOpen(1, 2), 7);
    expectEntries(m, [[Range.closedOpen(1, 4), 7]]);
  });

  it("a different value is a hard barrier, never absorbed or crossed", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 2), 7);
    m.put(Range.closedOpen(2, 3), 8);
    m.put(Range.closedOpen(3, 4), 7);
    expectEntries(m, [
      [Range.closedOpen(1, 2), 7],
      [Range.closedOpen(2, 3), 8],
      [Range.closedOpen(3, 4), 7],
    ]);
  });

  it("split fragments do not rejoin across the inserted entry", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 9), 100);
    m.put(Range.closedOpen(3, 5), 200);
    expectEntries(m, [
      [Range.closedOpen(1, 3), 100],
      [Range.closedOpen(3, 5), 200],
      [Range.closedOpen(5, 9), 100],
    ]);
  });

  it("normal form: no two connected entries hold an equal value", () => {
    // The global invariant the old put/putCoalescing split could not state.
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(1, 2), 7);
    m.put(Range.closedOpen(2, 3), 7);
    m.put(Range.closedOpen(3, 4), 8);
    m.put(Range.closedOpen(4, 5), 8);
    m.put(Range.closedOpen(5, 6), 7);
    const v = m.asMapOfRanges();
    for (let i = 0; i + 1 < v.length; i++) {
      expect(v[i][0].isConnected(v[i + 1][0]) && v[i][1] === v[i + 1][1]).toBe(
        false,
      );
    }
    expectEntries(m, [
      [Range.closedOpen(1, 3), 7],
      [Range.closedOpen(3, 5), 8],
      [Range.closedOpen(5, 6), 7],
    ]);
  });

  it("put unbounded chains on both sides collapse to all", () => {
    // The ONLY unbounded-range coalescing case in the family: the BelowAll /
    // AboveAll sentinels must merge like any other cut.
    const m = new RangeMap<number, number>();
    m.put(Range.lessThan(-5), 7);
    m.put(Range.closedOpen(-5, 0), 7);
    m.put(Range.closedOpen(5, 10), 7);
    m.put(Range.atLeast(10), 7);
    // Each pair merged as it landed; the [0,5) gap keeps them apart.
    expectEntries(m, [
      [Range.lessThan(0), 7],
      [Range.atLeast(5), 7],
    ]);
    m.put(Range.closedOpen(0, 5), 7);
    expectEntries(m, [[Range.all(), 7]]);
    expect(m.get(INT_MIN)).toBe(7);
    expect(m.get(0)).toBe(7);
    expect(m.get(INT_MAX)).toBe(7);
  });

  it("put rejoins clipped fragment and chain beyond it", () => {
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(0, 10), 7);
    m.put(Range.closedOpen(10, 12), 9);
    // [6,11) clips [0,10) down to [0,6) and [10,12) down to [11,12); the
    // surviving equal-valued fragment on the left rejoins, the 9 does not.
    m.put(Range.closedOpen(6, 11), 7);
    expectEntries(m, [
      [Range.closedOpen(0, 11), 7],
      [Range.closedOpen(11, 12), 9],
    ]);
    expect(m.get(0)).toBe(7);
    expect(m.get(10)).toBe(7);
    expect(m.get(11)).toBe(9);
  });

  it("put rejoins both clip fragments of a straddled equal entry", () => {
    // An equal-valued put INSIDE an entry splits it and immediately rejoins
    // both fragments: the map is unchanged.
    const m = new RangeMap<number, number>();
    m.put(Range.closedOpen(0, 20), 7);
    m.put(Range.closedOpen(6, 14), 7);
    expectEntries(m, [[Range.closedOpen(0, 20), 7]]);
    // With different-valued flanks, the flanks are barriers and the rejoined
    // middle stops exactly where it started.
    const n = new RangeMap<number, number>();
    n.put(Range.closedOpen(0, 2), 1);
    n.put(Range.closedOpen(2, 18), 7);
    n.put(Range.closedOpen(18, 20), 1);
    n.put(Range.closedOpen(6, 14), 7);
    expectEntries(n, [
      [Range.closedOpen(0, 2), 1],
      [Range.closedOpen(2, 18), 7],
      [Range.closedOpen(18, 20), 1],
    ]);
  });
});

describe("RangeMap no-integer ranges (cut-non-empty, no i32 inside)", () => {
  it("a no-integer range is a stored barrier", () => {
    // open(1,2) holds no i32 but is cut-non-empty, so it is stored and it
    // splits all()->1 at exactly Above(1) / Below(2). An integer-point oracle
    // cannot see this entry; pin it structurally.
    const m = new RangeMap<number, number>();
    m.put(Range.all(), 1);
    m.put(Range.open(1, 2), 2);
    expectEntries(m, [
      [Range.atMost(1), 1],
      [Range.open(1, 2), 2],
      [Range.atLeast(2), 1],
    ]);
    // Removing it leaves the two fragments apart: they are not connected
    // (Above(1) < Below(2)), so they must NOT rejoin.
    m.remove(Range.open(1, 2));
    expectEntries(m, [
      [Range.atMost(1), 1],
      [Range.atLeast(2), 1],
    ]);
  });
});

describe("RangeMap put/remove vs dense oracle", () => {
  // Domain of integer points checked after every op. Endpoints are drawn from
  // a narrower band so unbounded draws and the domain edges are covered by
  // the sentinels rather than by chance.
  const DOMAIN_LO = -12;
  const DOMAIN_HI = 12;
  const ENDPOINT_LO = -8;
  const ENDPOINT_HI = 8;
  const VALUES = [1, 2, 3];

  // Tiny deterministic 32-bit xorshift; no dependency, seed reproducible.
  function xorshift(seed: number): () => number {
    let x = seed >>> 0 || 0x9e3779b9;
    return () => {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return x;
    };
  }

  // Random range over the endpoint band: the four bounded kinds plus the five
  // unbounded forms. Cut-empty draws ([a,a) / (a,a]) are let through — they
  // must be no-ops. `open(a,a)` throws by contract, so open draws force a<b.
  function randomRange(next: () => number): Range<number> {
    const span = ENDPOINT_HI - ENDPOINT_LO + 1;
    const p = ENDPOINT_LO + (next() % span);
    const q = ENDPOINT_LO + (next() % span);
    const lo = Math.min(p, q);
    const hi = Math.max(p, q);
    switch (next() % 9) {
      case 0:
        return Range.closed(lo, hi);
      case 1:
        return lo === hi ? Range.singleton(lo) : Range.open(lo, hi);
      case 2:
        return Range.closedOpen(lo, hi);
      case 3:
        return Range.openClosed(lo, hi);
      case 4:
        return Range.lessThan(p);
      case 5:
        return Range.atMost(p);
      case 6:
        return Range.greaterThan(p);
      case 7:
        return Range.atLeast(p);
      default:
        return Range.all();
    }
  }

  // Structural check of the normal form over asMapOfRanges(): ascending by
  // lower cut, cut-non-empty, pairwise disjoint, and no two connected
  // consecutive entries hold an equal value.
  function expectNormalForm(m: RangeMap<number, number>, ctx: string): void {
    const v = m.asMapOfRanges();
    for (const [r] of v) expect(r.isEmpty(), `${ctx} empty entry`).toBe(false);
    for (let i = 0; i + 1 < v.length; i++) {
      const [a, av] = v[i];
      const [b, bv] = v[i + 1];
      const pair = `${ctx} entries ${i},${i + 1}`;
      expect(
        Range.compareCutsNumeric(a.lowerCut(), b.lowerCut()),
        `${pair} not ascending`,
      ).toBeLessThan(0);
      expect(
        a.intersection(b) === null || a.intersection(b)!.isEmpty(),
        `${pair} overlap`,
      ).toBe(true);
      expect(a.isConnected(b) && av === bv, `${pair} connected equal`).toBe(
        false,
      );
    }
  }

  function runOracle(seed: number, ops: number): void {
    const next = xorshift(seed);
    const m = new RangeMap<number, number>();
    const oracle: (number | undefined)[] = [];
    for (let p = DOMAIN_LO; p <= DOMAIN_HI; p++) oracle.push(undefined);
    const idx = (p: number) => p - DOMAIN_LO;

    for (let op = 0; op < ops; op++) {
      const r = randomRange(next);
      const isPut = next() % 10 < 7;
      let ctx = `seed=${seed} op=${op}`;
      if (isPut) {
        const value = VALUES[next() % VALUES.length];
        ctx += ` put(${r.toString()},${value})`;
        m.put(r, value);
        for (let p = DOMAIN_LO; p <= DOMAIN_HI; p++) {
          if (r.contains(p)) oracle[idx(p)] = value;
        }
      } else {
        ctx += ` remove(${r.toString()})`;
        m.remove(r);
        for (let p = DOMAIN_LO; p <= DOMAIN_HI; p++) {
          if (r.contains(p)) oracle[idx(p)] = undefined;
        }
      }

      // (a) get, (b) getEntry, per point.
      for (let p = DOMAIN_LO; p <= DOMAIN_HI; p++) {
        const want = oracle[idx(p)];
        const at = `${ctx} p=${p}`;
        expect(m.get(p), `${at} get`).toBe(want);
        const e = m.getEntry(p);
        if (want === undefined) {
          expect(e, `${at} getEntry`).toBeUndefined();
        } else {
          expect(e, `${at} getEntry`).toBeDefined();
          expect(e![0].contains(p), `${at} getEntry range`).toBe(true);
          expect(e![1], `${at} getEntry value`).toBe(want);
        }
      }
      // (c) normal form.
      expectNormalForm(m, ctx);
      // (d) the entries reconstruct the oracle exactly.
      const rebuilt: (number | undefined)[] = oracle.map(() => undefined);
      for (const [range, value] of m.asMapOfRanges()) {
        for (let p = DOMAIN_LO; p <= DOMAIN_HI; p++) {
          if (range.contains(p)) {
            // disjointness, again
            expect(
              rebuilt[idx(p)],
              `${ctx} p=${p} double cover`,
            ).toBeUndefined();
            rebuilt[idx(p)] = value;
          }
        }
      }
      expect(rebuilt, `${ctx} reconstruction`).toEqual(oracle);
    }
  }

  it("random put/remove sequence matches the oracle after every op (3 seeds x 400 ops)", () => {
    for (const seed of [0x1234567, 0x2468ace, 0x7fffffff]) {
      runOracle(seed, 400);
    }
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

  it("remove of an unbounded range clips to the exact sentinel cut", () => {
    // The surviving fragment starts at the removed range's upper cut, with
    // the bound type flipped: Below(0) -> [0,+inf), Above(0) -> (0,+inf).
    const m = new RangeMap<number, number>();
    m.put(Range.all(), 1);
    m.remove(Range.lessThan(0));
    expectEntries(m, [[Range.atLeast(0), 1]]);
    const n = new RangeMap<number, number>();
    n.put(Range.all(), 1);
    n.remove(Range.atMost(0));
    expectEntries(n, [[Range.greaterThan(0), 1]]);
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
