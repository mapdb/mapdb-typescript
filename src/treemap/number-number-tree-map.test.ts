// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberNumberTreeMap } from "./number-number-tree-map.js";

describe("NumberNumberTreeMap", () => {
  it("put and get", () => {
    const m = new NumberNumberTreeMap();
    m.put(3, 30);
    m.put(1, 10);
    m.put(2, 20);
    expect(m.get(2)).toBe(20);
    expect(m.get(99)).toBeUndefined();
    expect(m.size()).toBe(3);
  });

  it("sorted iteration", () => {
    const m = new NumberNumberTreeMap();
    m.put(50, 500);
    m.put(10, 100);
    m.put(30, 300);
    m.put(20, 200);
    m.put(40, 400);

    const keys = [...m.keys()];
    expect(keys).toEqual([10, 20, 30, 40, 50]);
  });

  it("min and max", () => {
    const m = new NumberNumberTreeMap();
    m.put(30, 300);
    m.put(10, 100);
    m.put(50, 500);
    expect(m.min()).toEqual([10, 100]);
    expect(m.max()).toEqual([50, 500]);
  });

  it("floor and ceiling", () => {
    const m = new NumberNumberTreeMap();
    m.put(10, 100);
    m.put(20, 200);
    m.put(30, 300);
    expect(m.floor(25)).toEqual([20, 200]);
    expect(m.ceiling(25)).toEqual([30, 300]);
    expect(m.floor(10)).toEqual([10, 100]);
    expect(m.ceiling(30)).toEqual([30, 300]);
  });

  it("remove", () => {
    const m = new NumberNumberTreeMap();
    for (let i = 1; i <= 20; i++) m.put(i, i * 10);
    for (let i = 1; i <= 20; i += 2) m.remove(i);
    expect(m.size()).toBe(10);
    const keys = [...m.keys()];
    for (const k of keys) {
      expect(k % 2).toBe(0);
    }
    // verify still sorted
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toBeGreaterThan(keys[i - 1]);
    }
  });

  it("rangeKeys", () => {
    const m = new NumberNumberTreeMap();
    for (let i = 1; i <= 10; i++) m.put(i, i * 10);
    const keys = [...m.rangeKeys(3, 7)].map(([k]) => k);
    expect(keys).toEqual([3, 4, 5, 6]);
  });

  it("large insert/delete", () => {
    const m = new NumberNumberTreeMap();
    for (let i = 0; i < 1000; i++) m.put(i, i);
    expect(m.size()).toBe(1000);
    for (let i = 0; i < 500; i++) m.remove(i);
    expect(m.size()).toBe(500);
    // verify sorted
    const keys = [...m.keys()];
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toBeGreaterThan(keys[i - 1]);
    }
  });

  it("empty map", () => {
    const m = new NumberNumberTreeMap();
    expect(m.isEmpty()).toBe(true);
    expect(m.min()).toBeUndefined();
    expect(m.max()).toBeUndefined();
    expect(m.size()).toBe(0);
  });

  it("select", () => {
    const m = new NumberNumberTreeMap();
    m.put(1, 10);
    m.put(2, 20);
    m.put(3, 30);
    const big = m.select((_k, v) => v > 15);
    expect(big.size()).toBe(2);
    // result should also be sorted
    const keys = [...big.keys()];
    expect(keys).toEqual([2, 3]);
  });
});
