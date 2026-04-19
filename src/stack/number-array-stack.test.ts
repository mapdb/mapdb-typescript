// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberArrayStack } from "./number-array-stack.js";

describe("NumberArrayStack", () => {
  it("push, pop, peek", () => {
    const s = new NumberArrayStack();
    s.push(10);
    s.push(20);
    s.push(30);
    expect(s.peek()).toBe(30);
    expect(s.pop()).toBe(30);
    expect(s.pop()).toBe(20);
    expect(s.size()).toBe(1);
  });

  it("peekAt", () => {
    const s = NumberArrayStack.of([10, 20, 30]);
    expect(s.peekAt(0)).toBe(30); // top
    expect(s.peekAt(1)).toBe(20);
    expect(s.peekAt(2)).toBe(10); // bottom
  });

  it("contains", () => {
    const s = NumberArrayStack.of([1, 2, 3]);
    expect(s.contains(2)).toBe(true);
    expect(s.contains(99)).toBe(false);
  });

  it("values generator", () => {
    const s = NumberArrayStack.of([10, 20, 30]);
    const values = [...s.values()];
    expect(values).toEqual([30, 20, 10]); // top to bottom
  });
});
