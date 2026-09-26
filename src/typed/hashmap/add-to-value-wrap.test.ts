// Copyright (c) 2026 Jan Kotek.
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Hand-written (not generated): typed-map addToValue returns the value it
// STORED, i.e. wrapped/narrowed at the value width (audit fable-spec-allign
// 04-typescript F7; algorithms.md "Integer overflow contract").

import { describe, it, expect } from "vitest";
import { Int32Int32HashMap } from "./int32-int32-hash-map.js";
import { Int32Int8HashMap } from "./int32-int8-hash-map.js";
import { Int32Float32HashMap } from "./int32-float32-hash-map.js";
import { Int32BigInt64HashMap } from "./int32-bigint64-hash-map.js";
import { Int32Float64HashMap } from "./int32-float64-hash-map.js";

describe("typed addToValue returns the stored value (F7)", () => {
  it("Int32Int32HashMap wraps at i32 and returns the wrapped sum", () => {
    const m = new Int32Int32HashMap();
    expect(m.addToValue(1, 2147483647)).toBe(2147483647);
    const r = m.addToValue(1, 1);
    expect(r).toBe(-2147483648);
    expect(r).toBe(m.get(1));
  });

  it("Int32Int8HashMap narrows on insert and on add", () => {
    const m = new Int32Int8HashMap();
    expect(m.addToValue(1, 200)).toBe(-56);
    expect(m.get(1)).toBe(-56);
    expect(m.addToValue(1, -100)).toBe(100);
    expect(m.get(1)).toBe(100);
  });

  it("Int32Float32HashMap returns the float32-rounded sum", () => {
    const m = new Int32Float32HashMap();
    const r = m.addToValue(1, 0.1);
    expect(r).toBe(Math.fround(0.1));
    expect(r).toBe(m.get(1));
  });

  it("Int32BigInt64HashMap wraps at i64", () => {
    const m = new Int32BigInt64HashMap();
    m.addToValue(1, 2n ** 63n - 1n);
    const r = m.addToValue(1, 1n);
    expect(r).toBe(-(2n ** 63n));
    expect(r).toBe(m.get(1));
  });

  it("Int32Float64HashMap is lossless", () => {
    const m = new Int32Float64HashMap();
    expect(m.addToValue(1, 0.1)).toBe(0.1);
    expect(m.addToValue(1, 0.2)).toBe(0.1 + 0.2);
  });
});
