// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntArrayStack } from "./bigint-array-stack.js";

describe("BigIntArrayStack generated", () => {
  it("push, peek, pop", () => {
    const s = new BigIntArrayStack();
    s.push(1n);
    s.push(2n);
    s.push(3n);
    expect(s.size()).toBe(3);
    expect(s.peek()).toBe(3n);
    expect(s.pop()).toBe(3n);
    expect(s.size()).toBe(2);
  });
  it("LIFO order", () => {
    const s = new BigIntArrayStack();
    s.push(1n);
    s.push(2n);
    s.push(3n);
    expect(s.pop()).toBe(3n);
    expect(s.pop()).toBe(2n);
    expect(s.pop()).toBe(1n);
  });
  it("isEmpty and clear", () => {
    const s = new BigIntArrayStack();
    expect(s.isEmpty()).toBe(true);
    s.push(1n);
    expect(s.isEmpty()).toBe(false);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });
  it("contains", () => {
    const s = new BigIntArrayStack();
    s.push(1n);
    s.push(2n);
    expect(s.contains(1n)).toBe(true);
    expect(s.contains(3n)).toBe(false);
  });
  it("values generator", () => {
    const s = new BigIntArrayStack();
    s.push(1n);
    s.push(2n);
    expect([...s.values()].length).toBe(2);
  });
  it("toArray", () => {
    const s = new BigIntArrayStack();
    s.push(1n);
    s.push(2n);
    expect(s.toArray().length).toBe(2);
  });
  it("forEach", () => {
    const s = new BigIntArrayStack();
    s.push(1n);
    s.push(2n);
    let count = 0;
    s.forEach(() => count++);
    expect(count).toBe(2);
  });
  it("toString", () => {
    const s = new BigIntArrayStack();
    s.push(1n);
    expect(s.toString()).not.toBe("");
  });
});
