// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableMap } from "../api/index";

/**
 * Insertion-ordered hash map backed by JavaScript's native `Map<K, V>`,
 * which guarantees insertion-order iteration per the ES2015 spec.
 */
export class LinkedHashMap<K, V> implements MapDbMutableMap<K, V> {
  private data: Map<K, V>;

  constructor(entries?: Iterable<[K, V]>) {
    this.data = entries ? new Map(entries) : new Map();
  }

  static of<K, V>(...entries: [K, V][]): LinkedHashMap<K, V> {
    return new LinkedHashMap<K, V>(entries);
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

  // ── Iteration ───────────────────────────────────────────────────────

  forEach(f: (value: V) => void): void {
    for (const v of this.data.values()) {
      f(v);
    }
  }

  forEachKeyValue(f: (key: K, value: V) => void): void {
    this.data.forEach((v, k) => f(k, v));
  }

  /** Returns keys in insertion order. */
  keysToArray(): K[] {
    return [...this.data.keys()];
  }

  /** Returns values in insertion order. */
  valuesToArray(): V[] {
    return [...this.data.values()];
  }

  // ── Functional operations ───────────────────────────────────────────

  select(predicate: (key: K, value: V) => boolean): LinkedHashMap<K, V> {
    const result = new LinkedHashMap<K, V>();
    this.data.forEach((v, k) => {
      if (predicate(k, v)) result.put(k, v);
    });
    return result;
  }

  reject(predicate: (key: K, value: V) => boolean): LinkedHashMap<K, V> {
    const result = new LinkedHashMap<K, V>();
    this.data.forEach((v, k) => {
      if (!predicate(k, v)) result.put(k, v);
    });
    return result;
  }

  detect(predicate: (key: K, value: V) => boolean): V | undefined {
    for (const [k, v] of this.data) {
      if (predicate(k, v)) return v;
    }
    return undefined;
  }

  count(predicate: (key: K, value: V) => boolean): number {
    let n = 0;
    for (const [k, v] of this.data) {
      if (predicate(k, v)) n++;
    }
    return n;
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.data[Symbol.iterator]();
  }
}
