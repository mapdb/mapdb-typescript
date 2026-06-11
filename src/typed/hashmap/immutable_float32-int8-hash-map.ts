// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.

import { f64HashSeed } from "../../internal/float-order.js";
import { Float32Int8HashMap } from "./float32-int8-hash-map.js";

/**
 * Immutable Float32→Int8 hash map backed by Float32Array and Int8Array.
 * Keys: 4 bytes each, values: 1 bytes each.
 * Construct via static of(entries) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 * Memory: 6 bytes/slot (vs ~50-70 bytes in Map<number, number>).
 */
export class ImmutableFloat32Int8HashMap {
  private keys: Float32Array;
  private values: Int8Array;
  private occupied: Uint8Array;
  private _size: number;
  private capacity: number;

  /** Creates an immutable map from an array of [key, value] entries (defensive copy). */
  static of(entries: [number, number][]): ImmutableFloat32Int8HashMap {
    const map = new Float32Int8HashMap(entries.length);
    for (const [k, v] of entries) {
      map.set(k, v);
    }
    return ImmutableFloat32Int8HashMap.fromMutable(map);
  }

  /** Creates an immutable copy from a mutable map (defensive copy). */
  static fromMutable(mutable: Float32Int8HashMap): ImmutableFloat32Int8HashMap {
    const entries: [number, number][] = [...mutable.entries()];
    const c = nextPowerOfTwo(Math.max(entries.length * 2, 16));
    const keys = new Float32Array(c);
    const values = new Int8Array(c);
    const occupied = new Uint8Array(c);
    let size = 0;
    const mask = c - 1;
    for (const [k, v] of entries) {
      let idx = hash(k) & mask;
      while (true) {
        if (!occupied[idx]) {
          keys[idx] = k;
          values[idx] = v;
          occupied[idx] = 1;
          size++;
          break;
        }
        if (Object.is(keys[idx], k)) {
          values[idx] = v;
          break;
        }
        idx = (idx + 1) & mask;
      }
    }
    return new ImmutableFloat32Int8HashMap(keys, values, occupied, size, c);
  }

  private constructor(
    keys: Float32Array,
    values: Int8Array,
    occupied: Uint8Array,
    size: number,
    capacity: number,
  ) {
    this.keys = keys;
    this.values = values;
    this.occupied = occupied;
    this._size = size;
    this.capacity = capacity;
  }

  /** Returns the value for the key, or undefined. */
  get(key: number): number | undefined {
    if (this.capacity === 0) return undefined;
    const mask = this.capacity - 1;
    let idx = hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) return this.values[idx];
      idx = (idx + 1) & mask;
    }
  }

  /** Returns the value for the key, or the given default. */
  getOrDefault(key: number, defaultValue: number): number {
    const v = this.get(key);
    return v !== undefined ? v : defaultValue;
  }

  /** Returns true if the map contains the given key. */
  has(key: number): boolean {
    return this.get(key) !== undefined;
  }

  /** Returns the number of entries. */
  get size(): number {
    return this._size;
  }

  /** Returns true if the map is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Yields [key, value] pairs. */
  *entries(): Generator<[number, number]> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield [this.keys[i], this.values[i]];
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[number, number]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<number> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.keys[i];
    }
  }

  /** Yields all values. */
  *valuesIter(): Generator<number> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.values[i];
    }
  }

  /** Calls the function for each entry. */
  forEach(f: (key: number, value: number) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) f(this.keys[i], this.values[i]);
    }
  }

  /** Returns a new MUTABLE map with entries satisfying the predicate. */
  select(predicate: (key: number, value: number) => boolean): Float32Int8HashMap {
    const result = new Float32Int8HashMap();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns a new MUTABLE map with entries NOT satisfying the predicate. */
  reject(predicate: (key: number, value: number) => boolean): Float32Int8HashMap {
    const result = new Float32Int8HashMap();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: number, value: number) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i]))
        return true;
    }
    return false;
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: number, value: number) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i]))
        return false;
    }
    return true;
  }

  /** Folds the entries into a single value. */
  injectInto<R>(initial: R, f: (acc: R, key: number, value: number) => R): R {
    let result = initial;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result = f(result, this.keys[i], this.values[i]);
    }
    return result;
  }

  /** Returns a mutable copy of this immutable map. */
  toMutable(): Float32Int8HashMap {
    const result = new Float32Int8HashMap();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result.set(this.keys[i], this.values[i]);
    }
    return result;
  }

  /** Memory stats for this map. */
  memoryBytes(): number {
    return this.capacity * (4 + 1 + 1);
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) parts.push(`${this.keys[i]}: ${this.values[i]}`);
    }
    return `{${parts.join(", ")}}`;
  }
}

function hash(key: number): number {
  let h = f64HashSeed(key);
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
  return ((h >> 16) ^ h) >>> 0;
}

function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 16;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n++;
  return n;
}
