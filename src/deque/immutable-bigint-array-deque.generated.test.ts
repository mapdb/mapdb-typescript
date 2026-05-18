// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntArrayDeque } from "./bigint-array-deque.js";
import { ImmutableBigIntArrayDeque } from "./immutable-bigint-array-deque.js";

describe("ImmutableBigIntArrayDeque generated", () => {
  it("of, peekFirst/peekLast, size", () => {
    const im = ImmutableBigIntArrayDeque.of([1n, 2n, 3n]);
    expect(im.size).toBe(3);
    expect(im.peekFirst()).toBe(1n);
    expect(im.peekLast()).toBe(3n);
  });

  it("withFirst/withLast are persistent", () => {
    const im = ImmutableBigIntArrayDeque.of([2n]);
    const im2 = im.withFirst(1n);
    const im3 = im2.withLast(3n);
    expect(im.size).toBe(1);
    expect(im3.size).toBe(3);
    expect(im3.peekFirst()).toBe(1n);
    expect(im3.peekLast()).toBe(3n);
  });

  it("withoutFirst/withoutLast return new deques", () => {
    const im = ImmutableBigIntArrayDeque.of([1n, 2n, 3n]);
    const r1 = im.withoutFirst()!;
    expect(r1.value).toBe(1n);
    expect(r1.deque.size).toBe(2);
    const r2 = im.withoutLast()!;
    expect(r2.value).toBe(3n);
    expect(r2.deque.size).toBe(2);
    expect(im.size).toBe(3);
  });

  it("withoutFirst/withoutLast on empty returns undefined", () => {
    const im = ImmutableBigIntArrayDeque.of([]);
    expect(im.withoutFirst()).toBeUndefined();
    expect(im.withoutLast()).toBeUndefined();
  });

  it("contains and isEmpty", () => {
    const im = ImmutableBigIntArrayDeque.of([1n]);
    expect(im.contains(1n)).toBe(true);
    expect(im.isEmpty).toBe(false);
    expect(ImmutableBigIntArrayDeque.of([]).isEmpty).toBe(true);
  });

  it("toMutable does not affect immutable", () => {
    const im = ImmutableBigIntArrayDeque.of([1n]);
    im.toMutable().addLast(2n);
    expect(im.size).toBe(1);
  });

  it("iterator yields front-to-back", () => {
    const im = ImmutableBigIntArrayDeque.of([1n, 2n]);
    const out: bigint[] = [];
    for (const x of im) out.push(x);
    expect(out).toEqual([1n, 2n]);
  });
});
