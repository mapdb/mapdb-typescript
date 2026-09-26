// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-bag`.


import { Float32HashBag } from "./float32-hash-bag.js";
import {
  mapKeyOf,
  mapKeyValue,
  type NumberMapKey,
} from "../../internal/float-order.js";

/**
 * Immutable bag (multiset) for number values backed by Map<NumberMapKey, number>.
 * Tracks occurrence counts for each distinct value.
 * Every caller-supplied value is first narrowed to what Float32Array stores.
 * Keys are routed through mapKeyOf, so -0 and +0 are DISTINCT keys
 * (Object.is identity, like the typed hash sets); every NaN is ONE key.
 * Iteration follows Map insertion order of the distinct values.
 * Construct via static of(values) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 */
export class ImmutableFloat32HashBag {
  private counts: Map<NumberMapKey, number>;
  private _size: number;

  /** Creates an immutable bag from an array of values (defensive copy). */
  static of(values: number[]): ImmutableFloat32HashBag {
    const counts = new Map<NumberMapKey, number>();
    let size = 0;
    for (const rawV of values) {
      const v = Math.fround(rawV);
      const key = mapKeyOf(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      size++;
    }
    return new ImmutableFloat32HashBag(counts, size);
  }

  /** Creates an immutable copy from a mutable bag (defensive copy). */
  static fromMutable(mutable: Float32HashBag): ImmutableFloat32HashBag {
    const counts = new Map<NumberMapKey, number>();
    let size = 0;
    mutable.forEachWithOccurrences((value, occurrences) => {
      counts.set(mapKeyOf(value), occurrences);
      size += occurrences;
    });
    return new ImmutableFloat32HashBag(counts, size);
  }

  private constructor(counts: Map<NumberMapKey, number>, size: number) {
    this.counts = counts;
    this._size = size;
  }

  /** Returns the number of occurrences of the given value. */
  occurrencesOf(value: number): number {
    value = Math.fround(value);
    return this.counts.get(mapKeyOf(value)) ?? 0;
  }

  /** Returns true if the bag contains the given value. */
  has(value: number): boolean {
    value = Math.fround(value);
    return this.counts.has(mapKeyOf(value));
  }

  /** Total number of items including duplicates. */
  get size(): number {
    return this._size;
  }

  /** Number of distinct values. */
  sizeDistinct(): number {
    return this.counts.size;
  }

  /** Returns true if the bag is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Yields [value, occurrences] pairs for each distinct value. */
  *entries(): Generator<[number, number]> {
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      yield [value, count];
    }
  }

  /** Makes the bag iterable with for-of loops; yields each item repeated by
   * its occurrence count (matching forEach / toArray). */
  *[Symbol.iterator](): IterableIterator<number> {
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      for (let i = 0; i < count; i++) yield value;
    }
  }

  /** Iterates over each item, repeating by occurrence count. */
  forEach(f: (value: number) => void): void {
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      for (let i = 0; i < count; i++) {
        f(value);
      }
    }
  }

  /** Iterates over each distinct value with its occurrence count. */
  forEachWithOccurrences(
    f: (value: number, occurrences: number) => void,
  ): void {
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      f(value, count);
    }
  }

  /** Returns a new MUTABLE bag with values satisfying the predicate. */
  select(predicate: (value: number) => boolean): Float32HashBag {
    const result = new Float32HashBag();
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      if (predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a new MUTABLE bag with values NOT satisfying the predicate. */
  reject(predicate: (value: number) => boolean): Float32HashBag {
    const result = new Float32HashBag();
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      if (!predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a Float32Array with all items, each repeated by occurrence count. */
  toArray(): Float32Array {
    const result = new Float32Array(this._size);
    let idx = 0;
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      for (let i = 0; i < count; i++) {
        result[idx++] = value;
      }
    }
    return result;
  }

  /** Returns a mutable copy of this immutable bag. */
  toMutable(): Float32HashBag {
    const result = new Float32HashBag();
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      result.addOccurrences(value, count);
    }
    return result;
  }

  toString(): string {
    const parts: string[] = [];
    for (const [key, count] of this.counts) {
      const value = mapKeyValue(key);
      parts.push(`${value}×${count}`);
    }
    return `{${parts.join(", ")}}`;
  }

  /** Estimated memory: Map overhead + this object overhead. */
  memoryBytes(): number {
    // Map<NumberMapKey, number>: ~80 bytes per entry overhead in V8
    // This is an estimate; exact memory depends on the JS engine.
    return this.counts.size * 80;
  }
}
