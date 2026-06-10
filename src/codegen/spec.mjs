// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// ---------------------------------------------------------------------------
// Type-axis SPEC for the typed hash-map code generator (phase 6b-1).
//
// The 36 src/typed/hashmap/<k>-<v>-hash-map.ts classes exist as concrete
// (non-generic) classes because their backing store is a concrete TypedArray
// (Int32Array / Float64Array / BigInt64Array / ...), and a TypedArray class
// cannot be a TypeScript generic type parameter. They are otherwise
// near-identical, so we generate them from ONE template parameterised by the
// per-type metadata below.
//
// Each PRIM entry is fully self-describing: the generator never branches on a
// type name, it only reads these fields. Adding a new primitive = add one row.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Prim
 * @property {string} id        kebab id used in file names (e.g. "int32").
 * @property {string} name      PascalCase token used in class names + doc
 *                              prose (e.g. "Int32", "BigInt64").
 * @property {string} arrayClass  the backing TypedArray class (e.g.
 *                              "Int32Array", "BigInt64Array").
 * @property {number} bytes     element width in bytes (for the doc comment +
 *                              memoryBytes() calc).
 * @property {"number"|"bigint"} tsType  the TS scalar type for this primitive.
 * @property {"int"|"float"|"bigint"} kind  drives the key-hash strategy:
 *                              int  -> `key | 0`            (no helper import)
 *                              float-> `f64HashSeed(key)`   (float-order helper)
 *                              bigint-> `bigintHashSeed(key) | 0` (hash helper)
 */

/** @type {Prim[]} */
export const PRIMS = [
  { id: "int8", name: "Int8", arrayClass: "Int8Array", bytes: 1, tsType: "number", kind: "int" },
  { id: "int16", name: "Int16", arrayClass: "Int16Array", bytes: 2, tsType: "number", kind: "int" },
  { id: "int32", name: "Int32", arrayClass: "Int32Array", bytes: 4, tsType: "number", kind: "int" },
  { id: "float32", name: "Float32", arrayClass: "Float32Array", bytes: 4, tsType: "number", kind: "float" },
  { id: "float64", name: "Float64", arrayClass: "Float64Array", bytes: 8, tsType: "number", kind: "float" },
  { id: "bigint64", name: "BigInt64", arrayClass: "BigInt64Array", bytes: 8, tsType: "bigint", kind: "bigint" },
];

/**
 * Canonical hash-seed helpers, imported BY NAME from the shared single-source
 * modules — never inlined into the generated files. The template selects one
 * row per KEY primitive `kind`.
 *
 * @type {Record<string, {import?: {names: string[], from: string}, seedExpr: (keyVar: string) => string}>}
 */
export const KEY_HASH = {
  // Integer keys: truncate to 32-bit via `| 0`. No helper import.
  int: {
    seedExpr: (k) => `${k} | 0`,
  },
  // Float keys: full IEEE-754 bit fold (distinguishes -0/+0 and fractions,
  // canonicalises NaN) from src/internal/float-order.ts.
  float: {
    import: { names: ["f64HashSeed"], from: "../../internal/float-order.js" },
    seedExpr: (k) => `f64HashSeed(${k})`,
  },
  // 64-bit integer (bigint) keys: high-into-low XOR fold matching the Go/Zig
  // ports, from src/internal/hash.ts.
  bigint: {
    import: { names: ["bigintHashSeed"], from: "../../internal/hash.js" },
    seedExpr: (k) => `bigintHashSeed(${k}) | 0`,
  },
};

/** All 36 (key, value) pairs in the committed file order (id sort = file sort). */
export function pairs() {
  const out = [];
  for (const key of PRIMS) {
    for (const val of PRIMS) {
      out.push({ key, val });
    }
  }
  return out;
}
