// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.

import { f64HashSeed } from "../../internal/float-order.js";
import {
  checkExpectedSize,
  hashCapacityFor,
  PumpDuplicateError,
  type BulkLoadOptions,
} from "../../internal/pump.js";

const DEFAULT_CAPACITY = 16;
const LOAD_FACTOR = 0.75;

/**
 * Float32→Float64 hash map backed by Float32Array and Float64Array.
 * Keys: 4 bytes each, values: 8 bytes each.
 * Contiguous memory, no GC pressure on the arrays.
 * Memory: 13 bytes/slot (vs ~50-70 bytes in Map<number, number>).
 */
export class Float32Float64HashMap {
  private keys: Float32Array;
  private values: Float64Array;
  private occupied: Uint8Array;
  private _size = 0;
  private capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = nextPowerOfTwo(capacity);
    this.keys = new Float32Array(this.capacity);
    this.values = new Float64Array(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
  }

  /**
   * Bulk-loads a fresh map from exactly `n` key/value pairs in one O(n) pass
   * (the data pump): the table is sized for `n` up front, so there is ZERO
   * mid-load rehash, and slots are filled via the same probe `set` uses. Throws
   * `RangeError` if `n` is not a valid size or if the source yields more or
   * fewer than `n` pairs. Duplicate keys throw {@link PumpDuplicateError} unless
   * `onDuplicate` is "ignore" (keeps the first). The result is observably
   * identical to the same pairs inserted one by one.
   */
  static bulkLoadExact(
    pairs: Iterable<readonly [number, number]>,
    n: number,
    opts?: BulkLoadOptions,
  ): Float32Float64HashMap {
    checkExpectedSize(n);
    const onDuplicate = opts?.onDuplicate ?? "error";
    const map = new Float32Float64HashMap(hashCapacityFor(n));
    const mask = map.capacity - 1;
    let seen = 0;
    let i = 0;
    for (const [key, value] of pairs) {
      if (seen >= n) {
        throw new RangeError("pump source exceeds exact size " + n);
      }
      let idx = map.hash(key) & mask;
      while (true) {
        if (!map.occupied[idx]) {
          map.keys[idx] = key;
          map.values[idx] = value;
          map.occupied[idx] = 1;
          map._size++;
          break;
        }
        if (Object.is(map.keys[idx], key)) {
          if (onDuplicate === "error") throw new PumpDuplicateError(i);
          break; // ignore: keep first
        }
        idx = (idx + 1) & mask;
      }
      seen++;
      i++;
    }
    if (seen < n) {
      throw new RangeError("pump source has fewer than exact size " + n);
    }
    return map;
  }

  /**
   * Bulk-loads a fresh map from key/value pairs in one O(n) pass. `opts.size`
   * (or the source's `length`/`size` if available) pre-sizes the table; with a
   * trustworthy size there is no rehash. Unlike {@link bulkLoadExact} the size
   * is only a hint and the table may grow. Duplicate-key handling matches
   * {@link bulkLoadExact}.
   */
  static bulkLoad(
    pairs: Iterable<readonly [number, number]>,
    opts?: BulkLoadOptions,
  ): Float32Float64HashMap {
    const sized = pairs as { length?: number; size?: number };
    const hint = opts?.size ?? sized.length ?? sized.size;
    const buffer = Array.from(pairs);
    if (hint !== undefined) checkExpectedSize(hint);
    return Float32Float64HashMap.bulkLoadExact(buffer, buffer.length, opts);
  }

  set(key: number, value: number): this {
    if (this.needsResize()) this.resize();
    const mask = this.capacity - 1;
    let idx = this.hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) {
        this.keys[idx] = key;
        this.values[idx] = value;
        this.occupied[idx] = 1;
        this._size++;
        return this;
      }
      if (Object.is(this.keys[idx], key)) {
        this.values[idx] = value;
        return this;
      }
      idx = (idx + 1) & mask;
    }
  }

  get(key: number): number | undefined {
    if (this.capacity === 0) return undefined;
    const mask = this.capacity - 1;
    let idx = this.hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) return this.values[idx];
      idx = (idx + 1) & mask;
    }
  }

  getOrDefault(key: number, defaultValue: number): number {
    const v = this.get(key);
    return v !== undefined ? v : defaultValue;
  }

  remove(key: number): number | undefined {
    if (this.capacity === 0) return undefined;
    const mask = this.capacity - 1;
    let idx = this.hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) {
        const old = this.values[idx];
        this.occupied[idx] = 0;
        this._size--;
        this.rehashFrom(idx, mask);
        return old;
      }
      idx = (idx + 1) & mask;
    }
  }

  has(key: number): boolean {
    return this.get(key) !== undefined;
  }
  get size(): number {
    return this._size;
  }
  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    this.occupied.fill(0);
    this._size = 0;
  }

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

  *keysIter(): Generator<number> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.keys[i];
    }
  }

  *valuesIter(): Generator<number> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.values[i];
    }
  }

  forEach(f: (key: number, value: number) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) f(this.keys[i], this.values[i]);
    }
  }

  select(
    predicate: (key: number, value: number) => boolean,
  ): Float32Float64HashMap {
    const result = new Float32Float64HashMap();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  reject(
    predicate: (key: number, value: number) => boolean,
  ): Float32Float64HashMap {
    const result = new Float32Float64HashMap();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  anySatisfy(predicate: (key: number, value: number) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i]))
        return true;
    }
    return false;
  }

  allSatisfy(predicate: (key: number, value: number) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i]))
        return false;
    }
    return true;
  }

  injectInto<R>(initial: R, f: (acc: R, key: number, value: number) => R): R {
    let result = initial;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result = f(result, this.keys[i], this.values[i]);
    }
    return result;
  }

  addToValue(key: number, amount: number): number {
    const existing = this.get(key);
    const newVal = (
      existing !== undefined ? (((existing as any) + amount) as any) : amount
    ) as number;
    this.set(key, newVal);
    return newVal;
  }

  /** Memory stats for this map */
  memoryBytes(): number {
    return this.capacity * (4 + 8 + 1);
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) parts.push(`${this.keys[i]}: ${this.values[i]}`);
    }
    return `{${parts.join(", ")}}`;
  }

  private hash(key: number): number {
    let h = f64HashSeed(key);
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    return ((h >> 16) ^ h) >>> 0;
  }

  private needsResize(): boolean {
    return this._size + 1 >= this.capacity * LOAD_FACTOR;
  }

  private resize(): void {
    const oldKeys = this.keys;
    const oldValues = this.values;
    const oldOccupied = this.occupied;
    const oldCap = this.capacity;
    this.capacity *= 2;
    this.keys = new Float32Array(this.capacity);
    this.values = new Float64Array(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
    this._size = 0;
    for (let i = 0; i < oldCap; i++) {
      if (oldOccupied[i]) this.set(oldKeys[i], oldValues[i]);
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    let idx = (deleted + 1) & mask;
    while (this.occupied[idx]) {
      const ideal = this.hash(this.keys[idx]) & mask;
      const distCurrent = (idx - ideal + this.capacity) & mask;
      const distGap = (deleted - ideal + this.capacity) & mask;
      if (distCurrent > distGap) {
        this.keys[deleted] = this.keys[idx];
        this.values[deleted] = this.values[idx];
        this.occupied[deleted] = 1;
        this.occupied[idx] = 0;
        deleted = idx;
      }
      idx = (idx + 1) & mask;
      if (idx === deleted) break;
    }
  }
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
