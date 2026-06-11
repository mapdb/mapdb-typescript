# Breaking idiom changes batched for a future v2

Phase 7b made only **additive** idiom changes (new `[Symbol.iterator]`, new `has`
aliases). The changes below would alter or remove existing public surface, so
they are **deferred** to a v2 major bump and are **NOT** implemented here. One
line each.

- Rename map `put(key, value)` → `set(key, value)` to match the JS `Map` API (keep/forward `put` for one deprecation cycle).
- Rename map `containsKey(key)` → `has(key)` (we ADDED `has` and KEPT `containsKey`; the rename/removal of `containsKey` is the breaking part).
- Rename set/bag `contains(value)` → `has(value)` (we ADDED `has` and KEPT `contains`; removing `contains` is the breaking part).
- Fix `entries()` to yield `[key, value]` pairs instead of values where a class's `entries()` currently yields values (review flagged this); changing the yield shape is breaking, so v7b leaves `entries()` as-is and relies on `[Symbol.iterator]` for the correct pair shape.
- Resolve the `size` method-vs-getter inconsistency: some classes expose `size()` (method) and others `get size()` (getter); pick one form across all collections.
- Normalize `add(value)` return-shape inconsistencies (e.g. `boolean` for sets vs `void` for bags/lists) into one consistent contract.
- Rename multimap `put(key, value)` shape and/or add a `set`-style API consistent with whatever the map rename above lands on.
- Optionally widen the `MapDbMap` / `MapDbSet` interfaces in `src/api/index.ts` to require `has(...)` and `[Symbol.iterator]` (adding members to a published interface is breaking for external implementors, so it is deferred).
