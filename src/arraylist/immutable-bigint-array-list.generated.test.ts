// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntArrayList } from "./bigint-array-list.js";
import { ImmutableBigIntArrayList } from "./immutable-bigint-array-list.js";

describe("ImmutableBigIntArrayList generated", () => {
  it("get and size", () => {
    const im = ImmutableBigIntArrayList.of([1n, 2n, 3n]);
    expect(im.size).toBe(3);
    expect(im.get(1)).toBe(2n);
  });
  it("contains", () => {
    const im = ImmutableBigIntArrayList.of([1n, 2n]);
    expect(im.has(1n)).toBe(true);
    expect(im.has(99n)).toBe(false);
  });
  it("select and reject", () => {
    const im = ImmutableBigIntArrayList.of([1n, 2n, 3n, 4n, 5n]);
    expect(im.select((v) => v > 3n).size).toBe(2);
    expect(im.reject((v) => v > 3n).size).toBe(3);
  });
  it("toArray", () => {
    const im = ImmutableBigIntArrayList.of([1n, 2n]);
    expect(im.toArray()).toEqual([1n, 2n]);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableBigIntArrayList.of([1n]);
    const m = im.toMutable();
    m.add(2n);
    expect(im.size).toBe(1);
  });
  it("toString", () => {
    const im = ImmutableBigIntArrayList.of([1n]);
    expect(im.toString()).not.toBe("");
  });
});
