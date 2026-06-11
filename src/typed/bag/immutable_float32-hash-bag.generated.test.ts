// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-bag`.


import { describe, it, expect } from "vitest";
import { ImmutableFloat32HashBag } from "./immutable_float32-hash-bag.js";
import { Float32HashBag } from "./float32-hash-bag.js";

describe("ImmutableFloat32HashBag generated", () => {
  it("static of creates immutable bag", () => {
    const b = ImmutableFloat32HashBag.of([1, 1, 2]);
    expect(b.occurrencesOf(1)).toBe(2);
    expect(b.occurrencesOf(2)).toBe(1);
    expect(b.size).toBe(3);
    expect(b.sizeDistinct()).toBe(2);
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new Float32HashBag();
    mutable.add(1);
    mutable.add(1);
    mutable.add(2);
    const imm = ImmutableFloat32HashBag.fromMutable(mutable);
    mutable.add(3);
    expect(imm.size).toBe(3);
    expect(imm.has(3)).toBe(false);
    expect(mutable.size).toBe(4);
  });

  it("occurrencesOf and has", () => {
    const b = ImmutableFloat32HashBag.of([1, 1, 2]);
    expect(b.occurrencesOf(1)).toBe(2);
    expect(b.occurrencesOf(99)).toBe(0);
    expect(b.has(1)).toBe(true);
    expect(b.has(99)).toBe(false);
  });

  it("size, sizeDistinct, isEmpty", () => {
    const empty = ImmutableFloat32HashBag.of([]);
    expect(empty.size).toBe(0);
    expect(empty.sizeDistinct()).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ImmutableFloat32HashBag.of([1, 1]);
    expect(nonEmpty.size).toBe(2);
    expect(nonEmpty.sizeDistinct()).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("entries", () => {
    const b = ImmutableFloat32HashBag.of([1, 1, 2]);
    let total = 0;
    for (const [, count] of b.entries()) {
      total += count;
    }
    expect(total).toBe(3);
  });

  it("Symbol.iterator yields repeated items", () => {
    const b = ImmutableFloat32HashBag.of([1, 1, 2]);
    const collected: number[] = [];
    for (const v of b) {
      collected.push(v);
    }
    expect(collected.length).toBe(3);
  });

  it("forEach repeats by occurrence count", () => {
    const b = ImmutableFloat32HashBag.of([1, 1, 2]);
    let count = 0;
    b.forEach(() => {
      count++;
    });
    expect(count).toBe(3);
  });

  it("forEachWithOccurrences", () => {
    const b = ImmutableFloat32HashBag.of([1, 1, 2]);
    let total = 0;
    b.forEachWithOccurrences((_v, c) => {
      total += c;
    });
    expect(total).toBe(3);
  });

  it("select returns MUTABLE", () => {
    const b = ImmutableFloat32HashBag.of([1, 2, 3]);
    const result = b.select((v) => v > 1);
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const b = ImmutableFloat32HashBag.of([1, 2, 3]);
    const result = b.reject((v) => v > 1);
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(1);
  });

  it("toArray repeats by occurrence count", () => {
    const b = ImmutableFloat32HashBag.of([1, 1, 2]);
    const arr = b.toArray();
    expect(arr.length).toBe(3);
  });

  it("toMutable round-trip", () => {
    const original = ImmutableFloat32HashBag.of([1, 1, 2]);
    const mutable = original.toMutable();
    mutable.add(3);
    expect(mutable.size).toBe(4);
    expect(original.size).toBe(3);
  });

  it("toString", () => {
    const b = ImmutableFloat32HashBag.of([1]);
    expect(b.toString()).not.toBe("");
  });

  it("memoryBytes", () => {
    const b = ImmutableFloat32HashBag.of([1, 2, 3]);
    expect(b.memoryBytes()).toBeGreaterThanOrEqual(0);
  });

  it("defensive copy - modifying source array doesn't affect immutable", () => {
    const source = [1, 2, 3];
    const b = ImmutableFloat32HashBag.of(source);
    source[0] = 99 as any;
    expect(b.has(1)).toBe(true);
    expect(b.has(99)).toBe(false);
  });

  // Verify mutators are not available
  it("has no add method", () => {
    const b = ImmutableFloat32HashBag.of([1]);
    // @ts-expect-error - add should not exist on immutable
    expect(b.add).toBeUndefined();
  });

  it("has no remove method", () => {
    const b = ImmutableFloat32HashBag.of([1]);
    // @ts-expect-error - remove should not exist on immutable
    expect(b.remove).toBeUndefined();
  });
});
