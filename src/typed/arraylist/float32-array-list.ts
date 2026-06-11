// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-arraylist`.


const DEFAULT_CAPACITY = 16;

/**
 * Resizable list backed by Float32Array.
 * Elements: 4 bytes each, contiguous memory, no GC pressure.
 * Grows by 2x when capacity is exceeded (allocates new Float32Array and copies).
 */
export class Float32ArrayList {
  private data: Float32Array;
  private _size = 0;

  constructor(initialCapacity = DEFAULT_CAPACITY) {
    this.data = new Float32Array(Math.max(initialCapacity, 1));
  }

  add(value: number): void {
    this.ensureCapacity(this._size + 1);
    this.data[this._size++] = value;
  }

  get(index: number): number {
    this.checkIndex(index);
    return this.data[index];
  }

  set(index: number, value: number): number {
    this.checkIndex(index);
    const old = this.data[index];
    this.data[index] = value;
    return old;
  }

  removeAtIndex(index: number): number {
    this.checkIndex(index);
    const old = this.data[index];
    // Shift elements left by copying subarray
    if (index < this._size - 1) {
      this.data.copyWithin(index, index + 1, this._size);
    }
    this._size--;
    return old;
  }

  contains(value: number): boolean {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return true;
    }
    return false;
  }

  indexOf(value: number): number {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return i;
    }
    return -1;
  }

  size(): number {
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

  select(predicate: (value: number) => boolean): Float32ArrayList {
    const result = new Float32ArrayList();
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  reject(predicate: (value: number) => boolean): Float32ArrayList {
    const result = new Float32ArrayList();
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  detect(predicate: (value: number) => boolean): number | undefined {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  anySatisfy(predicate: (value: number) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return true;
    }
    return false;
  }

  allSatisfy(predicate: (value: number) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  count(predicate: (value: number) => boolean): number {
    let c = 0;
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) c++;
    }
    return c;
  }

  sum(): number {
    // f32 per-add left-fold: round each running total back to f32 so the
    // accumulation precision matches a real Float32 column (and Go's
    // Float32ArrayList.Sum(), which accumulates in `float32`). A naive f64
    // running total would over-retain precision and disagree cross-language.
    let s = Math.fround(0);
    for (let i = 0; i < this._size; i++) {
      s = Math.fround(s + this.data[i]);
    }
    return s;
  }

  min(): number | undefined {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] < m) m = this.data[i];
    }
    return m;
  }

  max(): number | undefined {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  *entries(): Generator<number> {
    for (let i = 0; i < this._size; i++) {
      yield this.data[i];
    }
  }

  toArray(): Float32Array {
    return this.data.slice(0, this._size);
  }

  /** Creates a mutable list from an immutable one. */
  static fromImmutable(imm: { toArray(): number[] }): Float32ArrayList {
    const arr = imm.toArray();
    const list = new Float32ArrayList(arr.length);
    for (const v of arr) {
      list.add(v);
    }
    return list;
  }

  /** Makes the list iterable with for-of loops. Yields elements in order. */
  *[Symbol.iterator](): IterableIterator<number> {
    for (let i = 0; i < this._size; i++) {
      yield this.data[i];
    }
  }

  forEach(f: (value: number, index: number) => void): void {
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
    const newData = new Float32Array(newCapacity);
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
