// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:hashmap-nontyped`.


import { NumberBigIntHashBiMap } from "./number-bigint-hash-bi-map.js";
import { PumpDuplicateError } from "../internal/pump.js";
/**
 * Bidirectional hash map from bigint keys to number values.
 * Both key->value and value->key lookups are O(1).
 * Each key maps to exactly one value and each value maps to exactly one key.
 * Inserting a duplicate key OR value replaces the existing mapping.
 */
export class BigIntNumberHashBiMap {
  private _forward: Map<bigint, number>;
  private _inverse: Map<number, bigint>;

  constructor() {
    this._forward = new Map<bigint, number>();
    this._inverse = new Map<number, bigint>();
  }

  /** Creates a new empty BiMap. */
  static of(): BigIntNumberHashBiMap {
    return new BigIntNumberHashBiMap();
  }

  /**
   * Bulk-loads a fresh bi-map from key/value pairs in one O(n) pass (the data
   * pump). A bi-map requires a bijection, so — unlike {@link set}, which
   * overwrites — a duplicate KEY or duplicate VALUE throws
   * {@link PumpDuplicateError}. Both directions are probed before either side is
   * inserted, so a rejected pair leaves the map unchanged.
   */
  static bulkLoad(pairs: Iterable<readonly [bigint, number]>): BigIntNumberHashBiMap {
    const bm = new BigIntNumberHashBiMap();
    let i = 0;
    for (const [key, value] of pairs) {
      if (bm._forward.has(key)) throw new PumpDuplicateError(i, "key");
      if (bm._inverse.has(value)) throw new PumpDuplicateError(i, "value");
      bm._forward.set(key, value);
      bm._inverse.set(value, key);
      i++;
    }
    return bm;
  }

  /**
   * Inserts a key-value pair into the bi-map.
   * If the key already existed, the old value mapping is removed.
   * If the value already existed, the old key mapping is removed.
   */
  set(key: bigint, value: number): this {
    // If this key already maps to an old value, remove old_value->key from inverse
    const oldValue = this._forward.get(key);
    if (oldValue !== undefined) {
      this._inverse.delete(oldValue);
    }

    // If this value already maps to an old key, remove old_key->value from forward
    const oldKey = this._inverse.get(value);
    if (oldKey !== undefined && !Object.is(oldKey, key)) {
      this._forward.delete(oldKey);
    }

    this._forward.set(key, value);
    this._inverse.set(value, key);
    return this;
  }

  /** Forward lookup: returns the value for the given key, or undefined. */
  get(key: bigint): number | undefined {
    return this._forward.get(key);
  }

  /** Inverse lookup: returns the key for the given value, or undefined. */
  getKey(value: number): bigint | undefined {
    return this._inverse.get(value);
  }

  /** Returns true if the map contains the given key. */
  has(key: bigint): boolean {
    return this._forward.has(key);
  }

  /** Returns true if the map contains the given value. */
  containsValue(value: number): boolean {
    return this._inverse.has(value);
  }

  /**
   * Removes the entry for the given key.
   * Returns the old value, or undefined if the key was not present.
   */
  removeKey(key: bigint): number | undefined {
    const value = this._forward.get(key);
    if (value !== undefined) {
      this._forward.delete(key);
      this._inverse.delete(value);
      return value;
    }
    return undefined;
  }

  /**
   * Removes the entry for the given value.
   * Returns the old key, or undefined if the value was not present.
   */
  removeValue(value: number): bigint | undefined {
    const key = this._inverse.get(value);
    if (key !== undefined) {
      this._inverse.delete(value);
      this._forward.delete(key);
      return key;
    }
    return undefined;
  }

  /** Returns the number of entries in the bi-map. */
  get size(): number {
    return this._forward.size;
  }

  /** Returns true if the bi-map contains no entries. */
  get isEmpty(): boolean {
    return this._forward.size === 0;
  }

  /** Removes all entries from the bi-map. */
  clear(): void {
    this._forward.clear();
    this._inverse.clear();
  }

  /** Returns all keys as an array. */
  keys(): bigint[] {
    return Array.from(this._forward.keys());
  }

  /** Returns all values as an array. */
  values(): number[] {
    return Array.from(this._forward.values());
  }

  /** Calls the function for each key-value pair. */
  forEach(fn: (key: bigint, value: number) => void): void {
    this._forward.forEach((value, key) => {
      fn(key, value);
    });
  }

  /** Returns all entries as an array of [key, value] tuples. */
  toArray(): [bigint, number][] {
    return Array.from(this._forward.entries());
  }

  /** Returns a new BiMap with key and value types swapped. */
  inverse(): NumberBigIntHashBiMap {
    const result = new NumberBigIntHashBiMap();
    this._forward.forEach((value, key) => {
      result.set(value, key);
    });
    return result;
  }

  /** Returns true if this bi-map contains the same entries as the other. */
  equals(other: BigIntNumberHashBiMap): boolean {
    if (this.size !== other.size) {
      return false;
    }
    for (const [key, value] of this._forward) {
      const otherValue = other.get(key);
      if (otherValue === undefined || !Object.is(value, otherValue)) {
        return false;
      }
    }
    return true;
  }

  /** Returns a string representation of the bi-map. */
  toString(): string {
    const parts: string[] = [];
    this._forward.forEach((value, key) => {
      parts.push(`${key}=${value}`);
    });
    return `{${parts.join(", ")}}`;
  }

  /** Yields [key, value] tuples. */
  *[Symbol.iterator](): Generator<[bigint, number]> {
    for (const entry of this._forward) {
      yield entry;
    }
  }
}
