// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableMap } from "../api/index.js";

/**
 * Hash map with bigint keys and generic object values.
 * Uses the built-in Map<bigint, V> internally.
 */
export class BigIntObjectHashMap<V> implements MapDbMutableMap<bigint, V> {
  private readonly map: Map<bigint, V>;

  constructor() {
    this.map = new Map<bigint, V>();
  }

  /** Creates a new map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of<V>(pairs: [bigint, V][]): BigIntObjectHashMap<V> {
    const m = new BigIntObjectHashMap<V>();
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return m;
  }

  /** Inserts or updates a key-value pair. Returns the previous value or undefined. */
  set(key: bigint, value: V): V | undefined {
    const old = this.map.get(key);
    this.map.set(key, value);
    return old;
  }

  /** Returns the value for the key, or undefined if not found. */
  get(key: bigint): V | undefined {
    return this.map.get(key);
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: bigint, defaultValue: V): V {
    const v = this.map.get(key);
    return v !== undefined ? v : defaultValue;
  }

  /** Removes the entry for the key. Returns the previous value or undefined. */
  remove(key: bigint): V | undefined {
    const old = this.map.get(key);
    this.map.delete(key);
    return old;
  }

  /** Returns true if the map contains the key. */
  has(key: bigint): boolean {
    return this.map.has(key);
  }

  /** Returns the number of entries. */
  get size(): number {
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
  *entries(): Generator<[bigint, V]> {
    for (const entry of this.map) {
      yield entry;
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[bigint, V]> {
    return this.entries();
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: bigint, value: V) => void): void {
    for (const [k, v] of this.map) {
      f(k, v);
    }
  }

  /** Returns a new map with entries satisfying the predicate. */
  select(
    predicate: (key: bigint, value: V) => boolean,
  ): BigIntObjectHashMap<V> {
    const result = new BigIntObjectHashMap<V>();
    for (const [k, v] of this.map) {
      if (predicate(k, v)) {
        result.set(k, v);
      }
    }
    return result;
  }

  /** Returns a new map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: bigint, value: V) => boolean,
  ): BigIntObjectHashMap<V> {
    const result = new BigIntObjectHashMap<V>();
    for (const [k, v] of this.map) {
      if (!predicate(k, v)) {
        result.set(k, v);
      }
    }
    return result;
  }

  /** Returns all keys as an array. */
  keysToArray(): bigint[] {
    return Array.from(this.map.keys());
  }

  /** Returns all values as an array. */
  valuesToArray(): V[] {
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
