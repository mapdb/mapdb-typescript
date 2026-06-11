// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { NumberArrayList } from "./number-array-list.js";
import { ImmutableNumberArrayList } from "./immutable-number-array-list.js";

describe("ImmutableNumberArrayList generated", () => {
  it("get and size", () => {
    const im = ImmutableNumberArrayList.of([1, 2, 3]);
    expect(im.size()).toBe(3);
    expect(im.get(1)).toBe(2);
  });
  it("contains", () => {
    const im = ImmutableNumberArrayList.of([1, 2]);
    expect(im.has(1)).toBe(true);
    expect(im.has(99)).toBe(false);
  });
  it("select and reject", () => {
    const im = ImmutableNumberArrayList.of([1, 2, 3, 4, 5]);
    expect(im.select((v) => v > 3).size()).toBe(2);
    expect(im.reject((v) => v > 3).size()).toBe(3);
  });
  it("toArray", () => {
    const im = ImmutableNumberArrayList.of([1, 2]);
    expect(im.toArray()).toEqual([1, 2]);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableNumberArrayList.of([1]);
    const m = im.toMutable();
    m.add(2);
    expect(im.size()).toBe(1);
  });
  it("toString", () => {
    const im = ImmutableNumberArrayList.of([1]);
    expect(im.toString()).not.toBe("");
  });
});
