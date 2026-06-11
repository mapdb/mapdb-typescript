// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-bag`.


import { Float32HashBag } from "./float32-hash-bag.js";

/**
 * Immutable bag (multiset) for number values backed by Map<number, number>.
 * Tracks occurrence counts for each distinct value.
 * Construct via static of(values) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 */
export class ImmutableFloat32HashBag {
  private counts: Map<number, number>;
  private _size: number;

  /** Creates an immutable bag from an array of values (defensive copy). */
  static of(values: number[]): ImmutableFloat32HashBag {
    const counts = new Map<number, number>();
    let size = 0;
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
      size++;
    }
    return new ImmutableFloat32HashBag(counts, size);
  }

  /** Creates an immutable copy from a mutable bag (defensive copy). */
  static fromMutable(mutable: Float32HashBag): ImmutableFloat32HashBag {
    const counts = new Map<number, number>();
    let size = 0;
    mutable.forEachWithOccurrences((value, occurrences) => {
      counts.set(value, occurrences);
      size += occurrences;
    });
    return new ImmutableFloat32HashBag(counts, size);
  }

  private constructor(counts: Map<number, number>, size: number) {
    this.counts = counts;
    this._size = size;
  }

  /** Returns the number of occurrences of the given value. */
  occurrencesOf(value: number): number {
    return this.counts.get(value) ?? 0;
  }

  /** Returns true if the bag contains the given value. */
  has(value: number): boolean {
    return this.counts.has(value);
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
    for (const entry of this.counts) {
      yield entry;
    }
  }

  /** Makes the bag iterable with for-of loops; yields each item repeated by
   * its occurrence count (matching forEach / toArray). */
  *[Symbol.iterator](): IterableIterator<number> {
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) yield value;
    }
  }

  /** Iterates over each item, repeating by occurrence count. */
  forEach(f: (value: number) => void): void {
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) {
        f(value);
      }
    }
  }

  /** Iterates over each distinct value with its occurrence count. */
  forEachWithOccurrences(
    f: (value: number, occurrences: number) => void,
  ): void {
    for (const [value, count] of this.counts) {
      f(value, count);
    }
  }

  /** Returns a new MUTABLE bag with values satisfying the predicate. */
  select(predicate: (value: number) => boolean): Float32HashBag {
    const result = new Float32HashBag();
    for (const [value, count] of this.counts) {
      if (predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a new MUTABLE bag with values NOT satisfying the predicate. */
  reject(predicate: (value: number) => boolean): Float32HashBag {
    const result = new Float32HashBag();
    for (const [value, count] of this.counts) {
      if (!predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a Float32Array with all items, each repeated by occurrence count. */
  toArray(): Float32Array {
    const result = new Float32Array(this._size);
    let idx = 0;
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) {
        result[idx++] = value;
      }
    }
    return result;
  }

  /** Returns a mutable copy of this immutable bag. */
  toMutable(): Float32HashBag {
    const result = new Float32HashBag();
    for (const [value, count] of this.counts) {
      result.addOccurrences(value, count);
    }
    return result;
  }

  toString(): string {
    const parts: string[] = [];
    for (const [value, count] of this.counts) {
      parts.push(`${value}×${count}`);
    }
    return `{${parts.join(", ")}}`;
  }

  /** Estimated memory: Map overhead + this object overhead. */
  memoryBytes(): number {
    // Map<number, number>: ~80 bytes per entry overhead in V8
    // This is an estimate; exact memory depends on the JS engine.
    return this.counts.size * 80;
  }
}
