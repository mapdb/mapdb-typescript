// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Multimap } from "./multimap.js";

describe("Multimap", () => {
  it("put and get", () => {
    const m = new Multimap<string, number>();
    m.put("a", 1);
    m.put("a", 2);
    m.put("b", 3);
    expect(m.size()).toBe(3);
    expect(m.sizeDistinct()).toBe(2);
    expect(m.get("a")).toEqual([1, 2]);
    expect(m.get("b")).toEqual([3]);
    expect(m.get("c")).toEqual([]);
  });

  it("putAll", () => {
    const m = new Multimap<string, number>();
    m.putAll("x", 1, 2, 3);
    expect(m.get("x")).toEqual([1, 2, 3]);
    expect(m.size()).toBe(3);
  });

  it("removeAll", () => {
    const m = new Multimap<string, number>();
    m.putAll("x", 1, 2, 3);
    const removed = m.removeAll("x");
    expect(removed).toEqual([1, 2, 3]);
    expect(m.size()).toBe(0);
    expect(m.containsKey("x")).toBe(false);
  });

  it("entries generator", () => {
    const m = new Multimap<number, string>();
    m.put(1, "a");
    m.put(1, "b");
    m.put(2, "c");
    const entries = [...m.entries()];
    expect(entries.length).toBe(3);
  });

  it("forEachKey", () => {
    const m = new Multimap<string, number>();
    m.putAll("x", 1, 2);
    m.putAll("y", 3);
    let total = 0;
    m.forEachKey((_k, vals) => {
      total += vals.length;
    });
    expect(total).toBe(3);
  });
});
