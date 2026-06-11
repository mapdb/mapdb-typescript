// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.


import { describe, it, expect } from "vitest";
import { ImmutableInt32Float32HashMap } from "./immutable_int32-float32-hash-map.js";
import { Int32Float32HashMap } from "./int32-float32-hash-map.js";

describe("ImmutableInt32Float32HashMap generated", () => {
  it("static of creates immutable map", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2], [3, 3]]);
    expect(m.get(1)).toBe(1);
    expect(m.get(99)).toBeUndefined();
    expect(m.size).toBe(3);
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new Int32Float32HashMap();
    mutable.set(1, 1);
    mutable.set(2, 2);
    const imm = ImmutableInt32Float32HashMap.fromMutable(mutable);
    mutable.set(3, 3);
    expect(imm.size).toBe(2);
    expect(imm.has(3)).toBe(false);
    expect(mutable.size).toBe(3);
  });

  it("get and has", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2]]);
    expect(m.get(1)).toBe(1);
    expect(m.has(1)).toBe(true);
    expect(m.has(99)).toBe(false);
  });

  it("getOrDefault", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1]]);
    expect(m.getOrDefault(1, 3)).toBe(1);
    expect(m.getOrDefault(99, 3)).toBe(3);
  });

  it("size and isEmpty", () => {
    const empty = ImmutableInt32Float32HashMap.of([]);
    expect(empty.size).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ImmutableInt32Float32HashMap.of([[1, 1]]);
    expect(nonEmpty.size).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("entries and Symbol.iterator", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2]]);
    expect([...m.entries()].length).toBe(2);
    expect([...m].length).toBe(2);
  });

  it("keysIter and valuesIter", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2]]);
    expect([...m.keysIter()].length).toBe(2);
    expect([...m.valuesIter()].length).toBe(2);
  });

  it("forEach", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2]]);
    let count = 0;
    m.forEach(() => {
      count++;
    });
    expect(count).toBe(2);
  });

  it("select returns MUTABLE", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2], [3, 3]]);
    const result = m.select((_k, v) => v > 1);
    expect(typeof result.set).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2], [3, 3]]);
    const result = m.reject((_k, v) => v > 1);
    expect(typeof result.set).toBe("function");
    expect(result.size).toBe(1);
  });

  it("anySatisfy / allSatisfy", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2]]);
    expect(m.anySatisfy((_k, v) => v === 2)).toBe(true);
    expect(m.allSatisfy((_k, v) => v > 0)).toBe(true);
  });

  it("injectInto", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2]]);
    const count = m.injectInto(0, (acc) => acc + 1);
    expect(count).toBe(2);
  });

  it("toMutable round-trip", () => {
    const original = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2]]);
    const mutable = original.toMutable();
    mutable.set(3, 3);
    expect(mutable.size).toBe(3);
    expect(original.size).toBe(2);
  });

  it("memoryBytes", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1], [2, 2], [3, 3]]);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });

  it("toString", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1]]);
    expect(m.toString()).not.toBe("");
  });

  // Verify mutators are not available
  it("has no set method", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1]]);
    // @ts-expect-error - set should not exist on immutable
    expect(m.set).toBeUndefined();
  });

  it("has no remove method", () => {
    const m = ImmutableInt32Float32HashMap.of([[1, 1]]);
    // @ts-expect-error - remove should not exist on immutable
    expect(m.remove).toBeUndefined();
  });
});
