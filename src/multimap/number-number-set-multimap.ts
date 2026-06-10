// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:multimap-nontyped`.

import { mapKeyOf, NEG_ZERO_KEY } from "../internal/float-order.js";

type MapKey = number | typeof NEG_ZERO_KEY;

/**
 * A multimap that maps number keys to sets of unique number values.
 * Backed by a JavaScript Map from key to array of values (duplicates on put are silently dropped).
 */
export class NumberNumberSetMultimap {
  // keyed via mapKeyOf so -0 and +0 are distinct; tuple stores the
  // original key alongside its value list.
  private _map: Map<MapKey, [number, number[]]>;
  private _totalSize: number;

  constructor() {
    this._map = new Map<MapKey, [number, number[]]>();
    this._totalSize = 0;
  }

  /** Creates a new empty multimap. */
  static of(): NumberNumberSetMultimap {
    return new NumberNumberSetMultimap();
  }

  /** Adds a value under the given key. Idempotent: a duplicate value for the same key is silently dropped. */
  put(key: number, value: number): void {
    const mk = mapKeyOf(key);
    const entry = this._map.get(mk);
    if (entry !== undefined) {
      const list = entry[1];
      for (let i = 0; i < list.length; i++) {
        if (Object.is(list[i], value)) return;
      }
      list.push(value);
    } else {
      this._map.set(mk, [key, [value]]);
    }
    this._totalSize++;
  }

  /** Returns a copy of the values for the key as a readonly array. Returns an empty array if the key is absent. */
  get(key: number): readonly number[] {
    const entry = this._map.get(mapKeyOf(key));
    return entry !== undefined ? entry[1].slice() : [];
  }

  /** Returns the number of values for the given key. */
  getCount(key: number): number {
    const entry = this._map.get(mapKeyOf(key));
    return entry !== undefined ? entry[1].length : 0;
  }

  /** Removes all values for the key and returns them. Returns an empty array if the key is absent. */
  removeAll(key: number): number[] {
    const mk = mapKeyOf(key);
    const entry = this._map.get(mk);
    if (entry === undefined) {
      return [];
    }
    this._map.delete(mk);
    this._totalSize -= entry[1].length;
    return entry[1];
  }

  /** Returns true if the multimap contains the given key. */
  containsKey(key: number): boolean {
    return this._map.has(mapKeyOf(key));
  }

  /** Returns true if the multimap contains the given key-value pair. */
  containsKeyValue(key: number, value: number): boolean {
    const entry = this._map.get(mapKeyOf(key));
    if (entry === undefined) return false;
    const list = entry[1];
    for (let i = 0; i < list.length; i++) {
      if (Object.is(list[i], value)) return true;
    }
    return false;
  }

  /** Returns the number of distinct keys. */
  get keysCount(): number {
    return this._map.size;
  }

  /** Returns the total number of values across all keys. */
  get size(): number {
    return this._totalSize;
  }

  /** Returns true if the multimap has no entries. */
  get isEmpty(): boolean {
    return this._totalSize === 0;
  }

  /** Removes all entries. */
  clear(): void {
    this._map.clear();
    this._totalSize = 0;
  }

  /** Calls the function for each key-value pair. */
  forEach(fn: (key: number, value: number) => void): void {
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        fn(key, list[i]);
      }
    }
  }

  /** Calls the function for each key with a copy of its associated list of values. */
  forEachKey(fn: (key: number, values: readonly number[]) => void): void {
    for (const [key, list] of this._map.values()) {
      fn(key, list.slice());
    }
  }

  /** Returns a new multimap containing only the key-value pairs that satisfy the predicate. */
  select(
    predicate: (key: number, value: number) => boolean,
  ): NumberNumberSetMultimap {
    const result = new NumberNumberSetMultimap();
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        if (predicate(key, list[i])) {
          result.put(key, list[i]);
        }
      }
    }
    return result;
  }

  /** Returns a new multimap containing only the key-value pairs that do NOT satisfy the predicate. */
  reject(
    predicate: (key: number, value: number) => boolean,
  ): NumberNumberSetMultimap {
    const result = new NumberNumberSetMultimap();
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        if (!predicate(key, list[i])) {
          result.put(key, list[i]);
        }
      }
    }
    return result;
  }

  /** Returns an array of all distinct keys. */
  uniqueKeys(): number[] {
    return Array.from(this._map.values(), ([key]) => key);
  }

  /** Returns an array of all values across all keys. */
  values(): number[] {
    const result: number[] = [];
    for (const [, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        result.push(list[i]);
      }
    }
    return result;
  }

  /** Returns all key-value pairs as an array of tuples. */
  toArray(): [number, number][] {
    const result: [number, number][] = [];
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        result.push([key, list[i]]);
      }
    }
    return result;
  }

  /** Returns a string representation of the multimap. */
  toString(): string {
    const parts: string[] = [];
    for (const [key, list] of this._map.values()) {
      parts.push(`${key}: [${list.join(", ")}]`);
    }
    return `{${parts.join(", ")}}`;
  }

  /** Returns true if this multimap has the same entries as the other multimap. */
  equals(other: NumberNumberSetMultimap): boolean {
    if (this._totalSize !== other._totalSize) return false;
    if (this._map.size !== other._map.size) return false;
    for (const [mk, [, list]] of this._map) {
      const otherEntry = other._map.get(mk);
      if (otherEntry === undefined) return false;
      const otherList = otherEntry[1];
      if (list.length !== otherList.length) return false;
      for (let i = 0; i < list.length; i++) {
        if (!Object.is(list[i], otherList[i])) return false;
      }
    }
    return true;
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *[Symbol.iterator](): Generator<[number, number]> {
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        yield [key, list[i]];
      }
    }
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[number, number]> {
    yield* this[Symbol.iterator]();
  }
}
