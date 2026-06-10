// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Regression test for the f32-list sum contract (spec/algorithms.md): the f32
// ArrayList sum is a PER-ADD f32 left-fold (round each running total to f32),
// matching Go's float32-accumulating Float32ArrayList.Sum(). A naive f64-once
// accumulation would over-retain precision and disagree cross-language. The
// validation runner routes HashMap/list f32 sums through this production
// method instead of folding locally. Non-generated so codegen can't clobber it.

import { describe, it, expect } from "vitest";
import { Float32ArrayList } from "./float32-array-list.js";
import { ImmutableFloat32ArrayList } from "./immutable_float32-array-list.js";

describe("Float32ArrayList.sum f32 per-add fold", () => {
  it("matches a manual Math.fround left-fold", () => {
    const vals = [0.1, 0.2, 0.3, 1e7, -1e7, 0.123456789];
    const list = new Float32ArrayList();
    // Float32Array store already rounds the inputs to f32; the fold then
    // rounds each partial sum to f32 too.
    const stored: number[] = [];
    for (const v of vals) {
      list.add(v);
      stored.push(Math.fround(v));
    }
    let expected = Math.fround(0);
    for (const v of stored) expected = Math.fround(expected + v);
    expect(list.sum()).toBe(expected);
  });

  it("differs from a naive f64-once accumulation when precision matters", () => {
    // Many tiny adds onto a base above 2^24 (= 16777216), where the f32 ULP
    // exceeds 1. The per-add f32 fold loses each `+1` (it falls below the
    // running total's f32 ULP and rounds back); an f64 accumulation retains
    // them, so the two disagree — proving the fold is genuinely f32-width.
    const base = 1 << 25; // 33554432, f32 ULP here is 4
    const list = new Float32ArrayList();
    list.add(base);
    for (let i = 0; i < 16; i++) list.add(1);
    // Per-add f32 fold: base + 1 rounds back to base every time.
    expect(list.sum()).toBe(Math.fround(base));
    // Sanity: an f64-once accumulation would have produced base + 16.
    let f64 = 0;
    for (const v of list.toArray()) f64 += v;
    expect(f64).toBe(base + 16);
    expect(list.sum()).not.toBe(f64);
  });

  it("immutable list sum matches the mutable list sum", () => {
    const vals = [0.1, 0.2, 0.3, 100.5, -7.25];
    const mut = new Float32ArrayList();
    for (const v of vals) mut.add(v);
    const imm = ImmutableFloat32ArrayList.of(vals);
    expect(imm.sum()).toBe(mut.sum());
  });

  it("empty list sums to +0", () => {
    const list = new Float32ArrayList();
    expect(Object.is(list.sum(), 0)).toBe(true);
  });
});
