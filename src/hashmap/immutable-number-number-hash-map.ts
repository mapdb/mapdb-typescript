// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.

import type { MapDbMap } from "../api/index.js";
import { NumberNumberHashMap } from "./number-number-hash-map.js";

/**
 * Immutable hash map with number keys and number values.
 * Wraps a mutable NumberNumberHashMap, exposing only read-only operations.
 */
export class ImmutableNumberNumberHashMap implements MapDbMap<number, number> {
  private readonly delegate: NumberNumberHashMap;

  constructor(source: NumberNumberHashMap) {
    // Copy all entries into a fresh mutable map so the caller cannot mutate our data.
    this.delegate = new NumberNumberHashMap();
    for (const [k, v] of source.entries()) {
      this.delegate.set(k, v);
    }
  }

  /** Creates an immutable map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of(pairs: [number, number][]): ImmutableNumberNumberHashMap {
    const m = new NumberNumberHashMap(pairs.length * 2);
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return new ImmutableNumberNumberHashMap(m);
  }

  /** Returns the value for the key, or undefined if not found. */
  get(key: number): number | undefined {
    return this.delegate.get(key);
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: number, defaultValue: number): number {
    return this.delegate.getOrDefault(key, defaultValue);
  }

  /** Returns true if the map contains the key. */
  has(key: number): boolean {
    return this.delegate.has(key);
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
  *entries(): Generator<[number, number]> {
    yield* this.delegate.entries();
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[number, number]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<number> {
    yield* this.delegate.keysIter();
  }

  /** Yields all values. */
  *valuesIter(): Generator<number> {
    yield* this.delegate.valuesIter();
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: number, value: number) => void): void {
    this.delegate.forEach(f);
  }

  /** Returns a new immutable map with entries satisfying the predicate. */
  select(
    predicate: (key: number, value: number) => boolean,
  ): ImmutableNumberNumberHashMap {
    return new ImmutableNumberNumberHashMap(this.delegate.select(predicate));
  }

  /** Returns a new immutable map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: number, value: number) => boolean,
  ): ImmutableNumberNumberHashMap {
    return new ImmutableNumberNumberHashMap(this.delegate.reject(predicate));
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: number, value: number) => boolean): boolean {
    return this.delegate.anySatisfy(predicate);
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: number, value: number) => boolean): boolean {
    return this.delegate.allSatisfy(predicate);
  }

  /** Performs a left fold over all entries. */
  injectInto<R>(initial: R, f: (acc: R, key: number, value: number) => R): R {
    return this.delegate.injectInto(initial, f);
  }

  /** Returns all keys as an array. */
  keysToArray(): number[] {
    return this.delegate.keysToArray();
  }

  /** Returns all values as an array. */
  valuesToArray(): number[] {
    return this.delegate.valuesToArray();
  }

  /** Returns a new mutable copy of this map. */
  toMutable(): NumberNumberHashMap {
    const m = new NumberNumberHashMap();
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
