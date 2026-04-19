// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { HashingStrategy } from "./strategy";

const DEFAULT_CAPACITY = 16;

interface Entry<T> {
  value: T;
  occupied: boolean;
}

/**
 * Open-addressing hash set that uses a pluggable {@link HashingStrategy}
 * for identity. This allows case-insensitive sets, sets keyed by
 * extracted fields, etc.
 */
export class HashSetWithStrategy<T> {
  private entries: Entry<T>[];
  private _size: number;
  private readonly strategy: HashingStrategy<T>;

  constructor(
    strategy: HashingStrategy<T>,
    capacity: number = DEFAULT_CAPACITY,
  ) {
    this.strategy = strategy;
    this._size = 0;
    const cap = nextPow2(capacity);
    this.entries = HashSetWithStrategy.makeEntries<T>(cap);
  }

  private static makeEntries<T>(n: number): Entry<T>[] {
    const arr: Entry<T>[] = new Array(n);
    for (let i = 0; i < n; i++) {
      arr[i] = { value: undefined as unknown as T, occupied: false };
    }
    return arr;
  }

  // ── core ────────────────────────────────────────────────────────────

  add(value: T): boolean {
    if (this.needsResize()) {
      this.resize();
    }
    const mask = this.entries.length - 1;
    let idx = this.strategy.hashCode(value) & mask;
    for (;;) {
      const e = this.entries[idx];
      if (!e.occupied) {
        e.value = value;
        e.occupied = true;
        this._size++;
        return true;
      }
      if (this.strategy.equals(e.value, value)) {
        return false;
      }
      idx = (idx + 1) & mask;
    }
  }

  remove(value: T): boolean {
    if (this._size === 0) return false;
    const mask = this.entries.length - 1;
    let idx = this.strategy.hashCode(value) & mask;
    for (;;) {
      const e = this.entries[idx];
      if (!e.occupied) return false;
      if (this.strategy.equals(e.value, value)) {
        this.entries[idx] = {
          value: undefined as unknown as T,
          occupied: false,
        };
        this._size--;
        this.rehashFrom(idx, mask);
        return true;
      }
      idx = (idx + 1) & mask;
    }
  }

  contains(value: T): boolean {
    if (this._size === 0) return false;
    const mask = this.entries.length - 1;
    let idx = this.strategy.hashCode(value) & mask;
    for (;;) {
      const e = this.entries[idx];
      if (!e.occupied) return false;
      if (this.strategy.equals(e.value, value)) return true;
      idx = (idx + 1) & mask;
    }
  }

  get size(): number {
    return this._size;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    for (let i = 0; i < this.entries.length; i++) {
      this.entries[i] = { value: undefined as unknown as T, occupied: false };
    }
    this._size = 0;
  }

  // ── functional ──────────────────────────────────────────────────────

  forEach(fn: (value: T) => void): void {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].occupied) {
        fn(this.entries[i].value);
      }
    }
  }

  select(predicate: (value: T) => boolean): HashSetWithStrategy<T> {
    const result = new HashSetWithStrategy<T>(this.strategy);
    this.forEach((v) => {
      if (predicate(v)) result.add(v);
    });
    return result;
  }

  reject(predicate: (value: T) => boolean): HashSetWithStrategy<T> {
    const result = new HashSetWithStrategy<T>(this.strategy);
    this.forEach((v) => {
      if (!predicate(v)) result.add(v);
    });
    return result;
  }

  toArray(): T[] {
    const result: T[] = [];
    this.forEach((v) => result.push(v));
    return result;
  }

  // ── iteration ───────────────────────────────────────────────────────

  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].occupied) {
        yield this.entries[i].value;
      }
    }
  }

  // ── internal ────────────────────────────────────────────────────────

  private needsResize(): boolean {
    return (this._size + 1) * 4 > this.entries.length * 3;
  }

  private resize(): void {
    const old = this.entries;
    const newCap = old.length * 2 || DEFAULT_CAPACITY;
    this.entries = HashSetWithStrategy.makeEntries<T>(newCap);
    this._size = 0;
    for (let i = 0; i < old.length; i++) {
      if (old[i].occupied) {
        this.add(old[i].value);
      }
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    const c = this.entries.length;
    let idx = (deleted + 1) & mask;
    while (this.entries[idx].occupied) {
      const ideal = this.strategy.hashCode(this.entries[idx].value) & mask;
      const distCurrent = (idx - ideal + c) & mask;
      const distGap = (deleted - ideal + c) & mask;
      if (distCurrent > distGap) {
        this.entries[deleted] = this.entries[idx];
        this.entries[idx] = {
          value: undefined as unknown as T,
          occupied: false,
        };
        deleted = idx;
      }
      idx = (idx + 1) & mask;
      if (idx === deleted) break;
    }
  }
}

function nextPow2(n: number): number {
  if (n <= 0) return DEFAULT_CAPACITY;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n++;
  return n;
}
