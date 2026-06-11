# Changelog

All notable changes to `@mapdb/typescript` are documented here.

## 0.2.0 — v2 idiom line (BREAKING)

This release cuts the collection API over to JS-native idioms. It removes
several Java-style method names in favor of their `Map`/`Set` equivalents and
normalizes return shapes for chaining. These are **source-breaking** changes
for consumers upgrading from 0.1.x.

### Breaking changes & migration

| Before (0.1.x) | After (0.2.0) | Notes |
|----------------|---------------|-------|
| `map.put(k, v)` | `map.set(k, v)` | `set` now returns the map (for chaining), **not** the previous value. If you relied on the old return value, read it with `map.get(k)` before calling `set`. |
| `map.containsKey(k)` | `map.has(k)` | `containsKey` removed. |
| `set.contains(v)` / `bag.contains(v)` | `set.has(v)` / `bag.has(v)` | `contains` removed. |
| `coll.size()` | `coll.size` | `size` is now a getter on every collection; drop the parentheses. |
| `list.add(v)` / `set.add(v)` / `bag.add(v)` returning `void`/`boolean` | `add(...)` returns the collection (`this`) | `add` is now fluent/chainable. |
| `multimap.put(k, v)` | `multimap.set(k, v)` | matches the map rename. |
| `map.entries()` yielding scalar values | `entries()` yields `[key, value]` pairs (maps) / `[index, value]` pairs (lists) | shape now matches `[Symbol.iterator]`; iterate with `for (const [k, v] of map.entries())`. |

The `MapDbMap` / `MapDbSet` interfaces in `src/api/index.ts` (and the codegen
templates that emit the generated collections) were widened to require `has(...)`,
the `size` getter, the fluent return shapes, and `[Symbol.iterator]`.

### Already released on the 0.2.0 line (earlier v2 commits)

- `put` → `set` and `containsKey`/`contains` → `has` aliasing groundwork.
- `size` method → getter.

## 0.1.0

- Initial release: primitive-specialized and generic object collections,
  lazy stream pipelines.
