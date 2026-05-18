// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { NumberHashSet } from "./number-hash-set.js";
import { ImmutableNumberHashSet } from "./immutable-number-hash-set.js";

describe("ImmutableNumberHashSet generated", () => {
  it("contains and size", () => {
    const im = ImmutableNumberHashSet.of([1, 2, 3]);
    expect(im.size()).toBe(3);
    expect(im.contains(2)).toBe(true);
  });
  it("union", () => {
    const a = ImmutableNumberHashSet.of([1, 2]);
    const b = ImmutableNumberHashSet.of([2, 3]);
    expect(a.union(b).size()).toBe(3);
  });
  it("intersect", () => {
    const a = ImmutableNumberHashSet.of([1, 2]);
    const b = ImmutableNumberHashSet.of([2, 3]);
    expect(a.intersect(b).size()).toBe(1);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableNumberHashSet.of([1]);
    im.toMutable().add(2);
    expect(im.size()).toBe(1);
  });
});
