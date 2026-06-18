// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import {
  NumberNumberTreeMap,
  NumberNumberTreeMapSink,
} from "./treemap/number-number-tree-map.js";
import { BigIntBigIntTreeMap } from "./treemap/bigint-bigint-tree-map.js";
import { NumberTreeSet, NumberTreeSetSink } from "./treeset/number-tree-set.js";
import { BigIntTreeSet } from "./treeset/bigint-tree-set.js";
import { NumberTreeBag, NumberTreeBagSink } from "./treebag/number-tree-bag.js";
import { BigIntTreeBag } from "./treebag/bigint-tree-bag.js";
import {
  PumpNotSortedError,
  PumpDuplicateError,
  PUMP_BLACK,
  PUMP_RED,
} from "./internal/pump.js";

// --- RB validity via reflection into the (private) root --------------------

interface AnyNode {
  left: AnyNode | null;
  right: AnyNode | null;
  parent: AnyNode | null;
  color: boolean;
}

function rootOf(coll: unknown): AnyNode | null {
  return (coll as { root: AnyNode | null }).root;
}

function checkRb(node: AnyNode | null, parent: AnyNode | null): number {
  if (node === null) return 1;
  expect(node.parent).toBe(parent);
  if (node.color === PUMP_RED) {
    expect(node.left === null || node.left.color === PUMP_BLACK).toBe(true);
    expect(node.right === null || node.right.color === PUMP_BLACK).toBe(true);
  }
  const lh = checkRb(node.left, node);
  const rh = checkRb(node.right, node);
  expect(lh).toBe(rh);
  return lh + (node.color === PUMP_BLACK ? 1 : 0);
}

function assertValidRb(coll: unknown): void {
  const root = rootOf(coll);
  if (root) {
    expect(root.color).toBe(PUMP_BLACK);
    expect(root.parent).toBeNull();
  }
  checkRb(root, null);
}

// ---------------------------------------------------------------------------

describe("TreeMap pump (number)", () => {
  it("fromSorted == per-op set, same iteration order", () => {
    for (const n of [0, 1, 2, 3, 6, 12, 24, 48, 100]) {
      const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [
        i,
        i * 10,
      ]);
      const pumped = NumberNumberTreeMap.fromSorted(pairs);
      const incr = new NumberNumberTreeMap();
      for (const [k, v] of pairs) incr.set(k, v);
      expect([...pumped.entries()]).toEqual([...incr.entries()]);
      expect(pumped.size).toBe(incr.size);
      for (const [k, v] of pairs) expect(pumped.get(k)).toBe(v);
      assertValidRb(pumped);
    }
  });

  it("valid RB tree + post-build random mutation stays valid", () => {
    const n = 500;
    const pairs: [number, number][] = Array.from({ length: n }, (_, i) => [
      i,
      i,
    ]);
    const m = NumberNumberTreeMap.fromSorted(pairs);
    assertValidRb(m);
    let seed = 0x71ee;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    // Deterministic inserts / removes against the pumped tree.
    for (let t = 0; t < 48; t++) {
      const k = next() % (2 * n);
      if ((next() & 1) === 0) m.set(k, k);
      else m.remove(k);
      assertValidRb(m);
    }
  });

  it("out-of-order throws PumpNotSortedError at first/middle/last", () => {
    expect(() =>
      NumberNumberTreeMap.fromSorted([
        [2, 0],
        [1, 0],
      ]),
    ).toThrow(PumpNotSortedError);
    expect(() =>
      NumberNumberTreeMap.fromSorted([
        [1, 0],
        [3, 0],
        [2, 0],
        [4, 0],
      ]),
    ).toThrow(PumpNotSortedError);
    expect(() =>
      NumberNumberTreeMap.fromSorted([
        [1, 0],
        [2, 0],
        [3, 0],
        [2, 0],
      ]),
    ).toThrow(PumpNotSortedError);
  });

  it("duplicate key: error vs ignore (keeps first value)", () => {
    expect(() =>
      NumberNumberTreeMap.fromSorted([
        [1, 0],
        [1, 9],
      ]),
    ).toThrow(PumpDuplicateError);
    const m = NumberNumberTreeMap.fromSorted(
      [
        [1, 100],
        [1, 200],
        [2, 5],
      ],
      { onDuplicate: "ignore" },
    );
    expect(m.get(1)).toBe(100);
    expect(m.size).toBe(2);
  });

  it("float total order: -0/+0, ±Inf, +NaN at top", () => {
    const keys = [-Infinity, -0, 0, 1.5, Infinity, NaN];
    const m = NumberNumberTreeMap.fromSorted(keys.map((k) => [k, 1]));
    expect([...m.keys()]).toEqual(keys);
  });
});

describe("TreeMapSink (number)", () => {
  it("builds same as fromSorted", () => {
    const sink = new NumberNumberTreeMapSink();
    sink.put([1, 1]);
    sink.putAll([
      [2, 2],
      [3, 3],
    ]);
    const m = sink.create();
    expect([...m.entries()]).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it("poisoned after error", () => {
    const sink = new NumberNumberTreeMapSink();
    sink.put([2, 0]);
    expect(() => sink.put([1, 0])).toThrow(PumpNotSortedError);
    expect(() => sink.put([5, 0])).toThrow(/poisoned/);
    expect(() => sink.create()).toThrow(/poisoned/);
  });

  it("create is once-only", () => {
    const sink = new NumberNumberTreeMapSink();
    sink.put([1, 1]);
    sink.create();
    expect(() => sink.create()).toThrow(/already created/);
    expect(() => sink.put([2, 2])).toThrow(/already created/);
  });

  it("empty input builds an empty map", () => {
    const m = new NumberNumberTreeMapSink().create();
    expect(m.size).toBe(0);
    expect(m.isEmpty()).toBe(true);
  });
});

describe("TreeMap pump (bigint)", () => {
  it("fromSorted == per-op set", () => {
    const pairs: [bigint, bigint][] = [
      [1n, 10n],
      [2n, 20n],
      [3n, 30n],
    ];
    const pumped = BigIntBigIntTreeMap.fromSorted(pairs);
    const incr = new BigIntBigIntTreeMap();
    for (const [k, v] of pairs) incr.set(k, v);
    expect([...pumped.entries()]).toEqual([...incr.entries()]);
    assertValidRb(pumped);
  });
  it("out-of-order throws", () => {
    expect(() =>
      BigIntBigIntTreeMap.fromSorted([
        [2n, 0n],
        [1n, 0n],
      ]),
    ).toThrow(PumpNotSortedError);
  });
});

describe("TreeSet pump", () => {
  it("fromSorted == per-op add (number)", () => {
    for (const n of [0, 1, 3, 24, 48]) {
      const vals = Array.from({ length: n }, (_, i) => i);
      const pumped = NumberTreeSet.fromSorted(vals);
      const incr = NumberTreeSet.of(vals);
      expect([...pumped.values()]).toEqual([...incr.values()]);
      assertValidRb(pumped);
    }
  });
  it("bigint fromSorted", () => {
    const s = BigIntTreeSet.fromSorted([1n, 2n, 3n]);
    expect([...s.values()]).toEqual([1n, 2n, 3n]);
    assertValidRb(s);
  });
  it("duplicate error vs ignore", () => {
    expect(() => NumberTreeSet.fromSorted([1, 1])).toThrow(PumpDuplicateError);
    const s = NumberTreeSet.fromSorted([1, 1, 2], { onDuplicate: "ignore" });
    expect([...s.values()]).toEqual([1, 2]);
  });
  it("out-of-order throws", () => {
    expect(() => NumberTreeSet.fromSorted([2, 1])).toThrow(PumpNotSortedError);
  });
  it("sink poison + once-only", () => {
    const sink = new NumberTreeSetSink();
    sink.put(2);
    expect(() => sink.put(1)).toThrow(PumpNotSortedError);
    expect(() => sink.create()).toThrow(/poisoned/);
  });
});

describe("TreeBag pump", () => {
  it("fromSorted collapses runs into counts == per-op add", () => {
    const vals = [1, 1, 1, 2, 3, 3];
    const pumped = NumberTreeBag.fromSorted(vals);
    const incr = NumberTreeBag.of(vals);
    expect(pumped.size).toBe(incr.size);
    expect(pumped.sizeDistinct).toBe(incr.sizeDistinct);
    expect(pumped.occurrencesOf(1)).toBe(3);
    expect(pumped.occurrencesOf(3)).toBe(2);
    expect([...pumped]).toEqual([...incr]);
    assertValidRb(pumped);
  });
  it("bigint", () => {
    const b = BigIntTreeBag.fromSorted([1n, 1n, 2n]);
    expect(b.occurrencesOf(1n)).toBe(2);
    expect(b.size).toBe(3);
    assertValidRb(b);
  });
  it("out-of-order throws", () => {
    expect(() => NumberTreeBag.fromSorted([3, 1])).toThrow(PumpNotSortedError);
  });
  it("sink once-only + empty", () => {
    const empty = new NumberTreeBagSink().create();
    expect(empty.size).toBe(0);
    const sink = new NumberTreeBagSink();
    sink.put(1);
    sink.create();
    expect(() => sink.put(2)).toThrow(/already created/);
  });
});
