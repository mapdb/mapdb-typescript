// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { NumberBigIntPair } from "./number-bigint-pair.js";

describe("NumberBigIntPair generated", () => {
  it("one and two", () => {
    const p = new NumberBigIntPair(1, 2n);
    expect(p.one()).toBe(1);
    expect(p.two()).toBe(2n);
  });
  it("equals", () => {
    const p1 = new NumberBigIntPair(1, 2n);
    const p2 = new NumberBigIntPair(1, 2n);
    const p3 = new NumberBigIntPair(2, 1n);
    expect(p1.equals(p2)).toBe(true);
    expect(p1.equals(p3)).toBe(false);
  });
  it("toString", () => {
    const p = new NumberBigIntPair(1, 2n);
    expect(p.toString()).not.toBe("");
  });
});
