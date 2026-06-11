// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntHashBag } from "./bigint-hash-bag.js";
import { ImmutableBigIntHashBag } from "./immutable-bigint-hash-bag.js";

describe("ImmutableBigIntHashBag generated", () => {
  it("occurrences and size", () => {
    const im = ImmutableBigIntHashBag.of([1n, 1n, 2n]);
    expect(im.occurrencesOf(1n)).toBe(2);
    expect(im.size).toBe(3);
    expect(im.sizeDistinct()).toBe(2);
  });
  it("select", () => {
    const im = ImmutableBigIntHashBag.of([1n, 2n, 3n]);
    expect(im.select((v) => v > 1n).size).toBe(2);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableBigIntHashBag.of([1n]);
    im.toMutable().add(2n);
    expect(im.size).toBe(1);
  });
});
