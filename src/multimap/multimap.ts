// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Multimap: a one-to-many map where each key maps to an array of values.
 * This is the TypeScript equivalent of Eclipse Collections' ArrayListMultimap.
 *
 * Uses TypeScript generics — works with any key and value types.
 */
export class Multimap<K, V> {
  private data = new Map<K, V[]>();
  private _size = 0;

  /** Adds a value for the key. */
  set(key: K, value: V): void {
    const vals = this.data.get(key);
    if (vals) {
      vals.push(value);
    } else {
      this.data.set(key, [value]);
    }
    this._size++;
  }

  /** Adds multiple values for the key. */
  putAll(key: K, ...values: V[]): void {
    for (const v of values) this.set(key, v);
  }

  /** Returns a copy of all values for the key, or empty array. */
  get(key: K): V[] {
    return this.data.get(key)?.slice() ?? [];
  }

  /** Returns true if the key has at least one value. */
  has(key: K): boolean {
    const vals = this.data.get(key);
    return vals !== undefined && vals.length > 0;
  }

  /** Removes all values for the key. Returns the removed values. */
  removeAll(key: K): V[] {
    const vals = this.data.get(key);
    if (vals) {
      this._size -= vals.length;
      this.data.delete(key);
      return vals;
    }
    return [];
  }

  /** Total number of values across all keys. */
  size(): number {
    return this._size;
  }

  /** Number of distinct keys. */
  sizeDistinct(): number {
    return this.data.size;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    this.data.clear();
    this._size = 0;
  }

  /** Yields distinct keys. */
  *keys(): Generator<K> {
    yield* this.data.keys();
  }

  /** Yields all (key, value) pairs. */
  *entries(): Generator<[K, V]> {
    for (const [k, vals] of this.data) {
      for (const v of vals) {
        yield [k, v];
      }
    }
  }

  /** Yields all (key, value) pairs (delegates to {@link entries}), one tuple per
   * individual value — consistent with the typed multimaps. */
  [Symbol.iterator](): Generator<[K, V]> {
    return this.entries();
  }

  /** Calls f for each distinct key with a copy of its values. */
  forEachKey(f: (key: K, values: V[]) => void): void {
    for (const [k, vals] of this.data) {
      f(k, vals.slice());
    }
  }

  /** Calls f for each (key, value) pair. */
  forEach(f: (key: K, value: V) => void): void {
    for (const [k, vals] of this.data) {
      for (const v of vals) {
        f(k, v);
      }
    }
  }

  toString(): string {
    const parts: string[] = [];
    for (const [k, vals] of this.data) {
      parts.push(`${k}: [${vals.join(", ")}]`);
    }
    return `{${parts.join(", ")}}`;
  }
}
