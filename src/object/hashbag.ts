// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableBag } from "../api/index";

/** A `[value, count]` pair returned by occurrence-query methods. */
export interface OccurrencePair<T> {
  value: T;
  count: number;
}

/**
 * Generic hash bag (multiset) backed by `Map<T, number>`.
 */
export class HashBag<T> implements MapDbMutableBag<T> {
  private data: Map<T, number>;

  constructor() {
    this.data = new Map();
  }

  /** Creates a new HashBag from the given values. */
  static of<T>(...values: T[]): HashBag<T> {
    const bag = new HashBag<T>();
    for (const v of values) {
      bag.add(v);
    }
    return bag;
  }

  // ── MapDbMutableBag ─────────────────────────────────────────────────

  add(value: T): void {
    this.data.set(value, (this.data.get(value) ?? 0) + 1);
  }

  clear(): void {
    this.data.clear();
  }

  occurrencesOf(value: T): number {
    return this.data.get(value) ?? 0;
  }

  sizeDistinct(): number {
    return this.data.size;
  }

  size(): number {
    let total = 0;
    for (const c of this.data.values()) {
      total += c;
    }
    return total;
  }

  isEmpty(): boolean {
    return this.data.size === 0;
  }

  contains(value: T): boolean {
    return this.data.has(value);
  }

  // ── Iteration / functional ──────────────────────────────────────────

  forEach(f: (value: T) => void): void {
    for (const [v, count] of this.data) {
      for (let i = 0; i < count; i++) {
        f(v);
      }
    }
  }

  map<U>(f: (value: T) => U): U[] {
    const result: U[] = [];
    this.forEach((v) => result.push(f(v)));
    return result;
  }

  filter(predicate: (value: T) => boolean): T[] {
    const result: T[] = [];
    this.forEach((v) => {
      if (predicate(v)) result.push(v);
    });
    return result;
  }

  find(predicate: (value: T) => boolean): T | undefined {
    for (const [v] of this.data) {
      if (predicate(v)) return v;
    }
    return undefined;
  }

  every(predicate: (value: T) => boolean): boolean {
    for (const [v] of this.data) {
      if (!predicate(v)) return false;
    }
    return true;
  }

  some(predicate: (value: T) => boolean): boolean {
    for (const [v] of this.data) {
      if (predicate(v)) return true;
    }
    return false;
  }

  reduce<U>(f: (acc: U, value: T) => U, initial: U): U {
    let acc = initial;
    this.forEach((v) => {
      acc = f(acc, v);
    });
    return acc;
  }

  includes(value: T): boolean {
    return this.contains(value);
  }

  toArray(): T[] {
    const result: T[] = [];
    this.forEach((v) => result.push(v));
    return result;
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (const [v, count] of this.data) {
      for (let i = 0; i < count; i++) {
        yield v;
      }
    }
  }

  // ── Bag-specific extras ─────────────────────────────────────────────

  /** Adds `occurrences` copies of the value. */
  addOccurrences(value: T, occurrences: number): void {
    if (occurrences <= 0) return;
    this.data.set(value, (this.data.get(value) ?? 0) + occurrences);
  }

  /** Calls `f` for each distinct value with its occurrence count. */
  forEachWithOccurrences(f: (value: T, occurrences: number) => void): void {
    this.data.forEach((count, value) => f(value, count));
  }

  /** Returns the `n` values with the highest occurrence counts (descending). */
  topOccurrences(n: number): OccurrencePair<T>[] {
    const pairs: OccurrencePair<T>[] = [];
    this.data.forEach((count, value) => pairs.push({ value, count }));
    pairs.sort((a, b) => b.count - a.count);
    return pairs.slice(0, n);
  }

  /** Returns the `n` values with the lowest occurrence counts (ascending). */
  bottomOccurrences(n: number): OccurrencePair<T>[] {
    const pairs: OccurrencePair<T>[] = [];
    this.data.forEach((count, value) => pairs.push({ value, count }));
    pairs.sort((a, b) => a.count - b.count);
    return pairs.slice(0, n);
  }

  /** Returns a new HashBag containing elements that satisfy the predicate. */
  select(predicate: (value: T) => boolean): HashBag<T> {
    const result = new HashBag<T>();
    this.data.forEach((count, value) => {
      if (predicate(value)) result.addOccurrences(value, count);
    });
    return result;
  }

  /** Returns a new HashBag containing elements that do NOT satisfy the predicate. */
  reject(predicate: (value: T) => boolean): HashBag<T> {
    const result = new HashBag<T>();
    this.data.forEach((count, value) => {
      if (!predicate(value)) result.addOccurrences(value, count);
    });
    return result;
  }
}
