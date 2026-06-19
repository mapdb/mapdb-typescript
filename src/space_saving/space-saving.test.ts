// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { SpaceSaving, type SSEntry } from "./space-saving.js";

const U64_MAX = 0xffffffffffffffffn;

function triples(entries: SSEntry[]): [number, bigint, bigint][] {
  return entries.map((e) => [e.item, e.count, e.error]);
}

describe("SpaceSaving", () => {
  it("admits under capacity with no eviction", () => {
    const s = SpaceSaving.withCapacity(3);
    s.addOne(7);
    s.addOne(7);
    s.addOne(-1);
    expect(s.size()).toBe(2);
    expect(s.count(7)).toBe(2n);
    expect(s.error(7)).toBe(0n);
    expect(s.count(-1)).toBe(1n);
    expect(triples(s.monitoredSet())).toEqual([
      [7, 2n, 0n],
      [-1, 1n, 0n],
    ]);
    expect(triples(s.topK(1))).toEqual([[7, 2n, 0n]]);
  });

  it("evicts min-count with smaller-signed-item tie-break", () => {
    const s = SpaceSaving.withCapacity(2);
    s.addOne(1);
    s.addOne(2);
    s.addOne(3); // tie at count 1 -> evict smaller signed item = 1
    expect(triples(s.monitoredSet())).toEqual([
      [3, 2n, 1n],
      [2, 1n, 0n],
    ]);
    expect(s.count(1)).toBe(0n);
    expect(s.isMonitored(1)).toBe(false);
    expect(s.count(3)).toBe(2n);
    expect(s.error(3)).toBe(1n);
  });

  it("tie-break uses SIGNED order: negative beats positive", () => {
    const s = SpaceSaving.withCapacity(2);
    s.addOne(-5);
    s.addOne(2);
    s.addOne(9);
    expect(s.isMonitored(-5)).toBe(false); // -5 < 2 signed -> evicted
    expect(s.isMonitored(2)).toBe(true);
    expect(s.isMonitored(9)).toBe(true);
    expect(s.count(9)).toBe(2n);
    expect(s.error(9)).toBe(1n);
  });

  it("already-monitored error never changes on re-add", () => {
    const s = SpaceSaving.withCapacity(2);
    s.addOne(1);
    s.addOne(2);
    s.addOne(3); // evicts 1; 3 -> count 2, error 1
    expect(s.error(3)).toBe(1n);
    s.add(3, 100n); // monitored re-add: error unchanged
    expect(s.count(3)).toBe(102n);
    expect(s.error(3)).toBe(1n);
  });

  it("admitted with room has zero error", () => {
    const s = SpaceSaving.withCapacity(5);
    s.add(7, 9n);
    expect(s.error(7)).toBe(0n);
    expect(s.count(7)).toBe(9n);
  });

  it("count=0 add is a no-op (no eviction)", () => {
    const s = SpaceSaving.withCapacity(1);
    s.addOne(1);
    s.add(2, 0n); // must NOT evict 1
    expect(s.isMonitored(1)).toBe(true);
    expect(s.isMonitored(2)).toBe(false);
    expect(s.size()).toBe(1);
  });

  it("empty summary", () => {
    const s = SpaceSaving.withCapacity(3);
    expect(s.size()).toBe(0);
    expect(s.capacity()).toBe(3);
    expect(s.monitoredSet()).toEqual([]);
    expect(s.count(7)).toBe(0n);
    expect(s.error(7)).toBe(0n);
    expect(s.topK(3)).toEqual([]);
  });

  it("topK canonical order and bounds", () => {
    const s = SpaceSaving.withCapacity(10);
    s.add(1, 5n);
    s.add(2, 3n);
    s.add(3, 3n); // tie at 3 -> 2 before 3 (signed asc)
    s.add(4, 1n);
    const full = triples(s.monitoredSet());
    expect(full).toEqual([
      [1, 5n, 0n],
      [2, 3n, 0n],
      [3, 3n, 0n],
      [4, 1n, 0n],
    ]);
    expect(triples(s.topK(1))).toEqual([[1, 5n, 0n]]);
    expect(triples(s.topK(2))).toEqual([
      [1, 5n, 0n],
      [2, 3n, 0n],
    ]);
    expect(triples(s.topK(4))).toEqual(full);
    expect(triples(s.topK(99))).toEqual(full); // k > size -> all, no padding
    expect(s.topK(0)).toEqual([]);
  });

  it("count of unmonitored is 0", () => {
    const s = SpaceSaving.withCapacity(1);
    s.addOne(1);
    s.addOne(2); // evicts 1
    expect(s.count(1)).toBe(0n);
    expect(s.isMonitored(1)).toBe(false);
  });

  it("overflow saturates", () => {
    const s = SpaceSaving.withCapacity(1);
    s.add(7, U64_MAX);
    s.add(7, U64_MAX);
    expect(s.count(7)).toBe(U64_MAX);
  });

  it("order-dependence is deterministic per order", () => {
    const a = SpaceSaving.withCapacity(2);
    for (const it of [1, 1, 2, 3]) a.addOne(it);
    // A: 1->1, 1->2, 2 admitted->1, 3 evicts min count (2 has count1) -> {1:2, 3:2e1}
    expect(triples(a.monitoredSet())).toEqual([
      [1, 2n, 0n],
      [3, 2n, 1n],
    ]);
  });

  it("error floor unchanged across evictions", () => {
    const s = SpaceSaving.withCapacity(2);
    s.addOne(1);
    s.addOne(2);
    s.addOne(3); // evict 1: 3 -> count2 error1
    expect(s.error(3)).toBe(1n);
    s.addOne(3); // re-add: count3 error1 (unchanged)
    expect(s.count(3)).toBe(3n);
    expect(s.error(3)).toBe(1n);
    s.addOne(4); // full {2:1, 3:3}; evict 2: 4 -> count2 error1
    expect(s.error(4)).toBe(1n);
    expect(s.count(4)).toBe(2n);
    expect(s.error(3)).toBe(1n); // 3 still unchanged
  });

  it("m=0 traps", () => {
    expect(() => SpaceSaving.withCapacity(0)).toThrow(
      /capacity m must be non-zero/,
    );
  });

  it("rejects negative / out-of-range count", () => {
    const s = SpaceSaving.withCapacity(2);
    expect(() => s.add(1, -1n)).toThrow(/u64 range/);
    expect(() => s.add(1, U64_MAX + 1n)).toThrow(/u64 range/);
  });

  it("rejects non-i32 items on add/addOne", () => {
    const s = SpaceSaving.withCapacity(2);
    for (const bad of [
      2147483648,
      -2147483649,
      1.5,
      NaN,
      Infinity,
      -Infinity,
    ]) {
      expect(() => s.add(bad, 1n)).toThrow(/signed 32-bit integer/);
      expect(() => s.addOne(bad)).toThrow(/signed 32-bit integer/);
      // even a zero-weight add validates the item before the no-op.
      expect(() => s.add(bad, 0n)).toThrow(/signed 32-bit integer/);
    }
  });

  it("accepts the i32 boundaries", () => {
    const s = SpaceSaving.withCapacity(3);
    expect(() => s.addOne(-2147483648)).not.toThrow(); // INT_MIN
    expect(() => s.addOne(2147483647)).not.toThrow(); // INT_MAX
    expect(() => s.addOne(0)).not.toThrow();
    expect(s.count(-2147483648)).toBe(1n);
    expect(s.count(2147483647)).toBe(1n);
  });
});
