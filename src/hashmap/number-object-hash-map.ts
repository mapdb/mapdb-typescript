// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableMap } from "../api/index.js";
import { mapKeyOf, NEG_ZERO_KEY } from "../internal/float-order.js";

type MapKey = number | typeof NEG_ZERO_KEY;

/**
 * Hash map with number keys and generic object values.
 *
 * Backed by a native Map, but keyed via {@link mapKeyOf} so that -0 and +0 are
 * DISTINCT (matching the open-addressing collections in this package). NaN is
 * findable. The original key (preserving -0) is stored alongside the value so
 * iteration / entries reproduce it faithfully.
 */
export class NumberObjectHashMap<V> implements MapDbMutableMap<number, V> {
  private readonly map: Map<MapKey, [number, V]>;

  constructor() {
    this.map = new Map<MapKey, [number, V]>();
  }

  /** Creates a new map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of<V>(pairs: [number, V][]): NumberObjectHashMap<V> {
    const m = new NumberObjectHashMap<V>();
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return m;
  }

  /** Inserts or updates a key-value pair. Returns the map for chaining, like JS Map.set. */
  set(key: number, value: V): this {
    const k = mapKeyOf(key);
    this.map.set(k, [key, value]);
    return this;
  }

  /** Returns the value for the key, or undefined if not found. */
  get(key: number): V | undefined {
    const entry = this.map.get(mapKeyOf(key));
    return entry ? entry[1] : undefined;
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: number, defaultValue: V): V {
    const entry = this.map.get(mapKeyOf(key));
    return entry !== undefined ? entry[1] : defaultValue;
  }

  /** Removes the entry for the key. Returns the previous value or undefined. */
  remove(key: number): V | undefined {
    const k = mapKeyOf(key);
    const old = this.map.get(k);
    this.map.delete(k);
    return old ? old[1] : undefined;
  }

  /** Returns true if the map contains the key. */
  has(key: number): boolean {
    return this.map.has(mapKeyOf(key));
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
  *entries(): Generator<[number, V]> {
    for (const [key, value] of this.map.values()) {
      yield [key, value];
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[number, V]> {
    return this.entries();
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: number, value: V) => void): void {
    for (const [k, v] of this.map.values()) {
      f(k, v);
    }
  }

  /** Returns a new map with entries satisfying the predicate. */
  select(
    predicate: (key: number, value: V) => boolean,
  ): NumberObjectHashMap<V> {
    const result = new NumberObjectHashMap<V>();
    for (const [k, v] of this.map.values()) {
      if (predicate(k, v)) {
        result.set(k, v);
      }
    }
    return result;
  }

  /** Returns a new map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: number, value: V) => boolean,
  ): NumberObjectHashMap<V> {
    const result = new NumberObjectHashMap<V>();
    for (const [k, v] of this.map.values()) {
      if (!predicate(k, v)) {
        result.set(k, v);
      }
    }
    return result;
  }

  /** Returns all keys as an array. */
  keysToArray(): number[] {
    return Array.from(this.map.values(), ([k]) => k);
  }

  /** Returns all values as an array. */
  valuesToArray(): V[] {
    return Array.from(this.map.values(), ([, v]) => v);
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (const [k, v] of this.map.values()) {
      parts.push(`${k}: ${v}`);
    }
    return `{${parts.join(", ")}}`;
  }
}
