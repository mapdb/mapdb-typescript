// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.


import { describe, it, expect } from "vitest";
import { BigIntNumberHashMap } from "./bigint-number-hash-map.js";
import { ImmutableBigIntNumberHashMap } from "./immutable-bigint-number-hash-map.js";

describe("ImmutableBigIntNumberHashMap generated", () => {
  it("get and size", () => {
    const im = ImmutableBigIntNumberHashMap.of([
      [1n, 1],
      [2n, 2],
    ]);
    expect(im.size()).toBe(2);
    expect(im.get(1n)).toBe(1);
    expect(im.get(99n)).toBeUndefined();
  });
  it("containsKey", () => {
    const im = ImmutableBigIntNumberHashMap.of([[1n, 1]]);
    expect(im.containsKey(1n)).toBe(true);
    expect(im.containsKey(99n)).toBe(false);
  });
  it("select", () => {
    const im = ImmutableBigIntNumberHashMap.of([
      [1n, 1],
      [2n, 2],
      [3n, 3],
    ]);
    expect(im.select((_k, v) => v > 1).size()).toBe(2);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableBigIntNumberHashMap.of([[1n, 1]]);
    im.toMutable().put(2n, 2);
    expect(im.size()).toBe(1);
  });
});
