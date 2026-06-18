// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.

import type { MapDbMutableMap } from "../api/index.js";
import { bigintHashSeed } from "../internal/hash.js";
import {
  checkExpectedSize,
  hashCapacityFor,
  PumpDuplicateError,
  type BulkLoadOptions,
} from "../internal/pump.js";

const DEFAULT_CAPACITY = 16;
const LOAD_FACTOR = 0.75;

/**
 * Open-addressing hash map with bigint keys and bigint values.
 * Uses a bitmap (occupied array) to track which slots contain data.
 */
export class BigIntBigIntHashMap implements MapDbMutableMap<bigint, bigint> {
  private keys: bigint[];
  private values: bigint[];
  private occupied: boolean[];
  private _size: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    const cap = nextPowerOfTwo(capacity);
    this.keys = new Array<bigint>(cap).fill(0n);
    this.values = new Array<bigint>(cap).fill(0n);
    this.occupied = new Array<boolean>(cap).fill(false);
    this._size = 0;
  }

  /** Creates a new map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of(pairs: [bigint, bigint][]): BigIntBigIntHashMap {
    const m = new BigIntBigIntHashMap(pairs.length * 2);
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return m;
  }

  /**
   * Bulk-loads a fresh map from exactly `n` key/value pairs in one O(n) pass
   * (the data pump): the table is sized for `n` up front, so there is ZERO
   * mid-load rehash, and slots are filled via the same probe `set` uses. Throws
   * `RangeError` if `n` is invalid or if the source yields more or fewer than
   * `n` pairs. Duplicate keys throw {@link PumpDuplicateError} unless
   * `onDuplicate` is "ignore" (keeps the first). Observably identical to setting
   * the pairs one by one.
   */
  static bulkLoadExact(
    pairs: Iterable<readonly [bigint, bigint]>,
    n: number,
    opts?: BulkLoadOptions,
  ): BigIntBigIntHashMap {
    checkExpectedSize(n);
    const onDuplicate = opts?.onDuplicate ?? "error";
    const m = new BigIntBigIntHashMap(hashCapacityFor(n));
    const mask = m.keys.length - 1;
    let seen = 0;
    let i = 0;
    for (const [key, value] of pairs) {
      if (seen >= n) {
        throw new RangeError("pump source exceeds exact size " + n);
      }
      let idx = m.hashKey(key) & mask;
      while (true) {
        if (!m.occupied[idx]) {
          m.keys[idx] = key;
          m.values[idx] = value;
          m.occupied[idx] = true;
          m._size++;
          break;
        }
        if (Object.is(m.keys[idx], key)) {
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
    return m;
  }

  /**
   * Bulk-loads a fresh map from key/value pairs in one O(n) pass. `opts.size`
   * (or the source's `length`/`size`) pre-sizes the table; the size is a hint
   * and the table may grow. Duplicate handling matches {@link bulkLoadExact}.
   */
  static bulkLoad(
    pairs: Iterable<readonly [bigint, bigint]>,
    opts?: BulkLoadOptions,
  ): BigIntBigIntHashMap {
    const sized = pairs as { length?: number; size?: number };
    const hint = opts?.size ?? sized.length ?? sized.size;
    const buffer = Array.from(pairs);
    if (hint !== undefined) checkExpectedSize(hint);
    return BigIntBigIntHashMap.bulkLoadExact(buffer, buffer.length, opts);
  }

  /** Inserts or updates a key-value pair. Returns the map for chaining, like JS Map.set. */
  set(key: bigint, value: bigint): this {
    if (this.needsResize()) {
      this.resize();
    }
    const cap = this.keys.length;
    const mask = cap - 1;
    let idx = this.hashKey(key) & mask;

    while (true) {
      if (!this.occupied[idx]) {
        this.keys[idx] = key;
        this.values[idx] = value;
        this.occupied[idx] = true;
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

  /** Returns the value for the key, or undefined if not found. */
  get(key: bigint): bigint | undefined {
    const cap = this.keys.length;
    if (cap === 0) return undefined;
    const mask = cap - 1;
    let idx = this.hashKey(key) & mask;

    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) return this.values[idx];
      idx = (idx + 1) & mask;
    }
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: bigint, defaultValue: bigint): bigint {
    const v = this.get(key);
    return v !== undefined ? v : defaultValue;
  }

  /** Removes the entry for the key. Returns the previous value or undefined. */
  remove(key: bigint): bigint | undefined {
    const cap = this.keys.length;
    if (cap === 0) return undefined;
    const mask = cap - 1;
    let idx = this.hashKey(key) & mask;

    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) {
        const old = this.values[idx];
        this.occupied[idx] = false;
        this.keys[idx] = 0n;
        this.values[idx] = 0n;
        this._size--;
        this.rehashFrom(idx, mask);
        return old;
      }
      idx = (idx + 1) & mask;
    }
  }

  /** Returns true if the map contains the key. */
  has(key: bigint): boolean {
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

  /** Removes all entries. */
  clear(): void {
    this.keys.fill(0n);
    this.values.fill(0n);
    this.occupied.fill(false);
    this._size = 0;
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[bigint, bigint]> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        yield [this.keys[i], this.values[i]];
      }
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[bigint, bigint]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<bigint> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        yield this.keys[i];
      }
    }
  }

  /** Yields all values. */
  *valuesIter(): Generator<bigint> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        yield this.values[i];
      }
    }
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: bigint, value: bigint) => void): void {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        f(this.keys[i], this.values[i]);
      }
    }
  }

  /** Returns a new map with entries satisfying the predicate. */
  select(
    predicate: (key: bigint, value: bigint) => boolean,
  ): BigIntBigIntHashMap {
    const result = new BigIntBigIntHashMap();
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns a new map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: bigint, value: bigint) => boolean,
  ): BigIntBigIntHashMap {
    const result = new BigIntBigIntHashMap();
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: bigint, value: bigint) => boolean): boolean {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        return true;
      }
    }
    return false;
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: bigint, value: bigint) => boolean): boolean {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        return false;
      }
    }
    return true;
  }

  /** Performs a left fold over all entries. */
  injectInto<R>(initial: R, f: (acc: R, key: bigint, value: bigint) => R): R {
    let result = initial;
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        result = f(result, this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns all keys as an array. */
  keysToArray(): bigint[] {
    const result: bigint[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) result.push(this.keys[i]);
    }
    return result;
  }

  /** Returns all values as an array. */
  valuesToArray(): bigint[] {
    const result: bigint[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) result.push(this.values[i]);
    }
    return result;
  }

  /** Adds amount to the value for the key. If absent, inserts amount. Returns new value. */
  addToValue(key: bigint, amount: bigint): bigint {
    const existing = this.get(key);
    const newVal =
      existing !== undefined ? ((existing + amount) as bigint) : amount;
    this.set(key, newVal);
    return newVal;
  }

  /** Updates the value for the key. If absent, applies f to initialValue. Returns new value. */
  updateValue(
    key: bigint,
    initialValue: bigint,
    f: (value: bigint) => bigint,
  ): bigint {
    const existing = this.get(key);
    const newVal = f(existing !== undefined ? existing : initialValue);
    this.set(key, newVal);
    return newVal;
  }

  /** Fluent set. Returns this for chaining. */
  withKeyValue(key: bigint, value: bigint): this {
    this.set(key, value);
    return this;
  }

  /** Fluent remove. Returns this for chaining. */
  withoutKey(key: bigint): this {
    this.remove(key);
    return this;
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        parts.push(`${this.keys[i]}: ${this.values[i]}`);
      }
    }
    return `{${parts.join(", ")}}`;
  }

  private hashKey(key: bigint): number {
    let h = bigintHashSeed(key);
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (h >> 16) ^ h;
    return h < 0 ? -h : h;
  }

  private needsResize(): boolean {
    return this._size + 1 >= this.keys.length * LOAD_FACTOR;
  }

  private resize(): void {
    const oldKeys = this.keys;
    const oldValues = this.values;
    const oldOccupied = this.occupied;
    const newCap = oldKeys.length * 2;
    this.keys = new Array<bigint>(newCap).fill(0n);
    this.values = new Array<bigint>(newCap).fill(0n);
    this.occupied = new Array<boolean>(newCap).fill(false);
    this._size = 0;
    for (let i = 0; i < oldOccupied.length; i++) {
      if (oldOccupied[i]) {
        this.set(oldKeys[i], oldValues[i]);
      }
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    const cap = this.keys.length;
    let idx = (deleted + 1) & mask;
    while (this.occupied[idx]) {
      const ideal = this.hashKey(this.keys[idx]) & mask;
      const distCurrent = (idx - ideal + cap) & mask;
      const distGap = (deleted - ideal + cap) & mask;
      if (distCurrent > distGap) {
        this.keys[deleted] = this.keys[idx];
        this.values[deleted] = this.values[idx];
        this.occupied[deleted] = true;
        this.occupied[idx] = false;
        this.keys[idx] = 0n;
        this.values[idx] = 0n;
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
