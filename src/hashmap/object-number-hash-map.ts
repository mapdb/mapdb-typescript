// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableMap } from "../api/index.js";

/**
 * Hash map with generic object keys and number values.
 * Uses the built-in Map<K, number> internally.
 */
export class ObjectNumberHashMap<K> implements MapDbMutableMap<K, number> {
  private readonly map: Map<K, number>;

  constructor() {
    this.map = new Map<K, number>();
  }

  /** Creates a new map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of<K>(pairs: [K, number][]): ObjectNumberHashMap<K> {
    const m = new ObjectNumberHashMap<K>();
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return m;
  }

  /** Inserts or updates a key-value pair. Returns the previous value or undefined. */
  set(key: K, value: number): number | undefined {
    const old = this.map.get(key);
    this.map.set(key, value);
    return old;
  }

  /** Returns the value for the key, or undefined if not found. */
  get(key: K): number | undefined {
    return this.map.get(key);
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: K, defaultValue: number): number {
    const v = this.map.get(key);
    return v !== undefined ? v : defaultValue;
  }

  /** Removes the entry for the key. Returns the previous value or undefined. */
  remove(key: K): number | undefined {
    const old = this.map.get(key);
    this.map.delete(key);
    return old;
  }

  /** Returns true if the map contains the key. */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /** Returns the number of entries. */
  size(): number {
    return this.map.size;
  }

  /** Returns true if the map is empty. */
  isEmpty(): boolean {
    return this.map.size === 0;
  }

  /** Removes all entries. */
  clear(): void {
    this.map.clear();
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[K, number]> {
    for (const entry of this.map) {
      yield entry;
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[K, number]> {
    return this.entries();
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: K, value: number) => void): void {
    for (const [k, v] of this.map) {
      f(k, v);
    }
  }

  /** Returns a new map with entries satisfying the predicate. */
  select(
    predicate: (key: K, value: number) => boolean,
  ): ObjectNumberHashMap<K> {
    const result = new ObjectNumberHashMap<K>();
    for (const [k, v] of this.map) {
      if (predicate(k, v)) {
        result.set(k, v);
      }
    }
    return result;
  }

  /** Returns a new map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: K, value: number) => boolean,
  ): ObjectNumberHashMap<K> {
    const result = new ObjectNumberHashMap<K>();
    for (const [k, v] of this.map) {
      if (!predicate(k, v)) {
        result.set(k, v);
      }
    }
    return result;
  }

  /** Returns all keys as an array. */
  keysToArray(): K[] {
    return Array.from(this.map.keys());
  }

  /** Returns all values as an array. */
  valuesToArray(): number[] {
    return Array.from(this.map.values());
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (const [k, v] of this.map) {
      parts.push(`${k}: ${v}`);
    }
    return `{${parts.join(", ")}}`;
  }
}
