// Copyright (c) 2026 Jan Kotek.
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Hand-written (not generated): number-side identity of the hash bi-maps
// (audit fable-spec-allign 04-typescript F6; algorithms.md
// NegativeZeroDistinct). -0 and +0 are distinct keys/values on a number side;
// every NaN is one key/value (TS NaN exception).

import { describe, it, expect } from "vitest";
import { NumberNumberHashBiMap } from "./number-number-hash-bi-map.js";
import { NumberBigIntHashBiMap } from "./number-bigint-hash-bi-map.js";
import { BigIntNumberHashBiMap } from "./bigint-number-hash-bi-map.js";

const otherNaN = new Float64Array(
  new BigUint64Array([0x7ff8000000000001n]).buffer,
)[0]!;

describe("hash bi-map number-side identity (F6)", () => {
  it("NumberNumberHashBiMap: -0 and +0 are distinct keys", () => {
    const m = new NumberNumberHashBiMap();
    m.set(-0, 1);
    m.set(0, 2);
    expect(m.size).toBe(2);
    expect(m.get(-0)).toBe(1);
    expect(m.get(0)).toBe(2);
    expect(Object.is(m.getKey(1), -0)).toBe(true);
    expect(Object.is(m.getKey(2), 0)).toBe(true);
    expect(m.keys().some((k) => Object.is(k, -0))).toBe(true);
    expect(m.removeKey(-0)).toBe(1);
    expect(m.size).toBe(1);
    expect(m.get(0)).toBe(2);
    expect(m.containsValue(1)).toBe(false);
  });

  it("NumberNumberHashBiMap: -0 and +0 are distinct values", () => {
    const m = new NumberNumberHashBiMap();
    m.set(1, -0);
    m.set(2, 0);
    expect(m.size).toBe(2);
    expect(m.getKey(-0)).toBe(1);
    expect(m.getKey(0)).toBe(2);
    expect(m.removeValue(-0)).toBe(1);
    expect(m.size).toBe(1);
    expect(m.has(2)).toBe(true);
    const inv = m.inverse();
    expect(inv.get(0)).toBe(2);
    expect(inv.has(-0)).toBe(false);
  });

  it("NumberNumberHashBiMap: all NaNs are one key and one value", () => {
    const m = new NumberNumberHashBiMap();
    m.set(NaN, 1);
    m.set(otherNaN, 2);
    expect(m.size).toBe(1);
    expect(m.get(NaN)).toBe(2);
    m.set(10, NaN);
    m.set(11, otherNaN);
    expect(m.size).toBe(2);
    expect(m.has(10)).toBe(false);
    expect(m.getKey(NaN)).toBe(11);
  });

  it("NumberNumberHashBiMap: bulkLoad treats -0/+0 as distinct", () => {
    const m = NumberNumberHashBiMap.bulkLoad([
      [-0, -0],
      [0, 0],
    ]);
    expect(m.size).toBe(2);
    expect(Object.is(m.get(-0), -0)).toBe(true);
    expect(Object.is(m.getKey(0), 0)).toBe(true);
    expect(m.equals(NumberNumberHashBiMap.bulkLoad([[0, 0], [-0, -0]]))).toBe(true);
    expect(m.equals(NumberNumberHashBiMap.bulkLoad([[0, -0], [-0, 0]]))).toBe(false);
  });

  it("NumberBigIntHashBiMap: -0 and +0 are distinct keys", () => {
    const m = new NumberBigIntHashBiMap();
    m.set(-0, 1n);
    m.set(0, 2n);
    expect(m.size).toBe(2);
    expect(Object.is(m.getKey(1n), -0)).toBe(true);
    expect(m.toArray().map(([k]) => Object.is(k, -0))).toEqual([true, false]);
  });

  it("BigIntNumberHashBiMap: -0 and +0 are distinct values", () => {
    const m = new BigIntNumberHashBiMap();
    m.set(1n, -0);
    m.set(2n, 0);
    expect(m.size).toBe(2);
    expect(m.getKey(-0)).toBe(1n);
    expect(m.getKey(0)).toBe(2n);
    expect(m.inverse().size).toBe(2);
  });
});
