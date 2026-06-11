// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// ---------------------------------------------------------------------------
// Templates for the NON-TYPED number/bigint K×V map families (phase 6b-3):
//   hashmap   src/hashmap/   <k>-<v>-hash-map.ts + .generated.test.ts (4 pairs)
//   bimap     src/hashmap/   <k>-<v>-hash-bi-map.ts                   (4 pairs)
//   immutable src/hashmap/   immutable-<k>-<v>-hash-map.ts + test     (4 pairs)
//   multimap  src/multimap/  <k>-<v>-{list,set}-multimap.ts           (8 files)
//
// These are backed by PLAIN Array open-addressing (hashmap) or a JS Map
// (bimap / immutable delegate / multimap) — NOT TypedArray. The type axis here
// is {number, bigint} ONLY. The object-keyed maps in the same directories are a
// DIFFERENT (Map-backed identity) implementation and are NOT generated here.
//
// Pure string builders parameterised only by the per-PRIM metadata below; no
// branching on a type NAME. Canonical hash-seed helpers (f64HashSeed for number,
// bigintHashSeed for bigint) are imported BY NAME — never inlined.
//
// Per-type behavioural nuances folded in (NOT pure type substitution), so
// regeneration reproduces the committed files verbatim:
//
//   * hashmap key-import LAYOUT differs by key kind: a number key places its
//     `import { f64HashSeed }` BEFORE the `import type { MapDbMutableMap }`
//     (each on its own line, separated by blanks); a bigint key places the
//     `import type` first with `import { bigintHashSeed }` adjacent below it.
//   * hashmap `hashKey()` seed = f64HashSeed(key) | bigintHashSeed(key) (NO
//     `| 0` — that suffix is a TYPED-family detail; the non-typed maps fold the
//     sign with `h < 0 ? -h : h` instead of `>>> 0`).
//   * bimap `inverse()` returns the V×K-swapped bimap class. When K !== V that
//     class differs from `this`, so a sibling import is emitted; when K === V it
//     IS `this` and no import is added.
//   * multimap STRUCTURE switches on KEY kind: a number key uses the
//     `mapKeyOf`/`NEG_ZERO_KEY` tuple machinery (so -0/+0 keys stay distinct);
//     a bigint key uses a plain `Map<bigint, V[]>` (no -0 problem). Within each
//     key-branch the VALUE type is pure substitution. The value EQUALITY helper
//     follows kind: number values compare with `Object.is`, bigint values with
//     `===`/`!==` (in `equals` it tracks VALUE kind; in `containsKeyValue` and
//     the set-dedup it tracks KEY kind — both reproduced exactly).
//   * list vs set multimap differ only in the `set()` body (set dedups) and the
//     class / "list of"/"set of unique" doc wording.
// ---------------------------------------------------------------------------

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

/**
 * The two non-typed primitives.
 *
 * @typedef {Object} NonTypedPrim
 * @property {string} id     kebab token in file names ("number" | "bigint").
 * @property {string} name   PascalCase token in class names ("Number" | "BigInt").
 * @property {"number"|"bigint"} tsType  the TS scalar type.
 * @property {"float"|"bigint"} kind  number keys hash via f64HashSeed (the same
 *           canonical IEEE-754 seed the float-keyed typed maps use); bigint keys
 *           via bigintHashSeed.
 * @property {string} zero   the zero literal for array fills ("0" | "0n").
 * @property {{name: string, from: string}} hashImport  the seed-helper import
 *           (BY NAME), relative to src/hashmap/.
 */

/** @type {NonTypedPrim[]} */
export const NONTYPED_PRIMS = [
  {
    id: "number",
    name: "Number",
    tsType: "number",
    kind: "float",
    zero: "0",
    hashImport: { name: "f64HashSeed", from: "../internal/float-order.js" },
  },
  {
    id: "bigint",
    name: "BigInt",
    tsType: "bigint",
    kind: "bigint",
    zero: "0n",
    hashImport: { name: "bigintHashSeed", from: "../internal/hash.js" },
  },
];

/** All 4 (key, value) pairs in committed file order (number before bigint). */
export function nonTypedPairs() {
  const out = [];
  for (const key of NONTYPED_PRIMS) {
    for (const val of NONTYPED_PRIMS) {
      out.push({ key, val });
    }
  }
  return out;
}

/** Literal for a value of this primitive: bigint gets the `n` suffix. */
function lit(prim, n) {
  return prim.tsType === "bigint" ? `${n}n` : `${n}`;
}

/** `a !== b` style inequality term for a value of this primitive's kind. */
function neqExpr(prim, a, b) {
  return prim.tsType === "bigint" ? `${a} !== ${b}` : `!Object.is(${a}, ${b})`;
}

// ===========================================================================
// HASH MAP  (src/hashmap/<k>-<v>-hash-map.ts)
// ===========================================================================

export function hashMapSourceFileName({ key, val }) {
  return `${key.id}-${val.id}-hash-map.ts`;
}
export function hashMapTestFileName({ key, val }) {
  return `${key.id}-${val.id}-hash-map.generated.test.ts`;
}
export function hashMapClassName({ key, val }) {
  return `${key.name}${val.name}HashMap`;
}

// The committed key-import layout depends on the KEY kind (reproduced exactly):
//   number key (float):  <blank> import { f64HashSeed } <blank>
//                        import type { MapDbMutableMap } <blank>
//   bigint key:          <blank> import type { MapDbMutableMap }
//                        import { bigintHashSeed } <blank>
function hashMapImports(key) {
  const helper = `import { ${key.hashImport.name} } from "${key.hashImport.from}";`;
  const typeImport = `import type { MapDbMutableMap } from "../api/index.js";`;
  if (key.kind === "float") {
    return `\n${helper}\n\n${typeImport}\n`;
  }
  return `\n${typeImport}\n${helper}\n`;
}

export function renderHashMap(pair, command) {
  const { key, val } = pair;
  const cls = hashMapClassName(pair);
  const K = key.tsType;
  const V = val.tsType;
  const KZ = key.zero;
  const VZ = val.zero;
  const seed = `${key.hashImport.name}(key)`;

  return `${LICENSE}${banner(command)}${hashMapImports(key)}
const DEFAULT_CAPACITY = 16;
const LOAD_FACTOR = 0.75;

/**
 * Open-addressing hash map with ${K} keys and ${V} values.
 * Uses a bitmap (occupied array) to track which slots contain data.
 */
export class ${cls} implements MapDbMutableMap<${K}, ${V}> {
  private keys: ${K}[];
  private values: ${V}[];
  private occupied: boolean[];
  private _size: number;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    const cap = nextPowerOfTwo(capacity);
    this.keys = new Array<${K}>(cap).fill(${KZ});
    this.values = new Array<${V}>(cap).fill(${VZ});
    this.occupied = new Array<boolean>(cap).fill(false);
    this._size = 0;
  }

  /** Creates a new map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of(pairs: [${K}, ${V}][]): ${cls} {
    const m = new ${cls}(pairs.length * 2);
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return m;
  }

  /** Inserts or updates a key-value pair. Returns the map for chaining, like JS Map.set. */
  set(key: ${K}, value: ${V}): this {
    if (this.needsResize()) {
      this.resize();
    }
    const cap = this.keys.length;
    const mask = cap - 1;
    let idx = this.hashKey(key) & mask;

    while (true) {
      if (!this.occupied[idx]) {
        this.keys[idx] = key;
        this.values[idx] = value;
        this.occupied[idx] = true;
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

  /** Returns the value for the key, or undefined if not found. */
  get(key: ${K}): ${V} | undefined {
    const cap = this.keys.length;
    if (cap === 0) return undefined;
    const mask = cap - 1;
    let idx = this.hashKey(key) & mask;

    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) return this.values[idx];
      idx = (idx + 1) & mask;
    }
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: ${K}, defaultValue: ${V}): ${V} {
    const v = this.get(key);
    return v !== undefined ? v : defaultValue;
  }

  /** Removes the entry for the key. Returns the previous value or undefined. */
  remove(key: ${K}): ${V} | undefined {
    const cap = this.keys.length;
    if (cap === 0) return undefined;
    const mask = cap - 1;
    let idx = this.hashKey(key) & mask;

    while (true) {
      if (!this.occupied[idx]) return undefined;
      if (Object.is(this.keys[idx], key)) {
        const old = this.values[idx];
        this.occupied[idx] = false;
        this.keys[idx] = ${KZ};
        this.values[idx] = ${VZ};
        this._size--;
        this.rehashFrom(idx, mask);
        return old;
      }
      idx = (idx + 1) & mask;
    }
  }

  /** Returns true if the map contains the key. */
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

  /** Removes all entries. */
  clear(): void {
    this.keys.fill(${KZ});
    this.values.fill(${VZ});
    this.occupied.fill(false);
    this._size = 0;
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[${K}, ${V}]> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        yield [this.keys[i], this.values[i]];
      }
    }
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[${K}, ${V}]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<${K}> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        yield this.keys[i];
      }
    }
  }

  /** Yields all values. */
  *valuesIter(): Generator<${V}> {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        yield this.values[i];
      }
    }
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: ${K}, value: ${V}) => void): void {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        f(this.keys[i], this.values[i]);
      }
    }
  }

  /** Returns a new map with entries satisfying the predicate. */
  select(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns a new map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    const result = new ${cls}();
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        result.set(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && predicate(this.keys[i], this.values[i])) {
        return true;
      }
    }
    return false;
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        return false;
      }
    }
    return true;
  }

  /** Performs a left fold over all entries. */
  injectInto<R>(initial: R, f: (acc: R, key: ${K}, value: ${V}) => R): R {
    let result = initial;
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        result = f(result, this.keys[i], this.values[i]);
      }
    }
    return result;
  }

  /** Returns all keys as an array. */
  keysToArray(): ${K}[] {
    const result: ${K}[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) result.push(this.keys[i]);
    }
    return result;
  }

  /** Returns all values as an array. */
  valuesToArray(): ${V}[] {
    const result: ${V}[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) result.push(this.values[i]);
    }
    return result;
  }

  /** Adds amount to the value for the key. If absent, inserts amount. Returns new value. */
  addToValue(key: ${K}, amount: ${V}): ${V} {
    const existing = this.get(key);
    const newVal =
      existing !== undefined ? ((existing + amount) as ${V}) : amount;
    this.set(key, newVal);
    return newVal;
  }

  /** Updates the value for the key. If absent, applies f to initialValue. Returns new value. */
  updateValue(
    key: ${K},
    initialValue: ${V},
    f: (value: ${V}) => ${V},
  ): ${V} {
    const existing = this.get(key);
    const newVal = f(existing !== undefined ? existing : initialValue);
    this.set(key, newVal);
    return newVal;
  }

  /** Fluent set. Returns this for chaining. */
  withKeyValue(key: ${K}, value: ${V}): this {
    this.set(key, value);
    return this;
  }

  /** Fluent remove. Returns this for chaining. */
  withoutKey(key: ${K}): this {
    this.remove(key);
    return this;
  }

  /** Returns a string representation. */
  toString(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.occupied.length; i++) {
      if (this.occupied[i]) {
        parts.push(\`\${this.keys[i]}: \${this.values[i]}\`);
      }
    }
    return \`{\${parts.join(", ")}}\`;
  }

  private hashKey(key: ${K}): number {
    let h = ${seed};
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (((h >> 16) ^ h) * 0x45d9f3b) | 0;
    h = (h >> 16) ^ h;
    return h < 0 ? -h : h;
  }

  private needsResize(): boolean {
    return this._size + 1 >= this.keys.length * LOAD_FACTOR;
  }

  private resize(): void {
    const oldKeys = this.keys;
    const oldValues = this.values;
    const oldOccupied = this.occupied;
    const newCap = oldKeys.length * 2;
    this.keys = new Array<${K}>(newCap).fill(${KZ});
    this.values = new Array<${V}>(newCap).fill(${VZ});
    this.occupied = new Array<boolean>(newCap).fill(false);
    this._size = 0;
    for (let i = 0; i < oldOccupied.length; i++) {
      if (oldOccupied[i]) {
        this.set(oldKeys[i], oldValues[i]);
      }
    }
  }

  private rehashFrom(deleted: number, mask: number): void {
    const cap = this.keys.length;
    let idx = (deleted + 1) & mask;
    while (this.occupied[idx]) {
      const ideal = this.hashKey(this.keys[idx]) & mask;
      const distCurrent = (idx - ideal + cap) & mask;
      const distGap = (deleted - ideal + cap) & mask;
      if (distCurrent > distGap) {
        this.keys[deleted] = this.keys[idx];
        this.values[deleted] = this.values[idx];
        this.occupied[deleted] = true;
        this.occupied[idx] = false;
        this.keys[idx] = ${KZ};
        this.values[idx] = ${VZ};
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
// HASH MAP — test
// ---------------------------------------------------------------------------

// number-key IEEE-754 edge-case regression block — phase-3 coverage that lived
// inline in the committed number-key test files. Emitted ONLY for number keys
// (f64HashSeed + Object.is keying), value literals follow the value type.
function hashMapFloatEdge(cls, vLit) {
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

// resize loop body — same number/bigint adaptation the typed hashmap test uses.
function hashMapResizeLoop(key, val) {
  const keyIsBig = key.tsType === "bigint";
  const valIsBig = val.tsType === "bigint";
  const head = keyIsBig
    ? "for (let i = 0n; i < 100n; i += 1n)"
    : "for (let i = 0; i < 100; i += 1)";
  let iAsVal;
  if (keyIsBig === valIsBig) {
    iAsVal = "i";
  } else if (valIsBig) {
    iAsVal = "BigInt(i)";
  } else {
    iAsVal = "Number(i)";
  }
  const ten = valIsBig ? "10n" : "10";
  return `    ${head} m.set(i, ${iAsVal} * ${ten});`;
}

export function renderHashMapTest(pair, command) {
  const { key, val } = pair;
  const cls = hashMapClassName(pair);
  const file = hashMapSourceFileName(pair).replace(/\.ts$/, ".js");
  const k1 = lit(key, 1);
  const k2 = lit(key, 2);
  const k99 = lit(key, 99);
  const v1 = lit(val, 1);
  const v2 = lit(val, 2);
  const v3 = lit(val, 3);
  const edge =
    key.kind === "float" ? hashMapFloatEdge(cls, (n) => lit(val, n)) : "";

  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${cls} } from "./${file}";

describe("${cls} generated", () => {
  it("set and get", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    m.set(${lit(key, 3)}, ${v3});
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
    const old = m.remove(${k1});
    expect(old).toBe(${v1});
    expect(m.size).toBe(1);
    expect(m.has(${k1})).toBe(false);
  });
  it("has", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    expect(m.has(${k1})).toBe(true);
    expect(m.has(${k99})).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    expect(m.getOrDefault(${k1}, ${v3})).toBe(${v1});
    expect(m.getOrDefault(${k99}, ${v3})).toBe(${v3});
  });
  it("clear and isEmpty", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select and reject", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    m.set(${lit(key, 3)}, ${v3});
    expect(m.select((_k, v) => v > ${v1}).size).toBe(2);
    expect(m.reject((_k, v) => v > ${v1}).size).toBe(1);
  });
  it("entries generator", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    expect([...m.entries()].length).toBe(2);
  });
  it("keysToArray and valuesToArray", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    expect(m.keysToArray().length).toBe(2);
    expect(m.valuesToArray().length).toBe(2);
  });
  it("injectInto", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    m.set(${k2}, ${v2});
    const sum = m.injectInto(${lit(val, 0)}, (acc, _k, v) => acc + v);
    expect(sum).toBe(${v1} + ${v2});
  });
  it("resize", () => {
    const m = new ${cls}();
${hashMapResizeLoop(key, val)}
    expect(m.size).toBe(100);
  });
  it("toString", () => {
    const m = new ${cls}();
    m.set(${k1}, ${v1});
    expect(m.toString()).not.toBe("");
  });${edge}
});
`;
}

// ===========================================================================
// HASH BI-MAP  (src/hashmap/<k>-<v>-hash-bi-map.ts)  — NO generated test
// ===========================================================================

export function biMapSourceFileName({ key, val }) {
  return `${key.id}-${val.id}-hash-bi-map.ts`;
}
export function biMapClassName({ key, val }) {
  return `${key.name}${val.name}HashBiMap`;
}
// The swapped (inverse) bimap class for an (key,val) pair is the (val,key) one.
function biMapInverseClassName({ key, val }) {
  return `${val.name}${key.name}HashBiMap`;
}
function biMapInverseFileName({ key, val }) {
  return `${val.id}-${key.id}-hash-bi-map.js`;
}

export function renderBiMap(pair, command) {
  const { key, val } = pair;
  const cls = biMapClassName(pair);
  const inv = biMapInverseClassName(pair);
  const K = key.tsType;
  const V = val.tsType;

  // Committed header layout (banner replaces no content; HEAD is pre-banner):
  //   same key/value: <blank> <blank> /**   (inverse() returns `this` class —
  //                   no import)
  //   mixed key/value: <blank> <blank> import { Inverse } /**  (import sits
  //                   directly above the doc comment, no blank between)
  const imports =
    cls === inv
      ? `\n\n`
      : `\n\nimport { ${inv} } from "./${biMapInverseFileName(pair)}";\n`;

  return `${LICENSE}${banner(command)}${imports}/**
 * Bidirectional hash map from ${K} keys to ${V} values.
 * Both key->value and value->key lookups are O(1).
 * Each key maps to exactly one value and each value maps to exactly one key.
 * Inserting a duplicate key OR value replaces the existing mapping.
 */
export class ${cls} {
  private _forward: Map<${K}, ${V}>;
  private _inverse: Map<${V}, ${K}>;

  constructor() {
    this._forward = new Map<${K}, ${V}>();
    this._inverse = new Map<${V}, ${K}>();
  }

  /** Creates a new empty BiMap. */
  static of(): ${cls} {
    return new ${cls}();
  }

  /**
   * Inserts a key-value pair into the bi-map.
   * If the key already existed, the old value mapping is removed.
   * If the value already existed, the old key mapping is removed.
   */
  set(key: ${K}, value: ${V}): this {
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
  get(key: ${K}): ${V} | undefined {
    return this._forward.get(key);
  }

  /** Inverse lookup: returns the key for the given value, or undefined. */
  getKey(value: ${V}): ${K} | undefined {
    return this._inverse.get(value);
  }

  /** Returns true if the map contains the given key. */
  has(key: ${K}): boolean {
    return this._forward.has(key);
  }

  /** Returns true if the map contains the given value. */
  containsValue(value: ${V}): boolean {
    return this._inverse.has(value);
  }

  /**
   * Removes the entry for the given key.
   * Returns the old value, or undefined if the key was not present.
   */
  removeKey(key: ${K}): ${V} | undefined {
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
  removeValue(value: ${V}): ${K} | undefined {
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
  keys(): ${K}[] {
    return Array.from(this._forward.keys());
  }

  /** Returns all values as an array. */
  values(): ${V}[] {
    return Array.from(this._forward.values());
  }

  /** Calls the function for each key-value pair. */
  forEach(fn: (key: ${K}, value: ${V}) => void): void {
    this._forward.forEach((value, key) => {
      fn(key, value);
    });
  }

  /** Returns all entries as an array of [key, value] tuples. */
  toArray(): [${K}, ${V}][] {
    return Array.from(this._forward.entries());
  }

  /** Returns a new BiMap with key and value types swapped. */
  inverse(): ${inv} {
    const result = new ${inv}();
    this._forward.forEach((value, key) => {
      result.set(value, key);
    });
    return result;
  }

  /** Returns true if this bi-map contains the same entries as the other. */
  equals(other: ${cls}): boolean {
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
      parts.push(\`\${key}=\${value}\`);
    });
    return \`{\${parts.join(", ")}}\`;
  }

  /** Yields [key, value] tuples. */
  *[Symbol.iterator](): Generator<[${K}, ${V}]> {
    for (const entry of this._forward) {
      yield entry;
    }
  }
}
`;
}

// ===========================================================================
// IMMUTABLE HASH MAP  (src/hashmap/immutable-<k>-<v>-hash-map.ts) + test
// ===========================================================================

export function immMapSourceFileName({ key, val }) {
  return `immutable-${key.id}-${val.id}-hash-map.ts`;
}
export function immMapTestFileName({ key, val }) {
  return `immutable-${key.id}-${val.id}-hash-map.generated.test.ts`;
}
export function immMapClassName(pair) {
  return `Immutable${hashMapClassName(pair)}`;
}

export function renderImmutableMap(pair, command) {
  const { key, val } = pair;
  const cls = immMapClassName(pair);
  const mut = hashMapClassName(pair);
  const K = key.tsType;
  const V = val.tsType;
  const mutFile = hashMapSourceFileName(pair).replace(/\.ts$/, ".js");

  return `${LICENSE}${banner(command)}
import type { MapDbMap } from "../api/index.js";
import { ${mut} } from "./${mutFile}";

/**
 * Immutable hash map with ${K} keys and ${V} values.
 * Wraps a mutable ${mut}, exposing only read-only operations.
 */
export class ${cls} implements MapDbMap<${K}, ${V}> {
  private readonly delegate: ${mut};

  constructor(source: ${mut}) {
    // Copy all entries into a fresh mutable map so the caller cannot mutate our data.
    this.delegate = new ${mut}();
    for (const [k, v] of source.entries()) {
      this.delegate.set(k, v);
    }
  }

  /** Creates an immutable map from key-value pairs: [[k1, v1], [k2, v2], ...] */
  static of(pairs: [${K}, ${V}][]): ${cls} {
    const m = new ${mut}(pairs.length * 2);
    for (const [k, v] of pairs) {
      m.set(k, v);
    }
    return new ${cls}(m);
  }

  /** Returns the value for the key, or undefined if not found. */
  get(key: ${K}): ${V} | undefined {
    return this.delegate.get(key);
  }

  /** Returns the value for the key, or the default value if not found. */
  getOrDefault(key: ${K}, defaultValue: ${V}): ${V} {
    return this.delegate.getOrDefault(key, defaultValue);
  }

  /** Returns true if the map contains the key. */
  has(key: ${K}): boolean {
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
  *entries(): Generator<[${K}, ${V}]> {
    yield* this.delegate.entries();
  }

  /** Yields [key, value] pairs (delegates to {@link entries}), so the map is
   * spreadable and for-of-iterable like a JS Map. */
  [Symbol.iterator](): Generator<[${K}, ${V}]> {
    return this.entries();
  }

  /** Yields all keys. */
  *keysIter(): Generator<${K}> {
    yield* this.delegate.keysIter();
  }

  /** Yields all values. */
  *valuesIter(): Generator<${V}> {
    yield* this.delegate.valuesIter();
  }

  /** Calls the function for each key-value pair. */
  forEach(f: (key: ${K}, value: ${V}) => void): void {
    this.delegate.forEach(f);
  }

  /** Returns a new immutable map with entries satisfying the predicate. */
  select(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    return new ${cls}(this.delegate.select(predicate));
  }

  /** Returns a new immutable map with entries NOT satisfying the predicate. */
  reject(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    return new ${cls}(this.delegate.reject(predicate));
  }

  /** Returns true if any entry satisfies the predicate. */
  anySatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    return this.delegate.anySatisfy(predicate);
  }

  /** Returns true if all entries satisfy the predicate. */
  allSatisfy(predicate: (key: ${K}, value: ${V}) => boolean): boolean {
    return this.delegate.allSatisfy(predicate);
  }

  /** Performs a left fold over all entries. */
  injectInto<R>(initial: R, f: (acc: R, key: ${K}, value: ${V}) => R): R {
    return this.delegate.injectInto(initial, f);
  }

  /** Returns all keys as an array. */
  keysToArray(): ${K}[] {
    return this.delegate.keysToArray();
  }

  /** Returns all values as an array. */
  valuesToArray(): ${V}[] {
    return this.delegate.valuesToArray();
  }

  /** Returns a new mutable copy of this map. */
  toMutable(): ${mut} {
    const m = new ${mut}();
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
`;
}

export function renderImmutableMapTest(pair, command) {
  const { key, val } = pair;
  const cls = immMapClassName(pair);
  const mut = hashMapClassName(pair);
  const mutFile = hashMapSourceFileName(pair).replace(/\.ts$/, ".js");
  const immFile = immMapSourceFileName(pair).replace(/\.ts$/, ".js");
  const k1 = lit(key, 1);
  const k2 = lit(key, 2);
  const k3 = lit(key, 3);
  const k99 = lit(key, 99);
  const v1 = lit(val, 1);
  const v2 = lit(val, 2);
  const v3 = lit(val, 3);

  return `${LICENSE}${banner(command)}

import { describe, it, expect } from "vitest";
import { ${mut} } from "./${mutFile}";
import { ${cls} } from "./${immFile}";

describe("${cls} generated", () => {
  it("get and size", () => {
    const im = ${cls}.of([
      [${k1}, ${v1}],
      [${k2}, ${v2}],
    ]);
    expect(im.size).toBe(2);
    expect(im.get(${k1})).toBe(${v1});
    expect(im.get(${k99})).toBeUndefined();
  });
  it("has", () => {
    const im = ${cls}.of([[${k1}, ${v1}]]);
    expect(im.has(${k1})).toBe(true);
    expect(im.has(${k99})).toBe(false);
  });
  it("select", () => {
    const im = ${cls}.of([
      [${k1}, ${v1}],
      [${k2}, ${v2}],
      [${k3}, ${v3}],
    ]);
    expect(im.select((_k, v) => v > ${v1}).size).toBe(2);
  });
  it("toMutable does not affect immutable", () => {
    const im = ${cls}.of([[${k1}, ${v1}]]);
    im.toMutable().set(${k2}, ${v2});
    expect(im.size).toBe(1);
  });
});
`;
}

// ===========================================================================
// MULTIMAP  (src/multimap/<k>-<v>-{list,set}-multimap.ts)  — NO generated test
// ===========================================================================

export function multimapSourceFileName({ key, val }, variant) {
  return `${key.id}-${val.id}-${variant}-multimap.ts`;
}
export function multimapClassName({ key, val }, variant) {
  const V = variant === "list" ? "List" : "Set";
  return `${key.name}${val.name}${V}Multimap`;
}

// set() body — the ONLY structural difference between list (append) and set
// (dedup-then-append). The number-key branch carries the mapKeyOf tuple; the
// bigint-key branch a direct Map. `eq` is the per-key-kind value comparator.
function multimapPutBody(key, variant) {
  const numberKey = key.kind === "float";
  const eq = numberKey ? "Object.is(list[i], value)" : "list[i] === value";
  if (numberKey) {
    if (variant === "list") {
      return `    const mk = mapKeyOf(key);
    const entry = this._map.get(mk);
    if (entry !== undefined) {
      entry[1].push(value);
    } else {
      this._map.set(mk, [key, [value]]);
    }
    this._totalSize++;
    return this;`;
    }
    return `    const mk = mapKeyOf(key);
    const entry = this._map.get(mk);
    if (entry !== undefined) {
      const list = entry[1];
      for (let i = 0; i < list.length; i++) {
        if (${eq}) return this;
      }
      list.push(value);
    } else {
      this._map.set(mk, [key, [value]]);
    }
    this._totalSize++;
    return this;`;
  }
  // bigint key
  if (variant === "list") {
    return `    const list = this._map.get(key);
    if (list !== undefined) {
      list.push(value);
    } else {
      this._map.set(key, [value]);
    }
    this._totalSize++;
    return this;`;
  }
  return `    const list = this._map.get(key);
    if (list !== undefined) {
      for (let i = 0; i < list.length; i++) {
        if (${eq}) return this;
      }
      list.push(value);
    } else {
      this._map.set(key, [value]);
    }
    this._totalSize++;
    return this;`;
}

// The number-key multimap stores `Map<MapKey, [key, values]>` tuples so -0/+0
// keys stay distinct (via mapKeyOf); the bigint-key one stores a plain
// `Map<bigint, values>`. Each method body therefore has two committed shapes.
function renderNumberKeyMultimap(pair, variant, command, cls, K, V) {
  const eqKV = `Object.is(list[i], value)`; // containsKeyValue: KEY-kind = number
  // equals value-compare: in the number-key branch it follows the VALUE kind —
  // number values dedup with Object.is (NaN/-0 aware), bigint values with !==.
  const eqEquals = neqExpr(pair.val, "list[i]", "otherList[i]");
  const putBody = multimapPutBody(pair.key, variant);
  const doc =
    variant === "list"
      ? `/**
 * A multimap that maps ${K} keys to lists of ${V} values.
 * Backed by a JavaScript Map from key to array of values.
 */`
      : `/**
 * A multimap that maps ${K} keys to sets of unique ${V} values.
 * Backed by a JavaScript Map from key to array of values (duplicates on set are silently dropped).
 */`;
  const putDoc =
    variant === "list"
      ? `  /** Adds a value under the given key. */`
      : `  /** Adds a value under the given key. Idempotent: a duplicate value for the same key is silently dropped. */`;

  return `${LICENSE}${banner(command)}
import { mapKeyOf, NEG_ZERO_KEY } from "../internal/float-order.js";

type MapKey = ${K} | typeof NEG_ZERO_KEY;

${doc}
export class ${cls} {
  // keyed via mapKeyOf so -0 and +0 are distinct; tuple stores the
  // original key alongside its value list.
  private _map: Map<MapKey, [${K}, ${V}[]]>;
  private _totalSize: number;

  constructor() {
    this._map = new Map<MapKey, [${K}, ${V}[]]>();
    this._totalSize = 0;
  }

  /** Creates a new empty multimap. */
  static of(): ${cls} {
    return new ${cls}();
  }

${putDoc}
  set(key: ${K}, value: ${V}): this {
${putBody}
  }

  /** Returns a copy of the values for the key as a readonly array. Returns an empty array if the key is absent. */
  get(key: ${K}): readonly ${V}[] {
    const entry = this._map.get(mapKeyOf(key));
    return entry !== undefined ? entry[1].slice() : [];
  }

  /** Returns the number of values for the given key. */
  getCount(key: ${K}): number {
    const entry = this._map.get(mapKeyOf(key));
    return entry !== undefined ? entry[1].length : 0;
  }

  /** Removes all values for the key and returns them. Returns an empty array if the key is absent. */
  removeAll(key: ${K}): ${V}[] {
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
  has(key: ${K}): boolean {
    return this._map.has(mapKeyOf(key));
  }

  /** Returns true if the multimap contains the given key-value pair. */
  containsKeyValue(key: ${K}, value: ${V}): boolean {
    const entry = this._map.get(mapKeyOf(key));
    if (entry === undefined) return false;
    const list = entry[1];
    for (let i = 0; i < list.length; i++) {
      if (${eqKV}) return true;
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
  forEach(fn: (key: ${K}, value: ${V}) => void): void {
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        fn(key, list[i]);
      }
    }
  }

  /** Calls the function for each key with a copy of its associated list of values. */
  forEachKey(fn: (key: ${K}, values: readonly ${V}[]) => void): void {
    for (const [key, list] of this._map.values()) {
      fn(key, list.slice());
    }
  }

  /** Returns a new multimap containing only the key-value pairs that satisfy the predicate. */
  select(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    const result = new ${cls}();
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        if (predicate(key, list[i])) {
          result.set(key, list[i]);
        }
      }
    }
    return result;
  }

  /** Returns a new multimap containing only the key-value pairs that do NOT satisfy the predicate. */
  reject(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    const result = new ${cls}();
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        if (!predicate(key, list[i])) {
          result.set(key, list[i]);
        }
      }
    }
    return result;
  }

  /** Returns an array of all distinct keys. */
  uniqueKeys(): ${K}[] {
    return Array.from(this._map.values(), ([key]) => key);
  }

  /** Returns an array of all values across all keys. */
  values(): ${V}[] {
    const result: ${V}[] = [];
    for (const [, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        result.push(list[i]);
      }
    }
    return result;
  }

  /** Returns all key-value pairs as an array of tuples. */
  toArray(): [${K}, ${V}][] {
    const result: [${K}, ${V}][] = [];
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
      parts.push(\`\${key}: [\${list.join(", ")}]\`);
    }
    return \`{\${parts.join(", ")}}\`;
  }

  /** Returns true if this multimap has the same entries as the other multimap. */
  equals(other: ${cls}): boolean {
    if (this._totalSize !== other._totalSize) return false;
    if (this._map.size !== other._map.size) return false;
    for (const [mk, [, list]] of this._map) {
      const otherEntry = other._map.get(mk);
      if (otherEntry === undefined) return false;
      const otherList = otherEntry[1];
      if (list.length !== otherList.length) return false;
      for (let i = 0; i < list.length; i++) {
        if (${eqEquals}) return false;
      }
    }
    return true;
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *[Symbol.iterator](): Generator<[${K}, ${V}]> {
    for (const [key, list] of this._map.values()) {
      for (let i = 0; i < list.length; i++) {
        yield [key, list[i]];
      }
    }
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[${K}, ${V}]> {
    yield* this[Symbol.iterator]();
  }
}
`;
}

function renderBigIntKeyMultimap(pair, variant, command, cls, K, V) {
  const eqKV = `list[i] === value`; // containsKeyValue: KEY-kind = bigint
  // equals value-compare: the bigint-key branch ALWAYS uses !== (matches all
  // committed bigint-key files, regardless of value type).
  const eqEquals = `list[i] !== otherList[i]`;
  const putBody = multimapPutBody(pair.key, variant);
  const doc =
    variant === "list"
      ? `/**
 * A multimap that maps ${K} keys to lists of ${V} values.
 * Backed by a JavaScript Map from key to array of values.
 */`
      : `/**
 * A multimap that maps ${K} keys to sets of unique ${V} values.
 * Backed by a JavaScript Map from key to array of values (duplicates on set are silently dropped).
 */`;
  const putDoc =
    variant === "list"
      ? `  /** Adds a value under the given key. */`
      : `  /** Adds a value under the given key. Idempotent: a duplicate value for the same key is silently dropped. */`;

  return `${LICENSE}${banner(command)}
${doc}
export class ${cls} {
  private _map: Map<${K}, ${V}[]>;
  private _totalSize: number;

  constructor() {
    this._map = new Map<${K}, ${V}[]>();
    this._totalSize = 0;
  }

  /** Creates a new empty multimap. */
  static of(): ${cls} {
    return new ${cls}();
  }

${putDoc}
  set(key: ${K}, value: ${V}): this {
${putBody}
  }

  /** Returns a copy of the values for the key as a readonly array. Returns an empty array if the key is absent. */
  get(key: ${K}): readonly ${V}[] {
    const list = this._map.get(key);
    return list !== undefined ? list.slice() : [];
  }

  /** Returns the number of values for the given key. */
  getCount(key: ${K}): number {
    const list = this._map.get(key);
    return list !== undefined ? list.length : 0;
  }

  /** Removes all values for the key and returns them. Returns an empty array if the key is absent. */
  removeAll(key: ${K}): ${V}[] {
    const list = this._map.get(key);
    if (list === undefined) {
      return [];
    }
    this._map.delete(key);
    this._totalSize -= list.length;
    return list;
  }

  /** Returns true if the multimap contains the given key. */
  has(key: ${K}): boolean {
    return this._map.has(key);
  }

  /** Returns true if the multimap contains the given key-value pair. */
  containsKeyValue(key: ${K}, value: ${V}): boolean {
    const list = this._map.get(key);
    if (list === undefined) return false;
    for (let i = 0; i < list.length; i++) {
      if (${eqKV}) return true;
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
  forEach(fn: (key: ${K}, value: ${V}) => void): void {
    this._map.forEach((list, key) => {
      for (let i = 0; i < list.length; i++) {
        fn(key, list[i]);
      }
    });
  }

  /** Calls the function for each key with a copy of its associated list of values. */
  forEachKey(fn: (key: ${K}, values: readonly ${V}[]) => void): void {
    this._map.forEach((list, key) => {
      fn(key, list.slice());
    });
  }

  /** Returns a new multimap containing only the key-value pairs that satisfy the predicate. */
  select(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    const result = new ${cls}();
    this._map.forEach((list, key) => {
      for (let i = 0; i < list.length; i++) {
        if (predicate(key, list[i])) {
          result.set(key, list[i]);
        }
      }
    });
    return result;
  }

  /** Returns a new multimap containing only the key-value pairs that do NOT satisfy the predicate. */
  reject(
    predicate: (key: ${K}, value: ${V}) => boolean,
  ): ${cls} {
    const result = new ${cls}();
    this._map.forEach((list, key) => {
      for (let i = 0; i < list.length; i++) {
        if (!predicate(key, list[i])) {
          result.set(key, list[i]);
        }
      }
    });
    return result;
  }

  /** Returns an array of all distinct keys. */
  uniqueKeys(): ${K}[] {
    return Array.from(this._map.keys());
  }

  /** Returns an array of all values across all keys. */
  values(): ${V}[] {
    const result: ${V}[] = [];
    this._map.forEach((list) => {
      for (let i = 0; i < list.length; i++) {
        result.push(list[i]);
      }
    });
    return result;
  }

  /** Returns all key-value pairs as an array of tuples. */
  toArray(): [${K}, ${V}][] {
    const result: [${K}, ${V}][] = [];
    this._map.forEach((list, key) => {
      for (let i = 0; i < list.length; i++) {
        result.push([key, list[i]]);
      }
    });
    return result;
  }

  /** Returns a string representation of the multimap. */
  toString(): string {
    const parts: string[] = [];
    this._map.forEach((list, key) => {
      parts.push(\`\${key}: [\${list.join(", ")}]\`);
    });
    return \`{\${parts.join(", ")}}\`;
  }

  /** Returns true if this multimap has the same entries as the other multimap. */
  equals(other: ${cls}): boolean {
    if (this._totalSize !== other._totalSize) return false;
    if (this._map.size !== other._map.size) return false;
    for (const [key, list] of this._map) {
      const otherList = other._map.get(key);
      if (otherList === undefined) return false;
      if (list.length !== otherList.length) return false;
      for (let i = 0; i < list.length; i++) {
        if (${eqEquals}) return false;
      }
    }
    return true;
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *[Symbol.iterator](): Generator<[${K}, ${V}]> {
    for (const [key, list] of this._map) {
      for (let i = 0; i < list.length; i++) {
        yield [key, list[i]];
      }
    }
  }

  /** Yields all key-value pairs as [key, value] tuples. */
  *entries(): Generator<[${K}, ${V}]> {
    yield* this[Symbol.iterator]();
  }
}
`;
}

export function renderMultimap(pair, variant, command) {
  const cls = multimapClassName(pair, variant);
  const K = pair.key.tsType;
  const V = pair.val.tsType;
  return pair.key.kind === "float"
    ? renderNumberKeyMultimap(pair, variant, command, cls, K, V)
    : renderBigIntKeyMultimap(pair, variant, command, cls, K, V);
}
