# `src/codegen` — collection code generator

This directory holds the code generator that produces **seven collection
families**. Every `*.ts` class plus its `*.generated.test.ts` companion in the
target directories is **generated output**, not a hand-maintained file. A drift
gate (`npm run generate:check`) keeps the committed files in lock-step with the
templates.

| Family | Directory | Files | Sub-phase |
| --- | --- | --- | --- |
| hash map | `src/typed/hashmap/` | 36 `K×V` classes + 36 tests | 6b-1 |
| array list | `src/typed/arraylist/` | 6 mutable + 6 immutable (+ tests) | 6b-2 |
| hash set | `src/typed/hashset/` | 6 mutable + 6 immutable (+ tests) | 6b-2 |
| array stack | `src/typed/stack/` | 6 mutable + 6 immutable (+ tests) | 6b-2 |
| hash bag | `src/typed/bag/` | 6 mutable only (+ tests) | 6b-2 |
| non-typed map | `src/hashmap/` | 4 map (+4 tests), 4 bimap, 4 immutable (+4 tests) | 6b-3 |
| non-typed multimap | `src/multimap/` | 4 `K×V` × {list, set} = 8 classes | 6b-3 |

Phase 6b-1 (hash map) was the proof; phase 6b-2 extends the same
spec+template+runner model to the four single-element-type families. The hash
map keys on a `K×V` cross-product of the six primitives; the 6b-2 families have
a single element type and vary along just the six-primitive axis. Phase 6b-3
extends the model again to the **non-typed** number/bigint maps that live under
`src/hashmap/` and `src/multimap/` (backed by plain `Array` open-addressing or a
JS `Map`, not `TypedArray`; type axis = `{number, bigint}` only).

### Non-typed map families (6b-3) — a MIXED directory

`src/hashmap/` and `src/multimap/` contain BOTH generated number/bigint maps and
**hand-written** object-keyed maps (`number-object-hash-map.ts`,
`object-number-hash-map.ts`, `bigint-object-hash-map.ts`,
`object-bigint-hash-map.ts`, and the `multimap.ts` aggregator). The object-keyed
maps are a DIFFERENT (Map-backed identity) implementation that is **not
templatable** with this generator, so they are left hand-written and carry **no**
`CODE GENERATED` banner. The drift gate's STALE scan keys on that banner, so the
hand-written files are correctly ignored; the family builders emit ONLY the
number/bigint file names and never an object-keyed name. The 6b-3 templates live
in `nontyped.mjs` (separate from the typed `templates.mjs`/`families.mjs`) and
their per-type metadata is a small self-contained `NONTYPED_PRIMS` table
(`number` → `f64HashSeed`/`0`; `bigint` → `bigintHashSeed`/`0n`).

Per-type behavioural nuances folded into `nontyped.mjs` (NOT pure type
substitution, reproduced verbatim so regeneration never reverts a hand fix):

- **hash-map key-import layout** differs by key kind: a number key places
  `import { f64HashSeed }` *above* `import type { MapDbMutableMap }`; a bigint
  key places the `import type` first with `import { bigintHashSeed }` adjacent
  below it. The `hashKey()` seed is `f64HashSeed(key)` / `bigintHashSeed(key)`
  (no `| 0`; the sign is folded with `h < 0 ? -h : h`).
- **bimap `inverse()`** returns the `V×K`-swapped bimap class; when `K !== V`
  that class differs from `this`, so a sibling import is emitted (none when
  `K === V`). Bimaps have no generated test.
- **multimap structure switches on KEY kind**: a number key uses the
  `mapKeyOf`/`NEG_ZERO_KEY` tuple machinery (so `-0`/`+0` keys stay distinct); a
  bigint key uses a plain `Map<bigint, V[]>`. The value-equality helper follows
  kind — `containsKeyValue` and the set-dedup track the KEY kind (`Object.is`
  for number keys, `===` for bigint keys); `equals` uses `Object.is` only in the
  number-key + number-value case and `!==` everywhere else. `list` vs `set`
  differ only in the `put()` body (set dedups) and the doc wording. Multimaps
  have no generated test.
- **number-keyed hash maps** get the same `IEEE 754 edge cases` test block as the
  float-keyed typed maps (NaN findable/replace/remove, `-0`/`+0` distinct,
  `±Infinity` keys), gated on the number key kind.

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
| `nontyped.mjs` | Pure string builders for the **6b-3 non-typed families** (number/bigint hash map + bimap + immutable + multimap). Self-contained `NONTYPED_PRIMS` metadata (only the `{number, bigint}` axis); helpers imported by name. Per-type structural nuances (multimap key-branch, bimap inverse import, hash-map import layout) folded in (see above). |
| `generate.mjs` | The runner. Declares the seven families in one `FAMILIES` table (each with a target `dir`, resolved under `base` — `src/typed/` by default, `src/` for the 6b-3 families), then writes them, or (`--check`) acts as the drift gate, or (`--out DIR`) emits flat to a scratch dir for reconciliation. `--family <name>` scopes any mode to one family. |

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
npm run generate                    # regenerate ALL seven families (184 files)
npm run generate:typed-hashmap      # one family (also: -arraylist / -hashset / -stack / -bag)
npm run generate:hashmap-nontyped   # 6b-3 number/bigint maps in src/hashmap/ (20 files)
npm run generate:multimap-nontyped  # 6b-3 number/bigint multimaps in src/multimap/ (8 files)
npm run generate:check              # drift gate over ALL families — non-zero on any drift
node src/codegen/generate.mjs --family stack --check        # drift gate, one family
node src/codegen/generate.mjs --family arraylist --out /tmp/scratch  # scratch dir (reconcile)
```

### Drift gate (CI / dev)

`npm run generate:check` regenerates every family in memory and compares against
the committed files, failing if any differs. For each family it also runs a
**STALE scan**: any banner-stamped file on disk that the generator no longer
emits is flagged. Because `src/hashmap/` and `src/multimap/` are mixed
directories, this scan is what lets the hand-written object-keyed maps and the
`multimap.ts` aggregator coexist with generated files — they carry no banner, so
the scan ignores them. Wire it into CI so a hand-edit to a generated file (or a
template change that wasn't regenerated) fails the build.

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
