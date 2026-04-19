// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableStack } from "../api/index";

/**
 * Generic LIFO stack backed by a plain `T[]`.
 * The "top" of the stack is the last element of the backing array.
 */
export class ArrayStack<T> implements MapDbMutableStack<T> {
  private data: T[];

  constructor(items?: T[]) {
    this.data = items ? [...items] : [];
  }

  /** Creates a new ArrayStack with the given values (last value is top). */
  static of<T>(...values: T[]): ArrayStack<T> {
    return new ArrayStack<T>(values);
  }

  // ── MapDbMutableStack ───────────────────────────────────────────────

  push(value: T): void {
    this.data.push(value);
  }

  pop(): T {
    if (this.data.length === 0) {
      throw new Error("Stack is empty");
    }
    return this.data.pop()!;
  }

  peek(): T {
    if (this.data.length === 0) {
      throw new Error("Stack is empty");
    }
    return this.data[this.data.length - 1];
  }

  /** Peeks at the element `depth` positions from the top (0 = top). */
  peekAt(depth: number): T {
    const index = this.data.length - 1 - depth;
    if (index < 0 || index >= this.data.length) {
      throw new RangeError(
        `Depth ${depth} out of bounds for stack of size ${this.data.length}`,
      );
    }
    return this.data[index];
  }

  clear(): void {
    this.data = [];
  }

  size(): number {
    return this.data.length;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  contains(value: T): boolean {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] === value) return true;
    }
    return false;
  }

  // ── Iteration / functional ──────────────────────────────────────────

  /** Iterates from top to bottom. */
  forEach(f: (value: T) => void): void {
    for (let i = this.data.length - 1; i >= 0; i--) {
      f(this.data[i]);
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
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  every(predicate: (value: T) => boolean): boolean {
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  some(predicate: (value: T) => boolean): boolean {
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (predicate(this.data[i])) return true;
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

  /** Returns elements from top to bottom. */
  toArray(): T[] {
    const result: T[] = [];
    this.forEach((v) => result.push(v));
    return result;
  }

  /** Iterates from top to bottom. */
  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = this.data.length - 1; i >= 0; i--) {
      yield this.data[i];
    }
  }
}
