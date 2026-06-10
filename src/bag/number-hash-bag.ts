// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableBag } from "../api/index.js";
import { mapKeyOf, NEG_ZERO_KEY } from "../internal/float-order.js";

type MapKey = number | typeof NEG_ZERO_KEY;
interface BagEntry {
  value: number;
  count: number;
}

/**
 * Hash bag (multiset) for number values.
 *
 * Tracks occurrence counts in a native Map, but keyed via {@link mapKeyOf} so
 * that -0 and +0 are DISTINCT (matching the open-addressing collections in this
 * package). NaN is findable. The original value (preserving -0) is stored
 * alongside the count so iteration / entries reproduce it faithfully.
 */
export class NumberHashBag implements MapDbMutableBag<number> {
  private counts: Map<MapKey, BagEntry>;
  private _size: number;

  constructor() {
    this.counts = new Map<MapKey, BagEntry>();
    this._size = 0;
  }

  /** Creates a new bag from an array of values. */
  static of(values: number[]): NumberHashBag {
    const bag = new NumberHashBag();
    for (const v of values) {
      bag.add(v);
    }
    return bag;
  }

  /** Adds a single occurrence of the value. */
  add(value: number): void {
    this.addOccurrences(value, 1);
  }

  /** Adds the specified number of occurrences of the value. */
  addOccurrences(value: number, occurrences: number): void {
    if (occurrences < 0) {
      throw new RangeError("Occurrences must not be negative");
    }
    if (occurrences === 0) return;
    const k = mapKeyOf(value);
    const entry = this.counts.get(k);
    if (entry === undefined) {
      this.counts.set(k, { value, count: occurrences });
    } else {
      entry.count += occurrences;
    }
    this._size += occurrences;
  }

  /** Removes one occurrence of the value. Returns true if the value was present. */
  remove(value: number): boolean {
    const k = mapKeyOf(value);
    const entry = this.counts.get(k);
    if (entry === undefined || entry.count <= 0) return false;
    if (entry.count === 1) {
      this.counts.delete(k);
    } else {
      entry.count--;
    }
    this._size--;
    return true;
  }

  /** Removes all occurrences of the value. Returns the previous count. */
  removeAll(value: number): number {
    const k = mapKeyOf(value);
    const entry = this.counts.get(k);
    if (entry === undefined) return 0;
    this.counts.delete(k);
    this._size -= entry.count;
    return entry.count;
  }

  /** Removes the specified number of occurrences. Returns true if the value was present. */
  removeOccurrences(value: number, occurrences: number): boolean {
    if (occurrences < 0) {
      throw new RangeError("Occurrences must not be negative");
    }
    const k = mapKeyOf(value);
    const entry = this.counts.get(k);
    if (entry === undefined) return false;
    if (occurrences >= entry.count) {
      this.counts.delete(k);
      this._size -= entry.count;
    } else {
      entry.count -= occurrences;
      this._size -= occurrences;
    }
    return true;
  }

  /** Returns the number of occurrences of the value. */
  occurrencesOf(value: number): number {
    return this.counts.get(mapKeyOf(value))?.count ?? 0;
  }

  /** Returns true if the bag contains at least one occurrence of the value. */
  contains(value: number): boolean {
    return this.counts.has(mapKeyOf(value));
  }

  /** Returns the total number of elements (including duplicates). */
  size(): number {
    return this._size;
  }

  /** Returns the number of distinct elements. */
  sizeDistinct(): number {
    return this.counts.size;
  }

  /** Returns true if the bag is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Removes all elements. */
  clear(): void {
    this.counts.clear();
    this._size = 0;
  }

  /** Returns a new bag with elements satisfying the predicate. */
  select(predicate: (value: number) => boolean): NumberHashBag {
    const result = new NumberHashBag();
    for (const { value, count } of this.counts.values()) {
      if (predicate(value)) {
        result.addOccurrences(value, count);
      }
    }
    return result;
  }

  /** Returns a new bag with elements NOT satisfying the predicate. */
  reject(predicate: (value: number) => boolean): NumberHashBag {
    const result = new NumberHashBag();
    for (const { value, count } of this.counts.values()) {
      if (!predicate(value)) {
        result.addOccurrences(value, count);
      }
    }
    return result;
  }

  /** Calls the function for each element (including duplicates). */
  forEach(f: (value: number) => void): void {
    for (const { value, count } of this.counts.values()) {
      for (let i = 0; i < count; i++) {
        f(value);
      }
    }
  }

  /** Returns a new array with the results of calling `f` on each element (including duplicates). */
  map<U>(f: (value: number) => U): U[] {
    const result: U[] = [];
    for (const { value, count } of this.counts.values()) {
      for (let i = 0; i < count; i++) result.push(f(value));
    }
    return result;
  }

  /** Returns a new array with elements satisfying the predicate (including duplicates). */
  filter(predicate: (value: number) => boolean): number[] {
    const result: number[] = [];
    for (const { value, count } of this.counts.values()) {
      if (predicate(value)) {
        for (let i = 0; i < count; i++) result.push(value);
      }
    }
    return result;
  }

  /** Returns the first element satisfying the predicate, or undefined. */
  find(predicate: (value: number) => boolean): number | undefined {
    for (const { value } of this.counts.values()) {
      if (predicate(value)) return value;
    }
    return undefined;
  }

  /** Returns true if every distinct element satisfies the predicate. */
  every(predicate: (value: number) => boolean): boolean {
    for (const { value } of this.counts.values()) {
      if (!predicate(value)) return false;
    }
    return true;
  }

  /** Returns true if at least one element satisfies the predicate. */
  some(predicate: (value: number) => boolean): boolean {
    for (const { value } of this.counts.values()) {
      if (predicate(value)) return true;
    }
    return false;
  }

  /** Reduces the bag to a single value using the accumulator function (including duplicates). */
  reduce<U>(f: (acc: U, value: number) => U, initial: U): U {
    let acc = initial;
    for (const { value, count } of this.counts.values()) {
      for (let i = 0; i < count; i++) acc = f(acc, value);
    }
    return acc;
  }

  /** Returns true if the bag contains the value. Alias for `contains`. */
  includes(value: number): boolean {
    return this.contains(value);
  }

  /** Makes the bag iterable with for-of loops. Yields all elements including duplicates. */
  *[Symbol.iterator](): IterableIterator<number> {
    for (const { value, count } of this.counts.values()) {
      for (let i = 0; i < count; i++) yield value;
    }
  }

  /** Calls the function for each distinct element with its occurrence count. */
  forEachWithOccurrences(
    f: (value: number, occurrences: number) => void,
  ): void {
    for (const { value, count } of this.counts.values()) {
      f(value, count);
    }
  }

  /** Yields all distinct elements with their occurrence counts as [value, count] tuples. */
  *entries(): Generator<[number, number]> {
    for (const { value, count } of this.counts.values()) {
      yield [value, count];
    }
  }

  /** Returns all elements (including duplicates) as a plain array. */
  toArray(): number[] {
    const result: number[] = [];
    for (const { value, count } of this.counts.values()) {
      for (let i = 0; i < count; i++) {
        result.push(value);
      }
    }
    return result;
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (const { value, count } of this.counts.values()) {
      parts.push(`${value}x${count}`);
    }
    return `{${parts.join(", ")}}`;
  }
}
