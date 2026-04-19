// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableList } from "../api/index";

/**
 * Generic resizable array list backed by a plain `T[]`.
 */
export class ArrayList<T> implements MapDbMutableList<T> {
  private data: T[];

  constructor(items?: T[]) {
    this.data = items ? [...items] : [];
  }

  /** Creates a new ArrayList from the given values. */
  static of<T>(...values: T[]): ArrayList<T> {
    return new ArrayList<T>(values);
  }

  // ── MapDbMutableList ────────────────────────────────────────────────

  add(value: T): void {
    this.data.push(value);
  }

  set(index: number, value: T): T {
    this.checkBounds(index);
    const old = this.data[index];
    this.data[index] = value;
    return old;
  }

  get(index: number): T {
    this.checkBounds(index);
    return this.data[index];
  }

  indexOf(value: T): number {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] === value) return i;
    }
    return -1;
  }

  size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  contains(value: T): boolean {
    return this.indexOf(value) !== -1;
  }

  clear(): void {
    this.data = [];
  }

  // ── Iteration / functional ──────────────────────────────────────────

  forEach(f: (value: T) => void): void {
    for (const v of this.data) {
      f(v);
    }
  }

  map<U>(f: (value: T) => U): U[] {
    return this.data.map(f);
  }

  filter(predicate: (value: T) => boolean): T[] {
    return this.data.filter(predicate);
  }

  find(predicate: (value: T) => boolean): T | undefined {
    return this.data.find(predicate);
  }

  every(predicate: (value: T) => boolean): boolean {
    return this.data.every(predicate);
  }

  some(predicate: (value: T) => boolean): boolean {
    return this.data.some(predicate);
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

  // ── Eclipse-Collections-style extras ────────────────────────────────

  /** Returns a new ArrayList containing elements that satisfy the predicate. */
  select(predicate: (value: T) => boolean): ArrayList<T> {
    return new ArrayList<T>(this.data.filter(predicate));
  }

  /** Returns a new ArrayList containing elements that do NOT satisfy the predicate. */
  reject(predicate: (value: T) => boolean): ArrayList<T> {
    return new ArrayList<T>(this.data.filter((v) => !predicate(v)));
  }

  /** Returns the first element satisfying the predicate, or undefined. */
  detect(predicate: (value: T) => boolean): T | undefined {
    return this.data.find(predicate);
  }

  /** Returns the number of elements satisfying the predicate. */
  count(predicate: (value: T) => boolean): number {
    let n = 0;
    for (const v of this.data) {
      if (predicate(v)) n++;
    }
    return n;
  }

  /** Folds the collection with an accumulator (Eclipse-Collections name for reduce). */
  injectInto<U>(initial: U, f: (acc: U, value: T) => U): U {
    return this.reduce(f, initial);
  }

  /** Returns a new ArrayList sorted by the comparator. Does not mutate this list. */
  sort(comparator?: (a: T, b: T) => number): ArrayList<T> {
    const copy = [...this.data];
    copy.sort(comparator);
    return new ArrayList<T>(copy);
  }

  /** Returns a new ArrayList with elements in reverse order. */
  reversed(): ArrayList<T> {
    const copy = [...this.data];
    copy.reverse();
    return new ArrayList<T>(copy);
  }

  /** Returns a new ArrayList with duplicate values removed (by ===). */
  distinct(): ArrayList<T> {
    const seen = new Set<T>();
    const result: T[] = [];
    for (const v of this.data) {
      if (!seen.has(v)) {
        seen.add(v);
        result.push(v);
      }
    }
    return new ArrayList<T>(result);
  }

  /** Removes the first occurrence of the value. Returns true if found. */
  remove(value: T): boolean {
    const idx = this.indexOf(value);
    if (idx === -1) return false;
    this.data.splice(idx, 1);
    return true;
  }

  // ── Internal ────────────────────────────────────────────────────────

  private checkBounds(index: number): void {
    if (index < 0 || index >= this.data.length) {
      throw new RangeError(
        `Index ${index} out of bounds for size ${this.data.length}`,
      );
    }
  }
}
