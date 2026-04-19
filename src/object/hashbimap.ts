// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Bidirectional map enforcing a bijection between keys and values.
 * Backed by two `Map` instances (forward and inverse).
 */
export class HashBiMap<K, V> {
  private forward: Map<K, V>;
  private backward: Map<V, K>;

  constructor() {
    this.forward = new Map();
    this.backward = new Map();
  }

  /** Creates a new HashBiMap from key-value pairs. Throws on duplicate values. */
  static of<K, V>(...entries: [K, V][]): HashBiMap<K, V> {
    const bimap = new HashBiMap<K, V>();
    for (const [k, v] of entries) {
      bimap.put(k, v);
    }
    return bimap;
  }

  /**
   * Associates `key` with `value`, enforcing the bijection invariant.
   * If `key` already maps to a different value, the old value's inverse entry is removed.
   * If `value` already maps to a different key, the old key's forward entry is removed.
   * Returns the previous value associated with `key`, or undefined.
   */
  put(key: K, value: V): V | undefined {
    const oldValue = this.forward.get(key);

    // Remove old inverse entry for this key's previous value
    if (oldValue !== undefined) {
      this.backward.delete(oldValue);
    }

    // Remove old forward entry for this value's previous key
    const oldKey = this.backward.get(value);
    if (oldKey !== undefined) {
      this.forward.delete(oldKey);
    }

    this.forward.set(key, value);
    this.backward.set(value, key);

    return oldValue;
  }

  /** Returns the value associated with `key`, or undefined. */
  get(key: K): V | undefined {
    return this.forward.get(key);
  }

  /** Returns the key associated with `value`, or undefined. */
  getInverse(value: V): K | undefined {
    return this.backward.get(value);
  }

  containsKey(key: K): boolean {
    return this.forward.has(key);
  }

  containsValue(value: V): boolean {
    return this.backward.has(value);
  }

  /** Removes the entry for `key`. Returns the removed value, or undefined. */
  remove(key: K): V | undefined {
    const value = this.forward.get(key);
    if (value === undefined) return undefined;
    this.forward.delete(key);
    this.backward.delete(value);
    return value;
  }

  /** Removes the entry for `value` (from the inverse side). Returns the removed key, or undefined. */
  removeInverse(value: V): K | undefined {
    const key = this.backward.get(value);
    if (key === undefined) return undefined;
    this.backward.delete(value);
    this.forward.delete(key);
    return key;
  }

  /** Returns a snapshot of the inverse mapping as a new `Map<V, K>`. */
  inverse(): Map<V, K> {
    return new Map(this.backward);
  }

  size(): number {
    return this.forward.size;
  }

  isEmpty(): boolean {
    return this.forward.size === 0;
  }

  /** Calls `f` for each key-value pair. */
  forEach(f: (key: K, value: V) => void): void {
    this.forward.forEach((v, k) => f(k, v));
  }

  keysToArray(): K[] {
    return [...this.forward.keys()];
  }

  valuesToArray(): V[] {
    return [...this.forward.values()];
  }

  clear(): void {
    this.forward.clear();
    this.backward.clear();
  }

  /** Iterates over `[key, value]` entries. */
  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.forward[Symbol.iterator]();
  }
}
