# Breaking idiom changes — implemented in v0.2.0

The v0.2.0 "v2 idiom line" cuts the collection API over to JS-native idioms.
The changes below alter or remove existing public surface and are
**IMPLEMENTED** in this version (they are breaking for v0.1.x consumers —
see CHANGELOG.md for the migration guide). One line each.

## Implemented (breaking)

- **DONE** — Renamed map `put(key, value)` → `set(key, value)` to match the JS `Map` API. `set` now returns the map (for chaining), not the old value. `put` is removed.
- **DONE** — Renamed map `containsKey(key)` → `has(key)`. `containsKey` is removed.
- **DONE** — Renamed set/bag `contains(value)` → `has(value)`. `contains` is removed.
- **DONE** — `entries()` now yields `[key, value]` pairs (maps) / `[index, value]` pairs (lists) instead of scalar values, matching `[Symbol.iterator]`.
- **DONE** — Resolved the `size` method-vs-getter inconsistency: every collection now exposes `size` as a getter (`get size`); the `size()` method form is removed.
- **DONE** — Normalized `add(value)` return-shape: fluent `add(...)` now returns the collection (`this`) for chaining across lists/sets/bags (was `void`/`boolean`).
- **DONE** — Multimap `put(key, value)` → `set(key, value)`, consistent with the map rename.
- **DONE** — Widened the `MapDbMap` / `MapDbSet` interfaces in `src/api/index.ts` (and the codegen templates in `src/codegen/*.mjs`) to require `has(...)`, the getter `size`, the fluent return shapes, and `[Symbol.iterator]`.

## Still deferred

Nothing from the original list remains deferred — the v2 idiom line is complete.
Any future idiom adjustments will be tracked here.
