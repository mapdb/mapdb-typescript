// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { NumberNumberPair } from "./number-number-pair.js";

describe("NumberNumberPair generated", () => {
  it("one and two", () => {
    const p = new NumberNumberPair(1, 2);
    expect(p.one()).toBe(1);
    expect(p.two()).toBe(2);
  });
  it("equals", () => {
    const p1 = new NumberNumberPair(1, 2);
    const p2 = new NumberNumberPair(1, 2);
    const p3 = new NumberNumberPair(2, 1);
    expect(p1.equals(p2)).toBe(true);
    expect(p1.equals(p3)).toBe(false);
  });
  it("toString", () => {
    const p = new NumberNumberPair(1, 2);
    expect(p.toString()).not.toBe("");
  });
});
