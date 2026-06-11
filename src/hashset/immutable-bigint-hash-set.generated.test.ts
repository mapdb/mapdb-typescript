// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntHashSet } from "./bigint-hash-set.js";
import { ImmutableBigIntHashSet } from "./immutable-bigint-hash-set.js";

describe("ImmutableBigIntHashSet generated", () => {
  it("contains and size", () => {
    const im = ImmutableBigIntHashSet.of([1n, 2n, 3n]);
    expect(im.size()).toBe(3);
    expect(im.has(2n)).toBe(true);
  });
  it("union", () => {
    const a = ImmutableBigIntHashSet.of([1n, 2n]);
    const b = ImmutableBigIntHashSet.of([2n, 3n]);
    expect(a.union(b).size()).toBe(3);
  });
  it("intersect", () => {
    const a = ImmutableBigIntHashSet.of([1n, 2n]);
    const b = ImmutableBigIntHashSet.of([2n, 3n]);
    expect(a.intersect(b).size()).toBe(1);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableBigIntHashSet.of([1n]);
    im.toMutable().add(2n);
    expect(im.size()).toBe(1);
  });
});
