// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { NumberHashBag } from "./number-hash-bag.js";
import { ImmutableNumberHashBag } from "./immutable-number-hash-bag.js";

describe("ImmutableNumberHashBag generated", () => {
  it("occurrences and size", () => {
    const im = ImmutableNumberHashBag.of([1, 1, 2]);
    expect(im.occurrencesOf(1)).toBe(2);
    expect(im.size()).toBe(3);
    expect(im.sizeDistinct()).toBe(2);
  });
  it("select", () => {
    const im = ImmutableNumberHashBag.of([1, 2, 3]);
    expect(im.select((v) => v > 1).size()).toBe(2);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableNumberHashBag.of([1]);
    im.toMutable().add(2);
    expect(im.size()).toBe(1);
  });
});
