// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberHashBag } from "./number-hash-bag.js";

describe("NumberHashBag", () => {
  it("add and occurrences", () => {
    const b = new NumberHashBag();
    b.add(1);
    b.add(1);
    b.add(2);
    expect(b.occurrencesOf(1)).toBe(2);
    expect(b.occurrencesOf(2)).toBe(1);
    expect(b.size()).toBe(3);
    expect(b.sizeDistinct()).toBe(2);
  });

  it("remove", () => {
    const b = NumberHashBag.of([1, 1, 1, 2]);
    b.remove(1);
    expect(b.occurrencesOf(1)).toBe(2);
  });

  it("forEachWithOccurrences", () => {
    const b = NumberHashBag.of([1, 1, 2, 2, 2]);
    let total = 0;
    b.forEachWithOccurrences((_v, count) => {
      total += count;
    });
    expect(total).toBe(5);
  });
});
