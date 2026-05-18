// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntNumberPair } from "./bigint-number-pair.js";

describe("BigIntNumberPair generated", () => {
  it("one and two", () => {
    const p = new BigIntNumberPair(1n, 2);
    expect(p.one()).toBe(1n);
    expect(p.two()).toBe(2);
  });
  it("equals", () => {
    const p1 = new BigIntNumberPair(1n, 2);
    const p2 = new BigIntNumberPair(1n, 2);
    const p3 = new BigIntNumberPair(2n, 1);
    expect(p1.equals(p2)).toBe(true);
    expect(p1.equals(p3)).toBe(false);
  });
  it("toString", () => {
    const p = new BigIntNumberPair(1n, 2);
    expect(p.toString()).not.toBe("");
  });
});
