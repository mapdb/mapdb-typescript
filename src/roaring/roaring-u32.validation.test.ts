// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { RoaringU32 } from "./roaring-u32.js";

describe("RoaringU32 value-domain validation (cross-language u32 contract)", () => {
  it("add/remove/contains reject non-u32 values rather than coercing via >>> 0", () => {
    const s = new RoaringU32();
    // Witness: `value >>> 0` previously coerced 1.5 -> 1, -1 -> 0xFFFFFFFF,
    // 2^32 -> 0, NaN -> 0 — none expressible by the typed ports' u32 parameter.
    expect(() => s.add(1.5)).toThrow(RangeError);
    expect(() => s.add(-1)).toThrow(RangeError);
    expect(() => s.add(4294967296)).toThrow(RangeError); // 2^32
    expect(() => s.add(NaN)).toThrow(RangeError);
    expect(() => s.add(Infinity)).toThrow(RangeError);
    expect(() => s.remove(-1)).toThrow(RangeError);
    expect(() => s.contains(1.5)).toThrow(RangeError);
    expect(() => RoaringU32.fromValues([0, 1, -1])).toThrow(RangeError);
  });

  it("accepts the full u32 domain (0 .. 2^32-1)", () => {
    const s = new RoaringU32();
    expect(s.add(0)).toBe(true);
    expect(s.add(2147483648)).toBe(true); // 2^31 (i32 MIN bit pattern)
    expect(s.add(4294967295)).toBe(true); // 2^32 - 1 (i32 -1 bit pattern)
    expect(s.contains(0)).toBe(true);
    expect(s.contains(4294967295)).toBe(true);
    expect(s.contains(1)).toBe(false);
    expect(s.remove(2147483648)).toBe(true);
  });
});
