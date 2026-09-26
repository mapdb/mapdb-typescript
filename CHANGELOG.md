# Changelog

All notable changes to `@mapdb/typescript` are documented here.

## Unreleased

### Fixed

- `NumberInterval` now enforces its documented `Interval<i32>` domain: `from`,
  `to` and `step` must be int32 values, and every factory (`fromToBy`,
  `fromTo`, `oneTo`, `zeroTo`) throws a `RangeError` otherwise. Previously
  `fromTo(2 ** 53, 2 ** 53 + 2)` was accepted and iterated forever because the
  `current += step` cursor rounded back to `2 ** 53`. Iteration is now
  index-driven (`from + step * i` for `i < size`), `size` is an exact integer
  (`fromToBy(0, 10, 3).size` was `4.333…`, which let `get(4)` return `12`, a
  non-member), `get` rejects fractional indexes, and `has` returns false for
  any non-integer query. Callers that passed integers beyond int32 should
  switch to `BigIntInterval`; fractional endpoints or steps were never
  members of an integer interval and must be rounded to integers by the
  caller before construction.
- `NumberInterval.reversed()` and `BigIntInterval.reversed()` now start
  from the last element actually produced instead of the constructor's `to`.
  `to` is only an inclusive bound and may sit off the step grid:
  `fromToBy(0, 10, 3)` is `0, 3, 6, 9`, but its reverse was `10, 7, 4, 1`,
  a different element set. The reverse now pulls `to` back onto the grid by
  the remainder of the distance (`spec/algorithms.md` §"Reversed() starts
  from the last element"), so it has the same size and elements as the
  source, `has` agrees on every value, and `reversed().reversed()` is the
  source sequence (its `to` is normalised to the last element, `9` above).
  On-grid intervals such as `fromTo(1, 5)` are unaffected. The int32
  minimum-step trap in `NumberInterval` is unchanged and still fires first.

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
