# Review: ArrayList remove-by-value (iso2 E17)

## Verdict

No **MUST-FIX** findings. The change correctly repairs the conformance gap: the production `NumberArrayList.remove` has first-occurrence, stable-order, boolean-return semantics; the runner calls that method directly; and the mutable-list interface's explicit implementors remain sound.

## Correctness and parity

- `NumberArrayList.remove` and `BigIntArrayList.remove` use `indexOf` to find the first matching index, return `false` without mutation for `-1`, and otherwise delegate to `removeAtIndex` and return `true`. `removeAtIndex` shifts every later element one position left, so order is preserved and only one occurrence is removed.
- That is the same algorithm used by Java's generated `IntArrayList`/`FloatArrayList`, Go's `arraylist.Int32`/`Float32`, and Zig's generic `ArrayList`. Rust's `object::ArrayList` likewise uses `position` followed by ordered `Vec::remove`. It also matches the existing TypeScript `object/arraylist.ts` for first-occurrence selection, boolean result, and stable ordering.
- The generic TypeScript `object/ArrayList<T>` is not identical on numeric edge-case equality: its `indexOf` uses `===`, whereas `NumberArrayList` uses `Object.is`. That difference predates this patch and does not affect the i32 conformance scenario. The new methods correctly preserve each class's existing `indexOf` equality rather than introducing another equality definition.

## Numeric equality

`Object.is` is the correct choice for `NumberArrayList` under the TypeScript rule in `algorithms.md`: it matches `NaN` with `NaN` and distinguishes `+0` from `-0`. The tests assert both properties correctly. In particular, `[0, -0]` followed by `remove(-0)` must leave positive zero, and the explicit `Object.is(l.get(0), 0)` assertion verifies its sign. The NaN test also verifies first-occurrence behavior by leaving one NaN after the first removal.

This follows the documented TypeScript NaN carve-out: `Object.is` treats all JS NaNs as equal rather than preserving distinct f32 NaN payload identities. That is the specified TS behavior here.

## Interface coverage

Adding `remove(value: T): boolean` to `MapDbMutableList<T>` is preferable to adding an undeclared method only to concrete classes: remove-by-value is part of the mutable-list contract, while immutable lists should not expose it.

The explicit `MapDbMutableList` implementors are:

- `NumberArrayList`, now satisfied;
- `BigIntArrayList`, now satisfied;
- `object/ArrayList<T>`, already satisfied.

`src/api/verify.ts` checks the two primitive generic lists against `MapDbMutableList`; `object/ArrayList<T>` declares `implements MapDbMutableList<T>` directly, so normal typechecking checks it as well. The immutable number and bigint lists are intentionally checked only against `MapDbList`, so leaving them unchanged is correct. I found no missed implementor of the widened interface.

## Runner/G5

The new `NumberArrayList` branch satisfies G5 because it invokes `coll.remove(v())` on the production collection. It does not reproduce the search or shifting logic in `validate.ts`.

Its position at the start of the `remove` chain is safe. `NumberArrayList` does not inherit from any of the map, set, or bag classes, and those concrete classes are independent, so an ordinary instance cannot match both this branch and a later branch. The runner ignores the boolean return just as the scenario does; the resulting list state is obtained through production assertion methods later.

## NIT/OPTIONAL

- **OPTIONAL — decide whether all exported typed ArrayLists should gain parity.** The six generated mutable classes under `src/typed/arraylist/` are a separate public family and do not implement `MapDbMutableList`; therefore they are not missed interface implementors and their omission does not block this conformance repair. They nevertheless still lack remove-by-value. If “ArrayList operation parity” is intended to cover every exported TypeScript ArrayList variant, add the method and tests to the array-list generator template rather than editing generated files. This can be a follow-up because the conformance runner deliberately exercises `NumberArrayList`, and the present interface does not claim the typed classes.
- **NIT — the vacated-slot test does not prove its name.** After any removal, `add(9)` necessarily overwrites `data[_size]`, so `[6, 9]` would pass even if `removeAtIndex` did not clear the old backing slot. Slot clearing is private and has no observable number-list behavior in this sequence. Rename the test to describe remove-then-add behavior, or omit it; testing the private capacity slot would require an implementation-coupled hook and is not warranted here.
- **OPTIONAL — generic numeric equality is a pre-existing consistency question.** If `object/ArrayList<number>` is meant to obey the numeric-equality section too, its `indexOf`/`has`/`remove` should eventually use `Object.is`; currently it uses `===`, so NaN and signed-zero behavior differs from `NumberArrayList`. This patch should not change `remove` independently of that class's `indexOf`.

The remaining tests cover the meaningful observable edge cases well: duplicate/first occurrence, absent value, empty and singleton lists, head and tail shifting, repeated removal, NaN, and signed zero. I found no dead or duplicated production logic and no style inconsistency that should block the change.
