// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { BigIntArrayList } from "./bigint-array-list.js";

describe("BigIntArrayList remove (by value)", () => {
  it("removes only the first occurrence", () => {
    const l = BigIntArrayList.of([1n, 2n, 1n]);
    expect(l.remove(1n)).toBe(true);
    expect(l.toArray()).toEqual([2n, 1n]);
  });

  it("returns false and leaves the list unchanged for an absent value", () => {
    const l = BigIntArrayList.of([1n, 2n]);
    expect(l.remove(99n)).toBe(false);
    expect(l.toArray()).toEqual([1n, 2n]);
  });

  it("returns false on an empty list", () => {
    const l = new BigIntArrayList();
    expect(l.remove(0n)).toBe(false);
    expect(l.isEmpty()).toBe(true);
  });

  it("removes the last element and empties the list", () => {
    const l = BigIntArrayList.of([7n]);
    expect(l.remove(7n)).toBe(true);
    expect(l.isEmpty()).toBe(true);
    expect(l.remove(7n)).toBe(false);
  });
});
