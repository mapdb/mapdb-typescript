// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableSet } from "../api/index.js";

/**
 * Insertion-ordered hash set backed by JavaScript's native `Set<T>`,
 * which guarantees insertion-order iteration per the ES2015 spec.
 */
export class LinkedHashSet<T> implements MapDbMutableSet<T> {
  private data: Set<T>;

  constructor(items?: Iterable<T>) {
    this.data = items ? new Set(items) : new Set();
  }

  static of<T>(...values: T[]): LinkedHashSet<T> {
    return new LinkedHashSet<T>(values);
  }

  // ── MapDbMutableSet ─────────────────────────────────────────────────

  add(value: T): boolean {
    if (this.data.has(value)) return false;
    this.data.add(value);
    return true;
  }

  clear(): void {
    this.data.clear();
  }

  size(): number {
    return this.data.size;
  }

  isEmpty(): boolean {
    return this.data.size === 0;
  }

  contains(value: T): boolean {
    return this.data.has(value);
  }

  // ── Iteration / functional ──────────────────────────────────────────

  forEach(f: (value: T) => void): void {
    this.data.forEach(f);
  }

  map<U>(f: (value: T) => U): U[] {
    const result: U[] = [];
    for (const v of this.data) {
      result.push(f(v));
    }
    return result;
  }

  filter(predicate: (value: T) => boolean): T[] {
    const result: T[] = [];
    for (const v of this.data) {
      if (predicate(v)) result.push(v);
    }
    return result;
  }

  find(predicate: (value: T) => boolean): T | undefined {
    for (const v of this.data) {
      if (predicate(v)) return v;
    }
    return undefined;
  }

  every(predicate: (value: T) => boolean): boolean {
    for (const v of this.data) {
      if (!predicate(v)) return false;
    }
    return true;
  }

  some(predicate: (value: T) => boolean): boolean {
    for (const v of this.data) {
      if (predicate(v)) return true;
    }
    return false;
  }

  reduce<U>(f: (acc: U, value: T) => U, initial: U): U {
    let acc = initial;
    for (const v of this.data) {
      acc = f(acc, v);
    }
    return acc;
  }

  includes(value: T): boolean {
    return this.contains(value);
  }

  toArray(): T[] {
    return [...this.data];
  }

  select(predicate: (value: T) => boolean): LinkedHashSet<T> {
    const result = new LinkedHashSet<T>();
    for (const v of this.data) {
      if (predicate(v)) result.add(v);
    }
    return result;
  }

  reject(predicate: (value: T) => boolean): LinkedHashSet<T> {
    const result = new LinkedHashSet<T>();
    for (const v of this.data) {
      if (!predicate(v)) result.add(v);
    }
    return result;
  }

  detect(predicate: (value: T) => boolean): T | undefined {
    return this.find(predicate);
  }

  count(predicate: (value: T) => boolean): number {
    let n = 0;
    for (const v of this.data) {
      if (predicate(v)) n++;
    }
    return n;
  }

  // ── Set-algebra ─────────────────────────────────────────────────────

  union(other: LinkedHashSet<T>): LinkedHashSet<T> {
    const result = new LinkedHashSet<T>(this.data);
    for (const v of other) {
      result.add(v);
    }
    return result;
  }

  intersect(other: LinkedHashSet<T>): LinkedHashSet<T> {
    const result = new LinkedHashSet<T>();
    for (const v of this.data) {
      if (other.contains(v)) result.add(v);
    }
    return result;
  }

  difference(other: LinkedHashSet<T>): LinkedHashSet<T> {
    const result = new LinkedHashSet<T>();
    for (const v of this.data) {
      if (!other.contains(v)) result.add(v);
    }
    return result;
  }

  symmetricDifference(other: LinkedHashSet<T>): LinkedHashSet<T> {
    const result = new LinkedHashSet<T>();
    for (const v of this.data) {
      if (!other.contains(v)) result.add(v);
    }
    for (const v of other) {
      if (!this.contains(v)) result.add(v);
    }
    return result;
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.data[Symbol.iterator]();
  }
}
