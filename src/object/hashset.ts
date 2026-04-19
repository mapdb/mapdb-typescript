// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableSet } from "../api/index";

/**
 * Generic hash set backed by JavaScript's native `Set<T>`.
 */
export class HashSet<T> implements MapDbMutableSet<T> {
  private data: Set<T>;

  constructor(items?: Iterable<T>) {
    this.data = items ? new Set(items) : new Set();
  }

  /** Creates a new HashSet from the given values. */
  static of<T>(...values: T[]): HashSet<T> {
    return new HashSet<T>(values);
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

  [Symbol.iterator](): IterableIterator<T> {
    return this.data[Symbol.iterator]();
  }

  // ── Set-algebra extras ──────────────────────────────────────────────

  /** Returns a new set containing all elements from both sets. */
  union(other: HashSet<T>): HashSet<T> {
    const result = new HashSet<T>(this.data);
    for (const v of other) {
      result.add(v);
    }
    return result;
  }

  /** Returns a new set containing only elements present in both sets. */
  intersect(other: HashSet<T>): HashSet<T> {
    const result = new HashSet<T>();
    for (const v of this.data) {
      if (other.contains(v)) result.add(v);
    }
    return result;
  }

  /** Returns a new set containing elements in this set but not in `other`. */
  difference(other: HashSet<T>): HashSet<T> {
    const result = new HashSet<T>();
    for (const v of this.data) {
      if (!other.contains(v)) result.add(v);
    }
    return result;
  }

  /** Returns a new set with elements in either set but not both. */
  symmetricDifference(other: HashSet<T>): HashSet<T> {
    const result = new HashSet<T>();
    for (const v of this.data) {
      if (!other.contains(v)) result.add(v);
    }
    for (const v of other) {
      if (!this.contains(v)) result.add(v);
    }
    return result;
  }

  /** Returns a new HashSet containing elements that satisfy the predicate. */
  select(predicate: (value: T) => boolean): HashSet<T> {
    return new HashSet<T>(this.filter(predicate));
  }

  /** Returns a new HashSet containing elements that do NOT satisfy the predicate. */
  reject(predicate: (value: T) => boolean): HashSet<T> {
    return new HashSet<T>(this.filter((v) => !predicate(v)));
  }

  /** Returns the first element satisfying the predicate, or undefined. */
  detect(predicate: (value: T) => boolean): T | undefined {
    return this.find(predicate);
  }

  /** Returns the number of elements satisfying the predicate. */
  count(predicate: (value: T) => boolean): number {
    let n = 0;
    for (const v of this.data) {
      if (predicate(v)) n++;
    }
    return n;
  }
}
