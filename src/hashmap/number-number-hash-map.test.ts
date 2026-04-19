// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberNumberHashMap } from "./number-number-hash-map.js";

describe("NumberNumberHashMap", () => {
  it("put and get", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 100);
    m.put(2, 200);
    expect(m.get(1)).toBe(100);
    expect(m.get(2)).toBe(200);
    expect(m.get(99)).toBeUndefined();
    expect(m.size()).toBe(2);
  });

  it("put overwrite", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 100);
    const old = m.put(1, 200);
    expect(old).toBe(100);
    expect(m.get(1)).toBe(200);
  });

  it("remove", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 100);
    m.put(2, 200);
    const old = m.remove(1);
    expect(old).toBe(100);
    expect(m.size()).toBe(1);
    expect(m.containsKey(1)).toBe(false);
  });

  it("select and reject", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 10);
    m.put(2, 20);
    m.put(3, 30);

    const big = m.select((_k, v) => v > 15);
    expect(big.size()).toBe(2);

    const small = m.reject((_k, v) => v > 15);
    expect(small.size()).toBe(1);
  });

  it("entries generator", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 10);
    m.put(2, 20);

    const entries = [...m.entries()];
    expect(entries.length).toBe(2);
  });

  it("resize with many entries", () => {
    const m = new NumberNumberHashMap();
    for (let i = 0; i < 1000; i++) {
      m.put(i, i * 10);
    }
    expect(m.size()).toBe(1000);
    for (let i = 0; i < 1000; i++) {
      expect(m.get(i)).toBe(i * 10);
    }
  });

  it("injectInto", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 10);
    m.put(2, 20);
    const sum = m.injectInto(0, (acc, _k, v) => acc + v);
    expect(sum).toBe(30);
  });

  it("clear and isEmpty", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 100);
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
    expect(m.size()).toBe(0);
  });
});
