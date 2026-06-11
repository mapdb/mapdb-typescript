// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.


import { describe, it, expect } from "vitest";
import { Int16Float32HashMap } from "./int16-float32-hash-map.js";

describe("Int16Float32HashMap generated", () => {
  it("set and get", () => {
    const m = new Int16Float32HashMap();
    m.set(1, 1);
    m.set(2, 2);
    m.set(3, 3);
    expect(m.get(1)).toBe(1);
    expect(m.get(99)).toBeUndefined();
    expect(m.size).toBe(3);
  });
  it("set overwrite", () => {
    const m = new Int16Float32HashMap();
    m.set(1, 1);
    expect(m.set(1, 2)).toBe(m); // set returns the map for chaining
    expect(m.get(1)).toBe(2);
  });
  it("remove", () => {
    const m = new Int16Float32HashMap();
    m.set(1, 1);
    m.set(2, 2);
    expect(m.remove(1)).toBe(1);
    expect(m.size).toBe(1);
    expect(m.has(1)).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new Int16Float32HashMap();
    m.set(1, 1);
    expect(m.getOrDefault(1, 3)).toBe(1);
    expect(m.getOrDefault(99, 3)).toBe(3);
  });
  it("isEmpty and clear", () => {
    const m = new Int16Float32HashMap();
    expect(m.isEmpty()).toBe(true);
    m.set(1, 1);
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select", () => {
    const m = new Int16Float32HashMap();
    m.set(1, 1);
    m.set(2, 2);
    m.set(3, 3);
    expect(m.select((_k, v) => v > 1).size).toBe(2);
  });
  it("anySatisfy / allSatisfy", () => {
    const m = new Int16Float32HashMap();
    m.set(1, 1);
    m.set(2, 2);
    expect(m.anySatisfy((_k, v) => v === 2)).toBe(true);
    expect(m.allSatisfy((_k, v) => v > 0)).toBe(true);
  });
  it("resize", () => {
    const m = new Int16Float32HashMap();
    for (let i = 0; i < 100; i += 1) m.set(i, i * 10);
    expect(m.size).toBe(100);
  });
  it("memoryBytes", () => {
    const m = new Int16Float32HashMap(64);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const m = new Int16Float32HashMap();
    m.set(1, 1);
    expect(m.toString()).not.toBe("");
  });
});
