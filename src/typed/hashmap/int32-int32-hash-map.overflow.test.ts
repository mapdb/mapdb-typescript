// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Regression test for the cross-language "Integer overflow contract"
// (spec/algorithms.md). The STORED value of addToValue wraps at the declared
// i32 width, because keys+values are Int32Array-backed and the store truncates
// to i32. This is a PRODUCTION property of the width-aware typed map — the
// validation runner routes HashMap<i32,i32> through here and reads the result
// back via get() (the scenario asserts get_1), with NO runner-side `| 0`.
//
// NOTE on the RETURN value: addToValue returns the pre-store f64 sum (not the
// width-truncated value) in this generic typed map. The scenario asserts the
// STORED value via get(), which is the contract that matters and is exercised.
// Asserting the return would require a width-aware return path; left as the
// existing behavior to avoid corrupting the shared typed-map template (and the
// float-keyed maps, whose key narrows on store but is hashed as f64, cannot
// reliably read a value back). Non-generated so codegen can't clobber it.

import { describe, it, expect } from "vitest";
import { Int32Int32HashMap } from "./int32-int32-hash-map.js";

const I32_MAX = 2147483647;
const I32_MIN = -2147483648;

describe("Int32Int32HashMap addToValue i32 overflow contract (stored value)", () => {
  it("i32 MAX + 1 stores i32 MIN", () => {
    const m = new Int32Int32HashMap();
    m.set(1, I32_MAX);
    m.addToValue(1, 1);
    // 06-overflow/i32_add_to_value_overflow.json asserts get_1 == i32 MIN.
    expect(m.get(1)).toBe(I32_MIN);
  });

  it("i32 MIN - 1 stores i32 MAX", () => {
    const m = new Int32Int32HashMap();
    m.set(1, I32_MIN);
    m.addToValue(1, -1);
    // 06-overflow/i32_add_to_value_underflow.json asserts get_1 == i32 MAX.
    expect(m.get(1)).toBe(I32_MAX);
  });

  it("addToValue on absent key stores the width-truncated delta", () => {
    const m = new Int32Int32HashMap();
    // A delta that overflows i32 on insert is truncated by the store.
    m.addToValue(5, I32_MAX + 1); // = I32_MIN once truncated
    expect(m.get(5)).toBe(I32_MIN);
  });

  it("repeated addToValue keeps wrapping at i32 width", () => {
    const m = new Int32Int32HashMap();
    m.set(7, I32_MAX);
    m.addToValue(7, 1); // store -> I32_MIN
    m.addToValue(7, 1); // store -> I32_MIN + 1
    expect(m.get(7)).toBe(I32_MIN + 1);
  });
});
