// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// ---------------------------------------------------------------------------
// Templates for the four single-element-type typed families (phase 6b-2):
//   arraylist  (mutable + immutable)
//   hashset    (mutable + immutable)
//   stack      (mutable + immutable)
//   bag        (mutable only)
//
// Pure string builders parameterised ONLY by the per-PRIM metadata in spec.mjs
// (no name-based branching). Canonical hash helpers (f64HashSeed / bigintHashSeed)
// are imported BY NAME via KEY_HASH — never inlined. Per-type behavioural
// nuances that are NOT pure type substitution are folded into these templates so
// regeneration reproduces the committed files verbatim. The notable ones are:
//
//   * arraylist `sum()` for float32 uses a per-add Math.fround f32 left-fold
//     (matches Go's float32-accumulating Sum); float64/int use an f64 running
//     total; bigint uses a bigint total. The mutable and immutable float32
//     variants carry DIFFERENT explanatory comments — both reproduced exactly.
//   * stack `sum()` does NOT use the fround fold for float32 — it uses the same
//     f64 running total as the integers (this is the committed behaviour).
//   * hashset element hashing uses the same canonical helpers as hashmap keys.
//   * float-keyed hashsets carry an `IEEE 754 edge cases` test block.
// ---------------------------------------------------------------------------

import { KEY_HASH } from "./spec.mjs";

const LICENSE = `// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
`;

/** The DO-NOT-EDIT banner stamped on every generated file. */
function banner(command) {
  return `// CODE GENERATED — DO NOT EDIT. Regenerate with \`${command}\`.\n`;
}

/** Literal for a value of this primitive: bigint gets the `n` suffix. */
function lit(prim, n) {
  return prim.tsType === "bigint" ? `${n}n` : `${n}`;
}

// ---------------------------------------------------------------------------
// sum() body builders (shared by arraylist + stack).
// ---------------------------------------------------------------------------

/** f64 / bigint accumulating sum body (used by ints, float64, and all stacks). */
function plainSumBody(prim) {
  if (prim.tsType === "bigint") {
    return `    let s: bigint = 0n as bigint;
    for (let i = 0; i < this._size; i++) {
      s = ((s as any) + this.data[i]) as any as bigint;
    }
    return s;`;
  }
  return `    let s: number = 0 as number;
    for (let i = 0; i < this._size; i++) {
      s = ((s as any) + this.data[i]) as any as number;
    }
    return s;`;
}

/** f32 per-add fround left-fold body for the MUTABLE Float32ArrayList. */
function froundSumBodyMutable() {
  return `    // f32 per-add left-fold: round each running total back to f32 so the
    // accumulation precision matches a real Float32 column (and Go's
    // Float32ArrayList.Sum(), which accumulates in \`float32\`). A naive f64
    // running total would over-retain precision and disagree cross-language.
    let s = Math.fround(0);
    for (let i = 0; i < this._size; i++) {
      s = Math.fround(s + this.data[i]);
    }
    return s;`;
}

/** f32 per-add fround left-fold body for the IMMUTABLE Float32ArrayList. */
function froundSumBodyImmutable() {
  return `    // f32 per-add left-fold (Math.fround per addition) — matches the mutable
    // Float32ArrayList.sum() and Go's float32-accumulating Sum(). See the
    // mutable list for the rationale.
    let s = Math.fround(0);
    for (let i = 0; i < this._size; i++) {
      s = Math.fround(s + this.data[i]);
    }
    return s;`;
}

// ===========================================================================
// ARRAYLIST — mutable
// ===========================================================================

export function arrayListSourceFileName(prim) {
  return `${prim.id}-array-list.ts`;
}
export function arrayListTestFileName(prim) {
  return `${prim.id}-array-list.generated.test.ts`;
}
export function arrayListClassName(prim) {
  return `${prim.name}ArrayList`;
}

export function renderArrayList(prim, command) {
  const cls = arrayListClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;
  const retU = prim.tsType === "bigint" ? "bigint | undefined" : "number | undefined";
  const sumRet = T;
  const sumBody =
    prim.kind === "float" && prim.id === "float32"
      ? froundSumBodyMutable()
      : plainSumBody(prim);

  return `${LICENSE}${banner(command)}

const DEFAULT_CAPACITY = 16;

/**
 * Resizable list backed by ${Arr}.
 * Elements: ${prim.bytes} bytes each, contiguous memory, no GC pressure.
 * Grows by 2x when capacity is exceeded (allocates new ${Arr} and copies).
 */
export class ${cls} {
  private data: ${Arr};
  private _size = 0;

  constructor(initialCapacity = DEFAULT_CAPACITY) {
    this.data = new ${Arr}(Math.max(initialCapacity, 1));
  }

  /**
   * Bulk-loads a fresh list from \`values\` in one O(n) pass (the data pump),
   * allocating the backing array exactly once. Equivalent to appending each
   * value but with no intermediate growth.
   */
  static bulkLoad(values: Iterable<${T}>): ${cls} {
    const buffer = Array.from(values);
    const list = new ${cls}(Math.max(buffer.length, 1));
    list.data.set(buffer);
    list._size = buffer.length;
    return list;
  }

  add(value: ${T}): this {
    this.ensureCapacity(this._size + 1);
    this.data[this._size++] = value;
    return this;
  }

  get(index: number): ${T} {
    this.checkIndex(index);
    return this.data[index];
  }

  set(index: number, value: ${T}): ${T} {
    this.checkIndex(index);
    const old = this.data[index];
    this.data[index] = value;
    return old;
  }

  removeAtIndex(index: number): ${T} {
    this.checkIndex(index);
    const old = this.data[index];
    // Shift elements left by copying subarray
    if (index < this._size - 1) {
      this.data.copyWithin(index, index + 1, this._size);
    }
    this._size--;
    return old;
  }

  has(value: ${T}): boolean {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return true;
    }
    return false;
  }

  indexOf(value: ${T}): number {
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

  select(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  reject(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  detect(predicate: (value: ${T}) => boolean): ${retU} {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  anySatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return true;
    }
    return false;
  }

  allSatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  count(predicate: (value: ${T}) => boolean): number {
    let c = 0;
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) c++;
    }
    return c;
  }

  sum(): ${sumRet} {
${sumBody}
  }

  min(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] < m) m = this.data[i];
    }
    return m;
  }

  max(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  /** Yields [index, value] pairs, like Array.prototype.entries(). */
  *entries(): Generator<[number, ${T}]> {
    for (let i = 0; i < this._size; i++) {
      yield [i, this.data[i]];
    }
  }

  toArray(): ${Arr} {
    return this.data.slice(0, this._size);
  }

  /** Creates a mutable list from an immutable one. */
  static fromImmutable(imm: { toArray(): ${T}[] }): ${cls} {
    const arr = imm.toArray();
    const list = new ${cls}(arr.length);
    for (const v of arr) {
      list.add(v);
    }
    return list;
  }

  /** Makes the list iterable with for-of loops. Yields elements in order. */
  *[Symbol.iterator](): IterableIterator<${T}> {
    for (let i = 0; i < this._size; i++) {
      yield this.data[i];
    }
  }

  forEach(f: (value: ${T}, index: number) => void): void {
    for (let i = 0; i < this._size; i++) {
      f(this.data[i], i);
    }
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this._size; i++) {
      parts.push(\`\${this.data[i]}\`);
    }
    return \`[\${parts.join(", ")}]\`;
  }

  /** Memory used by the backing TypedArray in bytes */
  memoryBytes(): number {
    return this.data.byteLength;
  }

  private ensureCapacity(minCapacity: number): void {
    if (minCapacity <= this.data.length) return;
    let newCapacity = this.data.length * 2;
    if (newCapacity < minCapacity) newCapacity = minCapacity;
    const newData = new ${Arr}(newCapacity);
    newData.set(this.data.subarray(0, this._size));
    this.data = newData;
  }

  private checkIndex(index: number): void {
    if (index < 0 || index >= this._size) {
      throw new RangeError(
        \`Index \${index} out of bounds for size \${this._size}\`,
      );
    }
  }
}
`;
}

// ===========================================================================
// ARRAYLIST — immutable
// ===========================================================================

export function immArrayListSourceFileName(prim) {
  return `immutable_${prim.id}-array-list.ts`;
}
export function immArrayListTestFileName(prim) {
  return `immutable_${prim.id}-array-list.generated.test.ts`;
}
export function immArrayListClassName(prim) {
  return `Immutable${prim.name}ArrayList`;
}

export function renderImmutableArrayList(prim, command) {
  const cls = immArrayListClassName(prim);
  const mut = arrayListClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;
  const retU = `${T} | undefined`;
  const sumBody =
    prim.id === "float32" ? froundSumBodyImmutable() : plainSumBody(prim);

  return `${LICENSE}${banner(command)}

import { ${mut} } from "./${prim.id}-array-list.js";

/**
 * Immutable list backed by ${Arr}.
 * Elements: ${prim.bytes} bytes each, contiguous memory.
 * Construct via static of(values) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 */
export class ${cls} {
  private data: ${Arr};
  private _size: number;

  /** Creates an immutable list from an array of values (defensive copy). */
  static of(values: ${T}[]): ${cls} {
    const size = values.length;
    const data = new ${Arr}(size);
    data.set(values);
    return new ${cls}(data, size);
  }

  /** Creates an immutable copy from a mutable list (defensive copy). */
  static fromMutable(mutable: ${mut}): ${cls} {
    const arr = mutable.toArray();
    const data = new ${Arr}(arr.length);
    data.set(arr);
    return new ${cls}(data, arr.length);
  }

  private constructor(data: ${Arr}, size: number) {
    this.data = data;
    this._size = size;
  }

  /** Returns the value at the given index. */
  get(index: number): ${T} {
    if (index < 0 || index >= this._size) {
      throw new RangeError(
        \`Index \${index} out of bounds for size \${this._size}\`,
      );
    }
    return this.data[index];
  }

  /** Returns the number of elements. */
  get size(): number {
    return this._size;
  }

  /** Returns true if the list is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Returns true if the list contains the given value. */
  has(value: ${T}): boolean {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return true;
    }
    return false;
  }

  /** Alias for has. */
  includes(value: ${T}): boolean {
    return this.has(value);
  }

  /** Returns the index of the first occurrence, or -1. */
  indexOf(value: ${T}): number {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return i;
    }
    return -1;
  }

  /** Returns a new MUTABLE list with elements satisfying the predicate. */
  select(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  /** Returns a new MUTABLE list with elements NOT satisfying the predicate. */
  reject(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) result.add(this.data[i]);
    }
    return result;
  }

  /** Returns the first element satisfying the predicate, or undefined. */
  find(predicate: (value: ${T}) => boolean): ${retU} {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  /** Returns true if any element satisfies the predicate. */
  anySatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return true;
    }
    return false;
  }

  /** Returns true if all elements satisfy the predicate. */
  allSatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  /** Returns true if no element satisfies the predicate. */
  noneSatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return false;
    }
    return true;
  }

  /** Returns the number of elements satisfying the predicate. */
  count(predicate: (value: ${T}) => boolean): number {
    let c = 0;
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) c++;
    }
    return c;
  }

  /** Returns the sum of all elements. */
  sum(): ${T} {
${sumBody}
  }

  /** Returns the minimum element, or undefined if empty. */
  min(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] < m) m = this.data[i];
    }
    return m;
  }

  /** Returns the maximum element, or undefined if empty. */
  max(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  /** Yields all values in order. */
  *values(): Generator<${T}> {
    for (let i = 0; i < this._size; i++) {
      yield this.data[i];
    }
  }

  /** Makes the list iterable with for-of loops. */
  *[Symbol.iterator](): IterableIterator<${T}> {
    for (let i = 0; i < this._size; i++) {
      yield this.data[i];
    }
  }

  /** Returns all elements as a new plain array (defensive copy). */
  toArray(): ${T}[] {
    const result: ${T}[] = [];
    for (let i = 0; i < this._size; i++) {
      result.push(this.data[i]);
    }
    return result;
  }

  /** Returns a mutable copy of this immutable list. */
  toMutable(): ${mut} {
    return ${mut}.fromImmutable(this);
  }

  /** Calls the function for each element. */
  forEach(f: (value: ${T}, index: number) => void): void {
    for (let i = 0; i < this._size; i++) {
      f(this.data[i], i);
    }
  }

  /** Returns a new array with the results of calling f on each element. */
  map<U>(f: (value: ${T}) => U): U[] {
    const result: U[] = [];
    for (let i = 0; i < this._size; i++) {
      result.push(f(this.data[i]));
    }
    return result;
  }

  /** Returns a new array with elements satisfying the predicate. */
  filter(predicate: (value: ${T}) => boolean): ${T}[] {
    const result: ${T}[] = [];
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) result.push(this.data[i]);
    }
    return result;
  }

  /** Reduces the list to a single value. */
  reduce<U>(f: (acc: U, value: ${T}) => U, initial: U): U {
    let acc = initial;
    for (let i = 0; i < this._size; i++) {
      acc = f(acc, this.data[i]);
    }
    return acc;
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this._size; i++) {
      parts.push(\`\${this.data[i]}\`);
    }
    return \`[\${parts.join(", ")}]\`;
  }

  /** Memory used by the backing TypedArray in bytes. */
  memoryBytes(): number {
    return this.data.byteLength;
  }
}
`;
}

// ===========================================================================
// ARRAYLIST — tests
// ===========================================================================

export function renderArrayListTest(prim, command) {
  const cls = arrayListClassName(prim);
  const Arr = prim.arrayClass;
  const L = (n) => lit(prim, n);
  // The `sum, min, max` assertion: float32's running f64-of-f32 still equals
  // 1+2+3 (small exact integers), so all types use the same `1 + 2 + 3`-style
  // literal sum — only the per-element suffix differs.
  const resizeHead = prim.tsType === "bigint"
    ? "for (let i = 0n; i < 100n; i += 1n) l.add(i);"
    : "for (let i = 0; i < 100; i += 1) l.add(i);";
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./${prim.id}-array-list.js";

describe("${cls} generated", () => {
  it("add and get", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    l.add(${L(3)});
    expect(l.size).toBe(3);
    expect(l.get(0)).toBe(${L(1)});
    expect(l.get(2)).toBe(${L(3)});
  });
  it("set", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    const old = l.set(0, ${L(3)});
    expect(old).toBe(${L(1)});
    expect(l.get(0)).toBe(${L(3)});
  });
  it("removeAtIndex", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    l.add(${L(3)});
    const removed = l.removeAtIndex(1);
    expect(removed).toBe(${L(2)});
    expect(l.size).toBe(2);
  });
  it("contains and indexOf", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    expect(l.has(${L(1)})).toBe(true);
    expect(l.has(${L(99)})).toBe(false);
    expect(l.indexOf(${L(2)})).toBe(1);
    expect(l.indexOf(${L(99)})).toBe(-1);
  });
  it("isEmpty and clear", () => {
    const l = new ${cls}();
    expect(l.isEmpty()).toBe(true);
    l.add(${L(1)});
    expect(l.isEmpty()).toBe(false);
    l.clear();
    expect(l.size).toBe(0);
  });
  it("select", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    l.add(${L(3)});
    l.add(${L(4)});
    l.add(${L(5)});
    expect(l.select((v) => v > ${L(3)}).size).toBe(2);
  });
  it("reject", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    l.add(${L(3)});
    l.add(${L(4)});
    l.add(${L(5)});
    expect(l.reject((v) => v > ${L(3)}).size).toBe(3);
  });
  it("detect", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    expect(l.detect((v) => v === ${L(2)})).toBe(${L(2)});
    expect(l.detect((v) => v === ${L(99)})).toBeUndefined();
  });
  it("anySatisfy / allSatisfy", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    expect(l.anySatisfy((v) => v === ${L(2)})).toBe(true);
    expect(l.anySatisfy((v) => v === ${L(99)})).toBe(false);
    expect(l.allSatisfy((v) => v > ${L(0)})).toBe(true);
  });
  it("count", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    l.add(${L(3)});
    l.add(${L(4)});
    l.add(${L(5)});
    expect(l.count((v) => v > ${L(3)})).toBe(2);
  });
  it("sum, min, max", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    l.add(${L(2)});
    l.add(${L(3)});
    expect(l.sum()).toBe(${L(1)} + ${L(2)} + ${L(3)});
    expect(l.min()).toBe(${L(1)});
    expect(l.max()).toBe(${L(3)});
  });
  it("sort and toArray", () => {
    const l = new ${cls}();
    l.add(${L(3)});
    l.add(${L(1)});
    l.add(${L(2)});
    l.sort();
    expect(l.toArray()).toEqual(new ${Arr}([${L(1)}, ${L(2)}, ${L(3)}]));
  });
  it("resize", () => {
    const l = new ${cls}();
    ${resizeHead}
    expect(l.size).toBe(100);
  });
  it("memoryBytes", () => {
    const l = new ${cls}(64);
    expect(l.memoryBytes()).toBe(64 * ${prim.bytes});
  });
  it("toString", () => {
    const l = new ${cls}();
    l.add(${L(1)});
    expect(l.toString()).not.toBe("");
  });
});
`;
}

export function renderImmutableArrayListTest(prim, command) {
  const cls = immArrayListClassName(prim);
  const mut = arrayListClassName(prim);
  const T = prim.tsType;
  const L = (n) => lit(prim, n);
  const arr = (...ns) => `[${ns.map(L).join(", ")}]`;
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./immutable_${prim.id}-array-list.js";
import { ${mut} } from "./${prim.id}-array-list.js";

describe("${cls} generated", () => {
  it("static of creates immutable copy", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    expect(list.size).toBe(3);
    expect(list.get(0)).toBe(${L(1)});
    expect(list.get(2)).toBe(${L(3)});
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new ${mut}();
    mutable.add(${L(1)});
    mutable.add(${L(2)});
    const imm = ${cls}.fromMutable(mutable);
    // Mutating original doesn't affect immutable
    mutable.add(${L(3)});
    expect(imm.size).toBe(2);
    expect(mutable.size).toBe(3);
  });

  it("get with bounds check", () => {
    const list = ${cls}.of(${arr(1, 2)});
    expect(list.get(0)).toBe(${L(1)});
    expect(list.get(1)).toBe(${L(2)});
    expect(() => list.get(2)).toThrow();
    expect(() => list.get(-1)).toThrow();
  });

  it("size and isEmpty", () => {
    const empty = ${cls}.of([]);
    expect(empty.size).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ${cls}.of(${arr(1)});
    expect(nonEmpty.size).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("contains and includes", () => {
    const list = ${cls}.of(${arr(1, 2)});
    expect(list.has(${L(1)})).toBe(true);
    expect(list.has(${L(2)})).toBe(true);
    expect(list.has(${L(99)})).toBe(false);
    expect(list.includes(${L(1)})).toBe(true);
  });

  it("indexOf", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    expect(list.indexOf(${L(1)})).toBe(0);
    expect(list.indexOf(${L(2)})).toBe(1);
    expect(list.indexOf(${L(99)})).toBe(-1);
  });

  it("select returns MUTABLE", () => {
    const list = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    const result = list.select((v) => v > ${L(3)});
    // Verify it's mutable by checking it has add method
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const list = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    const result = list.reject((v) => v > ${L(3)});
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(3);
  });

  it("find", () => {
    const list = ${cls}.of(${arr(1, 2)});
    expect(list.find((v) => v === ${L(2)})).toBe(${L(2)});
    expect(list.find((v) => v === ${L(99)})).toBeUndefined();
  });

  it("anySatisfy / allSatisfy", () => {
    const list = ${cls}.of(${arr(1, 2)});
    expect(list.anySatisfy((v) => v === ${L(2)})).toBe(true);
    expect(list.anySatisfy((v) => v === ${L(99)})).toBe(false);
    expect(list.allSatisfy((v) => v > ${L(0)})).toBe(true);
  });

  it("noneSatisfy", () => {
    const list = ${cls}.of(${arr(1, 2)});
    expect(list.noneSatisfy((v) => v === ${L(99)})).toBe(true);
    expect(list.noneSatisfy((v) => v === ${L(1)})).toBe(false);
  });

  it("count", () => {
    const list = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    expect(list.count((v) => v > ${L(3)})).toBe(2);
  });

  it("sum, min, max", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    expect(list.sum()).toBe(${L(1)} + ${L(2)} + ${L(3)});
    expect(list.min()).toBe(${L(1)});
    expect(list.max()).toBe(${L(3)});
  });

  it("toArray creates copy", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    const arr = list.toArray();
    arr[0] = ${L(99)} as any;
    expect(list.get(0)).toBe(${L(1)}); // original unchanged
  });

  it("toMutable round-trip", () => {
    const original = ${cls}.of(${arr(1, 2, 3)});
    const mutable = original.toMutable();
    mutable.add(${L(4)});
    expect(mutable.size).toBe(4);
    // Original unchanged
    expect(original.size).toBe(3);
  });

  it("forEach", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    const collected: ${T}[] = [];
    list.forEach((v) => collected.push(v));
    expect(collected).toEqual(${arr(1, 2, 3)});
  });

  it("map", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    const result = list.map((v) => v * ${L(2)});
    expect(result).toEqual([${L(1)} * ${L(2)}, ${L(2)} * ${L(2)}, ${L(3)} * ${L(2)}]);
  });

  it("filter", () => {
    const list = ${cls}.of(${arr(1, 2, 3, 4)});
    const result = list.filter((v) => v <= ${L(3)});
    expect(result.length).toBe(3);
  });

  it("reduce", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    const sum = list.reduce((acc, v) => acc + v, ${L(0)});
    expect(sum).toBe(${L(1)} + ${L(2)} + ${L(3)});
  });

  it("values iterator", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    const collected: ${T}[] = [];
    for (const v of list.values()) {
      collected.push(v);
    }
    expect(collected).toEqual(${arr(1, 2, 3)});
  });

  it("Symbol.iterator", () => {
    const list = ${cls}.of(${arr(1, 2)});
    const collected: ${T}[] = [];
    for (const v of list) {
      collected.push(v);
    }
    expect(collected).toEqual(${arr(1, 2)});
  });

  it("toString", () => {
    const list = ${cls}.of(${arr(1, 2)});
    const str = list.toString();
    expect(str).not.toBe("");
    expect(str.includes("[")).toBe(true);
    expect(str.includes("]")).toBe(true);
  });

  it("memoryBytes", () => {
    const list = ${cls}.of(${arr(1, 2, 3)});
    // 3 elements * byteSize
    expect(list.memoryBytes()).toBe(3 * ${prim.bytes});
  });

  it("defensive copy - modifying source array doesn't affect immutable", () => {
    const source = ${arr(1, 2, 3)};
    const list = ${cls}.of(source);
    source[0] = ${L(99)} as any;
    expect(list.get(0)).toBe(${L(1)});
  });

  // Verify mutators are not available
  it("has no add method", () => {
    const list = ${cls}.of(${arr(1)});
    // @ts-expect-error - add should not exist on immutable
    expect(list.add).toBeUndefined();
  });
});
`;
}

// ===========================================================================
// HASHSET — mutable
// ===========================================================================

export function hashSetSourceFileName(prim) {
  return `${prim.id}-hash-set.ts`;
}
export function hashSetTestFileName(prim) {
  return `${prim.id}-hash-set.generated.test.ts`;
}
export function hashSetClassName(prim) {
  return `${prim.name}HashSet`;
}

// Preamble (license, banner, blank, [helper import, blank], const). The helper
// import is selected per `kind` from KEY_HASH and imported BY NAME — exactly the
// rule the hashmap generator uses, so int keys import nothing.
function hashHelperPreamble(prim) {
  const keyHash = KEY_HASH[prim.kind];
  const pumpImport =
    `import {\n` +
    `  checkExpectedSize,\n` +
    `  hashCapacityFor,\n` +
    `  PumpDuplicateError,\n` +
    `  type BulkLoadOptions,\n` +
    `} from "../../internal/pump.js";\n`;
  return keyHash.import
    ? `\nimport { ${keyHash.import.names.join(", ")} } from "${keyHash.import.from}";\n${pumpImport}`
    : `\n${pumpImport}`;
}

export function renderHashSet(prim, command) {
  const cls = hashSetClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;
  const keyHash = KEY_HASH[prim.kind];
  const seed = keyHash.seedExpr("key");

  return `${LICENSE}${banner(command)}${hashHelperPreamble(prim)}
const DEFAULT_CAPACITY = 16;
const LOAD_FACTOR = 0.75;

/**
 * Hash set backed by ${Arr} with Uint8Array occupied bitmap.
 * Elements: ${prim.bytes} bytes each, contiguous memory, no GC pressure.
 * Open-addressing with linear probing.
 * Memory: ${prim.bytes + 1} bytes/slot (vs ~50-70 bytes in Set<${T}>).
 */
export class ${cls} {
  private items: ${Arr};
  private occupied: Uint8Array;
  private _size = 0;
  private capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = nextPowerOfTwo(capacity);
    this.items = new ${Arr}(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
  }

  /**
   * Bulk-loads a fresh set from exactly \`n\` values in one O(n) pass (the data
   * pump): the table is sized for \`n\` up front, so there is ZERO mid-load
   * rehash, and slots are filled via the same probe \`add\` uses. Throws
   * \`RangeError\` if \`n\` is invalid or if the source yields more or fewer than
   * \`n\` values. Duplicate values throw {@link PumpDuplicateError} unless
   * \`onDuplicate\` is "ignore" (keeps the first). Observably identical to adding
   * the values one by one.
   */
  static bulkLoadExact(
    values: Iterable<${T}>,
    n: number,
    opts?: BulkLoadOptions,
  ): ${cls} {
    checkExpectedSize(n);
    const onDuplicate = opts?.onDuplicate ?? "error";
    const set = new ${cls}(hashCapacityFor(n));
    const mask = set.capacity - 1;
    let seen = 0;
    let i = 0;
    for (const value of values) {
      if (seen >= n) {
        throw new RangeError("pump source exceeds exact size " + n);
      }
      let idx = set.hash(value) & mask;
      while (true) {
        if (!set.occupied[idx]) {
          set.items[idx] = value;
          set.occupied[idx] = 1;
          set._size++;
          break;
        }
        if (Object.is(set.items[idx], value)) {
          if (onDuplicate === "error") throw new PumpDuplicateError(i);
          break; // ignore: keep first
        }
        idx = (idx + 1) & mask;
      }
      seen++;
      i++;
    }
    if (seen < n) {
      throw new RangeError("pump source has fewer than exact size " + n);
    }
    return set;
  }

  /**
   * Bulk-loads a fresh set from values in one O(n) pass. \`opts.size\` (or the
   * source's \`length\`/\`size\`) pre-sizes the table BEFORE iteration. Size is
   * only a hint: the source is never buffered and the table grows normally (via
   * the same probe \`add\` uses) if the hint is exceeded. Duplicate handling
   * matches {@link bulkLoadExact}.
   */
  static bulkLoad(values: Iterable<${T}>, opts?: BulkLoadOptions): ${cls} {
    const onDuplicate = opts?.onDuplicate ?? "error";
    const sized = values as { length?: number; size?: number };
    const hint = opts?.size ?? sized.length ?? sized.size;
    if (hint !== undefined) checkExpectedSize(hint);
    const set =
      hint !== undefined ? new ${cls}(hashCapacityFor(hint)) : new ${cls}();
    let i = 0;
    for (const value of values) {
      if (set.needsResize()) set.resize();
      const mask = set.capacity - 1;
      let idx = set.hash(value) & mask;
      while (true) {
        if (!set.occupied[idx]) {
          set.items[idx] = value;
          set.occupied[idx] = 1;
          set._size++;
          break;
        }
        if (Object.is(set.items[idx], value)) {
          if (onDuplicate === "error") throw new PumpDuplicateError(i);
          break; // ignore: keep first
        }
        idx = (idx + 1) & mask;
      }
      i++;
    }
    return set;
  }

  add(value: ${T}): this {
    if (this.needsResize()) this.resize();
    const mask = this.capacity - 1;
    let idx = this.hash(value) & mask;
    while (true) {
      if (!this.occupied[idx]) {
        this.items[idx] = value;
        this.occupied[idx] = 1;
        this._size++;
        return this;
      }
      if (Object.is(this.items[idx], value)) return this;
      idx = (idx + 1) & mask;
    }
  }

  remove(value: ${T}): boolean {
    if (this.capacity === 0) return false;
    const mask = this.capacity - 1;
    let idx = this.hash(value) & mask;
    while (true) {
      if (!this.occupied[idx]) return false;
      if (Object.is(this.items[idx], value)) {
        this.occupied[idx] = 0;
        this._size--;
        this.rehashFrom(idx, mask);
        return true;
      }
      idx = (idx + 1) & mask;
    }
  }

  has(value: ${T}): boolean {
    if (this.capacity === 0) return false;
    const mask = this.capacity - 1;
    let idx = this.hash(value) & mask;
    while (true) {
      if (!this.occupied[idx]) return false;
      if (Object.is(this.items[idx], value)) return true;
      idx = (idx + 1) & mask;
    }
  }

  get size(): number {
    return this._size;
  }
  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    this.occupied.fill(0);
    this._size = 0;
  }

  union(other: ${cls}): ${cls} {
    const result = new ${cls}(this._size + other._size);
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result.add(this.items[i]);
    }
    for (let i = 0; i < other.capacity; i++) {
      if (other.occupied[i]) result.add(other.items[i]);
    }
    return result;
  }

  intersect(other: ${cls}): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && other.has(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  difference(other: ${cls}): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !other.has(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  *values(): Generator<${T}> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.items[i];
    }
  }

  /** Makes the set iterable with for-of loops (delegates to values()). */
  [Symbol.iterator](): Generator<${T}> {
    return this.values();
  }

  toArray(): ${Arr} {
    const result = new ${Arr}(this._size);
    let j = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result[j++] = this.items[i];
    }
    return result;
  }

  /** Creates a mutable set from an immutable one. */
  static fromImmutable(imm: {
    toArray(): ${T}[];
    readonly size: number;
  }): ${cls} {
    const arr = imm.toArray();
    const set = new ${cls}(arr.length);
    for (const v of arr) {
      set.add(v);
    }
    return set;
  }

  forEach(f: (value: ${T}) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) f(this.items[i]);
    }
  }

  select(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  reject(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) parts.push(\`\${this.items[i]}\`);
    }
    return \`{\${parts.join(", ")}}\`;
  }

  /** Memory used by backing arrays in bytes */
  memoryBytes(): number {
    return this.capacity * (${prim.bytes} + 1);
  }

  private hash(key: ${T}): number {
    let h = ${seed};
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    return ((h >> 16) ^ h) >>> 0;
  }

  private needsResize(): boolean {
    return this._size + 1 >= this.capacity * LOAD_FACTOR;
  }

  private resize(): void {
    const oldItems = this.items;
    const oldOccupied = this.occupied;
    const oldCap = this.capacity;
    this.capacity *= 2;
    this.items = new ${Arr}(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
    this._size = 0;
    for (let i = 0; i < oldCap; i++) {
      if (oldOccupied[i]) this.add(oldItems[i]);
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    let idx = (deleted + 1) & mask;
    while (this.occupied[idx]) {
      const ideal = this.hash(this.items[idx]) & mask;
      const distCurrent = (idx - ideal + this.capacity) & mask;
      const distGap = (deleted - ideal + this.capacity) & mask;
      if (distCurrent > distGap) {
        this.items[deleted] = this.items[idx];
        this.occupied[deleted] = 1;
        this.occupied[idx] = 0;
        deleted = idx;
      }
      idx = (idx + 1) & mask;
      if (idx === deleted) break;
    }
  }
}

function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 16;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n++;
  return n;
}
`;
}

// ===========================================================================
// HASHSET — immutable
// ===========================================================================

export function immHashSetSourceFileName(prim) {
  return `immutable_${prim.id}-hash-set.ts`;
}
export function immHashSetTestFileName(prim) {
  return `immutable_${prim.id}-hash-set.generated.test.ts`;
}
export function immHashSetClassName(prim) {
  return `Immutable${prim.name}HashSet`;
}

// The immutable hash set imports its mutable sibling AND (for float/bigint) the
// canonical hash-seed helper used by the free `hash()` function. The committed
// files place that helper import irregularly by kind, so we reproduce it
// exactly (this is hand-written layout, not a normalisable pattern):
//   int     : <blank> import { Mutable }
//   float   : import { helper } <blank> import { Mutable }
//   bigint  : <blank> import { Mutable } import { helper }
function immHashSetImports(prim) {
  const mutImport = `import { ${hashSetClassName(prim)} } from "./${prim.id}-hash-set.js";`;
  const keyHash = KEY_HASH[prim.kind];
  if (!keyHash.import) {
    return `\n\n${mutImport}\n`;
  }
  const helperImport = `import { ${keyHash.import.names.join(", ")} } from "${keyHash.import.from}";`;
  if (prim.kind === "float") {
    return `\n${helperImport}\n\n${mutImport}\n`;
  }
  // bigint: mutable import first, helper import adjacent below it.
  return `\n\n${mutImport}\n${helperImport}\n`;
}

export function renderImmutableHashSet(prim, command) {
  const cls = immHashSetClassName(prim);
  const mut = hashSetClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;
  const seed = KEY_HASH[prim.kind].seedExpr("key");

  return `${LICENSE}${banner(command)}${immHashSetImports(prim)}
/**
 * Immutable hash set backed by ${Arr} with Uint8Array occupied bitmap.
 * Elements: ${prim.bytes} bytes each, contiguous memory.
 * Construct via static of(values) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 */
export class ${cls} {
  private items: ${Arr};
  private occupied: Uint8Array;
  private _size: number;
  private capacity: number;

  /** Creates an immutable set from an array of values (defensive copy). */
  static of(values: ${T}[]): ${cls} {
    const set = new ${mut}(values.length);
    for (const v of values) {
      set.add(v);
    }
    return ${cls}.fromMutable(set);
  }

  /** Creates an immutable copy from a mutable set (defensive copy). */
  static fromMutable(mutable: ${mut}): ${cls} {
    const arr = mutable.toArray();
    const c = nextPowerOfTwo(Math.max(arr.length * 2, 16));
    const items = new ${Arr}(c);
    const occupied = new Uint8Array(c);
    let size = 0;
    for (const v of arr) {
      const idx = hash(v, c);
      let i = idx;
      while (true) {
        if (!occupied[i]) {
          items[i] = v;
          occupied[i] = 1;
          size++;
          break;
        }
        if (Object.is(items[i], v)) break;
        i = (i + 1) & (c - 1);
      }
    }
    return new ${cls}(items, occupied, size, c);
  }

  private constructor(
    items: ${Arr},
    occupied: Uint8Array,
    size: number,
    capacity: number,
  ) {
    this.items = items;
    this.occupied = occupied;
    this._size = size;
    this.capacity = capacity;
  }

  /** Returns true if the set contains the given value. */
  has(value: ${T}): boolean {
    if (this.capacity === 0) return false;
    const mask = this.capacity - 1;
    let idx = hash(value, this.capacity);
    while (true) {
      if (!this.occupied[idx]) return false;
      if (Object.is(this.items[idx], value)) return true;
      idx = (idx + 1) & mask;
    }
  }

  /** Alias for has. */
  includes(value: ${T}): boolean {
    return this.has(value);
  }

  /** Returns the number of elements. */
  get size(): number {
    return this._size;
  }

  /** Returns true if the set is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Returns a new MUTABLE set with elements satisfying the predicate. */
  select(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  /** Returns a new MUTABLE set with elements NOT satisfying the predicate. */
  reject(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.items[i])) {
        result.add(this.items[i]);
      }
    }
    return result;
  }

  /** Returns true if any element satisfies the predicate. */
  anySatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.items[i])) return true;
    }
    return false;
  }

  /** Returns true if all elements satisfy the predicate. */
  allSatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.items[i])) return false;
    }
    return true;
  }

  /** Returns true if no element satisfies the predicate. */
  noneSatisfy(predicate: (value: ${T}) => boolean): boolean {
    return !this.anySatisfy(predicate);
  }

  /** Returns the number of elements satisfying the predicate. */
  count(predicate: (value: ${T}) => boolean): number {
    let c = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.items[i])) c++;
    }
    return c;
  }

  /** Yields all values. */
  *values(): Generator<${T}> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.items[i];
    }
  }

  /** Makes the set iterable with for-of loops. */
  *[Symbol.iterator](): IterableIterator<${T}> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.items[i];
    }
  }

  /** Returns all elements as a new plain array (defensive copy). */
  toArray(): ${T}[] {
    const result: ${T}[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result.push(this.items[i]);
    }
    return result;
  }

  /** Returns a mutable copy of this immutable set. */
  toMutable(): ${mut} {
    return ${mut}.fromImmutable(this);
  }

  /** Calls the function for each element. */
  forEach(f: (value: ${T}) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) f(this.items[i]);
    }
  }

  /** Returns a new array with the results of calling f on each element. */
  map<U>(f: (value: ${T}) => U): U[] {
    const result: U[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result.push(f(this.items[i]));
    }
    return result;
  }

  /** Returns a new array with elements satisfying the predicate. */
  filter(predicate: (value: ${T}) => boolean): ${T}[] {
    const result: ${T}[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.items[i]))
        result.push(this.items[i]);
    }
    return result;
  }

  /** Reduces the set to a single value. */
  reduce<U>(f: (acc: U, value: ${T}) => U, initial: U): U {
    let acc = initial;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) acc = f(acc, this.items[i]);
    }
    return acc;
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) parts.push(\`\${this.items[i]}\`);
    }
    return \`{\${parts.join(", ")}}\`;
  }

  /** Memory used by backing arrays in bytes. */
  memoryBytes(): number {
    return this.capacity * (${prim.bytes} + 1);
  }
}

function hash(key: ${T}, cap: number): number {
  let h = ${seed};
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
  h = ((h >> 16) ^ h) >>> 0;
  return h & (cap - 1);
}

function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 16;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n++;
  return n;
}
`;
}

// ===========================================================================
// HASHSET — tests
// ===========================================================================

// Float element IEEE-754 edge-case regression block (NaN findable / dedup /
// removable, -0 vs +0 distinct, ±Infinity distinct). Set semantics, so only
// add/contains/remove — no values. Emitted ONLY for float elements; reproduced
// verbatim from the committed float32/float64 test files so regeneration never
// drops this phase-3 coverage.
function floatElemEdgeCases(cls) {
  return `
  });

  describe("IEEE 754 edge cases", () => {
    it("NaN is findable", () => {
      const s = new ${cls}();
      s.add(NaN);
      expect(s.has(NaN)).toBe(true);
      expect(s.size).toBe(1);
    });
    it("NaN add duplicate does not grow", () => {
      const s = new ${cls}();
      expect(s.add(NaN)).toBe(s); // add returns the set for chaining
      s.add(NaN);
      s.add(NaN);
      expect(s.size).toBe(1);
    });
    it("NaN remove works", () => {
      const s = new ${cls}();
      s.add(NaN);
      expect(s.remove(NaN)).toBe(true);
      expect(s.has(NaN)).toBe(false);
      expect(s.size).toBe(0);
    });
    it("-0.0 is distinct from +0.0", () => {
      const s = new ${cls}();
      s.add(0.0);
      s.add(-0.0);
      expect(s.size).toBe(2);
      expect(s.has(0.0)).toBe(true);
      expect(s.has(-0.0)).toBe(true);
    });
    it("+/-Infinity are distinct elements", () => {
      const s = new ${cls}();
      s.add(Number.POSITIVE_INFINITY);
      s.add(Number.NEGATIVE_INFINITY);
      expect(s.size).toBe(2);
      expect(s.has(Number.POSITIVE_INFINITY)).toBe(true);
      expect(s.has(Number.NEGATIVE_INFINITY)).toBe(true);
    });`;
}

export function renderHashSetTest(prim, command) {
  const cls = hashSetClassName(prim);
  const L = (n) => lit(prim, n);
  const edge = prim.kind === "float" ? floatElemEdgeCases(cls) : "";
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./${prim.id}-hash-set.js";

describe("${cls} generated", () => {
  it("add and contains", () => {
    const s = new ${cls}();
    s.add(${L(1)});
    s.add(${L(2)});
    s.add(${L(3)});
    expect(s.size).toBe(3);
    expect(s.has(${L(2)})).toBe(true);
    expect(s.has(${L(99)})).toBe(false);
  });
  it("add duplicate", () => {
    const s = new ${cls}();
    expect(s.add(${L(1)})).toBe(s); // add returns the set for chaining
    s.add(${L(1)});
    expect(s.size).toBe(1);
  });
  it("remove", () => {
    const s = new ${cls}();
    s.add(${L(1)});
    s.add(${L(2)});
    expect(s.remove(${L(1)})).toBe(true);
    expect(s.has(${L(1)})).toBe(false);
    expect(s.remove(${L(99)})).toBe(false);
  });
  it("isEmpty and clear", () => {
    const s = new ${cls}();
    expect(s.isEmpty()).toBe(true);
    s.add(${L(1)});
    expect(s.isEmpty()).toBe(false);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });
  it("union", () => {
    const a = new ${cls}();
    a.add(${L(1)});
    a.add(${L(2)});
    const b = new ${cls}();
    b.add(${L(2)});
    b.add(${L(3)});
    expect(a.union(b).size).toBe(3);
  });
  it("intersect", () => {
    const a = new ${cls}();
    a.add(${L(1)});
    a.add(${L(2)});
    const b = new ${cls}();
    b.add(${L(2)});
    b.add(${L(3)});
    expect(a.intersect(b).size).toBe(1);
  });
  it("difference", () => {
    const a = new ${cls}();
    a.add(${L(1)});
    a.add(${L(2)});
    const b = new ${cls}();
    b.add(${L(2)});
    b.add(${L(3)});
    expect(a.difference(b).size).toBe(1);
  });
  it("select", () => {
    const s = new ${cls}();
    s.add(${L(1)});
    s.add(${L(2)});
    s.add(${L(3)});
    expect(s.select((v) => v > ${L(1)}).size).toBe(2);
  });
  it("memoryBytes", () => {
    const s = new ${cls}(64);
    expect(s.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const s = new ${cls}();
    s.add(${L(1)});
    expect(s.toString()).not.toBe("");${edge}
  });
});
`;
}

export function renderImmutableHashSetTest(prim, command) {
  const cls = immHashSetClassName(prim);
  const mut = hashSetClassName(prim);
  const T = prim.tsType;
  const L = (n) => lit(prim, n);
  const arr = (...ns) => `[${ns.map(L).join(", ")}]`;
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./immutable_${prim.id}-hash-set.js";
import { ${mut} } from "./${prim.id}-hash-set.js";

describe("${cls} generated", () => {
  it("static of creates immutable set", () => {
    const set = ${cls}.of(${arr(1, 2, 3)});
    expect(set.size).toBe(3);
    expect(set.has(${L(1)})).toBe(true);
    expect(set.has(${L(3)})).toBe(true);
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new ${mut}();
    mutable.add(${L(1)});
    mutable.add(${L(2)});
    const imm = ${cls}.fromMutable(mutable);
    mutable.add(${L(3)});
    expect(imm.size).toBe(2);
    expect(mutable.size).toBe(3);
  });

  it("contains and includes", () => {
    const set = ${cls}.of(${arr(1, 2)});
    expect(set.has(${L(1)})).toBe(true);
    expect(set.has(${L(2)})).toBe(true);
    expect(set.has(${L(99)})).toBe(false);
    expect(set.includes(${L(1)})).toBe(true);
  });

  it("size and isEmpty", () => {
    const empty = ${cls}.of([]);
    expect(empty.size).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ${cls}.of(${arr(1)});
    expect(nonEmpty.size).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("select returns MUTABLE", () => {
    const set = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    const result = set.select((v) => v > ${L(3)});
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const set = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    const result = set.reject((v) => v > ${L(3)});
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(3);
  });

  it("anySatisfy / allSatisfy", () => {
    const set = ${cls}.of(${arr(1, 2)});
    expect(set.anySatisfy((v) => v === ${L(2)})).toBe(true);
    expect(set.anySatisfy((v) => v === ${L(99)})).toBe(false);
    expect(set.allSatisfy((v) => v > ${L(0)})).toBe(true);
  });

  it("noneSatisfy", () => {
    const set = ${cls}.of(${arr(1, 2)});
    expect(set.noneSatisfy((v) => v === ${L(99)})).toBe(true);
    expect(set.noneSatisfy((v) => v === ${L(1)})).toBe(false);
  });

  it("count", () => {
    const set = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    expect(set.count((v) => v > ${L(3)})).toBe(2);
  });

  it("toArray creates copy", () => {
    const set = ${cls}.of(${arr(1, 2, 3)});
    const arr = set.toArray();
    // Modify the array - original should be unaffected (but we can't easily test this for sets)
    expect(arr.length).toBe(3);
  });

  it("toMutable round-trip", () => {
    const original = ${cls}.of(${arr(1, 2, 3)});
    const mutable = original.toMutable();
    mutable.add(${L(4)});
    expect(mutable.size).toBe(4);
    expect(original.size).toBe(3);
  });

  it("forEach", () => {
    const set = ${cls}.of(${arr(1, 2, 3)});
    const collected: ${T}[] = [];
    set.forEach((v) => collected.push(v));
    expect(collected.length).toBe(3);
    expect(collected.includes(${L(1)})).toBe(true);
  });

  it("map", () => {
    const set = ${cls}.of(${arr(1, 2, 3)});
    const result = set.map((v) => v * ${L(2)});
    expect(result.length).toBe(3);
  });

  it("filter", () => {
    const set = ${cls}.of(${arr(1, 2, 3, 4)});
    const result = set.filter((v) => v <= ${L(3)});
    expect(result.length).toBe(3);
  });

  it("reduce", () => {
    const set = ${cls}.of(${arr(1, 2, 3)});
    const sum = set.reduce((acc, v) => acc + v, ${L(0)});
    expect(sum).toBe(${L(1)} + ${L(2)} + ${L(3)});
  });

  it("values iterator", () => {
    const set = ${cls}.of(${arr(1, 2, 3)});
    const collected: ${T}[] = [];
    for (const v of set.values()) {
      collected.push(v);
    }
    expect(collected.length).toBe(3);
  });

  it("Symbol.iterator", () => {
    const set = ${cls}.of(${arr(1, 2)});
    const collected: ${T}[] = [];
    for (const v of set) {
      collected.push(v);
    }
    expect(collected.length).toBe(2);
  });

  it("toString", () => {
    const set = ${cls}.of(${arr(1, 2)});
    const str = set.toString();
    expect(str).not.toBe("");
  });

  it("memoryBytes", () => {
    const set = ${cls}.of(${arr(1, 2, 3)});
    // At least 3 elements * (byteSize + 1 for occupied) bytes
    expect(set.memoryBytes()).toBeGreaterThanOrEqual(3 * (${prim.bytes} + 1));
  });

  it("defensive copy - modifying source array doesn't affect immutable", () => {
    const source = ${arr(1, 2, 3)};
    const set = ${cls}.of(source);
    source[0] = ${L(99)} as any;
    expect(set.has(${L(1)})).toBe(true);
    expect(set.has(${L(99)})).toBe(false);
  });

  // Verify mutators are not available
  it("has no add method", () => {
    const set = ${cls}.of(${arr(1)});
    // @ts-expect-error - add should not exist on immutable
    expect(set.add).toBeUndefined();
  });

  it("has no remove method", () => {
    const set = ${cls}.of(${arr(1)});
    // @ts-expect-error - remove should not exist on immutable
    expect(set.remove).toBeUndefined();
  });
});
`;
}

// ===========================================================================
// STACK — mutable
// ===========================================================================

export function stackSourceFileName(prim) {
  return `${prim.id}-array-stack.ts`;
}
export function stackTestFileName(prim) {
  return `${prim.id}-array-stack.generated.test.ts`;
}
export function stackClassName(prim) {
  return `${prim.name}ArrayStack`;
}

export function renderStack(prim, command) {
  const cls = stackClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;
  const retU = `${T} | undefined`;
  // NOTE: stack sum() uses the f64/bigint running total for EVERY type,
  // including float32 (unlike arraylist, which uses an f32 fround fold for
  // float32). This matches the committed stack behaviour.
  const sumBody = plainSumBody(prim);

  return `${LICENSE}${banner(command)}

const DEFAULT_CAPACITY = 16;

/**
 * Array-backed stack (LIFO) backed by ${Arr}.
 * Elements: ${prim.bytes} bytes each, contiguous memory, no GC pressure.
 * Grows by 2x when capacity is exceeded (allocates new ${Arr} and copies).
 */
export class ${cls} {
  private data: ${Arr};
  private _size = 0;

  constructor(initialCapacity = DEFAULT_CAPACITY) {
    this.data = new ${Arr}(Math.max(initialCapacity, 1));
  }

  /** Creates a new stack from an array of values. The last element becomes the top. */
  static of(values: ${T}[]): ${cls} {
    const stack = new ${cls}(values.length);
    for (const v of values) {
      stack.push(v);
    }
    return stack;
  }

  /**
   * Bulk-loads a fresh stack from \`values\` in one O(n) pass (the data pump),
   * allocating the backing array exactly once. The last value becomes the top.
   */
  static bulkLoad(values: Iterable<${T}>): ${cls} {
    const buffer = Array.from(values);
    const stack = new ${cls}(Math.max(buffer.length, 1));
    stack.data.set(buffer);
    stack._size = buffer.length;
    return stack;
  }

  /** Creates a mutable stack from an immutable one. */
  static fromMutable(imm: { toArray(): ${T}[] }): ${cls} {
    const arr = imm.toArray();
    const stack = new ${cls}(arr.length);
    for (const v of arr) {
      stack.push(v);
    }
    return stack;
  }

  /** Pushes a value onto the top of the stack. */
  push(value: ${T}): void {
    this.ensureCapacity(this._size + 1);
    this.data[this._size++] = value;
  }

  /** Removes and returns the top element. Throws if empty. */
  pop(): ${T} {
    if (this._size === 0) {
      throw new Error("Stack is empty");
    }
    const value = this.data[--this._size];
    return value;
  }

  /** Returns the top element without removing it. Throws if empty. */
  peek(): ${T} {
    if (this._size === 0) {
      throw new Error("Stack is empty");
    }
    return this.data[this._size - 1];
  }

  /** Returns the element at the given distance from the top (0 = top). Throws if out of bounds. */
  peekAt(index: number): ${T} {
    if (index < 0 || index >= this._size) {
      throw new RangeError(
        \`Index \${index} out of bounds for stack size \${this._size}\`,
      );
    }
    return this.data[this._size - 1 - index];
  }

  /** Returns the number of elements. */
  get size(): number {
    return this._size;
  }

  /** Returns true if the stack is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Removes all elements. */
  clear(): void {
    this._size = 0;
  }

  /** Returns true if the stack contains the given value. */
  has(value: ${T}): boolean {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return true;
    }
    return false;
  }

  /** Returns true if the stack contains the value. Alias for \`has\`. */
  includes(value: ${T}): boolean {
    return this.has(value);
  }

  /** Returns a new stack with elements satisfying the predicate (order preserved). */
  select(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    // Select from bottom to top, push to result (which reverses order)
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) {
        result.push(this.data[i]);
      }
    }
    return result;
  }

  /** Returns a new stack with elements NOT satisfying the predicate (order preserved). */
  reject(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) {
        result.push(this.data[i]);
      }
    }
    return result;
  }

  /** Returns the first element (from top) satisfying the predicate, or undefined. */
  find(predicate: (value: ${T}) => boolean): ${retU} {
    for (let i = this._size - 1; i >= 0; i--) {
      if (predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  /** Returns true if every element satisfies the predicate. */
  every(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  /** Returns true if at least one element satisfies the predicate. */
  some(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return true;
    }
    return false;
  }

  /** Calls the function for each element from top to bottom. */
  forEach(f: (value: ${T}) => void): void {
    for (let i = this._size - 1; i >= 0; i--) {
      f(this.data[i]);
    }
  }

  /** Returns a new array with the results of calling \`f\` on each element (top to bottom). */
  map<U>(f: (value: ${T}) => U): U[] {
    const result: U[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      result.push(f(this.data[i]));
    }
    return result;
  }

  /** Returns a new array with elements satisfying the predicate (top to bottom). */
  filter(predicate: (value: ${T}) => boolean): ${T}[] {
    const result: ${T}[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      if (predicate(this.data[i])) result.push(this.data[i]);
    }
    return result;
  }

  /** Reduces the stack to a single value using the accumulator function (top to bottom). */
  reduce<U>(f: (acc: U, value: ${T}) => U, initial: U): U {
    let acc = initial;
    for (let i = this._size - 1; i >= 0; i--) {
      acc = f(acc, this.data[i]);
    }
    return acc;
  }

  /** Returns true if any element satisfies the predicate. */
  anySatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return true;
    }
    return false;
  }

  /** Returns true if all elements satisfy the predicate. */
  allSatisfy(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  /** Returns the number of elements that satisfy the predicate. */
  count(predicate: (value: ${T}) => boolean): number {
    let c = 0;
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) c++;
    }
    return c;
  }

  /** Returns the sum of all elements. */
  sum(): ${T} {
${sumBody}
  }

  /** Returns the minimum element, or undefined if empty. */
  min(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] < m) m = this.data[i];
    }
    return m;
  }

  /** Returns the maximum element, or undefined if empty. */
  max(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  /** Yields all values from top to bottom. */
  *values(): Generator<${T}> {
    for (let i = this._size - 1; i >= 0; i--) {
      yield this.data[i];
    }
  }

  /** Makes the stack iterable with for-of loops. Yields top to bottom. */
  *[Symbol.iterator](): IterableIterator<${T}> {
    for (let i = this._size - 1; i >= 0; i--) {
      yield this.data[i];
    }
  }

  /** Returns all elements as an array (top element first). */
  toArray(): ${T}[] {
    const result: ${T}[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      result.push(this.data[i]);
    }
    return result;
  }

  /** Creates a mutable stack from an immutable one. */
  static fromImmutable(imm: { toArray(): ${T}[] }): ${cls} {
    const arr = imm.toArray();
    return ${cls}.of(arr);
  }

  /** Returns a string representation (top element first). */
  toString(): string {
    const parts: string[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      parts.push(\`\${this.data[i]}\`);
    }
    return \`[\${parts.join(", ")}]\`;
  }

  /** Memory used by the backing TypedArray in bytes. */
  memoryBytes(): number {
    return this.data.byteLength;
  }

  private ensureCapacity(minCapacity: number): void {
    if (minCapacity <= this.data.length) return;
    let newCapacity = this.data.length * 2;
    if (newCapacity < minCapacity) newCapacity = minCapacity;
    const newData = new ${Arr}(newCapacity);
    newData.set(this.data.subarray(0, this._size));
    this.data = newData;
  }
}
`;
}

// ===========================================================================
// STACK — immutable
// ===========================================================================

export function immStackSourceFileName(prim) {
  return `immutable_${prim.id}-array-stack.ts`;
}
export function immStackTestFileName(prim) {
  return `immutable_${prim.id}-array-stack.generated.test.ts`;
}
export function immStackClassName(prim) {
  return `Immutable${prim.name}ArrayStack`;
}

export function renderImmutableStack(prim, command) {
  const cls = immStackClassName(prim);
  const mut = stackClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;
  const retU = `${T} | undefined`;
  const sumBody = plainSumBody(prim);

  return `${LICENSE}${banner(command)}

import { ${mut} } from "./${prim.id}-array-stack.js";

/**
 * Immutable stack (LIFO) backed by ${Arr}.
 * Elements: ${prim.bytes} bytes each, contiguous memory.
 * Construct via static of(values) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 */
export class ${cls} {
  private data: ${Arr};
  private _size: number;

  /** Creates an immutable stack from an array of values (defensive copy). Last element = top. */
  static of(values: ${T}[]): ${cls} {
    const size = values.length;
    const data = new ${Arr}(size);
    data.set(values);
    return new ${cls}(data, size);
  }

  /** Creates an immutable copy from a mutable stack (defensive copy). */
  static fromMutable(mutable: ${mut}): ${cls} {
    const arr = mutable.toArray();
    const data = new ${Arr}(arr.length);
    data.set(arr);
    return new ${cls}(data, arr.length);
  }

  private constructor(data: ${Arr}, size: number) {
    this.data = data;
    this._size = size;
  }

  /** Returns the top element without removing it. Throws if empty. */
  peek(): ${T} {
    if (this._size === 0) {
      throw new Error("Stack is empty");
    }
    return this.data[this._size - 1];
  }

  /** Returns the element at the given distance from the top (0 = top). Throws if out of bounds. */
  peekAt(index: number): ${T} {
    if (index < 0 || index >= this._size) {
      throw new RangeError(
        \`Index \${index} out of bounds for stack size \${this._size}\`,
      );
    }
    return this.data[this._size - 1 - index];
  }

  /** Returns the number of elements. */
  get size(): number {
    return this._size;
  }

  /** Returns true if the stack is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Returns true if the stack contains the given value. */
  has(value: ${T}): boolean {
    for (let i = 0; i < this._size; i++) {
      if (Object.is(this.data[i], value)) return true;
    }
    return false;
  }

  /** Alias for has. */
  includes(value: ${T}): boolean {
    return this.has(value);
  }

  /** Returns a new MUTABLE stack with elements satisfying the predicate. */
  select(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) {
        result.push(this.data[i]);
      }
    }
    return result;
  }

  /** Returns a new MUTABLE stack with elements NOT satisfying the predicate. */
  reject(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) {
        result.push(this.data[i]);
      }
    }
    return result;
  }

  /** Returns the first element (from top) satisfying the predicate, or undefined. */
  find(predicate: (value: ${T}) => boolean): ${retU} {
    for (let i = this._size - 1; i >= 0; i--) {
      if (predicate(this.data[i])) return this.data[i];
    }
    return undefined;
  }

  /** Returns true if every element satisfies the predicate. */
  every(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (!predicate(this.data[i])) return false;
    }
    return true;
  }

  /** Returns true if at least one element satisfies the predicate. */
  some(predicate: (value: ${T}) => boolean): boolean {
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) return true;
    }
    return false;
  }

  /** Returns true if any element satisfies the predicate. */
  anySatisfy(predicate: (value: ${T}) => boolean): boolean {
    return this.some(predicate);
  }

  /** Returns true if all elements satisfy the predicate. */
  allSatisfy(predicate: (value: ${T}) => boolean): boolean {
    return this.every(predicate);
  }

  /** Returns the number of elements satisfying the predicate. */
  count(predicate: (value: ${T}) => boolean): number {
    let c = 0;
    for (let i = 0; i < this._size; i++) {
      if (predicate(this.data[i])) c++;
    }
    return c;
  }

  /** Returns the sum of all elements. */
  sum(): ${T} {
${sumBody}
  }

  /** Returns the minimum element, or undefined if empty. */
  min(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] < m) m = this.data[i];
    }
    return m;
  }

  /** Returns the maximum element, or undefined if empty. */
  max(): ${retU} {
    if (this._size === 0) return undefined;
    let m = this.data[0];
    for (let i = 1; i < this._size; i++) {
      if (this.data[i] > m) m = this.data[i];
    }
    return m;
  }

  /** Yields all values from top to bottom. */
  *values(): Generator<${T}> {
    for (let i = this._size - 1; i >= 0; i--) {
      yield this.data[i];
    }
  }

  /** Makes the stack iterable with for-of loops. Yields top to bottom. */
  *[Symbol.iterator](): IterableIterator<${T}> {
    for (let i = this._size - 1; i >= 0; i--) {
      yield this.data[i];
    }
  }

  /** Returns all elements as a new array (top element first). */
  toArray(): ${T}[] {
    const result: ${T}[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      result.push(this.data[i]);
    }
    return result;
  }

  /** Returns a mutable copy of this immutable stack. */
  toMutable(): ${mut} {
    return ${mut}.fromImmutable(this);
  }

  /** Calls the function for each element from top to bottom. */
  forEach(f: (value: ${T}) => void): void {
    for (let i = this._size - 1; i >= 0; i--) {
      f(this.data[i]);
    }
  }

  /** Returns a new array with the results of calling f on each element (top to bottom). */
  map<U>(f: (value: ${T}) => U): U[] {
    const result: U[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      result.push(f(this.data[i]));
    }
    return result;
  }

  /** Returns a new array with elements satisfying the predicate (top to bottom). */
  filter(predicate: (value: ${T}) => boolean): ${T}[] {
    const result: ${T}[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      if (predicate(this.data[i])) result.push(this.data[i]);
    }
    return result;
  }

  /** Reduces the stack to a single value using the accumulator function (top to bottom). */
  reduce<U>(f: (acc: U, value: ${T}) => U, initial: U): U {
    let acc = initial;
    for (let i = this._size - 1; i >= 0; i--) {
      acc = f(acc, this.data[i]);
    }
    return acc;
  }

  /** Returns a string representation (top element first). */
  toString(): string {
    const parts: string[] = [];
    for (let i = this._size - 1; i >= 0; i--) {
      parts.push(\`\${this.data[i]}\`);
    }
    return \`[\${parts.join(", ")}]\`;
  }

  /** Memory used by the backing TypedArray in bytes. */
  memoryBytes(): number {
    return this.data.byteLength;
  }
}
`;
}

// ===========================================================================
// STACK — tests
// ===========================================================================

export function renderStackTest(prim, command) {
  const cls = stackClassName(prim);
  const T = prim.tsType;
  const L = (n) => lit(prim, n);
  const arr = (...ns) => `[${ns.map(L).join(", ")}]`;
  const resizeHead = prim.tsType === "bigint"
    ? "for (let i = 0n; i < 100n; i += 1n) s.push(i);"
    : "for (let i = 0; i < 100; i += 1) s.push(i);";
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./${prim.id}-array-stack.js";

describe("${cls} generated", () => {
  it("push and pop", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    expect(s.size).toBe(3);
    expect(s.pop()).toBe(${L(3)});
    expect(s.pop()).toBe(${L(2)});
    expect(s.pop()).toBe(${L(1)});
  });

  it("peek", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    expect(s.peek()).toBe(${L(2)});
    expect(s.size).toBe(2); // peek doesn't remove
  });

  it("peekAt", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    expect(s.peekAt(0)).toBe(${L(3)}); // top
    expect(s.peekAt(1)).toBe(${L(2)});
    expect(s.peekAt(2)).toBe(${L(1)}); // bottom
  });

  it("pop on empty throws", () => {
    const s = new ${cls}();
    expect(() => s.pop()).toThrow();
  });

  it("has", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    expect(s.has(${L(1)})).toBe(true);
    expect(s.has(${L(2)})).toBe(true);
    expect(s.has(${L(99)})).toBe(false);
  });

  it("includes alias for contains", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    expect(s.includes(${L(1)})).toBe(true);
    expect(s.includes(${L(99)})).toBe(false);
  });

  it("isEmpty and clear", () => {
    const s = new ${cls}();
    expect(s.isEmpty()).toBe(true);
    s.push(${L(1)});
    expect(s.isEmpty()).toBe(false);
    s.clear();
    expect(s.size).toBe(0);
    expect(s.isEmpty()).toBe(true);
  });

  it("select", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    s.push(${L(4)});
    s.push(${L(5)});
    // select preserves order (but stack reversal means bottom-to-top becomes top-to-bottom in result)
    const result = s.select((v) => v > ${L(3)});
    expect(result.size).toBe(2);
  });

  it("reject", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    s.push(${L(4)});
    s.push(${L(5)});
    expect(s.reject((v) => v > ${L(3)}).size).toBe(3);
  });

  it("find", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    expect(s.find((v) => v === ${L(2)})).toBe(${L(2)});
    expect(s.find((v) => v === ${L(99)})).toBeUndefined();
  });

  it("every", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    expect(s.every((v) => v < ${L(100)})).toBe(true);
    expect(s.every((v) => v < ${L(1)})).toBe(false);
  });

  it("some", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    expect(s.some((v) => v === ${L(2)})).toBe(true);
    expect(s.some((v) => v === ${L(99)})).toBe(false);
  });

  it("anySatisfy / allSatisfy", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    expect(s.anySatisfy((v) => v === ${L(2)})).toBe(true);
    expect(s.anySatisfy((v) => v === ${L(99)})).toBe(false);
    expect(s.allSatisfy((v) => v > ${L(0)})).toBe(true);
  });

  it("count", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    s.push(${L(4)});
    s.push(${L(5)});
    expect(s.count((v) => v > ${L(3)})).toBe(2);
  });

  it("sum, min, max", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    expect(s.sum()).toBe(${L(1)} + ${L(2)} + ${L(3)});
    expect(s.min()).toBe(${L(1)});
    expect(s.max()).toBe(${L(3)});
  });

  it("map", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    // Use explicit bigint literal (2n) for multiplication with bigint values
    const two = ${L(2)};
    const result = s.map((v) => v * two);
    const expected = [${L(3)} * two, ${L(2)} * two, ${L(1)} * two];
    expect(result).toEqual(expected); // top to bottom
  });

  it("filter", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    s.push(${L(4)});
    const result = s.filter((v) => v <= ${L(3)});
    expect(result.length).toBe(3);
  });

  it("reduce", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    const sum = s.reduce((acc, v) => acc + v, ${L(0)});
    expect(sum).toBe(${L(1)} + ${L(2)} + ${L(3)});
  });

  it("forEach", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    const collected: ${T}[] = [];
    s.forEach((v) => collected.push(v));
    // forEach goes top to bottom
    expect(collected).toEqual(${arr(3, 2, 1)});
  });

  it("resize", () => {
    const s = new ${cls}();
    ${resizeHead}
    expect(s.size).toBe(100);
  });

  it("memoryBytes", () => {
    const s = new ${cls}(64);
    expect(s.memoryBytes()).toBe(64 * ${prim.bytes});
  });

  it("toString", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    expect(s.toString()).not.toBe("");
  });

  it("toArray", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    const arr = s.toArray();
    expect(arr).toEqual(${arr(3, 2, 1)}); // top first
  });

  it("values iterator", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    s.push(${L(3)});
    const collected: ${T}[] = [];
    for (const v of s.values()) {
      collected.push(v);
    }
    expect(collected).toEqual(${arr(3, 2, 1)}); // top to bottom
  });

  it("Symbol.iterator", () => {
    const s = new ${cls}();
    s.push(${L(1)});
    s.push(${L(2)});
    const collected: ${T}[] = [];
    for (const v of s) {
      collected.push(v);
    }
    expect(collected).toEqual(${arr(2, 1)}); // top to bottom
  });

  it("of factory", () => {
    const s = ${cls}.of(${arr(1, 2, 3)}); // last element is top
    expect(s.size).toBe(3);
    expect(s.peek()).toBe(${L(3)});
    expect(s.pop()).toBe(${L(3)});
    expect(s.pop()).toBe(${L(2)});
    expect(s.pop()).toBe(${L(1)});
  });
});
`;
}

export function renderImmutableStackTest(prim, command) {
  const cls = immStackClassName(prim);
  const mut = stackClassName(prim);
  const T = prim.tsType;
  const L = (n) => lit(prim, n);
  const arr = (...ns) => `[${ns.map(L).join(", ")}]`;
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./immutable_${prim.id}-array-stack.js";
import { ${mut} } from "./${prim.id}-array-stack.js";

describe("${cls} generated", () => {
  it("static of creates immutable stack", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)}); // last = top
    expect(stack.size).toBe(3);
    expect(stack.peek()).toBe(${L(3)});
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new ${mut}();
    mutable.push(${L(1)});
    mutable.push(${L(2)});
    const imm = ${cls}.fromMutable(mutable);
    mutable.push(${L(3)});
    expect(imm.size).toBe(2);
    expect(mutable.size).toBe(3);
  });

  it("peek returns top element", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)}); // top = ${L(3)}
    expect(stack.peek()).toBe(${L(3)});
  });

  it("peek throws on empty", () => {
    const stack = ${cls}.of([]);
    expect(() => stack.peek()).toThrow();
  });

  it("peekAt", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)}); // top = ${L(3)}
    expect(stack.peekAt(0)).toBe(${L(3)}); // top
    expect(stack.peekAt(1)).toBe(${L(2)});
    expect(stack.peekAt(2)).toBe(${L(1)}); // bottom
  });

  it("peekAt throws on out of bounds", () => {
    const stack = ${cls}.of(${arr(1)});
    expect(() => stack.peekAt(1)).toThrow();
    expect(() => stack.peekAt(-1)).toThrow();
  });

  it("size and isEmpty", () => {
    const empty = ${cls}.of([]);
    expect(empty.size).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ${cls}.of(${arr(1)});
    expect(nonEmpty.size).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("contains and includes", () => {
    const stack = ${cls}.of(${arr(1, 2)});
    expect(stack.has(${L(1)})).toBe(true);
    expect(stack.has(${L(2)})).toBe(true);
    expect(stack.has(${L(99)})).toBe(false);
    expect(stack.includes(${L(1)})).toBe(true);
  });

  it("select returns MUTABLE", () => {
    const stack = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    const result = stack.select((v) => v > ${L(3)});
    expect(typeof result.push).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const stack = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    const result = stack.reject((v) => v > ${L(3)});
    expect(typeof result.push).toBe("function");
    expect(result.size).toBe(3);
  });

  it("find", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)}); // top = ${L(3)}
    expect(stack.find((v) => v === ${L(3)})).toBe(${L(3)});
    expect(stack.find((v) => v === ${L(99)})).toBeUndefined();
  });

  it("every / some", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)});
    expect(stack.every((v) => v < 100)).toBe(true);
    expect(stack.every((v) => v < ${L(1)})).toBe(false);
    expect(stack.some((v) => v === ${L(2)})).toBe(true);
    expect(stack.some((v) => v === ${L(99)})).toBe(false);
  });

  it("anySatisfy / allSatisfy", () => {
    const stack = ${cls}.of(${arr(1, 2)});
    expect(stack.anySatisfy((v) => v === ${L(2)})).toBe(true);
    expect(stack.anySatisfy((v) => v === ${L(99)})).toBe(false);
    expect(stack.allSatisfy((v) => v > ${L(0)})).toBe(true);
  });

  it("count", () => {
    const stack = ${cls}.of(${arr(1, 2, 3, 4, 5)});
    expect(stack.count((v) => v > ${L(3)})).toBe(2);
  });

  it("sum, min, max", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)});
    expect(stack.sum()).toBe(${L(1)} + ${L(2)} + ${L(3)});
    expect(stack.min()).toBe(${L(1)});
    expect(stack.max()).toBe(${L(3)});
  });

  it("toArray top to bottom", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)}); // top = ${L(3)}
    const arr = stack.toArray();
    expect(arr).toEqual(${arr(3, 2, 1)}); // top first
  });

  it("toMutable round-trip", () => {
    const original = ${cls}.of(${arr(1, 2, 3)});
    const mutable = original.toMutable();
    mutable.push(${L(4)});
    expect(mutable.size).toBe(4);
    expect(original.size).toBe(3);
  });

  it("forEach top to bottom", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)});
    const collected: ${T}[] = [];
    stack.forEach((v) => collected.push(v));
    expect(collected).toEqual(${arr(3, 2, 1)}); // top to bottom
  });

  it("map top to bottom", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)});
    const result = stack.map((v) => v * ${L(2)});
    expect(result).toEqual([${L(3)} * ${L(2)}, ${L(2)} * ${L(2)}, ${L(1)} * ${L(2)}]);
  });

  it("filter top to bottom", () => {
    const stack = ${cls}.of(${arr(1, 2, 3, 4)});
    const result = stack.filter((v) => v <= ${L(3)});
    expect(result.length).toBe(3);
  });

  it("reduce top to bottom", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)});
    const sum = stack.reduce((acc, v) => acc + v, ${L(0)});
    expect(sum).toBe(${L(1)} + ${L(2)} + ${L(3)});
  });

  it("values iterator top to bottom", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)});
    const collected: ${T}[] = [];
    for (const v of stack.values()) {
      collected.push(v);
    }
    expect(collected).toEqual(${arr(3, 2, 1)});
  });

  it("Symbol.iterator top to bottom", () => {
    const stack = ${cls}.of(${arr(1, 2)});
    const collected: ${T}[] = [];
    for (const v of stack) {
      collected.push(v);
    }
    expect(collected).toEqual(${arr(2, 1)});
  });

  it("toString", () => {
    const stack = ${cls}.of(${arr(1, 2)}); // top = ${L(2)}
    const str = stack.toString();
    expect(str).not.toBe("");
    expect(str.includes("[")).toBe(true);
    expect(str.includes("]")).toBe(true);
  });

  it("memoryBytes", () => {
    const stack = ${cls}.of(${arr(1, 2, 3)});
    expect(stack.memoryBytes()).toBe(3 * ${prim.bytes});
  });

  it("defensive copy - modifying source array doesn't affect immutable", () => {
    const source = ${arr(1, 2, 3)};
    const stack = ${cls}.of(source);
    source[0] = ${L(99)} as any;
    expect(stack.peek()).toBe(${L(3)});
  });

  // Verify mutators are not available
  it("has no push method", () => {
    const stack = ${cls}.of(${arr(1)});
    // @ts-expect-error - push should not exist on immutable
    expect(stack.push).toBeUndefined();
  });
});
`;
}

// ===========================================================================
// BAG — mutable only (multiset; no immutable variant)
// ===========================================================================

export function bagSourceFileName(prim) {
  return `${prim.id}-hash-bag.ts`;
}
export function bagTestFileName(prim) {
  return `${prim.id}-hash-bag.generated.test.ts`;
}
export function bagClassName(prim) {
  return `${prim.name}HashBag`;
}

export function renderBag(prim, command) {
  const cls = bagClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;

  return `${LICENSE}${banner(command)}

/**
 * Bag (multiset) for ${T} values backed by Map<${T}, number>.
 * Tracks occurrence counts for each distinct value.
 * Map handles ${T} keys natively, including bigint.
 */
export class ${cls} {
  private counts: Map<${T}, number> = new Map();
  private _size = 0;

  add(value: ${T}): this {
    this.addOccurrences(value, 1);
    return this;
  }

  /**
   * Bulk-loads a fresh bag from (value, count) entries in one O(n) pass (the
   * data pump). Counts for equal values accumulate; total count is
   * overflow-checked against Number.MAX_SAFE_INTEGER. Backed by a native Map, so
   * this is a convenience over a per-element loop, not a pre-sized table fill.
   */
  static bulkLoad(entries: Iterable<readonly [${T}, number]>): ${cls} {
    const bag = new ${cls}();
    for (const [value, count] of entries) {
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new RangeError(
          "bag occurrence count must be a non-negative safe integer, got " +
            count,
        );
      }
      if (count === 0) continue;
      const current = bag.counts.get(value) ?? 0;
      if (
        current + count > Number.MAX_SAFE_INTEGER ||
        bag._size + count > Number.MAX_SAFE_INTEGER
      ) {
        throw new RangeError("bag count overflow during pump");
      }
      bag.counts.set(value, current + count);
      bag._size += count;
    }
    return bag;
  }

  addOccurrences(value: ${T}, occurrences: number): void {
    if (occurrences < 0)
      throw new RangeError("Occurrences must not be negative");
    if (occurrences === 0) return;
    const current = this.counts.get(value) ?? 0;
    this.counts.set(value, current + occurrences);
    this._size += occurrences;
  }

  remove(value: ${T}): boolean {
    return this.removeOccurrences(value, 1);
  }

  removeOccurrences(value: ${T}, occurrences: number): boolean {
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

  removeAll(value: ${T}): boolean {
    const current = this.counts.get(value);
    if (current === undefined) return false;
    this.counts.delete(value);
    this._size -= current;
    return true;
  }

  occurrencesOf(value: ${T}): number {
    return this.counts.get(value) ?? 0;
  }

  has(value: ${T}): boolean {
    return this.counts.has(value);
  }

  /** Total number of items including duplicates */
  get size(): number {
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
  *entries(): Generator<[${T}, number]> {
    for (const entry of this.counts) {
      yield entry;
    }
  }

  /** Makes the bag iterable with for-of loops; yields each item repeated by
   * its occurrence count (matching forEach / toArray). */
  *[Symbol.iterator](): IterableIterator<${T}> {
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) yield value;
    }
  }

  /** Iterates over each item, repeating by occurrence count */
  forEach(f: (value: ${T}) => void): void {
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) {
        f(value);
      }
    }
  }

  /** Iterates over each distinct value with its occurrence count */
  forEachWithOccurrences(
    f: (value: ${T}, occurrences: number) => void,
  ): void {
    for (const [value, count] of this.counts) {
      f(value, count);
    }
  }

  select(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    for (const [value, count] of this.counts) {
      if (predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  reject(predicate: (value: ${T}) => boolean): ${cls} {
    const result = new ${cls}();
    for (const [value, count] of this.counts) {
      if (!predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a ${Arr} with all items, each repeated by occurrence count */
  toArray(): ${Arr} {
    const result = new ${Arr}(this._size);
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
      parts.push(\`\${value}×\${count}\`);
    }
    return \`{\${parts.join(", ")}}\`;
  }

  /** Estimated memory: Map overhead + this object overhead */
  memoryBytes(): number {
    // Map<${T}, number>: ~80 bytes per entry overhead in V8
    // This is an estimate; exact memory depends on the JS engine.
    return this.counts.size * 80;
  }
}
`;
}

export function renderBagTest(prim, command) {
  const cls = bagClassName(prim);
  const L = (n) => lit(prim, n);
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./${prim.id}-hash-bag.js";

describe("${cls} generated", () => {
  it("add and occurrences", () => {
    const b = new ${cls}();
    b.add(${L(1)});
    b.add(${L(1)});
    b.add(${L(2)});
    expect(b.occurrencesOf(${L(1)})).toBe(2);
    expect(b.occurrencesOf(${L(2)})).toBe(1);
    expect(b.size).toBe(3);
    expect(b.sizeDistinct()).toBe(2);
  });
  it("remove and removeAll", () => {
    const b = new ${cls}();
    b.add(${L(1)});
    b.add(${L(1)});
    b.add(${L(1)});
    b.remove(${L(1)});
    expect(b.occurrencesOf(${L(1)})).toBe(2);
    b.removeAll(${L(1)});
    expect(b.has(${L(1)})).toBe(false);
  });
  it("isEmpty and clear", () => {
    const b = new ${cls}();
    expect(b.isEmpty()).toBe(true);
    b.add(${L(1)});
    b.clear();
    expect(b.isEmpty()).toBe(true);
  });
  it("forEachWithOccurrences", () => {
    const b = new ${cls}();
    b.add(${L(1)});
    b.add(${L(1)});
    b.add(${L(2)});
    let total = 0;
    b.forEachWithOccurrences((_v, c) => {
      total += c;
    });
    expect(total).toBe(3);
  });
  it("select", () => {
    const b = new ${cls}();
    b.add(${L(1)});
    b.add(${L(2)});
    b.add(${L(3)});
    expect(b.select((v) => v > ${L(1)}).size).toBe(2);
  });
  it("toString", () => {
    const b = new ${cls}();
    b.add(${L(1)});
    expect(b.toString()).not.toBe("");
  });
});
`;
}

// ===========================================================================
// BAG — immutable
// ===========================================================================

export function immBagSourceFileName(prim) {
  return `immutable_${prim.id}-hash-bag.ts`;
}
export function immBagTestFileName(prim) {
  return `immutable_${prim.id}-hash-bag.generated.test.ts`;
}
export function immBagClassName(prim) {
  return `Immutable${prim.name}HashBag`;
}

export function renderImmutableBag(prim, command) {
  const cls = immBagClassName(prim);
  const mut = bagClassName(prim);
  const T = prim.tsType;
  const Arr = prim.arrayClass;

  return `${LICENSE}${banner(command)}

import { ${mut} } from "./${prim.id}-hash-bag.js";

/**
 * Immutable bag (multiset) for ${T} values backed by Map<${T}, number>.
 * Tracks occurrence counts for each distinct value.
 * Construct via static of(values) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 */
export class ${cls} {
  private counts: Map<${T}, number>;
  private _size: number;

  /** Creates an immutable bag from an array of values (defensive copy). */
  static of(values: ${T}[]): ${cls} {
    const counts = new Map<${T}, number>();
    let size = 0;
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
      size++;
    }
    return new ${cls}(counts, size);
  }

  /** Creates an immutable copy from a mutable bag (defensive copy). */
  static fromMutable(mutable: ${mut}): ${cls} {
    const counts = new Map<${T}, number>();
    let size = 0;
    mutable.forEachWithOccurrences((value, occurrences) => {
      counts.set(value, occurrences);
      size += occurrences;
    });
    return new ${cls}(counts, size);
  }

  private constructor(counts: Map<${T}, number>, size: number) {
    this.counts = counts;
    this._size = size;
  }

  /** Returns the number of occurrences of the given value. */
  occurrencesOf(value: ${T}): number {
    return this.counts.get(value) ?? 0;
  }

  /** Returns true if the bag contains the given value. */
  has(value: ${T}): boolean {
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
  *entries(): Generator<[${T}, number]> {
    for (const entry of this.counts) {
      yield entry;
    }
  }

  /** Makes the bag iterable with for-of loops; yields each item repeated by
   * its occurrence count (matching forEach / toArray). */
  *[Symbol.iterator](): IterableIterator<${T}> {
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) yield value;
    }
  }

  /** Iterates over each item, repeating by occurrence count. */
  forEach(f: (value: ${T}) => void): void {
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) {
        f(value);
      }
    }
  }

  /** Iterates over each distinct value with its occurrence count. */
  forEachWithOccurrences(
    f: (value: ${T}, occurrences: number) => void,
  ): void {
    for (const [value, count] of this.counts) {
      f(value, count);
    }
  }

  /** Returns a new MUTABLE bag with values satisfying the predicate. */
  select(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (const [value, count] of this.counts) {
      if (predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a new MUTABLE bag with values NOT satisfying the predicate. */
  reject(predicate: (value: ${T}) => boolean): ${mut} {
    const result = new ${mut}();
    for (const [value, count] of this.counts) {
      if (!predicate(value)) result.addOccurrences(value, count);
    }
    return result;
  }

  /** Returns a ${Arr} with all items, each repeated by occurrence count. */
  toArray(): ${Arr} {
    const result = new ${Arr}(this._size);
    let idx = 0;
    for (const [value, count] of this.counts) {
      for (let i = 0; i < count; i++) {
        result[idx++] = value;
      }
    }
    return result;
  }

  /** Returns a mutable copy of this immutable bag. */
  toMutable(): ${mut} {
    const result = new ${mut}();
    for (const [value, count] of this.counts) {
      result.addOccurrences(value, count);
    }
    return result;
  }

  toString(): string {
    const parts: string[] = [];
    for (const [value, count] of this.counts) {
      parts.push(\`\${value}×\${count}\`);
    }
    return \`{\${parts.join(", ")}}\`;
  }

  /** Estimated memory: Map overhead + this object overhead. */
  memoryBytes(): number {
    // Map<${T}, number>: ~80 bytes per entry overhead in V8
    // This is an estimate; exact memory depends on the JS engine.
    return this.counts.size * 80;
  }
}
`;
}

export function renderImmutableBagTest(prim, command) {
  const cls = immBagClassName(prim);
  const mut = bagClassName(prim);
  const T = prim.tsType;
  const L = (n) => lit(prim, n);
  const arr = (...ns) => `[${ns.map(L).join(", ")}]`;
  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./immutable_${prim.id}-hash-bag.js";
import { ${mut} } from "./${prim.id}-hash-bag.js";

describe("${cls} generated", () => {
  it("static of creates immutable bag", () => {
    const b = ${cls}.of(${arr(1, 1, 2)});
    expect(b.occurrencesOf(${L(1)})).toBe(2);
    expect(b.occurrencesOf(${L(2)})).toBe(1);
    expect(b.size).toBe(3);
    expect(b.sizeDistinct()).toBe(2);
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new ${mut}();
    mutable.add(${L(1)});
    mutable.add(${L(1)});
    mutable.add(${L(2)});
    const imm = ${cls}.fromMutable(mutable);
    mutable.add(${L(3)});
    expect(imm.size).toBe(3);
    expect(imm.has(${L(3)})).toBe(false);
    expect(mutable.size).toBe(4);
  });

  it("occurrencesOf and has", () => {
    const b = ${cls}.of(${arr(1, 1, 2)});
    expect(b.occurrencesOf(${L(1)})).toBe(2);
    expect(b.occurrencesOf(${L(99)})).toBe(0);
    expect(b.has(${L(1)})).toBe(true);
    expect(b.has(${L(99)})).toBe(false);
  });

  it("size, sizeDistinct, isEmpty", () => {
    const empty = ${cls}.of([]);
    expect(empty.size).toBe(0);
    expect(empty.sizeDistinct()).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ${cls}.of(${arr(1, 1)});
    expect(nonEmpty.size).toBe(2);
    expect(nonEmpty.sizeDistinct()).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("entries", () => {
    const b = ${cls}.of(${arr(1, 1, 2)});
    let total = 0;
    for (const [, count] of b.entries()) {
      total += count;
    }
    expect(total).toBe(3);
  });

  it("Symbol.iterator yields repeated items", () => {
    const b = ${cls}.of(${arr(1, 1, 2)});
    const collected: ${T}[] = [];
    for (const v of b) {
      collected.push(v);
    }
    expect(collected.length).toBe(3);
  });

  it("forEach repeats by occurrence count", () => {
    const b = ${cls}.of(${arr(1, 1, 2)});
    let count = 0;
    b.forEach(() => {
      count++;
    });
    expect(count).toBe(3);
  });

  it("forEachWithOccurrences", () => {
    const b = ${cls}.of(${arr(1, 1, 2)});
    let total = 0;
    b.forEachWithOccurrences((_v, c) => {
      total += c;
    });
    expect(total).toBe(3);
  });

  it("select returns MUTABLE", () => {
    const b = ${cls}.of(${arr(1, 2, 3)});
    const result = b.select((v) => v > ${L(1)});
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const b = ${cls}.of(${arr(1, 2, 3)});
    const result = b.reject((v) => v > ${L(1)});
    expect(typeof result.add).toBe("function");
    expect(result.size).toBe(1);
  });

  it("toArray repeats by occurrence count", () => {
    const b = ${cls}.of(${arr(1, 1, 2)});
    const arr = b.toArray();
    expect(arr.length).toBe(3);
  });

  it("toMutable round-trip", () => {
    const original = ${cls}.of(${arr(1, 1, 2)});
    const mutable = original.toMutable();
    mutable.add(${L(3)});
    expect(mutable.size).toBe(4);
    expect(original.size).toBe(3);
  });

  it("toString", () => {
    const b = ${cls}.of(${arr(1)});
    expect(b.toString()).not.toBe("");
  });

  it("memoryBytes", () => {
    const b = ${cls}.of(${arr(1, 2, 3)});
    expect(b.memoryBytes()).toBeGreaterThanOrEqual(0);
  });

  it("defensive copy - modifying source array doesn't affect immutable", () => {
    const source = ${arr(1, 2, 3)};
    const b = ${cls}.of(source);
    source[0] = ${L(99)} as any;
    expect(b.has(${L(1)})).toBe(true);
    expect(b.has(${L(99)})).toBe(false);
  });

  // Verify mutators are not available
  it("has no add method", () => {
    const b = ${cls}.of(${arr(1)});
    // @ts-expect-error - add should not exist on immutable
    expect(b.add).toBeUndefined();
  });

  it("has no remove method", () => {
    const b = ${cls}.of(${arr(1)});
    // @ts-expect-error - remove should not exist on immutable
    expect(b.remove).toBeUndefined();
  });
});
`;
}
