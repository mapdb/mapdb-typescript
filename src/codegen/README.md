# `src/codegen` — typed-collection code generator

This directory holds the code generator that produces the **typed hash-map
family** under `src/typed/hashmap/`. Those 36 `K×V` classes
(`<key>-<value>-hash-map.ts`) plus their `*.generated.test.ts` companions are
**generated output**, not hand-maintained files. A drift gate
(`npm run generate:check`) keeps the committed files in lock-step with the
template.

This is the proof sub-phase (6b-1); later sub-phases extend the same
spec+template+runner model to the other typed families.

## Why these files are generated instead of being a TS generic

The backing store of a typed hash map is a **concrete `TypedArray`**
(`Int32Array`, `Float64Array`, `BigInt64Array`, …). A `TypedArray` class cannot
be a TypeScript generic type parameter, so a single
`HashMap<K, V>` cannot pick its backing array from `K`/`V`. The 36 classes are
therefore concrete, near-identical specializations — exactly the kind of
duplication a generator removes. Diffing any two (after normalizing the type
tokens) leaves only:

- the TS key/value type names and `TypedArray` classes,
- the per-type byte sizes in the doc comment and `memoryBytes()` calc,
- the key-hash helper (int vs float vs bigint), and
- value-literal suffixes in the tests (`1` vs `1n`).

All of that is data, captured in the **spec**.

## The three pieces

| File | Role |
| --- | --- |
| `spec.mjs` | The **type axis** (`PRIMS`) + per-type metadata, and the `KEY_HASH` table that maps a key's `kind` to its canonical hash helper. The single source of truth for "what types exist and how they behave." |
| `templates.mjs` | Pure string builders: `renderSource()` and `renderTest()`. They read only spec metadata — they never branch on a type *name*. Canonical hash helpers are imported **by name** (`f64HashSeed`, `bigintHashSeed`), never inlined. |
| `generate.mjs` | The runner: writes the files, or (`--check`) acts as the drift gate, or (`--out DIR`) emits to a scratch dir for reconciliation. |

### Per-type metadata (`spec.mjs`)

Each `PRIMS` row is self-describing:

```js
{ id: "int32", name: "Int32", arrayClass: "Int32Array",
  bytes: 4, tsType: "number", kind: "int" }
```

- `id` — kebab token used in file names (`int32-int32-hash-map.ts`).
- `name` — PascalCase token used in class names (`Int32Int32HashMap`) and doc prose.
- `arrayClass` — the backing `TypedArray`.
- `bytes` — element width (doc comment + `memoryBytes()`).
- `tsType` — `"number"` or `"bigint"`.
- `kind` — `"int" | "float" | "bigint"`, which selects the **key-hash strategy**:

| `kind` | seed expression | helper import |
| --- | --- | --- |
| `int` | `key \| 0` | _(none)_ |
| `float` | `f64HashSeed(key)` | `../../internal/float-order.js` |
| `bigint` | `bigintHashSeed(key) \| 0` | `../../internal/hash.js` |

The `float` and `bigint` seed helpers are the canonical phase-3 correctness
fixes (IEEE-754 bit fold that distinguishes `-0`/`+0` and canonicalizes `NaN`;
i64 high-into-low XOR fold matching the Go/Zig ports). They are **imported by
name** so a future fix to the helper flows into all generated files — the
template must never inline these expressions.

### Float-key regression tests

Float-keyed maps additionally get an `IEEE 754 edge cases` test block (NaN
findable / dedup / removable, `-0` vs `+0` distinct, `±Infinity` keys). This is
phase-3 regression coverage that lived inline in the committed test files; it is
reproduced verbatim by `floatKeyEdgeCases()` and gated on `kind === "float"` so
regeneration never silently drops it.

## How to add a new type

1. Add one row to `PRIMS` in `spec.mjs` (and, if its keys need a new hash
   strategy, a row to `KEY_HASH`).
2. Run `npm run generate:typed-hashmap`.
3. Export the new classes from `src/index.ts` if they are public API.
4. Run `npm run build` and `npx vitest run`.

The generator emits the full `N²` cross-product, so adding one primitive adds
`2·(2N+1)` new files automatically.

## Commands

```bash
npm run generate:typed-hashmap   # (alias: npm run generate) regenerate the 72 files
npm run generate:check           # drift gate — exits non-zero if regen would change anything
node src/codegen/generate.mjs --out /tmp/scratch   # emit to a scratch dir (reconciliation)
```

### Drift gate (CI / dev)

`npm run generate:check` regenerates in memory and compares against the
committed files, failing if any differs. Equivalent to a
`git diff --exit-code` over `src/typed/hashmap/` after a fresh regenerate. Wire
it into CI so a hand-edit to a generated file (or a template change that wasn't
regenerated) fails the build.

Every generated file carries a banner:

```ts
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-hashmap`.
```

## Note on formatting

The committed files were originally produced through Prettier (printWidth 80).
The template reproduces the one relevant width-sensitive case deterministically:
`select`/`reject` keep their one-line signature when it fits in 80 columns and
wrap the predicate parameter otherwise (driven by class-name length). This
avoids a Prettier dependency in the generator while keeping output byte-stable.
