// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-arraylist`.


const DEFAULT_CAPACITY = 16;

/**
 * Resizable list backed by BigInt64Array.
 * Elements: 8 bytes each, contiguous memory, no GC pressure.
 * Grows by 2x when capacity is exceeded (allocates new BigInt64Array and copies).
 */
export class BigInt64ArrayList {
  private data: BigInt64Array;
  private _size = 0;

  constructor(initialCapacity = DEFAULT_CAPACITY) {
    this.data = new BigInt64Array(Math.max(initialCapacity, 1));
  }

  /**
   * Bulk-loads a fresh list from `values` in one O(n) pass (the data pump),
   * allocating the backing array exactly once. Equivalent to appending each
   * value but with no intermediate growth.
   */
  static bulkLoad(values: Iterable<bigint>): BigInt64ArrayList {
    const buffer = Array.from(values);
    const list = new BigInt64ArrayList(Math.max(buffer.length, 1));
    list.data.set(buffer);
    list._size = buffer.length;
    return list;
  }

  add(value: bigint): this {
    this.ensureCapacity(this._size + 1);
    this.data[this._size++] = value;
    return this;
  }

  get(index: number): bigint {
    this.checkIndex(index);
    return this.data[index];
  }

  set(index: number, value: bigint): bigint {
    this.checkIndex(index);
    const old = this.data[index];
    this.data[index] = value;
    return old;
  }

  removeAtIndex(index: number): bigint {
    this.checkIndex(index);
    const old = this.data[index];
    // Shift elements left by copying subarray
    if (index < this._size - 1) {
      this.data.copyWithin(index, index + 1, this._size);
    }
    this._size--;
    return old;
  }

  has(value: bigint): boolean {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return true;
    }
    return false;
  }

  indexOf(value: bigint): number {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return i;
    }
    return -1;
  }

  get size(): number {
    return this._size;
  }
  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    this._size = 0;
  }

  sort(): void {
    if (this._size <= 1) return;
    const view = this.data.subarray(0, this._size);
    view.sort();
  }

  select(predicate: (value: bigint) => boolean): BigInt64ArrayList {
    const result = new BigInt64ArrayList();
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  reject(predicate: (value: bigint) => boolean): BigInt64ArrayList {
    const result = new BigInt64ArrayList();
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  detect(predicate: (value: bigint) => boolean): bigint | undefined {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  anySatisfy(predicate: (value: bigint) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return true;
    }
    return false;
  }

  allSatisfy(predicate: (value: bigint) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  count(predicate: (value: bigint) => boolean): number {
    let c = 0;
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) c++;
    }
    return c;
  }

  sum(): bigint {
    let s: bigint = 0n as bigint;
    for (let i = 0; i < this._size; i++) {
      s = ((s as any) + this.data[i]) as any as bigint;
    }
    return s;
  }

  min(): bigint | undefined {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] < m) m = this.data[i];
    }
    return m;
  }

  max(): bigint | undefined {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  /** Yields [index, value] pairs, like Array.prototype.entries(). */
  *entries(): Generator<[number, bigint]> {
    for (let i = 0; i < this._size; i++) {
      yield [i, this.data[i]];
    }
  }

  toArray(): BigInt64Array {
    return this.data.slice(0, this._size);
  }

  /** Creates a mutable list from an immutable one. */
  static fromImmutable(imm: { toArray(): bigint[] }): BigInt64ArrayList {
    const arr = imm.toArray();
    const list = new BigInt64ArrayList(arr.length);
    for (const v of arr) {
      list.add(v);
    }
    return list;
  }

  /** Makes the list iterable with for-of loops. Yields elements in order. */
  *[Symbol.iterator](): IterableIterator<bigint> {
    for (let i = 0; i < this._size; i++) {
      yield this.data[i];
    }
  }

  forEach(f: (value: bigint, index: number) => void): void {
    for (let i = 0; i < this._size; i++) {
      f(this.data[i], i);
    }
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this._size; i++) {
      parts.push(`${this.data[i]}`);
    }
    return `[${parts.join(", ")}]`;
  }

  /** Memory used by the backing TypedArray in bytes */
  memoryBytes(): number {
    return this.data.byteLength;
  }

  private ensureCapacity(minCapacity: number): void {
    if (minCapacity <= this.data.length) return;
    let newCapacity = this.data.length * 2;
    if (newCapacity < minCapacity) newCapacity = minCapacity;
    const newData = new BigInt64Array(newCapacity);
    newData.set(this.data.subarray(0, this._size));
    this.data = newData;
  }

  private checkIndex(index: number): void {
    if (index < 0 || index >= this._size) {
      throw new RangeError(
        `Index ${index} out of bounds for size ${this._size}`,
      );
    }
  }
}
