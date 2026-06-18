// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// ---------------------------------------------------------------------------
// Templates for the typed hash-map family. Pure string builders, parameterised
// only by the SPEC metadata (no name-based branching). Canonical hash helpers
// are imported BY NAME (see spec.KEY_HASH) — never inlined.
// ---------------------------------------------------------------------------

import { KEY_HASH } from "./spec.mjs";

const LICENSE = `// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.
`;

/** The DO-NOT-EDIT banner stamped on every generated file. */
export function generatedHeader(command) {
  return `// CODE GENERATED — DO NOT EDIT. Regenerate with \`${command}\`.\n`;
}

/** Bare file name (no dir) for the source class of a (key,val) pair. */
export function sourceFileName(key, val) {
  return `${key.id}-${val.id}-hash-map.ts`;
}

/** Bare file name (no dir) for the generated test of a (key,val) pair. */
export function testFileName(key, val) {
  return `${key.id}-${val.id}-hash-map.generated.test.ts`;
}

/** Class / export name for a (key,val) pair, e.g. Int32BigInt64HashMap. */
export function className(key, val) {
  return `${key.name}${val.name}HashMap`;
}

// ---------------------------------------------------------------------------
// Source class template
// ---------------------------------------------------------------------------

/**
 * Build the full <k>-<v>-hash-map.ts source for one (key,val) pair.
 * @param {{key: import('./spec.mjs').Prim, val: import('./spec.mjs').Prim}} pair
 * @param {string} command  the regenerate command, embedded in the banner.
 */
export function renderSource({ key, val }, command) {
  const cls = className(key, val);
  const K = key.tsType; // "number" | "bigint"
  const V = val.tsType;
  const keyArr = key.arrayClass;
  const valArr = val.arrayClass;
  const keyHash = KEY_HASH[key.kind];
  const slotBytes = key.bytes + val.bytes + 1;

  // Imports: the optional key-hash helper (float/bigint keys) followed by the
  // shared data-pump helpers. Int keys import only the pump helpers.
  const pumpImport =
    `import {\n` +
    `  checkExpectedSize,\n` +
    `  hashCapacityFor,\n` +
    `  PumpDuplicateError,\n` +
    `  type BulkLoadOptions,\n` +
    `} from "../../internal/pump.js";\n`;
  const preamble = keyHash.import
    ? `\nimport { ${keyHash.import.names.join(", ")} } from "${keyHash.import.from}";\n${pumpImport}`
    : `\n${pumpImport}`;

  // select/reject have an identical signature shape. The committed files were
  // emitted through Prettier (printWidth 80): when the one-line form fits in
  // 80 columns it stays on one line, otherwise the predicate param wraps onto
  // its own line. Class-name + type-token length is what decides this, so we
  // reproduce Prettier's width rule deterministically (no extra dependency).
  const sig = (method) => {
    const oneLine = `  ${method}(predicate: (key: ${K}, value: ${V}) => boolean): ${cls} {`;
    if (oneLine.length <= 80) return oneLine;
    return (
      `  ${method}(\n` +
      `    predicate: (key: ${K}, value: ${V}) => boolean,\n` +
      `  ): ${cls} {`
    );
  };

  return `${LICENSE}${generatedHeader(command)}${preamble}
const DEFAULT_CAPACITY = 16;
const LOAD_FACTOR = 0.75;

/**
 * ${key.name}→${val.name} hash map backed by ${keyArr} and ${valArr}.
 * Keys: ${key.bytes} bytes each, values: ${val.bytes} bytes each.
 * Contiguous memory, no GC pressure on the arrays.
 * Memory: ${slotBytes} bytes/slot (vs ~50-70 bytes in Map<${K}, ${V}>).
 */
export class ${cls} {
  private keys: ${keyArr};
  private values: ${valArr};
  private occupied: Uint8Array;
  private _size = 0;
  private capacity: number;

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = nextPowerOfTwo(capacity);
    this.keys = new ${keyArr}(this.capacity);
    this.values = new ${valArr}(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
  }

  /**
   * Bulk-loads a fresh map from exactly \`n\` key/value pairs in one O(n) pass
   * (the data pump): the table is sized for \`n\` up front, so there is ZERO
   * mid-load rehash, and slots are filled via the same probe \`set\` uses. Throws
   * \`RangeError\` if \`n\` is not a valid size or if the source yields more or
   * fewer than \`n\` pairs. Duplicate keys throw {@link PumpDuplicateError} unless
   * \`onDuplicate\` is "ignore" (keeps the first). The result is observably
   * identical to the same pairs inserted one by one.
   */
  static bulkLoadExact(
    pairs: Iterable<readonly [${K}, ${V}]>,
    n: number,
    opts?: BulkLoadOptions,
  ): ${cls} {
    checkExpectedSize(n);
    const onDuplicate = opts?.onDuplicate ?? "error";
    const map = new ${cls}(hashCapacityFor(n));
    const mask = map.capacity - 1;
    let seen = 0;
    let i = 0;
    for (const [key, value] of pairs) {
      if (seen >= n) {
        throw new RangeError("pump source exceeds exact size " + n);
      }
      let idx = map.hash(key) & mask;
      while (true) {
        if (!map.occupied[idx]) {
          map.keys[idx] = key;
          map.values[idx] = value;
          map.occupied[idx] = 1;
          map._size++;
          break;
        }
        if (Object.is(map.keys[idx], key)) {
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
    return map;
  }

  /**
   * Bulk-loads a fresh map from key/value pairs in one O(n) pass. \`opts.size\`
   * (or the source's \`length\`/\`size\` if available) pre-sizes the table BEFORE
   * iteration; with a trustworthy size there is no rehash. Unlike
   * {@link bulkLoadExact} the size is only a hint: the source is never buffered
   * and the table grows normally (via the same probe \`set\` uses) if the hint is
   * exceeded. Duplicate-key handling matches {@link bulkLoadExact}.
   */
  static bulkLoad(
    pairs: Iterable<readonly [${K}, ${V}]>,
    opts?: BulkLoadOptions,
  ): ${cls} {
    const onDuplicate = opts?.onDuplicate ?? "error";
    const sized = pairs as { length?: number; size?: number };
    const hint = opts?.size ?? sized.length ?? sized.size;
    if (hint !== undefined) checkExpectedSize(hint);
    const map =
      hint !== undefined ? new ${cls}(hashCapacityFor(hint)) : new ${cls}();
    let i = 0;
    for (const [key, value] of pairs) {
      if (map.needsResize()) map.resize();
      const mask = map.capacity - 1;
      let idx = map.hash(key) & mask;
      while (true) {
        if (!map.occupied[idx]) {
          map.keys[idx] = key;
          map.values[idx] = value;
          map.occupied[idx] = 1;
          map._size++;
          break;
        }
        if (Object.is(map.keys[idx], key)) {
          if (onDuplicate === "error") throw new PumpDuplicateError(i);
          break; // ignore: keep first
        }
        idx = (idx + 1) & mask;
      }
      i++;
    }
    return map;
  }

  set(key: ${K}, value: ${V}): this {
    if (this.needsResize()) this.resize();
    const mask = this.capacity - 1;
    let idx = this.hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) {
        this.keys[idx] = key;
        this.values[idx] = value;
        this.occupied[idx] = 1;
        this._size++;
        return this;
      }
      if (Object.is(this.keys[idx], key)) {
        this.values[idx] = value;
        return this;
      }
      idx = (idx + 1) & mask;
    }
  }

  get(key: ${K}): ${V} | undefined {
    if (this.capacity === 0) return undefined;
    const mask = this.capacity - 1;
    let idx = this.hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) return this.values[idx];
      idx = (idx + 1) & mask;
    }
  }

  getOrDefault(key: ${K}, defaultValue: ${V}): ${V} {
    const v = this.get(key);
    return v !== undefined ? v : defaultValue;
  }

  remove(key: ${K}): ${V} | undefined {
    if (this.capacity === 0) return undefined;
    const mask = this.capacity - 1;
    let idx = this.hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) {
        const old = this.values[idx];
        this.occupied[idx] = 0;
        this._size--;
        this.rehashFrom(idx, mask);
        return old;
      }
      idx = (idx + 1) & mask;
    }
  }

  has(key: ${K}): boolean {
    return this.get(key) !== undefined;
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

  *entries(): Generator<[${K}, ${V}]> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield [this.keys[i], this.values[i]];
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[${K}, ${V}]> {
    return this.entries();
  }

  *keysIter(): Generator<${K}> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.keys[i];
    }
  }

  *valuesIter(): Generator<${V}> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.values[i];
    }
  }

  forEach(f: (key: ${K}, value: ${V}) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) f(this.keys[i], this.values[i]);
    }
  }

${sig("select")}
    const result = new ${cls}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

${sig("reject")}
    const result = new ${cls}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  anySatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i]))
        return true;
    }
    return false;
  }

  allSatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i]))
        return false;
    }
    return true;
  }

  injectInto<R>(initial: R, f: (acc: R, key: ${K}, value: ${V}) => R): R {
    let result = initial;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result = f(result, this.keys[i], this.values[i]);
    }
    return result;
  }

  addToValue(key: ${K}, amount: ${V}): ${V} {
    const existing = this.get(key);
    const newVal = (
      existing !== undefined ? (((existing as any) + amount) as any) : amount
    ) as ${V};
    this.set(key, newVal);
    return newVal;
  }

  /** Memory stats for this map */
  memoryBytes(): number {
    return this.capacity * (${key.bytes} + ${val.bytes} + 1);
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) parts.push(\`\${this.keys[i]}: \${this.values[i]}\`);
    }
    return \`{\${parts.join(", ")}}\`;
  }

  private hash(key: ${K}): number {
    let h = ${keyHash.seedExpr("key")};
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    return ((h >> 16) ^ h) >>> 0;
  }

  private needsResize(): boolean {
    return this._size + 1 >= this.capacity * LOAD_FACTOR;
  }

  private resize(): void {
    const oldKeys = this.keys;
    const oldValues = this.values;
    const oldOccupied = this.occupied;
    const oldCap = this.capacity;
    this.capacity *= 2;
    this.keys = new ${keyArr}(this.capacity);
    this.values = new ${valArr}(this.capacity);
    this.occupied = new Uint8Array(this.capacity);
    this._size = 0;
    for (let i = 0; i < oldCap; i++) {
      if (oldOccupied[i]) this.set(oldKeys[i], oldValues[i]);
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    let idx = (deleted + 1) & mask;
    while (this.occupied[idx]) {
      const ideal = this.hash(this.keys[idx]) & mask;
      const distCurrent = (idx - ideal + this.capacity) & mask;
      const distGap = (deleted - ideal + this.capacity) & mask;
      if (distCurrent > distGap) {
        this.keys[deleted] = this.keys[idx];
        this.values[deleted] = this.values[idx];
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

// ---------------------------------------------------------------------------
// Immutable hash-map source template
// ---------------------------------------------------------------------------

/** Bare file name (no dir) for the immutable source class of a (key,val) pair. */
export function immSourceFileName(key, val) {
  return `immutable_${key.id}-${val.id}-hash-map.ts`;
}

/** Bare file name (no dir) for the immutable generated test of a (key,val) pair. */
export function immTestFileName(key, val) {
  return `immutable_${key.id}-${val.id}-hash-map.generated.test.ts`;
}

/** Class / export name for an immutable (key,val) pair, e.g. ImmutableInt32BigInt64HashMap. */
export function immClassName(key, val) {
  return `Immutable${key.name}${val.name}HashMap`;
}

/**
 * Build the full immutable_<k>-<v>-hash-map.ts source for one (key,val) pair.
 * Exposes the READ-ONLY subset of the mutable map (no set/remove/clear): keys
 * are inserted once at construction into an open-addressed backing store, then
 * the instance is frozen. select/reject return MUTABLE, mirroring the other
 * immutable typed families.
 * @param {{key: import('./spec.mjs').Prim, val: import('./spec.mjs').Prim}} pair
 * @param {string} command  the regenerate command, embedded in the banner.
 */
export function renderImmutableSource({ key, val }, command) {
  const cls = immClassName(key, val);
  const mut = className(key, val);
  const K = key.tsType;
  const V = val.tsType;
  const keyArr = key.arrayClass;
  const valArr = val.arrayClass;
  const keyHash = KEY_HASH[key.kind];
  const slotBytes = key.bytes + val.bytes + 1;

  // Same preamble rule as the mutable map: a key needing a hash helper imports
  // it BY NAME; the mutable-sibling import always follows. Int keys import only
  // the mutable sibling.
  const mutImport = `import { ${mut} } from "./${key.id}-${val.id}-hash-map.js";`;
  const preamble = keyHash.import
    ? `\nimport { ${keyHash.import.names.join(", ")} } from "${keyHash.import.from}";\n${mutImport}\n`
    : `\n${mutImport}\n`;

  return `${LICENSE}${generatedHeader(command)}${preamble}
/**
 * Immutable ${key.name}→${val.name} hash map backed by ${keyArr} and ${valArr}.
 * Keys: ${key.bytes} bytes each, values: ${val.bytes} bytes each.
 * Construct via static of(entries) or fromMutable(mutable).
 * Mutations create new instances; select/reject return MUTABLE.
 * Memory: ${slotBytes} bytes/slot (vs ~50-70 bytes in Map<${K}, ${V}>).
 */
export class ${cls} {
  private keys: ${keyArr};
  private values: ${valArr};
  private occupied: Uint8Array;
  private _size: number;
  private capacity: number;

  /** Creates an immutable map from an array of [key, value] entries (defensive copy). */
  static of(entries: [${K}, ${V}][]): ${cls} {
    const map = new ${mut}(entries.length);
    for (const [k, v] of entries) {
      map.set(k, v);
    }
    return ${cls}.fromMutable(map);
  }

  /** Creates an immutable copy from a mutable map (defensive copy). */
  static fromMutable(mutable: ${mut}): ${cls} {
    const entries: [${K}, ${V}][] = [...mutable.entries()];
    const c = nextPowerOfTwo(Math.max(entries.length * 2, 16));
    const keys = new ${keyArr}(c);
    const values = new ${valArr}(c);
    const occupied = new Uint8Array(c);
    let size = 0;
    const mask = c - 1;
    for (const [k, v] of entries) {
      let idx = hash(k) & mask;
      while (true) {
        if (!occupied[idx]) {
          keys[idx] = k;
          values[idx] = v;
          occupied[idx] = 1;
          size++;
          break;
        }
        if (Object.is(keys[idx], k)) {
          values[idx] = v;
          break;
        }
        idx = (idx + 1) & mask;
      }
    }
    return new ${cls}(keys, values, occupied, size, c);
  }

  private constructor(
    keys: ${keyArr},
    values: ${valArr},
    occupied: Uint8Array,
    size: number,
    capacity: number,
  ) {
    this.keys = keys;
    this.values = values;
    this.occupied = occupied;
    this._size = size;
    this.capacity = capacity;
  }

  /** Returns the value for the key, or undefined. */
  get(key: ${K}): ${V} | undefined {
    if (this.capacity === 0) return undefined;
    const mask = this.capacity - 1;
    let idx = hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) return this.values[idx];
      idx = (idx + 1) & mask;
    }
  }

  /** Returns the value for the key, or the given default. */
  getOrDefault(key: ${K}, defaultValue: ${V}): ${V} {
    const v = this.get(key);
    return v !== undefined ? v : defaultValue;
  }

  /** Returns true if the map contains the given key. */
  has(key: ${K}): boolean {
    return this.get(key) !== undefined;
  }

  /** Returns the number of entries. */
  get size(): number {
    return this._size;
  }

  /** Returns true if the map is empty. */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /** Yields [key, value] pairs. */
  *entries(): Generator<[${K}, ${V}]> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield [this.keys[i], this.values[i]];
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[${K}, ${V}]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<${K}> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.keys[i];
    }
  }

  /** Yields all values. */
  *valuesIter(): Generator<${V}> {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) yield this.values[i];
    }
  }

  /** Calls the function for each entry. */
  forEach(f: (key: ${K}, value: ${V}) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) f(this.keys[i], this.values[i]);
    }
  }

  /** Returns a new MUTABLE map with entries satisfying the predicate. */
  select(predicate: (key: ${K}, value: ${V}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns a new MUTABLE map with entries NOT satisfying the predicate. */
  reject(predicate: (key: ${K}, value: ${V}) => boolean): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i]))
        return true;
    }
    return false;
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i]))
        return false;
    }
    return true;
  }

  /** Folds the entries into a single value. */
  injectInto<R>(initial: R, f: (acc: R, key: ${K}, value: ${V}) => R): R {
    let result = initial;
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result = f(result, this.keys[i], this.values[i]);
    }
    return result;
  }

  /** Returns a mutable copy of this immutable map. */
  toMutable(): ${mut} {
    const result = new ${mut}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) result.set(this.keys[i], this.values[i]);
    }
    return result;
  }

  /** Memory stats for this map. */
  memoryBytes(): number {
    return this.capacity * (${key.bytes} + ${val.bytes} + 1);
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i]) parts.push(\`\${this.keys[i]}: \${this.values[i]}\`);
    }
    return \`{\${parts.join(", ")}}\`;
  }
}

function hash(key: ${K}): number {
  let h = ${keyHash.seedExpr("key")};
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
  h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
  return ((h >> 16) ^ h) >>> 0;
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

/**
 * Build the full immutable_<k>-<v>-hash-map.generated.test.ts for one pair.
 * @param {{key: import('./spec.mjs').Prim, val: import('./spec.mjs').Prim}} pair
 * @param {string} command  the regenerate command, embedded in the banner.
 */
export function renderImmutableTest({ key, val }, command) {
  const cls = immClassName(key, val);
  const mut = className(key, val);
  const k1 = keyLit(key, 1);
  const k2 = keyLit(key, 2);
  const k3 = keyLit(key, 3);
  const k99 = keyLit(key, 99);
  const v1 = valLit(val, 1);
  const v2 = valLit(val, 2);
  const v3 = valLit(val, 3);
  const v0 = valLit(val, 0);
  const ent = (...pairsList) =>
    `[${pairsList.map(([k, v]) => `[${keyLit(key, k)}, ${valLit(val, v)}]`).join(", ")}]`;

  return `${LICENSE}${generatedHeader(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./immutable_${key.id}-${val.id}-hash-map.js";
import { ${mut} } from "./${key.id}-${val.id}-hash-map.js";

describe("${cls} generated", () => {
  it("static of creates immutable map", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2], [3, 3])});
    expect(m.get(${k1})).toBe(${v1});
    expect(m.get(${k99})).toBeUndefined();
    expect(m.size).toBe(3);
  });

  it("fromMutable creates defensive copy", () => {
    const mutable = new ${mut}();
    mutable.set(${k1}, ${v1});
    mutable.set(${k2}, ${v2});
    const imm = ${cls}.fromMutable(mutable);
    mutable.set(${k3}, ${v3});
    expect(imm.size).toBe(2);
    expect(imm.has(${k3})).toBe(false);
    expect(mutable.size).toBe(3);
  });

  it("get and has", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2])});
    expect(m.get(${k1})).toBe(${v1});
    expect(m.has(${k1})).toBe(true);
    expect(m.has(${k99})).toBe(false);
  });

  it("getOrDefault", () => {
    const m = ${cls}.of(${ent([1, 1])});
    expect(m.getOrDefault(${k1}, ${v3})).toBe(${v1});
    expect(m.getOrDefault(${k99}, ${v3})).toBe(${v3});
  });

  it("size and isEmpty", () => {
    const empty = ${cls}.of([]);
    expect(empty.size).toBe(0);
    expect(empty.isEmpty()).toBe(true);
    const nonEmpty = ${cls}.of(${ent([1, 1])});
    expect(nonEmpty.size).toBe(1);
    expect(nonEmpty.isEmpty()).toBe(false);
  });

  it("entries and Symbol.iterator", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2])});
    expect([...m.entries()].length).toBe(2);
    expect([...m].length).toBe(2);
  });

  it("keysIter and valuesIter", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2])});
    expect([...m.keysIter()].length).toBe(2);
    expect([...m.valuesIter()].length).toBe(2);
  });

  it("forEach", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2])});
    let count = 0;
    m.forEach(() => {
      count++;
    });
    expect(count).toBe(2);
  });

  it("select returns MUTABLE", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2], [3, 3])});
    const result = m.select((_k, v) => v > ${v1});
    expect(typeof result.set).toBe("function");
    expect(result.size).toBe(2);
  });

  it("reject returns MUTABLE", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2], [3, 3])});
    const result = m.reject((_k, v) => v > ${v1});
    expect(typeof result.set).toBe("function");
    expect(result.size).toBe(1);
  });

  it("anySatisfy / allSatisfy", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2])});
    expect(m.anySatisfy((_k, v) => v === ${v2})).toBe(true);
    expect(m.allSatisfy((_k, v) => v > ${v0})).toBe(true);
  });

  it("injectInto", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2])});
    const count = m.injectInto(0, (acc) => acc + 1);
    expect(count).toBe(2);
  });

  it("toMutable round-trip", () => {
    const original = ${cls}.of(${ent([1, 1], [2, 2])});
    const mutable = original.toMutable();
    mutable.set(${k3}, ${v3});
    expect(mutable.size).toBe(3);
    expect(original.size).toBe(2);
  });

  it("memoryBytes", () => {
    const m = ${cls}.of(${ent([1, 1], [2, 2], [3, 3])});
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });

  it("toString", () => {
    const m = ${cls}.of(${ent([1, 1])});
    expect(m.toString()).not.toBe("");
  });

  // Verify mutators are not available
  it("has no set method", () => {
    const m = ${cls}.of(${ent([1, 1])});
    // @ts-expect-error - set should not exist on immutable
    expect(m.set).toBeUndefined();
  });

  it("has no remove method", () => {
    const m = ${cls}.of(${ent([1, 1])});
    // @ts-expect-error - remove should not exist on immutable
    expect(m.remove).toBeUndefined();
  });
});
`;
}

// ---------------------------------------------------------------------------
// Test template
// ---------------------------------------------------------------------------

/** Literal builder for a key: bigint keys get the `n` suffix. */
function keyLit(prim, n) {
  return prim.tsType === "bigint" ? `${n}n` : `${n}`;
}
/** Literal builder for a value: bigint values get the `n` suffix. */
function valLit(prim, n) {
  return prim.tsType === "bigint" ? `${n}n` : `${n}`;
}

/**
 * The `resize` loop body depends on BOTH axes:
 *   number key:  `for (let i = 0; i < 100; i += 1) m.set(i, <valExpr>);`
 *   bigint key:  `for (let i = 0n; i < 100n; i += 1n) m.set(i, <valExpr>);`
 * where <valExpr> is `i * 10` style, with `i` adapted to the value type:
 *   num key + num val:    i * 10
 *   bigint key + num val: Number(i) * 10
 *   num key + bigint val: BigInt(i) * 10n
 *   bigint key + bigint val: i * 10n
 */
function resizeLoop(key, val) {
  const keyIsBig = key.tsType === "bigint";
  const valIsBig = val.tsType === "bigint";
  const head = keyIsBig
    ? "for (let i = 0n; i < 100n; i += 1n)"
    : "for (let i = 0; i < 100; i += 1)";
  let iAsVal;
  if (keyIsBig === valIsBig) {
    iAsVal = "i"; // same family: use i directly
  } else if (valIsBig) {
    iAsVal = "BigInt(i)"; // number key -> bigint value
  } else {
    iAsVal = "Number(i)"; // bigint key -> number value
  }
  const ten = valIsBig ? "10n" : "10";
  return `    ${head} m.set(i, ${iAsVal} * ${ten});`;
}

/**
 * Float-key IEEE-754 edge-case regression block (phase-3 correctness coverage:
 * NaN findable / dedup / removable, -0 vs +0 distinct, ±Infinity keys). These
 * exercise the `f64HashSeed` + `Object.is` keying that float keys rely on, so
 * the block is emitted ONLY for float-keyed maps. Value literals follow the
 * value type (bigint values use the `n` suffix). This block is a hand-added
 * regression suite in the committed files; it is reproduced here verbatim so
 * regeneration does NOT silently drop the coverage.
 */
function floatKeyEdgeCases(cls, vLit) {
  const v1 = vLit(1);
  const v2 = vLit(2);
  const v3 = vLit(3);
  return `

  describe("IEEE 754 edge cases", () => {
    it("NaN key is findable", () => {
      const m = new ${cls}();
      m.set(NaN, ${v1});
      expect(m.has(NaN)).toBe(true);
      expect(m.get(NaN)).toBe(${v1});
      expect(m.size).toBe(1);
    });
    it("NaN key replaces, does not duplicate", () => {
      const m = new ${cls}();
      m.set(NaN, ${v1});
      m.set(NaN, ${v2});
      m.set(NaN, ${v3});
      expect(m.size).toBe(1);
      expect(m.get(NaN)).toBe(${v3});
    });
    it("NaN key remove works", () => {
      const m = new ${cls}();
      m.set(NaN, ${v1});
      const removed = m.remove(NaN);
      expect(removed).toBe(${v1});
      expect(m.size).toBe(0);
      expect(m.has(NaN)).toBe(false);
    });
    it("-0.0 is distinct from +0.0", () => {
      const m = new ${cls}();
      m.set(0.0, ${v1});
      m.set(-0.0, ${v2});
      expect(m.size).toBe(2);
      expect(m.get(0.0)).toBe(${v1});
      expect(m.get(-0.0)).toBe(${v2});
    });
    it("+/-Infinity keys", () => {
      const m = new ${cls}();
      m.set(Number.POSITIVE_INFINITY, ${v1});
      m.set(Number.NEGATIVE_INFINITY, ${v2});
      expect(m.size).toBe(2);
      expect(m.get(Number.POSITIVE_INFINITY)).toBe(${v1});
      expect(m.get(Number.NEGATIVE_INFINITY)).toBe(${v2});
    });
  });`;
}

/**
 * Build the full <k>-<v>-hash-map.generated.test.ts for one (key,val) pair.
 * @param {{key: import('./spec.mjs').Prim, val: import('./spec.mjs').Prim}} pair
 * @param {string} command  the regenerate command, embedded in the banner.
 */
export function renderTest({ key, val }, command) {
  const cls = className(key, val);
  const file = sourceFileName(key, val).replace(/\.ts$/, ".js");
  const k1 = keyLit(key, 1);
  const k2 = keyLit(key, 2);
  const k3 = keyLit(key, 3);
  const k99 = keyLit(key, 99);
  const v1 = valLit(val, 1);
  const v2 = valLit(val, 2);
  const v3 = valLit(val, 3);
  const v0 = valLit(val, 0);

  return `${LICENSE}${generatedHeader(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./${file}";

describe("${cls} generated", () => {
  it("set and get", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    m.set(${k3}, ${v3});
    expect(m.get(${k1})).toBe(${v1});
    expect(m.get(${k99})).toBeUndefined();
    expect(m.size).toBe(3);
  });
  it("set overwrite", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    expect(m.set(${k1}, ${v2})).toBe(m); // set returns the map for chaining
    expect(m.get(${k1})).toBe(${v2});
  });
  it("remove", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    expect(m.remove(${k1})).toBe(${v1});
    expect(m.size).toBe(1);
    expect(m.has(${k1})).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    expect(m.getOrDefault(${k1}, ${v3})).toBe(${v1});
    expect(m.getOrDefault(${k99}, ${v3})).toBe(${v3});
  });
  it("isEmpty and clear", () => {
    const m = new ${cls}();
    expect(m.isEmpty()).toBe(true);
    m.set(${k1}, ${v1});
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    m.set(${k3}, ${v3});
    expect(m.select((_k, v) => v > ${v1}).size).toBe(2);
  });
  it("anySatisfy / allSatisfy", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    expect(m.anySatisfy((_k, v) => v === ${v2})).toBe(true);
    expect(m.allSatisfy((_k, v) => v > ${v0})).toBe(true);
  });
  it("resize", () => {
    const m = new ${cls}();
${resizeLoop(key, val)}
    expect(m.size).toBe(100);
  });
  it("memoryBytes", () => {
    const m = new ${cls}(64);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    expect(m.toString()).not.toBe("");
  });${key.kind === "float" ? floatKeyEdgeCases(cls, (n) => valLit(val, n)) : ""}
});
`;
}
