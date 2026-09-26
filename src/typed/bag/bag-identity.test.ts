// Copyright (c) 2026 Jan Kotek.
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Hand-written (not generated): typed bag key identity (audit
// fable-spec-allign 04-typescript F5). Keys are narrowed to the storage width
// at every entry point; -0 and +0 are distinct keys; every NaN is one key
// (algorithms.md, TS NaN exception).

import { describe, it, expect } from "vitest";
import { Float32HashBag } from "./float32-hash-bag.js";
import { Float64HashBag } from "./float64-hash-bag.js";
import { Int8HashBag } from "./int8-hash-bag.js";
import { Int16HashBag } from "./int16-hash-bag.js";
import { Int32HashBag } from "./int32-hash-bag.js";
import { BigInt64HashBag } from "./bigint64-hash-bag.js";
import { ImmutableFloat64HashBag } from "./immutable_float64-hash-bag.js";
import { ImmutableFloat32HashBag } from "./immutable_float32-hash-bag.js";
import { ImmutableInt8HashBag } from "./immutable_int8-hash-bag.js";

const otherNaN = new Float64Array(
  new BigUint64Array([0x7ff8000000000001n]).buffer,
)[0]!;

describe("typed bag identity (F5)", () => {
  for (const [name, make] of [
    ["Float32HashBag", () => new Float32HashBag()],
    ["Float64HashBag", () => new Float64HashBag()],
  ] as const) {
    it(`${name}: -0 and +0 are distinct keys`, () => {
      const b = make();
      b.add(-0);
      b.add(0);
      b.add(0);
      expect(b.sizeDistinct()).toBe(2);
      expect(b.occurrencesOf(-0)).toBe(1);
      expect(b.occurrencesOf(0)).toBe(2);
      const entries = [...b.entries()];
      expect(entries.some(([v, c]) => Object.is(v, -0) && c === 1)).toBe(true);
      expect(entries.some(([v, c]) => Object.is(v, 0) && c === 2)).toBe(true);
      expect(Array.from(b.toArray()).filter((v) => Object.is(v, -0)).length).toBe(1);
      expect(b.removeAll(-0)).toBe(true);
      expect(b.has(-0)).toBe(false);
      expect(b.occurrencesOf(0)).toBe(2);
      expect(b.size).toBe(2);
    });
    it(`${name}: all NaNs are one key`, () => {
      const b = make();
      b.add(NaN);
      b.add(otherNaN);
      expect(b.sizeDistinct()).toBe(1);
      expect(b.occurrencesOf(NaN)).toBe(2);
    });
  }

  it("Float32HashBag narrows keys with Math.fround", () => {
    const b = new Float32HashBag();
    b.add(0.1);
    b.add(Math.fround(0.1));
    expect(b.sizeDistinct()).toBe(1);
    expect(b.occurrencesOf(0.1)).toBe(2);
    expect([...b.entries()]).toEqual([[Math.fround(0.1), 2]]);
  });

  it("Int8HashBag narrows keys to int8", () => {
    const b = new Int8HashBag();
    b.add(200);
    b.add(-56);
    expect(b.sizeDistinct()).toBe(1);
    expect(b.occurrencesOf(-56)).toBe(2);
    expect(b.occurrencesOf(200)).toBe(2);
    expect(Array.from(b.toArray())).toEqual([-56, -56]);
    expect(b.toString()).toBe("{-56×2}");
    expect(b.removeOccurrences(200, 1)).toBe(true);
    expect(b.occurrencesOf(-56)).toBe(1);
  });

  it("Int8HashBag.bulkLoad narrows keys", () => {
    const b = Int8HashBag.bulkLoad([
      [200, 1],
      [-56, 2],
    ]);
    expect([...b.entries()]).toEqual([[-56, 3]]);
  });

  it("Int16/Int32/BigInt64 bags narrow keys", () => {
    const b16 = new Int16HashBag();
    b16.add(40000);
    expect([...b16.entries()]).toEqual([[40000 - 65536, 1]]);
    const b32 = new Int32HashBag();
    b32.add(2 ** 32 + 5);
    b32.add(-0);
    expect([...b32.entries()]).toEqual([[5, 1], [0, 1]]);
    expect(Object.is([...b32.entries()][1]![0], 0)).toBe(true);
    const b64 = new BigInt64HashBag();
    b64.add(2n ** 64n + 1n);
    expect([...b64.entries()]).toEqual([[1n, 1]]);
    expect(b64.occurrencesOf(1n)).toBe(1);
  });

  it("immutable bags: narrowing and signed-zero identity", () => {
    const f = ImmutableFloat64HashBag.of([-0, 0, NaN, otherNaN]);
    expect(f.sizeDistinct()).toBe(3);
    expect(f.occurrencesOf(-0)).toBe(1);
    expect(f.occurrencesOf(NaN)).toBe(2);
    const m = new Float32HashBag();
    m.add(-0);
    m.add(0);
    const fm = ImmutableFloat32HashBag.fromMutable(m);
    expect(fm.sizeDistinct()).toBe(2);
    expect(fm.toMutable().occurrencesOf(-0)).toBe(1);
    const i = ImmutableInt8HashBag.of([200, -56]);
    expect(i.sizeDistinct()).toBe(1);
    expect(i.occurrencesOf(200)).toBe(2);
    expect(Array.from(i.toArray())).toEqual([-56, -56]);
  });
});
