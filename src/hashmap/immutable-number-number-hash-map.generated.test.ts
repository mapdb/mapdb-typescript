// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.


import { describe, it, expect } from "vitest";
import { NumberNumberHashMap } from "./number-number-hash-map.js";
import { ImmutableNumberNumberHashMap } from "./immutable-number-number-hash-map.js";

describe("ImmutableNumberNumberHashMap generated", () => {
  it("get and size", () => {
    const im = ImmutableNumberNumberHashMap.of([
      [1, 1],
      [2, 2],
    ]);
    expect(im.size()).toBe(2);
    expect(im.get(1)).toBe(1);
    expect(im.get(99)).toBeUndefined();
  });
  it("containsKey", () => {
    const im = ImmutableNumberNumberHashMap.of([[1, 1]]);
    expect(im.has(1)).toBe(true);
    expect(im.has(99)).toBe(false);
  });
  it("select", () => {
    const im = ImmutableNumberNumberHashMap.of([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
    expect(im.select((_k, v) => v > 1).size()).toBe(2);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableNumberNumberHashMap.of([[1, 1]]);
    im.toMutable().set(2, 2);
    expect(im.size()).toBe(1);
  });
});
