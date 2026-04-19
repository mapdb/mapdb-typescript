// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Int32ArrayList } from "./int32-array-list.js";

describe("Int32ArrayList (TypedArray-backed)", () => {
  it("add and get", () => {
    const l = new Int32ArrayList();
    l.add(10);
    l.add(20);
    l.add(30);
    expect(l.size()).toBe(3);
    expect(l.get(1)).toBe(20);
  });

  it("sort", () => {
    const l = new Int32ArrayList();
    l.add(30);
    l.add(10);
    l.add(20);
    l.sort();
    expect(l.toArray()).toEqual(new Int32Array([10, 20, 30]));
  });

  it("sum, min, max", () => {
    const l = new Int32ArrayList();
    for (let i = 1; i <= 5; i++) l.add(i);
    expect(l.sum()).toBe(15);
    expect(l.min()).toBe(1);
    expect(l.max()).toBe(5);
  });

  it("select", () => {
    const l = new Int32ArrayList();
    for (let i = 1; i <= 10; i++) l.add(i);
    const evens = l.select((v) => v % 2 === 0);
    expect(evens.size()).toBe(5);
  });

  it("resize with many entries", () => {
    const l = new Int32ArrayList();
    for (let i = 0; i < 1000; i++) l.add(i);
    expect(l.size()).toBe(1000);
    expect(l.get(999)).toBe(999);
  });

  it("memoryBytes", () => {
    const l = new Int32ArrayList(64);
    // 64 capacity × 4 bytes = 256 bytes
    expect(l.memoryBytes()).toBe(64 * 4);
  });
});
