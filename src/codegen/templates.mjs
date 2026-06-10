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

  // The committed files keep a fixed two-blank-line gap between the license
  // block and `const DEFAULT_CAPACITY`. When a key needs a hash helper, the
  // import occupies the FIRST of those two blank lines (license, blank, import,
  // blank, const); otherwise both lines stay blank (license, blank, blank,
  // const). Int keys import nothing. Reproduce that layout exactly.
  const preamble = keyHash.import
    ? `\nimport { ${keyHash.import.names.join(", ")} } from "${keyHash.import.from}";\n`
    : `\n`;

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

  put(key: ${K}, value: ${V}): ${V} | undefined {
    if (this.needsResize()) this.resize();
    const mask = this.capacity - 1;
    let idx = this.hash(key) & mask;
    while (true) {
      if (!this.occupied[idx]) {
        this.keys[idx] = key;
        this.values[idx] = value;
        this.occupied[idx] = 1;
        this._size++;
        return undefined;
      }
      if (Object.is(this.keys[idx], key)) {
        const old = this.values[idx];
        this.values[idx] = value;
        return old;
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

  containsKey(key: ${K}): boolean {
    return this.get(key) !== undefined;
  }
  size(): number {
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
        result.put(this.keys[i], this.values[i]);
      }
    }
    return result;
  }

${sig("reject")}
    const result = new ${cls}();
    for (let i = 0; i < this.capacity; i++) {
      if (this.occupied[i] && !predicate(this.keys[i], this.values[i])) {
        result.put(this.keys[i], this.values[i]);
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
    this.put(key, newVal);
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
      if (oldOccupied[i]) this.put(oldKeys[i], oldValues[i]);
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
 *   number key:  `for (let i = 0; i < 100; i += 1) m.put(i, <valExpr>);`
 *   bigint key:  `for (let i = 0n; i < 100n; i += 1n) m.put(i, <valExpr>);`
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
  return `    ${head} m.put(i, ${iAsVal} * ${ten});`;
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
      m.put(NaN, ${v1});
      expect(m.containsKey(NaN)).toBe(true);
      expect(m.get(NaN)).toBe(${v1});
      expect(m.size()).toBe(1);
    });
    it("NaN key replaces, does not duplicate", () => {
      const m = new ${cls}();
      m.put(NaN, ${v1});
      m.put(NaN, ${v2});
      m.put(NaN, ${v3});
      expect(m.size()).toBe(1);
      expect(m.get(NaN)).toBe(${v3});
    });
    it("NaN key remove works", () => {
      const m = new ${cls}();
      m.put(NaN, ${v1});
      const removed = m.remove(NaN);
      expect(removed).toBe(${v1});
      expect(m.size()).toBe(0);
      expect(m.containsKey(NaN)).toBe(false);
    });
    it("-0.0 is distinct from +0.0", () => {
      const m = new ${cls}();
      m.put(0.0, ${v1});
      m.put(-0.0, ${v2});
      expect(m.size()).toBe(2);
      expect(m.get(0.0)).toBe(${v1});
      expect(m.get(-0.0)).toBe(${v2});
    });
    it("+/-Infinity keys", () => {
      const m = new ${cls}();
      m.put(Number.POSITIVE_INFINITY, ${v1});
      m.put(Number.NEGATIVE_INFINITY, ${v2});
      expect(m.size()).toBe(2);
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
  it("put and get", () => {
    const m = new ${cls}();
    m.put(${k1}, ${v1});
    m.put(${k2}, ${v2});
    m.put(${k3}, ${v3});
    expect(m.get(${k1})).toBe(${v1});
    expect(m.get(${k99})).toBeUndefined();
    expect(m.size()).toBe(3);
  });
  it("put overwrite", () => {
    const m = new ${cls}();
    m.put(${k1}, ${v1});
    const old = m.put(${k1}, ${v2});
    expect(old).toBe(${v1});
    expect(m.get(${k1})).toBe(${v2});
  });
  it("remove", () => {
    const m = new ${cls}();
    m.put(${k1}, ${v1});
    m.put(${k2}, ${v2});
    expect(m.remove(${k1})).toBe(${v1});
    expect(m.size()).toBe(1);
    expect(m.containsKey(${k1})).toBe(false);
  });
  it("getOrDefault", () => {
    const m = new ${cls}();
    m.put(${k1}, ${v1});
    expect(m.getOrDefault(${k1}, ${v3})).toBe(${v1});
    expect(m.getOrDefault(${k99}, ${v3})).toBe(${v3});
  });
  it("isEmpty and clear", () => {
    const m = new ${cls}();
    expect(m.isEmpty()).toBe(true);
    m.put(${k1}, ${v1});
    expect(m.isEmpty()).toBe(false);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
  it("select", () => {
    const m = new ${cls}();
    m.put(${k1}, ${v1});
    m.put(${k2}, ${v2});
    m.put(${k3}, ${v3});
    expect(m.select((_k, v) => v > ${v1}).size()).toBe(2);
  });
  it("anySatisfy / allSatisfy", () => {
    const m = new ${cls}();
    m.put(${k1}, ${v1});
    m.put(${k2}, ${v2});
    expect(m.anySatisfy((_k, v) => v === ${v2})).toBe(true);
    expect(m.allSatisfy((_k, v) => v > ${v0})).toBe(true);
  });
  it("resize", () => {
    const m = new ${cls}();
${resizeLoop(key, val)}
    expect(m.size()).toBe(100);
  });
  it("memoryBytes", () => {
    const m = new ${cls}(64);
    expect(m.memoryBytes()).toBeGreaterThan(0);
  });
  it("toString", () => {
    const m = new ${cls}();
    m.put(${k1}, ${v1});
    expect(m.toString()).not.toBe("");
  });${key.kind === "float" ? floatKeyEdgeCases(cls, (n) => valLit(val, n)) : ""}
});
`;
}
