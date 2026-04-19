// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableMap } from "../api/index";

/**
 * Generic hash map backed by JavaScript's native `Map<K, V>`.
 */
export class HashMap<K, V> implements MapDbMutableMap<K, V> {
  private data: Map<K, V>;

  constructor(entries?: Iterable<[K, V]>) {
    this.data = entries ? new Map(entries) : new Map();
  }

  /** Creates a new HashMap from key-value pairs. */
  static of<K, V>(...entries: [K, V][]): HashMap<K, V> {
    return new HashMap<K, V>(entries);
  }

  // ── MapDbMutableMap ─────────────────────────────────────────────────

  put(key: K, value: V): V | undefined {
    const old = this.data.get(key);
    this.data.set(key, value);
    return old;
  }

  remove(key: K): V | undefined {
    const old = this.data.get(key);
    this.data.delete(key);
    return old;
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

  containsKey(key: K): boolean {
    return this.data.has(key);
  }

  get(key: K): V | undefined {
    return this.data.get(key);
  }

  // ── Iteration extras ────────────────────────────────────────────────

  /** Calls `f` for each value in the map. */
  forEach(f: (value: V) => void): void {
    for (const v of this.data.values()) {
      f(v);
    }
  }

  /** Calls `f` for each key-value pair. */
  forEachKeyValue(f: (key: K, value: V) => void): void {
    this.data.forEach((v, k) => f(k, v));
  }

  /** Returns a new HashMap with entries whose values satisfy the predicate. */
  select(predicate: (key: K, value: V) => boolean): HashMap<K, V> {
    const result = new HashMap<K, V>();
    this.data.forEach((v, k) => {
      if (predicate(k, v)) result.put(k, v);
    });
    return result;
  }

  /** Returns a new HashMap with entries whose values do NOT satisfy the predicate. */
  reject(predicate: (key: K, value: V) => boolean): HashMap<K, V> {
    const result = new HashMap<K, V>();
    this.data.forEach((v, k) => {
      if (!predicate(k, v)) result.put(k, v);
    });
    return result;
  }

  /** Returns the first value satisfying the predicate, or undefined. */
  detect(predicate: (key: K, value: V) => boolean): V | undefined {
    for (const [k, v] of this.data) {
      if (predicate(k, v)) return v;
    }
    return undefined;
  }

  /** Returns the number of entries satisfying the predicate. */
  count(predicate: (key: K, value: V) => boolean): number {
    let n = 0;
    for (const [k, v] of this.data) {
      if (predicate(k, v)) n++;
    }
    return n;
  }

  /** Returns all keys as an array. */
  keysToArray(): K[] {
    return [...this.data.keys()];
  }

  /** Returns all values as an array. */
  valuesToArray(): V[] {
    return [...this.data.values()];
  }

  /** Returns an iterator over `[key, value]` entries. */
  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.data[Symbol.iterator]();
  }
}
