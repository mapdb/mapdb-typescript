// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { CountMin } from "./count-min.js";
import { positions } from "../hash/hash.js";

const U64_MAX = 0xffffffffffffffffn;

// The LE-4-byte encoding of an i32 (reinterpret, not sign-extend).
function encode(item: number): Uint8Array {
  const u = item >>> 0;
  return new Uint8Array([
    u & 0xff,
    (u >>> 8) & 0xff,
    (u >>> 16) & 0xff,
    (u >>> 24) & 0xff,
  ]);
}

// Reproduce the private column derivation for assertions.
function columns(c: CountMin, item: number): number[] {
  return positions(encode(item), c.width(), c.depth());
}

describe("CountMin", () => {
  it("row-hash matches positions and the pinned [7,0,9,2] vector", () => {
    const c = CountMin.withParams(4, 16);
    expect(columns(c, 7)).toEqual(positions(encode(7), 16, 4));
    // Pinned worked example (12-hash-pipeline/positions_basic.json).
    expect(columns(c, 7)).toEqual([7, 0, 9, 2]);
  });

  it("addOne touches the four columns; estimate=1; total=1", () => {
    const c = CountMin.withParams(4, 16);
    c.addOne(7);
    const m = c.toCounters();
    expect(m[7]).toBe(1n); // row 0 col 7
    expect(m[16]).toBe(1n); // row 1 col 0
    expect(m[2 * 16 + 9]).toBe(1n); // row 2 col 9
    expect(m[3 * 16 + 2]).toBe(1n); // row 3 col 2
    expect(m.filter((v) => v === 1n).length).toBe(4);
    expect(c.estimate(7)).toBe(1n);
    expect(c.total()).toBe(1n);
    expect(m.length).toBe(64);
  });

  it("add(item,5) equals five addOne", () => {
    const a = CountMin.withParams(3, 13);
    const b = CountMin.withParams(3, 13);
    a.add(42, 5n);
    for (let i = 0; i < 5; i++) b.addOne(42);
    expect(a.toCounters()).toEqual(b.toCounters());
    expect(a.estimate(42)).toBe(5n);
    expect(a.total()).toBe(5n);
  });

  it("add accumulates", () => {
    const c = CountMin.withParams(4, 16);
    c.add(7, 5n);
    c.add(7, 3n);
    expect(c.estimate(7)).toBe(8n);
    expect(c.total()).toBe(8n);
  });

  it("count=0 is a counter no-op but updates total (by 0)", () => {
    const c = CountMin.withParams(3, 7);
    c.add(1, 0n);
    expect(c.toCounters().every((v) => v === 0n)).toBe(true);
    expect(c.total()).toBe(0n);
    c.add(1, 4n);
    c.add(1, 0n);
    expect(c.estimate(1)).toBe(4n);
    expect(c.total()).toBe(4n);
  });

  it("cross-row column collision is NOT de-duplicated", () => {
    const d = 3;
    let found = false;
    outer: for (let w = 2; w < 32 && !found; w++) {
      for (let item = 0; item < 256; item++) {
        const cols = positions(encode(item), w, d);
        const seen = new Map<number, number>();
        let repeated: [number, number, number] | null = null;
        for (let r = 0; r < cols.length; r++) {
          const col = cols[r];
          if (seen.has(col)) {
            repeated = [seen.get(col)!, r, col];
            break;
          }
          seen.set(col, r);
        }
        if (repeated) {
          const [r0, r1, col] = repeated;
          const c = CountMin.withParams(d, w);
          c.addOne(item);
          const m = c.toCounters();
          expect(m[r0 * w + col]).toBe(1n);
          expect(m[r1 * w + col]).toBe(1n);
          expect(c.estimate(item)).toBe(1n);
          found = true;
          break outer;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("estimate is MIN over rows (>= true count)", () => {
    const c = CountMin.withParams(4, 8);
    const target = 5;
    c.add(target, 1n);
    const cols = columns(c, target);
    for (let other = 0; other < 200; other++) {
      if (other === target) continue;
      c.add(other, 7n);
    }
    const m = c.toCounters();
    const selected = cols.map((col, r) => m[r * 8 + col]);
    const min = selected.reduce((a, b) => (a < b ? a : b));
    expect(c.estimate(target)).toBe(min);
    expect(c.estimate(target) >= 1n).toBe(true);
  });

  it("overflow saturates, not wraps", () => {
    const c = CountMin.withParams(2, 4);
    c.add(9, U64_MAX);
    c.add(9, 5n);
    expect(c.estimate(9)).toBe(U64_MAX);
    expect(c.total()).toBe(U64_MAX);
    const m = c.toCounters();
    columns(c, 9).forEach((col, r) => {
      expect(m[r * 4 + col]).toBe(U64_MAX);
    });
  });

  it("no under-estimate for signed extremes", () => {
    const c = CountMin.withParams(5, 64);
    c.add(-1, 3n);
    c.add(-2147483648, 10n);
    expect(c.estimate(-1) >= 3n).toBe(true);
    expect(c.estimate(-2147483648) >= 10n).toBe(true);
  });

  it("order-independence of the matrix", () => {
    const a = CountMin.withParams(4, 16);
    const b = CountMin.withParams(4, 16);
    const seq: [number, bigint][] = [
      [1, 3n],
      [2, 5n],
      [1, 2n],
      [-7, 9n],
      [2147483647, 1n],
    ];
    for (const [it, ct] of seq) a.add(it, ct);
    for (const [it, ct] of [...seq].reverse()) b.add(it, ct);
    expect(a.toCounters()).toEqual(b.toCounters());
    expect(a.total()).toBe(b.total());
  });

  it("d=0 is legal vacuous MAX", () => {
    const c = CountMin.withParams(0, 16);
    c.add(5, 1n);
    expect(c.toCounters()).toEqual([]);
    expect(c.total()).toBe(1n);
    expect(c.estimate(5)).toBe(U64_MAX); // MIN over zero rows
  });

  it("empty matrix is all-zero dense", () => {
    const c = CountMin.withParams(4, 16);
    const m = c.toCounters();
    expect(m.length).toBe(64);
    expect(m.every((v) => v === 0n)).toBe(true);
    expect(c.estimate(7)).toBe(0n);
    expect(c.total()).toBe(0n);
  });

  it("w=0 traps", () => {
    expect(() => CountMin.withParams(4, 0)).toThrow(/width w must be non-zero/);
  });

  it("element encoding uses the byte path", () => {
    const c = CountMin.withParams(4, 16);
    expect(columns(c, 7)).toEqual(positions(encode(7), 16, 4));
    expect([...encode(-1)]).toEqual([0xff, 0xff, 0xff, 0xff]);
    expect([...encode(-2147483648)]).toEqual([0x00, 0x00, 0x00, 0x80]);
  });

  it("rejects negative / out-of-range count", () => {
    const c = CountMin.withParams(2, 4);
    expect(() => c.add(1, -1n)).toThrow(/u64 range/);
    expect(() => c.add(1, U64_MAX + 1n)).toThrow(/u64 range/);
  });

  it("rejects non-i32 items on add/addOne/estimate", () => {
    const c = CountMin.withParams(2, 4);
    for (const bad of [
      2147483648,
      -2147483649,
      1.5,
      NaN,
      Infinity,
      -Infinity,
    ]) {
      expect(() => c.add(bad, 1n)).toThrow(/signed 32-bit integer/);
      expect(() => c.addOne(bad)).toThrow(/signed 32-bit integer/);
      expect(() => c.estimate(bad)).toThrow(/signed 32-bit integer/);
    }
  });

  it("accepts the i32 boundaries", () => {
    for (const v of [-2147483648, 2147483647, 0]) {
      const c = CountMin.withParams(2, 4);
      expect(() => c.add(v, 1n)).not.toThrow();
      expect(c.estimate(v)).toBe(1n); // fresh sketch: no collision noise
    }
  });

  // optimal() pinned integer table (native-only, float-quarantined).
  it("optimal() reproduces the pinned (w,d) table", () => {
    const cases: [number, number, number, number][] = [
      [0.01, 0.01, 272, 5],
      [0.001, 0.001, 2719, 7],
      [0.1, 0.05, 28, 3],
      [0.01, 0.001, 272, 7],
      [0.5, 0.5, 6, 1],
    ];
    for (const [eps, delta, w, d] of cases) {
      const c = CountMin.optimal(eps, delta);
      expect(c.width()).toBe(w);
      expect(c.depth()).toBe(d);
    }
  });

  it("optimal() rejects bad epsilon/delta/NaN/Infinity", () => {
    expect(() => CountMin.optimal(0.0, 0.5)).toThrow(/0 < epsilon < 1/);
    expect(() => CountMin.optimal(1.0, 0.5)).toThrow(/0 < epsilon < 1/);
    expect(() => CountMin.optimal(0.5, 1.0)).toThrow(/0 < delta < 1/);
    expect(() => CountMin.optimal(0.5, 0.0)).toThrow(/0 < delta < 1/);
    expect(() => CountMin.optimal(NaN, 0.5)).toThrow(/0 < epsilon < 1/);
    expect(() => CountMin.optimal(Infinity, 0.5)).toThrow(/0 < epsilon < 1/);
    expect(() => CountMin.optimal(0.5, NaN)).toThrow(/0 < delta < 1/);
  });
});
