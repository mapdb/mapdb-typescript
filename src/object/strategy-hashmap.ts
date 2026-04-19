// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { HashingStrategy } from "./strategy";

const DEFAULT_CAPACITY = 16;

interface Entry<K, V> {
  key: K;
  value: V;
  occupied: boolean;
}

/**
 * Open-addressing hash map that uses a pluggable {@link HashingStrategy}
 * for key identity. This allows case-insensitive maps, maps keyed by
 * extracted fields, etc.
 */
export class HashMapWithStrategy<K, V> {
  private entries: Entry<K, V>[];
  private _size: number;
  private readonly strategy: HashingStrategy<K>;

  constructor(
    strategy: HashingStrategy<K>,
    capacity: number = DEFAULT_CAPACITY,
  ) {
    this.strategy = strategy;
    this._size = 0;
    const cap = nextPow2(capacity);
    this.entries = HashMapWithStrategy.makeEntries<K, V>(cap);
  }

  private static makeEntries<K, V>(n: number): Entry<K, V>[] {
    const arr: Entry<K, V>[] = new Array(n);
    for (let i = 0; i < n; i++) {
      arr[i] = {
        key: undefined as unknown as K,
        value: undefined as unknown as V,
        occupied: false,
      };
    }
    return arr;
  }

  // ── core ────────────────────────────────────────────────────────────

  /**
   * Puts a key-value pair. Returns the previous value if the key existed,
   * or undefined if it was a new insertion.
   */
  put(key: K, value: V): V | undefined {
    if (this.needsResize()) {
      this.resize();
    }
    const mask = this.entries.length - 1;
    let idx = this.strategy.hashCode(key) & mask;
    for (;;) {
      const e = this.entries[idx];
      if (!e.occupied) {
        e.key = key;
        e.value = value;
        e.occupied = true;
        this._size++;
        return undefined;
      }
      if (this.strategy.equals(e.key, key)) {
        const old = e.value;
        e.value = value;
        return old;
      }
      idx = (idx + 1) & mask;
    }
  }

  get(key: K): V | undefined {
    if (this._size === 0) return undefined;
    const mask = this.entries.length - 1;
    let idx = this.strategy.hashCode(key) & mask;
    for (;;) {
      const e = this.entries[idx];
      if (!e.occupied) return undefined;
      if (this.strategy.equals(e.key, key)) return e.value;
      idx = (idx + 1) & mask;
    }
  }

  remove(key: K): V | undefined {
    if (this._size === 0) return undefined;
    const mask = this.entries.length - 1;
    let idx = this.strategy.hashCode(key) & mask;
    for (;;) {
      const e = this.entries[idx];
      if (!e.occupied) return undefined;
      if (this.strategy.equals(e.key, key)) {
        const old = e.value;
        this.entries[idx] = {
          key: undefined as unknown as K,
          value: undefined as unknown as V,
          occupied: false,
        };
        this._size--;
        this.rehashFrom(idx, mask);
        return old;
      }
      idx = (idx + 1) & mask;
    }
  }

  containsKey(key: K): boolean {
    return this.get(key) !== undefined;
  }

  get size(): number {
    return this._size;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    for (let i = 0; i < this.entries.length; i++) {
      this.entries[i] = {
        key: undefined as unknown as K,
        value: undefined as unknown as V,
        occupied: false,
      };
    }
    this._size = 0;
  }

  // ── functional ──────────────────────────────────────────────────────

  forEach(fn: (key: K, value: V) => void): void {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].occupied) {
        fn(this.entries[i].key, this.entries[i].value);
      }
    }
  }

  select(predicate: (key: K, value: V) => boolean): HashMapWithStrategy<K, V> {
    const result = new HashMapWithStrategy<K, V>(this.strategy);
    this.forEach((k, v) => {
      if (predicate(k, v)) result.put(k, v);
    });
    return result;
  }

  reject(predicate: (key: K, value: V) => boolean): HashMapWithStrategy<K, V> {
    const result = new HashMapWithStrategy<K, V>(this.strategy);
    this.forEach((k, v) => {
      if (!predicate(k, v)) result.put(k, v);
    });
    return result;
  }

  keysToArray(): K[] {
    const result: K[] = [];
    this.forEach((k) => result.push(k));
    return result;
  }

  valuesToArray(): V[] {
    const result: V[] = [];
    this.forEach((_, v) => result.push(v));
    return result;
  }

  // ── iteration ───────────────────────────────────────────────────────

  *[Symbol.iterator](): Iterator<[K, V]> {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.entries[i].occupied) {
        yield [this.entries[i].key, this.entries[i].value];
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
    this.entries = HashMapWithStrategy.makeEntries<K, V>(newCap);
    this._size = 0;
    for (let i = 0; i < old.length; i++) {
      if (old[i].occupied) {
        this.put(old[i].key, old[i].value);
      }
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    const c = this.entries.length;
    let idx = (deleted + 1) & mask;
    while (this.entries[idx].occupied) {
      const ideal = this.strategy.hashCode(this.entries[idx].key) & mask;
      const distCurrent = (idx - ideal + c) & mask;
      const distGap = (deleted - ideal + c) & mask;
      if (distCurrent > distGap) {
        this.entries[deleted] = this.entries[idx];
        this.entries[idx] = {
          key: undefined as unknown as K,
          value: undefined as unknown as V,
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
