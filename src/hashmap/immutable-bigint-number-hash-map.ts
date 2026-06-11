// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.

import type { MapDbMap } from "../api/index.js";
import { BigIntNumberHashMap } from "./bigint-number-hash-map.js";

/**
 * Immutable hash map with bigint keys and number values.
 * Wraps a mutable BigIntNumberHashMap, exposing only read-only operations.
 */
export class ImmutableBigIntNumberHashMap implements MapDbMap<bigint, number> {
  private readonly delegate: BigIntNumberHashMap;

  constructor(source: BigIntNumberHashMap) {
    // Copy all entries into a fresh mutable map so the caller cannot mutate our data.
    this.delegate = new BigIntNumberHashMap();
    for (const [k, v] of source.entries()) {
      this.delegate.put(k, v);
    }
  }

  /** Creates an immutable map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of(pairs: [bigint, number][]): ImmutableBigIntNumberHashMap {
    const m = new BigIntNumberHashMap(pairs.length * 2);
    for (const [k, v] of pairs) {
      m.put(k, v);
    }
    return new ImmutableBigIntNumberHashMap(m);
  }

  /** Returns the value for the key, or undefined if not found. */
  get(key: bigint): number | undefined {
    return this.delegate.get(key);
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: bigint, defaultValue: number): number {
    return this.delegate.getOrDefault(key, defaultValue);
  }

  /** Returns true if the map contains the key. */
  containsKey(key: bigint): boolean {
    return this.delegate.containsKey(key);
  }

  /** Map-shaped alias for {@link containsKey}. */
  has(key: bigint): boolean {
    return this.containsKey(key);
  }

  /** Returns the number of entries. */
  size(): number {
    return this.delegate.size();
  }

  /** Returns true if the map is empty. */
  isEmpty(): boolean {
    return this.delegate.isEmpty();
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[bigint, number]> {
    yield* this.delegate.entries();
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[bigint, number]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<bigint> {
    yield* this.delegate.keysIter();
  }

  /** Yields all values. */
  *valuesIter(): Generator<number> {
    yield* this.delegate.valuesIter();
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: bigint, value: number) => void): void {
    this.delegate.forEach(f);
  }

  /** Returns a new immutable map with entries satisfying the predicate. */
  select(
    predicate: (key: bigint, value: number) => boolean,
  ): ImmutableBigIntNumberHashMap {
    return new ImmutableBigIntNumberHashMap(this.delegate.select(predicate));
  }

  /** Returns a new immutable map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: bigint, value: number) => boolean,
  ): ImmutableBigIntNumberHashMap {
    return new ImmutableBigIntNumberHashMap(this.delegate.reject(predicate));
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: bigint, value: number) => boolean): boolean {
    return this.delegate.anySatisfy(predicate);
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: bigint, value: number) => boolean): boolean {
    return this.delegate.allSatisfy(predicate);
  }

  /** Performs a left fold over all entries. */
  injectInto<R>(initial: R, f: (acc: R, key: bigint, value: number) => R): R {
    return this.delegate.injectInto(initial, f);
  }

  /** Returns all keys as an array. */
  keysToArray(): bigint[] {
    return this.delegate.keysToArray();
  }

  /** Returns all values as an array. */
  valuesToArray(): number[] {
    return this.delegate.valuesToArray();
  }

  /** Returns a new mutable copy of this map. */
  toMutable(): BigIntNumberHashMap {
    const m = new BigIntNumberHashMap();
    for (const [k, v] of this.delegate.entries()) {
      m.put(k, v);
    }
    return m;
  }

  /** Returns a string representation. */
  toString(): string {
    return this.delegate.toString();
  }
}
