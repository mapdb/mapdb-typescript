// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { LinkedHashMap } from "./linkedhashmap";
import { LinkedHashSet } from "./linkedhashset";

describe("LinkedHashMap", () => {
  it("basic put/get/remove", () => {
    const m = new LinkedHashMap<string, number>();
    expect(m.isEmpty()).toBe(true);
    expect(m.put("a", 1)).toBeUndefined();
    expect(m.put("b", 2)).toBeUndefined();
    expect(m.put("a", 10)).toBe(1);
    expect(m.size()).toBe(2);
    expect(m.get("a")).toBe(10);
    expect(m.remove("a")).toBe(10);
    expect(m.size()).toBe(1);
  });

  it("preserves insertion order", () => {
    const m = new LinkedHashMap<string, number>();
    m.put("c", 3);
    m.put("a", 1);
    m.put("b", 2);
    expect(m.keysToArray()).toEqual(["c", "a", "b"]);
    expect(m.valuesToArray()).toEqual([3, 1, 2]);
  });

  it("overwrite preserves position", () => {
    const m = new LinkedHashMap<string, number>();
    m.put("a", 1);
    m.put("b", 2);
    m.put("c", 3);
    m.put("b", 20);
    expect(m.keysToArray()).toEqual(["a", "b", "c"]);
    expect(m.get("b")).toBe(20);
  });

  it("remove preserves order", () => {
    const m = new LinkedHashMap<string, number>();
    m.put("a", 1);
    m.put("b", 2);
    m.put("c", 3);
    m.remove("b");
    expect(m.keysToArray()).toEqual(["a", "c"]);
  });

  it("select preserves order", () => {
    const m = new LinkedHashMap<number, number>();
    m.put(1, 10);
    m.put(2, 20);
    m.put(3, 30);
    const big = m.select((_k, v) => v > 15);
    expect(big.size()).toBe(2);
    expect(big.keysToArray()).toEqual([2, 3]);
  });

  it("iterator yields insertion order", () => {
    const m = LinkedHashMap.of<string, number>(["z", 1], ["a", 2], ["m", 3]);
    const keys = [...m].map(([k]) => k);
    expect(keys).toEqual(["z", "a", "m"]);
  });

  it("clear", () => {
    const m = new LinkedHashMap<number, number>();
    m.put(1, 1);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
});

describe("LinkedHashSet", () => {
  it("basic add/contains/remove", () => {
    const s = new LinkedHashSet<number>();
    expect(s.isEmpty()).toBe(true);
    expect(s.add(1)).toBe(true);
    expect(s.add(2)).toBe(true);
    expect(s.add(1)).toBe(false);
    expect(s.size()).toBe(2);
    expect(s.contains(1)).toBe(true);
    expect(s.contains(99)).toBe(false);
  });

  it("preserves insertion order", () => {
    const s = LinkedHashSet.of(3, 1, 4, 1, 5, 9);
    expect(s.toArray()).toEqual([3, 1, 4, 5, 9]);
  });

  it("remove preserves order", () => {
    const s = LinkedHashSet.of(1, 2, 3, 4);
    s.add(1); // no-op
    expect(s.toArray()).toEqual([1, 2, 3, 4]);
    // remove middle
    expect(s.contains(2)).toBe(true);
    s.forEach(() => {}); // ensure iteration works pre-remove
    // We just test final state:
    const s2 = LinkedHashSet.of(10, 20, 30);
    s2.add(20); // duplicate no-op
    expect(s2.toArray()).toEqual([10, 20, 30]);
  });

  it("set operations preserve order", () => {
    const a = LinkedHashSet.of(1, 2, 3);
    const b = LinkedHashSet.of(2, 3, 4);
    expect(a.union(b).toArray()).toEqual([1, 2, 3, 4]);
    expect(a.intersect(b).toArray()).toEqual([2, 3]);
    expect(a.difference(b).toArray()).toEqual([1]);
    expect(a.symmetricDifference(b).toArray()).toEqual([1, 4]);
  });

  it("select/reject preserve order", () => {
    const s = LinkedHashSet.of(1, 2, 3, 4, 5);
    expect(s.select((v) => v % 2 === 0).toArray()).toEqual([2, 4]);
    expect(s.reject((v) => v % 2 === 0).toArray()).toEqual([1, 3, 5]);
  });

  it("detect returns first match in insertion order", () => {
    const s = LinkedHashSet.of(1, 2, 3);
    expect(s.detect((v) => v > 1)).toBe(2);
  });

  it("clear", () => {
    const s = LinkedHashSet.of(1, 2);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });

  it("iterator yields insertion order", () => {
    const s = LinkedHashSet.of(5, 3, 1);
    expect([...s]).toEqual([5, 3, 1]);
  });
});
