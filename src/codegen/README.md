# `src/codegen` — typed-collection code generator

This directory holds the code generator that produces **five typed-collection
families** under `src/typed/`. Every `*.ts` class plus its `*.generated.test.ts`
companion in those directories is **generated output**, not a hand-maintained
file. A drift gate (`npm run generate:check`) keeps the committed files in
lock-step with the templates.

| Family | Directory | Files | Sub-phase |
| --- | --- | --- | --- |
| hash map | `src/typed/hashmap/` | 36 `K×V` classes + 36 tests | 6b-1 |
| array list | `src/typed/arraylist/` | 6 mutable + 6 immutable (+ tests) | 6b-2 |
| hash set | `src/typed/hashset/` | 6 mutable + 6 immutable (+ tests) | 6b-2 |
| array stack | `src/typed/stack/` | 6 mutable + 6 immutable (+ tests) | 6b-2 |
| hash bag | `src/typed/bag/` | 6 mutable only (+ tests) | 6b-2 |

Phase 6b-1 (hash map) was the proof; phase 6b-2 extends the same
spec+template+runner model to the four single-element-type families above. The
hash map keys on a `K×V` cross-product of the six primitives; the 6b-2 families
have a single element type and vary along just the six-primitive axis.

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
| `spec.mjs` | The **type axis** (`PRIMS`) + per-type metadata, and the `KEY_HASH` table that maps a `kind` to its canonical hash helper. The single source of truth for "what types exist and how they behave." Shared by every family. |
| `templates.mjs` | Pure string builders for the **hash-map** family: `renderSource()` / `renderTest()`. They read only spec metadata — never branching on a type *name*. Canonical hash helpers are imported **by name** (`f64HashSeed`, `bigintHashSeed`), never inlined. |
| `families.mjs` | Pure string builders for the four **6b-2 families** (array list / hash set / stack / bag, each `render*` + `*FileName` + `*ClassName`). Same rules: spec-driven, helpers imported by name. Per-type behavioural nuances that are not pure type substitution are folded in here (see below). |
| `generate.mjs` | The runner. Declares the five families in one `FAMILIES` table, then writes them, or (`--check`) acts as the drift gate, or (`--out DIR`) emits flat to a scratch dir for reconciliation. `--family <name>` scopes any mode to one family. |

### Per-type behavioural nuances folded into `families.mjs`

These are the hunks that are **not** pure type substitution; they are reproduced
verbatim so regeneration never silently reverts a hand fix:

- **array-list `sum()` for `float32`** uses a per-add `Math.fround` f32 left-fold
  (matches Go's `float32`-accumulating `Sum()` so the cross-language f32 column
  agrees). `float64` and the integers use an f64 running total; `bigint` uses a
  bigint total. The **mutable** and **immutable** `float32` variants carry
  *different* explanatory comments — both reproduced exactly.
- **stack `sum()` does NOT use the fround fold** for `float32`; it uses the same
  f64 running total as the integers, for every type. (This is the committed
  stack behaviour; the fold is an array-list-only nuance.)
- **hash-set element hashing** uses the same canonical helpers as hash-map keys
  (`f64HashSeed` / `bigintHashSeed` / `key | 0`), imported by name.
- **float-element hash sets** get an `IEEE 754 edge cases` test block.
- A couple of **hand quirks** in the immutable-stack tests (a `// top = …`
  comment that carries the bigint `n` suffix, and an `every((v) => v < 100)`
  that compares a bigint element to a plain `100`) are reproduced as-is.

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

### Float regression tests

Float-keyed maps and float-element hash sets additionally get an
`IEEE 754 edge cases` test block (NaN findable / dedup / removable, `-0` vs `+0`
distinct, `±Infinity`). This is phase-3 regression coverage that lived inline in
the committed test files; it is reproduced verbatim (`floatKeyEdgeCases()` for
maps, `floatElemEdgeCases()` for sets) and gated on `kind === "float"` so
regeneration never silently drops it.

## How to add a new type

1. Add one row to `PRIMS` in `spec.mjs` (and, if it needs a new hash strategy, a
   row to `KEY_HASH`).
2. Run `npm run generate` (regenerates all five families).
3. Export the new classes from `src/index.ts` if they are public API.
4. Run `npm run build` and `npx vitest run`.

The hash-map family emits the full `N²` cross-product; the four 6b-2 families
emit along the single primitive axis, so adding one primitive adds files to
every family automatically.

## Commands

```bash
npm run generate                 # regenerate ALL five families (156 files)
npm run generate:typed-hashmap   # one family (also: -arraylist / -hashset / -stack / -bag)
npm run generate:check           # drift gate over ALL families — non-zero on any drift
node src/codegen/generate.mjs --family stack --check        # drift gate, one family
node src/codegen/generate.mjs --family arraylist --out /tmp/scratch  # scratch dir (reconcile)
```

### Drift gate (CI / dev)

`npm run generate:check` regenerates every family in memory and compares against
the committed files, failing if any differs. Equivalent to a
`git diff --exit-code` over `src/typed/` after a fresh regenerate. Wire it into
CI so a hand-edit to a generated file (or a template change that wasn't
regenerated) fails the build.

Every generated file carries a banner naming its own regenerate command, e.g.:

```ts
// CODE GENERATED — DO NOT EDIT. Regenerate with `npm run generate:typed-arraylist`.
```

## Note on formatting

The committed files were originally produced through Prettier (printWidth 80).
The template reproduces the one relevant width-sensitive case deterministically:
`select`/`reject` keep their one-line signature when it fits in 80 columns and
wrap the predicate parameter otherwise (driven by class-name length). This
avoids a Prettier dependency in the generator while keeping output byte-stable.
