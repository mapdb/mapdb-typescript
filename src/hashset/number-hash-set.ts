// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { f64HashSeed } from "../internal/float-order.js";

import type { MapDbMutableSet } from "../api/index.js";
import {
  checkExpectedSize,
  hashCapacityFor,
  PumpDuplicateError,
  type BulkLoadOptions,
} from "../internal/pump.js";

const DEFAULT_CAPACITY = 16;
const LOAD_FACTOR = 0.75;

/**
 * Open-addressing hash set for number values.
 * Uses a bitmap (occupied array) to track which slots contain data.
 */
export class NumberHashSet implements MapDbMutableSet<number> {
  private data: number[];
  private occupied: boolean[];
  private _size: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    const cap = nextPowerOfTwo(capacity);
    this.data = new Array<number>(cap).fill(0);
    this.occupied = new Array<boolean>(cap).fill(false);
    this._size = 0;
  }

  /** Creates a new set from an array of values. */
  static of(values: number[]): NumberHashSet {
    const set = new NumberHashSet(values.length * 2);
    for (const v of values) {
      set.add(v);
    }
    return set;
  }

  /**
   * Bulk-loads a fresh set from exactly `n` values in one O(n) pass (the data
   * pump): the table is sized for `n` up front, so there is ZERO mid-load
   * rehash, and slots are filled via the same probe `add` uses. Throws
   * `RangeError` if `n` is invalid or if the source yields more or fewer than
   * `n` values. Duplicate values throw {@link PumpDuplicateError} unless
   * `onDuplicate` is "ignore" (keeps the first). Observably identical to adding
   * the values one by one.
   */
  static bulkLoadExact(
    values: Iterable<number>,
    n: number,
    opts?: BulkLoadOptions,
  ): NumberHashSet {
    checkExpectedSize(n);
    const onDuplicate = opts?.onDuplicate ?? "error";
    const set = new NumberHashSet(hashCapacityFor(n));
    const mask = set.data.length - 1;
    let seen = 0;
    let i = 0;
    for (const value of values) {
      if (seen >= n) {
        throw new RangeError("pump source exceeds exact size " + n);
      }
      let idx = set.hash(value) & mask;
      while (true) {
        if (!set.occupied[idx]) {
          set.data[idx] = value;
          set.occupied[idx] = true;
          set._size++;
          break;
        }
        if (Object.is(set.data[idx], value)) {
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
    return set;
  }

  /**
   * Bulk-loads a fresh set from values in one O(n) pass. `opts.size` (or the
   * source's `length`/`size`) pre-sizes the table; the size is a hint and the
   * table may grow. Duplicate handling matches {@link bulkLoadExact}.
   */
  static bulkLoad(
    values: Iterable<number>,
    opts?: BulkLoadOptions,
  ): NumberHashSet {
    const sized = values as { length?: number; size?: number };
    const hint = opts?.size ?? sized.length ?? sized.size;
    if (hint !== undefined) checkExpectedSize(hint);
    const onDuplicate = opts?.onDuplicate ?? "error";
    const set = new NumberHashSet(hashCapacityFor(hint ?? 0));
    let i = 0;
    for (const value of values) {
      if (set.needsResize()) set.resize();
      let idx = set.hash(value) & (set.data.length - 1);
      while (true) {
        if (!set.occupied[idx]) {
          set.data[idx] = value;
          set.occupied[idx] = true;
          set._size++;
          break;
        }
        if (Object.is(set.data[idx], value)) {
          if (onDuplicate === "error") throw new PumpDuplicateError(i);
          break;
        }
        idx = (idx + 1) & (set.data.length - 1);
      }
      i++;
    }
    return set;
  }

  /** Adds a value to the set. Returns the set for chaining, like JS Set.add. */
  add(value: number): this {
    if (this.needsResize()) {
      this.resize();
    }
    const cap = this.data.length;
    const mask = cap - 1;
    let idx = this.hash(value) & mask;

    while (true) {
      if (!this.occupied[idx]) {
        this.data[idx] = value;
        this.occupied[idx] = true;
        this._size++;
        return this;
      }
      if (Object.is(this.data[idx], value)) {
        return this;
      }
      idx = (idx + 1) & mask;
    }
  }

  /** Removes a value from the set. Returns true if the value was present. */
  remove(value: number): boolean {
    const cap = this.data.length;
    if (cap === 0) return false;
    const mask = cap - 1;
    let idx = this.hash(value) & mask;

    while (true) {
      if (!this.occupied[idx]) return false;
      if (Object.is(this.data[idx], value)) {
        this.occupied[idx] = false;
        this.data[idx] = 0;
        this._size--;
        this.rehashFrom(idx, mask);
        return true;
      }
      idx = (idx + 1) & mask;
    }
  }

  /** Returns true if the set contains the given value. */
  has(value: number): boolean {
    const cap = this.data.length;
    if (cap === 0) return false;
    const mask = cap - 1;
    let idx = this.hash(value) & mask;

    while (true) {
      if (!this.occupied[idx]) return false;
      if (Object.is(this.data[idx], value)) return true;
      idx = (idx + 1) & mask;
    }
  }

  /** Returns the number of elements. */
  get size(): number {
    return this._size;
  }

  /** Returns true if the set is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Removes all elements. */
  clear(): void {
    this.data.fill(0);
    this.occupied.fill(false);
    this._size = 0;
  }

  /** Returns a new set that is the union of this set and the other. */
  union(other: NumberHashSet): NumberHashSet {
    const result = new NumberHashSet((this._size + other._size) * 2);
    for (const v of this.values()) {
      result.add(v);
    }
    for (const v of other.values()) {
      result.add(v);
    }
    return result;
  }

  /** Returns a new set that is the intersection of this set and the other. */
  intersect(other: NumberHashSet): NumberHashSet {
    const result = new NumberHashSet();
    for (const v of this.values()) {
      if (other.has(v)) {
        result.add(v);
      }
    }
    return result;
  }

  /** Returns a new set with elements in this set but not in the other. */
  difference(other: NumberHashSet): NumberHashSet {
    const result = new NumberHashSet();
    for (const v of this.values()) {
      if (!other.has(v)) {
        result.add(v);
      }
    }
    return result;
  }

  /** Returns a new set with elements satisfying the predicate. */
  select(predicate: (value: number) => boolean): NumberHashSet {
    const result = new NumberHashSet();
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.data[i])) {
        result.add(this.data[i]);
      }
    }
    return result;
  }

  /** Returns a new set with elements NOT satisfying the predicate. */
  reject(predicate: (value: number) => boolean): NumberHashSet {
    const result = new NumberHashSet();
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && !predicate(this.data[i])) {
        result.add(this.data[i]);
      }
    }
    return result;
  }

  /** Calls the function for each element. */
  forEach(f: (value: number) => void): void {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        f(this.data[i]);
      }
    }
  }

  /** Returns a new array with the results of calling `f` on each element. */
  map<U>(f: (value: number) => U): U[] {
    const result: U[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) result.push(f(this.data[i]));
    }
    return result;
  }

  /** Returns a new array with elements satisfying the predicate. */
  filter(predicate: (value: number) => boolean): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.data[i]))
        result.push(this.data[i]);
    }
    return result;
  }

  /** Returns the first element satisfying the predicate, or undefined. */
  find(predicate: (value: number) => boolean): number | undefined {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  /** Returns true if every element satisfies the predicate. */
  every(predicate: (value: number) => boolean): boolean {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && !predicate(this.data[i])) return false;
    }
    return true;
  }

  /** Returns true if at least one element satisfies the predicate. */
  some(predicate: (value: number) => boolean): boolean {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.data[i])) return true;
    }
    return false;
  }

  /** Reduces the set to a single value using the accumulator function. */
  reduce<U>(f: (acc: U, value: number) => U, initial: U): U {
    let acc = initial;
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) acc = f(acc, this.data[i]);
    }
    return acc;
  }

  /** Returns true if the set contains the value. Alias for `has`. */
  includes(value: number): boolean {
    return this.has(value);
  }

  /** Makes the set iterable with for-of loops. */
  *[Symbol.iterator](): IterableIterator<number> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) yield this.data[i];
    }
  }

  /** Yields all values. */
  *values(): Generator<number> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        yield this.data[i];
      }
    }
  }

  /** Returns all values as a plain array. */
  toArray(): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) result.push(this.data[i]);
    }
    return result;
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        parts.push(`${this.data[i]}`);
      }
    }
    return `{${parts.join(", ")}}`;
  }

  private hash(value: number): number {
    let h = f64HashSeed(value);
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (h >> 16) ^ h;
    return h < 0 ? -h : h;
  }

  private needsResize(): boolean {
    return this._size + 1 >= this.data.length * LOAD_FACTOR;
  }

  private resize(): void {
    const oldData = this.data;
    const oldOccupied = this.occupied;
    const newCap = oldData.length * 2;
    this.data = new Array<number>(newCap).fill(0);
    this.occupied = new Array<boolean>(newCap).fill(false);
    this._size = 0;
    for (let i = 0; i < oldOccupied.length; i++) {
      if (oldOccupied[i]) {
        this.add(oldData[i]);
      }
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    const cap = this.data.length;
    let idx = (deleted + 1) & mask;
    while (this.occupied[idx]) {
      const ideal = this.hash(this.data[idx]) & mask;
      const distCurrent = (idx - ideal + cap) & mask;
      const distGap = (deleted - ideal + cap) & mask;
      if (distCurrent > distGap) {
        this.data[deleted] = this.data[idx];
        this.occupied[deleted] = true;
        this.occupied[idx] = false;
        this.data[idx] = 0;
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
