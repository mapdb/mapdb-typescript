// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { NumberNumberHashMap } from "./number-number-hash-map.js";
import { ImmutableNumberNumberHashMap } from "./immutable-number-number-hash-map.js";

describe("ImmutableNumberNumberHashMap", () => {
  it("get from immutable", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 100);
    m.put(2, 200);
    const im = new ImmutableNumberNumberHashMap(m);
    expect(im.get(1)).toBe(100);
    expect(im.size()).toBe(2);
  });

  it("isolation from mutable", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 100);
    const im = new ImmutableNumberNumberHashMap(m);
    m.put(2, 200);
    expect(im.size()).toBe(1); // immutable is independent
  });

  it("select returns immutable", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 10);
    m.put(2, 20);
    m.put(3, 30);
    const im = new ImmutableNumberNumberHashMap(m);
    const filtered = im.select((_k, v) => v > 15);
    expect(filtered.size()).toBe(2);
    expect(filtered).toBeInstanceOf(ImmutableNumberNumberHashMap);
  });

  it("toMutable returns independent copy", () => {
    const m = new NumberNumberHashMap();
    m.put(1, 100);
    const im = new ImmutableNumberNumberHashMap(m);
    const mut = im.toMutable();
    mut.put(2, 200);
    expect(mut.size()).toBe(2);
    expect(im.size()).toBe(1);
  });
});
