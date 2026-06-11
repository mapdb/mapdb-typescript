// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


import { describe, it, expect } from "vitest";
import { BigIntNumberTreeMap } from "./bigint-number-tree-map.js";

describe("BigIntNumberTreeMap generated", () => {
  it("put and get", () => {
    const m = new BigIntNumberTreeMap();
    m.set(3n, 3);
    m.set(1n, 1);
    m.set(2n, 2);
    expect(m.size()).toBe(3);
    expect(m.get(2n)).toBe(2);
    expect(m.get(99n)).toBeUndefined();
  });
  it("remove", () => {
    const m = new BigIntNumberTreeMap();
    m.set(1n, 1);
    m.set(2n, 2);
    expect(m.remove(1n)).toBe(1);
    expect(m.size()).toBe(1);
  });
  it("min and max", () => {
    const m = new BigIntNumberTreeMap();
    m.set(3n, 3);
    m.set(1n, 1);
    expect(m.min()?.[0]).toBe(1n);
    expect(m.max()?.[0]).toBe(3n);
  });
  it("sorted iteration", () => {
    const m = new BigIntNumberTreeMap();
    m.set(3n, 3);
    m.set(1n, 1);
    m.set(2n, 2);
    const keys = [...m.keys()];
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i] >= keys[i - 1]).toBe(true);
    }
  });
  it("clear", () => {
    const m = new BigIntNumberTreeMap();
    m.set(1n, 1);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select", () => {
    const m = new BigIntNumberTreeMap();
    m.set(1n, 1);
    m.set(2n, 2);
    m.set(3n, 3);
    expect(m.select((_k, v) => v > 1).size()).toBe(2);
  });
  it("toString", () => {
    const m = new BigIntNumberTreeMap();
    m.set(1n, 1);
    expect(m.toString()).not.toBe("");
  });
});
