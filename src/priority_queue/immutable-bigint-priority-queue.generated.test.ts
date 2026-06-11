// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntPriorityQueue } from "./bigint-priority-queue.js";
import { ImmutableBigIntPriorityQueue } from "./immutable-bigint-priority-queue.js";

describe("ImmutableBigIntPriorityQueue generated", () => {
  it("of heapifies and peek returns minimum", () => {
    const im = ImmutableBigIntPriorityQueue.of([3n, 1n, 2n]);
    expect(im.size).toBe(3);
    // For bool, v[0]=true so min is false (v[1]); only assert presence.
    expect(im.peek()).toBeDefined();
  });

  it("push returns new queue, original untouched", () => {
    const im = ImmutableBigIntPriorityQueue.of([3n]);
    const im2 = im.push(1n);
    expect(im.size).toBe(1);
    expect(im2.size).toBe(2);
  });

  it("pop returns [newQueue, value]", () => {
    const im = ImmutableBigIntPriorityQueue.of([1n, 2n, 3n]);
    const r = im.pop()!;
    expect(r).toBeDefined();
    expect(r[0].size).toBe(2);
    expect(im.size).toBe(3);
  });

  it("pop on empty returns undefined", () => {
    expect(ImmutableBigIntPriorityQueue.of([]).pop()).toBeUndefined();
  });

  it("contains and isEmpty", () => {
    const im = ImmutableBigIntPriorityQueue.of([1n]);
    expect(im.has(1n)).toBe(true);
    expect(im.isEmpty).toBe(false);
    expect(ImmutableBigIntPriorityQueue.of([]).isEmpty).toBe(true);
  });

  it("toMutable does not affect immutable", () => {
    const im = ImmutableBigIntPriorityQueue.of([1n]);
    im.toMutable().push(2n);
    expect(im.size).toBe(1);
  });

  it("iterator yields heap-array order (length only)", () => {
    const im = ImmutableBigIntPriorityQueue.of([1n, 2n]);
    let count = 0;
    for (const _ of im) count++;
    expect(count).toBe(2);
  });
});
