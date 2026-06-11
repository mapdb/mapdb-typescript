// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.


import { describe, it, expect } from "vitest";
import { ImmutableBigInt64BigInt64HashMap } from "./immutable_bigint64-bigint64-hash-map.js";
import { BigInt64BigInt64HashMap } from "./bigint64-bigint64-hash-map.js";

describe("ImmutableBigInt64BigInt64HashMap generated", () => {
  it("static of creates immutable map", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n], [3n, 3n]]);
    expect(m.get(1n)).toBe(1n);
    expect(m.get(99n)).toBeUndefined();
    expect(m.size).toBe(3);
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new BigInt64BigInt64HashMap();
    mutable.set(1n, 1n);
    mutable.set(2n, 2n);
    const imm = ImmutableBigInt64BigInt64HashMap.fromMutable(mutable);
    mutable.set(3n, 3n);
    expect(imm.size).toBe(2);
    expect(imm.has(3n)).toBe(false);
    expect(mutable.size).toBe(3);
  });

  it("get and has", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n]]);
    expect(m.get(1n)).toBe(1n);
    expect(m.has(1n)).toBe(true);
    expect(m.has(99n)).toBe(false);
  });

  it("getOrDefault", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n]]);
    expect(m.getOrDefault(1n, 3n)).toBe(1n);
    expect(m.getOrDefault(99n, 3n)).toBe(3n);
  });

  it("size and isEmpty", () => {
    const empty = ImmutableBigInt64BigInt64HashMap.of([]);
    expect(empty.size).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n]]);
    expect(nonEmpty.size).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("entries and Symbol.iterator", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n]]);
    expect([...m.entries()].length).toBe(2);
    expect([...m].length).toBe(2);
  });

  it("keysIter and valuesIter", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n]]);
    expect([...m.keysIter()].length).toBe(2);
    expect([...m.valuesIter()].length).toBe(2);
  });

  it("forEach", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n]]);
    let count = 0;
    m.forEach(() => {
      count++;
    });
    expect(count).toBe(2);
  });

  it("select returns MUTABLE", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n], [3n, 3n]]);
    const result = m.select((_k, v) => v > 1n);
    expect(typeof result.set).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n], [3n, 3n]]);
    const result = m.reject((_k, v) => v > 1n);
    expect(typeof result.set).toBe("function");
    expect(result.size).toBe(1);
  });

  it("anySatisfy / allSatisfy", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n]]);
    expect(m.anySatisfy((_k, v) => v === 2n)).toBe(true);
    expect(m.allSatisfy((_k, v) => v > 0n)).toBe(true);
  });

  it("injectInto", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n]]);
    const count = m.injectInto(0, (acc) => acc + 1);
    expect(count).toBe(2);
  });

  it("toMutable round-trip", () => {
    const original = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n]]);
    const mutable = original.toMutable();
    mutable.set(3n, 3n);
    expect(mutable.size).toBe(3);
    expect(original.size).toBe(2);
  });

  it("memoryBytes", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n], [2n, 2n], [3n, 3n]]);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });

  it("toString", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n]]);
    expect(m.toString()).not.toBe("");
  });

  // Verify mutators are not available
  it("has no set method", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n]]);
    // @ts-expect-error - set should not exist on immutable
    expect(m.set).toBeUndefined();
  });

  it("has no remove method", () => {
    const m = ImmutableBigInt64BigInt64HashMap.of([[1n, 1n]]);
    // @ts-expect-error - remove should not exist on immutable
    expect(m.remove).toBeUndefined();
  });
});
