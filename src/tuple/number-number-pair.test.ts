// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberNumberPair } from "./number-number-pair.js";

describe("NumberNumberPair", () => {
  it("one and two", () => {
    const p = new NumberNumberPair(42, 100);
    expect(p.one()).toBe(42);
    expect(p.two()).toBe(100);
  });

  it("equals", () => {
    const a = new NumberNumberPair(1, 2);
    const b = new NumberNumberPair(1, 2);
    const c = new NumberNumberPair(1, 3);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("compareTo", () => {
    const a = new NumberNumberPair(1, 10);
    const b = new NumberNumberPair(2, 5);
    expect(a.compareTo(b)).toBeLessThan(0);
    expect(b.compareTo(a)).toBeGreaterThan(0);
    expect(a.compareTo(a)).toBe(0);
  });

  it("toString", () => {
    const p = new NumberNumberPair(42, 100);
    expect(p.toString()).toBe("(42, 100)");
  });
});
