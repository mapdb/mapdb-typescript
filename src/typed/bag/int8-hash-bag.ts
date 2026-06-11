// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-bag`.


/**
 * Bag (multiset) for number values backed by Map<number, number>.
 * Tracks occurrence counts for each distinct value.
 * Map handles number keys natively, including bigint.
 */
export class Int8HashBag {
  private counts: Map<number, number> = new Map();
  private _size = 0;

  add(value: number): void {
    this.addOccurrences(value, 1);
  }

  addOccurrences(value: number, occurrences: number): void {
    if (occurrences < 0)
      throw new RangeError("Occurrences must not be negative");
    if (occurrences === 0) return;
    const current = this.counts.get(value) ?? 0;
    this.counts.set(value, current + occurrences);
    this._size += occurrences;
  }

  remove(value: number): boolean {
    return this.removeOccurrences(value, 1);
  }

  removeOccurrences(value: number, occurrences: number): boolean {
    if (occurrences < 0)
      throw new RangeError("Occurrences must not be negative");
    if (occurrences === 0) return false;
    const current = this.counts.get(value);
    if (current === undefined) return false;
    if (occurrences >= current) {
      this.counts.delete(value);
      this._size -= current;
    } else {
      this.counts.set(value, current - occurrences);
      this._size -= occurrences;
    }
    return true;
  }

  removeAll(value: number): boolean {
    const current = this.counts.get(value);
    if (current === undefined) return false;
    this.counts.delete(value);
    this._size -= current;
    return true;
  }

  occurrencesOf(value: number): number {
    return this.counts.get(value) ?? 0;
  }

  contains(value: number): boolean {
    return this.counts.has(value);
  }

  /** Set-shaped alias for {@link contains}. */
  has(value: number): boolean {
    return this.contains(value);
  }

  /** Total number of items including duplicates */
  size(): number {
    return this._size;
  }

  /** Number of distinct values */
  sizeDistinct(): number {
    return this.counts.size;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    this.counts.clear();
    this._size = 0;
  }

  /** Yields [value, occurrences] pairs for each distinct value */
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

  /** Iterates over each item, repeating by occurrence count */
  forEach(f: (value: number) => void): void {
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) {
        f(value);
      }
    }
  }

  /** Iterates over each distinct value with its occurrence count */
  forEachWithOccurrences(
    f: (value: number, occurrences: number) => void,
  ): void {
    for (const [value, count] of this.counts) {
      f(value, count);
    }
  }

  select(predicate: (value: number) => boolean): Int8HashBag {
    const result = new Int8HashBag();
    for (const [value, count] of this.counts) {
      if (predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  reject(predicate: (value: number) => boolean): Int8HashBag {
    const result = new Int8HashBag();
    for (const [value, count] of this.counts) {
      if (!predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a Int8Array with all items, each repeated by occurrence count */
  toArray(): Int8Array {
    const result = new Int8Array(this._size);
    let idx = 0;
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) {
        result[idx++] = value;
      }
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

  /** Estimated memory: Map overhead + this object overhead */
  memoryBytes(): number {
    // Map<number, number>: ~80 bytes per entry overhead in V8
    // This is an estimate; exact memory depends on the JS engine.
    return this.counts.size * 80;
  }
}
