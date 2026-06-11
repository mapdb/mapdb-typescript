// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.

import type { MapDbMap } from "../api/index.js";
import { NumberBigIntHashMap } from "./number-bigint-hash-map.js";

/**
 * Immutable hash map with number keys and bigint values.
 * Wraps a mutable NumberBigIntHashMap, exposing only read-only operations.
 */
export class ImmutableNumberBigIntHashMap implements MapDbMap<number, bigint> {
  private readonly delegate: NumberBigIntHashMap;

  constructor(source: NumberBigIntHashMap) {
    // Copy all entries into a fresh mutable map so the caller cannot mutate our data.
    this.delegate = new NumberBigIntHashMap();
    for (const [k, v] of source.entries()) {
      this.delegate.set(k, v);
    }
  }

  /** Creates an immutable map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of(pairs: [number, bigint][]): ImmutableNumberBigIntHashMap {
    const m = new NumberBigIntHashMap(pairs.length * 2);
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return new ImmutableNumberBigIntHashMap(m);
  }

  /** Returns the value for the key, or undefined if not found. */
  get(key: number): bigint | undefined {
    return this.delegate.get(key);
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: number, defaultValue: bigint): bigint {
    return this.delegate.getOrDefault(key, defaultValue);
  }

  /** Returns true if the map contains the key. */
  has(key: number): boolean {
    return this.delegate.has(key);
  }

  /** Returns the number of entries. */
  get size(): number {
    return this.delegate.size;
  }

  /** Returns true if the map is empty. */
  isEmpty(): boolean {
    return this.delegate.isEmpty();
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[number, bigint]> {
    yield* this.delegate.entries();
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[number, bigint]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<number> {
    yield* this.delegate.keysIter();
  }

  /** Yields all values. */
  *valuesIter(): Generator<bigint> {
    yield* this.delegate.valuesIter();
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: number, value: bigint) => void): void {
    this.delegate.forEach(f);
  }

  /** Returns a new immutable map with entries satisfying the predicate. */
  select(
    predicate: (key: number, value: bigint) => boolean,
  ): ImmutableNumberBigIntHashMap {
    return new ImmutableNumberBigIntHashMap(this.delegate.select(predicate));
  }

  /** Returns a new immutable map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: number, value: bigint) => boolean,
  ): ImmutableNumberBigIntHashMap {
    return new ImmutableNumberBigIntHashMap(this.delegate.reject(predicate));
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: number, value: bigint) => boolean): boolean {
    return this.delegate.anySatisfy(predicate);
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: number, value: bigint) => boolean): boolean {
    return this.delegate.allSatisfy(predicate);
  }

  /** Performs a left fold over all entries. */
  injectInto<R>(initial: R, f: (acc: R, key: number, value: bigint) => R): R {
    return this.delegate.injectInto(initial, f);
  }

  /** Returns all keys as an array. */
  keysToArray(): number[] {
    return this.delegate.keysToArray();
  }

  /** Returns all values as an array. */
  valuesToArray(): bigint[] {
    return this.delegate.valuesToArray();
  }

  /** Returns a new mutable copy of this map. */
  toMutable(): NumberBigIntHashMap {
    const m = new NumberBigIntHashMap();
    for (const [k, v] of this.delegate.entries()) {
      m.set(k, v);
    }
    return m;
  }

  /** Returns a string representation. */
  toString(): string {
    return this.delegate.toString();
  }
}
