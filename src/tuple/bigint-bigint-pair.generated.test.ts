// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntBigIntPair } from "./bigint-bigint-pair.js";

describe("BigIntBigIntPair generated", () => {
  it("one and two", () => {
    const p = new BigIntBigIntPair(1n, 2n);
    expect(p.one()).toBe(1n);
    expect(p.two()).toBe(2n);
  });
  it("equals", () => {
    const p1 = new BigIntBigIntPair(1n, 2n);
    const p2 = new BigIntBigIntPair(1n, 2n);
    const p3 = new BigIntBigIntPair(2n, 1n);
    expect(p1.equals(p2)).toBe(true);
    expect(p1.equals(p3)).toBe(false);
  });
  it("toString", () => {
    const p = new BigIntBigIntPair(1n, 2n);
    expect(p.toString()).not.toBe("");
  });
});
