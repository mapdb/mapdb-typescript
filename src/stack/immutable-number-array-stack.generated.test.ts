// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { NumberArrayStack } from "./number-array-stack.js";
import { ImmutableNumberArrayStack } from "./immutable-number-array-stack.js";

describe("ImmutableNumberArrayStack generated", () => {
  it("peek and size", () => {
    const im = ImmutableNumberArrayStack.of([1, 2]);
    expect(im.size).toBe(2);
    expect(im.peek()).toBe(2);
  });
  it("push returns new stack", () => {
    const im = ImmutableNumberArrayStack.of([1]);
    const im2 = im.push(2);
    expect(im.size).toBe(1);
    expect(im2.size).toBe(2);
  });
  it("pop returns new stack and value", () => {
    const im = ImmutableNumberArrayStack.of([1, 2]);
    const [im2, val] = im.pop();
    expect(val).toBe(2);
    expect(im2.size).toBe(1);
    expect(im.size).toBe(2);
  });
  it("toMutable does not affect immutable", () => {
    const im = ImmutableNumberArrayStack.of([1]);
    im.toMutable().push(2);
    expect(im.size).toBe(1);
  });
});
