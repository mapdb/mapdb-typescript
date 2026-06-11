// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-bag`.


import { describe, it, expect } from "vitest";
import { ImmutableBigInt64HashBag } from "./immutable_bigint64-hash-bag.js";
import { BigInt64HashBag } from "./bigint64-hash-bag.js";

describe("ImmutableBigInt64HashBag generated", () => {
  it("static of creates immutable bag", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    expect(b.occurrencesOf(1n)).toBe(2);
    expect(b.occurrencesOf(2n)).toBe(1);
    expect(b.size).toBe(3);
    expect(b.sizeDistinct()).toBe(2);
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new BigInt64HashBag();
    mutable.add(1n);
    mutable.add(1n);
    mutable.add(2n);
    const imm = ImmutableBigInt64HashBag.fromMutable(mutable);
    mutable.add(3n);
    expect(imm.size).toBe(3);
    expect(imm.has(3n)).toBe(false);
    expect(mutable.size).toBe(4);
  });

  it("occurrencesOf and has", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    expect(b.occurrencesOf(1n)).toBe(2);
    expect(b.occurrencesOf(99n)).toBe(0);
    expect(b.has(1n)).toBe(true);
    expect(b.has(99n)).toBe(false);
  });

  it("size, sizeDistinct, isEmpty", () => {
    const empty = ImmutableBigInt64HashBag.of([]);
    expect(empty.size).toBe(0);
    expect(empty.sizeDistinct()).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ImmutableBigInt64HashBag.of([1n, 1n]);
    expect(nonEmpty.size).toBe(2);
    expect(nonEmpty.sizeDistinct()).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("entries", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    let total = 0;
    for (const [, count] of b.entries()) {
      total += count;
    }
    expect(total).toBe(3);
  });

  it("Symbol.iterator yields repeated items", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    const collected: bigint[] = [];
    for (const v of b) {
      collected.push(v);
    }
    expect(collected.length).toBe(3);
  });

  it("forEach repeats by occurrence count", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    let count = 0;
    b.forEach(() => {
      count++;
    });
    expect(count).toBe(3);
  });

  it("forEachWithOccurrences", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    let total = 0;
    b.forEachWithOccurrences((_v, c) => {
      total += c;
    });
    expect(total).toBe(3);
  });

  it("select returns MUTABLE", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 2n, 3n]);
    const result = b.select((v) => v > 1n);
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 2n, 3n]);
    const result = b.reject((v) => v > 1n);
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(1);
  });

  it("toArray repeats by occurrence count", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    const arr = b.toArray();
    expect(arr.length).toBe(3);
  });

  it("toMutable round-trip", () => {
    const original = ImmutableBigInt64HashBag.of([1n, 1n, 2n]);
    const mutable = original.toMutable();
    mutable.add(3n);
    expect(mutable.size).toBe(4);
    expect(original.size).toBe(3);
  });

  it("toString", () => {
    const b = ImmutableBigInt64HashBag.of([1n]);
    expect(b.toString()).not.toBe("");
  });

  it("memoryBytes", () => {
    const b = ImmutableBigInt64HashBag.of([1n, 2n, 3n]);
    expect(b.memoryBytes()).toBeGreaterThanOrEqual(0);
  });

  it("defensive copy - modifying source array doesn't affect immutable", () => {
    const source = [1n, 2n, 3n];
    const b = ImmutableBigInt64HashBag.of(source);
    source[0] = 99n as any;
    expect(b.has(1n)).toBe(true);
    expect(b.has(99n)).toBe(false);
  });

  // Verify mutators are not available
  it("has no add method", () => {
    const b = ImmutableBigInt64HashBag.of([1n]);
    // @ts-expect-error - add should not exist on immutable
    expect(b.add).toBeUndefined();
  });

  it("has no remove method", () => {
    const b = ImmutableBigInt64HashBag.of([1n]);
    // @ts-expect-error - remove should not exist on immutable
    expect(b.remove).toBeUndefined();
  });
});
