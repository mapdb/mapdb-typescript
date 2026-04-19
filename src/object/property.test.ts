// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Property-based tests using a simple seeded PRNG. No external deps.

import { describe, it, expect } from "vitest";
import { ArrayList } from "./arraylist";
import { HashSet } from "./hashset";
import { HashBag } from "./hashbag";
import { HashMap } from "./hashmap";
import { ArrayStack } from "./arraystack";
import { HashBiMap } from "./hashbimap";

const TRIALS = 500;

class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed;
  }
  next(bound: number): number {
    // xorshift32
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return Math.abs(this.state) % bound;
  }
}

describe("Property-based tests", () => {
  it("ArrayList: len after push", () => {
    const rng = new Rng(42);
    for (let t = 0; t < TRIALS; t++) {
      const n = rng.next(200);
      const list = new ArrayList<number>();
      for (let i = 0; i < n; i++) list.add(i);
      expect(list.size()).toBe(n);
    }
  });

  it("HashSet: contains after add", () => {
    const rng = new Rng(43);
    for (let t = 0; t < TRIALS; t++) {
      const n = rng.next(200);
      const set = new HashSet<number>();
      const added = new Set<number>();
      for (let i = 0; i < n; i++) {
        const v = rng.next(500);
        set.add(v);
        added.add(v);
      }
      for (const v of added) {
        expect(set.contains(v)).toBe(true);
      }
      for (let probe = 500; probe < 600; probe++) {
        if (!added.has(probe)) {
          expect(set.contains(probe)).toBe(false);
        }
      }
    }
  });

  it("HashBag: occurrences match adds", () => {
    const rng = new Rng(44);
    for (let t = 0; t < TRIALS; t++) {
      const n = rng.next(200);
      const bag = new HashBag<number>();
      const counts = new Map<number, number>();
      for (let i = 0; i < n; i++) {
        const v = rng.next(50);
        bag.add(v);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      for (const [v, expected] of counts) {
        expect(bag.occurrencesOf(v)).toBe(expected);
      }
      expect(bag.size()).toBe(n);
    }
  });

  it("HashMap: get returns what was put", () => {
    const rng = new Rng(45);
    for (let t = 0; t < TRIALS; t++) {
      const n = rng.next(200);
      const map = new HashMap<number, number>();
      const expected = new Map<number, number>();
      for (let i = 0; i < n; i++) {
        const k = rng.next(100);
        const v = rng.next(10000);
        map.put(k, v);
        expected.set(k, v);
      }
      for (const [k, v] of expected) {
        expect(map.get(k)).toBe(v);
      }
      expect(map.size()).toBe(expected.size);
    }
  });

  it("ArrayStack: LIFO order", () => {
    const rng = new Rng(46);
    for (let t = 0; t < TRIALS; t++) {
      const n = rng.next(100);
      const stack = new ArrayStack<number>();
      const values: number[] = [];
      for (let i = 0; i < n; i++) {
        const v = rng.next(10000);
        values.push(v);
        stack.push(v);
      }
      for (let i = values.length - 1; i >= 0; i--) {
        expect(stack.pop()).toBe(values[i]);
      }
      expect(stack.size()).toBe(0);
    }
  });

  it("HashBiMap: bijection — values are unique", () => {
    const rng = new Rng(48);
    for (let t = 0; t < TRIALS; t++) {
      const n = rng.next(100);
      const bm = new HashBiMap<number, number>();
      for (let i = 0; i < n; i++) {
        const k = rng.next(200);
        const v = rng.next(200);
        bm.put(k, v);
      }
      const seenValues = new Set<number>();
      bm.forEach((k, v) => {
        expect(seenValues.has(v)).toBe(false);
        seenValues.add(v);
      });
    }
  });
});
