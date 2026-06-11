// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.


import { describe, it, expect } from "vitest";
import { NumberBigIntHashMap } from "./number-bigint-hash-map.js";
import { ImmutableNumberBigIntHashMap } from "./immutable-number-bigint-hash-map.js";

describe("ImmutableNumberBigIntHashMap generated", () => {
  it("get and size", () => {
    const im = ImmutableNumberBigIntHashMap.of([
      [1, 1n],
      [2, 2n],
    ]);
    expect(im.size).toBe(2);
    expect(im.get(1)).toBe(1n);
    expect(im.get(99)).toBeUndefined();
  });
  it("has", () => {
    const im = ImmutableNumberBigIntHashMap.of([[1, 1n]]);
    expect(im.has(1)).toBe(true);
    expect(im.has(99)).toBe(false);
  });
  it("select", () => {
    const im = ImmutableNumberBigIntHashMap.of([
      [1, 1n],
      [2, 2n],
      [3, 3n],
    ]);
    expect(im.select((_k, v) => v > 1n).size).toBe(2);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableNumberBigIntHashMap.of([[1, 1n]]);
    im.toMutable().set(2, 2n);
    expect(im.size).toBe(1);
  });
});
