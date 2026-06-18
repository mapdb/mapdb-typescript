// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashset`.

import {
  checkExpectedSize,
  hashCapacityFor,
  PumpDuplicateError,
  type BulkLoadOptions,
} from "../../internal/pump.js";

const DEFAULT_CAPACITY = 16;
const LOAD_FACTOR = 0.75;

/**
 * Hash set backed by Int32Array with Uint8Array occupied bitmap.
 * Elements: 4 bytes each, contiguous memory, no GC pressure.
 * Open-addressing with linear probing.
 * Memory: 5 bytes/slot (vs ~50-70 bytes in Set<number>).
 */
export class Int32HashSet {
  private items: Int32Array;
  private occupied: Uint8Array;
  private _size = 0;
  private capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = nextPowerOfTwo(capacity);
    this.items = new Int32Array(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
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
  ): Int32HashSet {
    checkExpectedSize(n);
    const onDuplicate = opts?.onDuplicate ?? "error";
    const set = new Int32HashSet(hashCapacityFor(n));
    const mask = set.capacity - 1;
    let seen = 0;
    let i = 0;
    for (const value of values) {
      if (seen >= n) {
        throw new RangeError("pump source exceeds exact size " + n);
      }
      let idx = set.hash(value) & mask;
      while (true) {
        if (!set.occupied[idx]) {
          set.items[idx] = value;
          set.occupied[idx] = 1;
          set._size++;
          break;
        }
        if (Object.is(set.items[idx], value)) {
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
   * source's `length`/`size`) pre-sizes the table BEFORE iteration. Size is
   * only a hint: the source is never buffered and the table grows normally (via
   * the same probe `add` uses) if the hint is exceeded. Duplicate handling
   * matches {@link bulkLoadExact}.
   */
  static bulkLoad(values: Iterable<number>, opts?: BulkLoadOptions): Int32HashSet {
    const onDuplicate = opts?.onDuplicate ?? "error";
    const sized = values as { length?: number; size?: number };
    const hint = opts?.size ?? sized.length ?? sized.size;
    if (hint !== undefined) checkExpectedSize(hint);
    const set =
      hint !== undefined ? new Int32HashSet(hashCapacityFor(hint)) : new Int32HashSet();
    let i = 0;
    for (const value of values) {
      if (set.needsResize()) set.resize();
      const mask = set.capacity - 1;
      let idx = set.hash(value) & mask;
      while (true) {
        if (!set.occupied[idx]) {
          set.items[idx] = value;
          set.occupied[idx] = 1;
          set._size++;
          break;
        }
        if (Object.is(set.items[idx], value)) {
          if (onDuplicate === "error") throw new PumpDuplicateError(i);
          break; // ignore: keep first
        }
        idx = (idx + 1) & mask;
      }
      i++;
    }
    return set;
  }

  add(value: number): this {
    if (this.needsResize()) this.resize();
    const mask = this.capacity - 1;
    let idx = this.hash(value) & mask;
    while (true) {
      if (!this.occupied[idx]) {
        this.items[idx] = value;
        this.occupied[idx] = 1;
        this._size++;
        return this;
      }
      if (Object.is(this.items[idx], value)) return this;
      idx = (idx + 1) & mask;
    }
  }

  remove(value: number): boolean {
    if (this.capacity === 0) return false;
    const mask = this.capacity - 1;
    let idx = this.hash(value) & mask;
    while (true) {
      if (!this.occupied[idx]) return false;
      if (Object.is(this.items[idx], value)) {
        this.occupied[idx] = 0;
        this._size--;
        this.rehashFrom(idx, mask);
        return true;
      }
      idx = (idx + 1) & mask;
    }
  }

  has(value: number): boolean {
    if (this.capacity === 0) return false;
    const mask = this.capacity - 1;
    let idx = this.hash(value) & mask;
    while (true) {
      if (!this.occupied[idx]) return false;
      if (Object.is(this.items[idx], value)) return true;
      idx = (idx + 1) & mask;
    }
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

  union(other: Int32HashSet): Int32HashSet {
    const result = new Int32HashSet(this._size + other._size);
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result.add(this.items[i]);
    }
    for (let i = 0; i < other.capacity; i++) {
      if (other.occupied[i]) result.add(other.items[i]);
    }
    return result;
  }

  intersect(other: Int32HashSet): Int32HashSet {
    const result = new Int32HashSet();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && other.has(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  difference(other: Int32HashSet): Int32HashSet {
    const result = new Int32HashSet();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !other.has(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  *values(): Generator<number> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.items[i];
    }
  }

  /** Makes the set iterable with for-of loops (delegates to values()). */
  [Symbol.iterator](): Generator<number> {
    return this.values();
  }

  toArray(): Int32Array {
    const result = new Int32Array(this._size);
    let j = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result[j++] = this.items[i];
    }
    return result;
  }

  /** Creates a mutable set from an immutable one. */
  static fromImmutable(imm: {
    toArray(): number[];
    readonly size: number;
  }): Int32HashSet {
    const arr = imm.toArray();
    const set = new Int32HashSet(arr.length);
    for (const v of arr) {
      set.add(v);
    }
    return set;
  }

  forEach(f: (value: number) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) f(this.items[i]);
    }
  }

  select(predicate: (value: number) => boolean): Int32HashSet {
    const result = new Int32HashSet();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  reject(predicate: (value: number) => boolean): Int32HashSet {
    const result = new Int32HashSet();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) parts.push(`${this.items[i]}`);
    }
    return `{${parts.join(", ")}}`;
  }

  /** Memory used by backing arrays in bytes */
  memoryBytes(): number {
    return this.capacity * (4 + 1);
  }

  private hash(key: number): number {
    let h = key | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    return ((h >> 16) ^ h) >>> 0;
  }

  private needsResize(): boolean {
    return this._size + 1 >= this.capacity * LOAD_FACTOR;
  }

  private resize(): void {
    const oldItems = this.items;
    const oldOccupied = this.occupied;
    const oldCap = this.capacity;
    this.capacity *= 2;
    this.items = new Int32Array(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
    this._size = 0;
    for (let i = 0; i < oldCap; i++) {
      if (oldOccupied[i]) this.add(oldItems[i]);
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    let idx = (deleted + 1) & mask;
    while (this.occupied[idx]) {
      const ideal = this.hash(this.items[idx]) & mask;
      const distCurrent = (idx - ideal + this.capacity) & mask;
      const distGap = (deleted - ideal + this.capacity) & mask;
      if (distCurrent > distGap) {
        this.items[deleted] = this.items[idx];
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
