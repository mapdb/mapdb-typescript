# Review brief: mapdb-typescript ArrayList remove-by-value (iso2 E17)

You are a REVIEWER and you are **READ-ONLY**: do NOT edit, create, move or
delete any file in any repository, do not run git commands that mutate state,
do not run formatters that rewrite files. Your ONLY write is your answer, which
you must write to `/tmp/iso2-ts-remove-codex.md`.

## The gap being fixed

The cross-language conformance suite in
`/home/play2/mapdb/mapdb-collection-spec/cross-language-validation` has scenario
`scenarios/01-basic-crud/arraylist_remove.json` (collection `ArrayList<i32>`):
add 1, 2, 1; remove 1 -> `[2,1]`; remove 99 is a no-op. All five ports passed
except TypeScript, because:

- `mapdb-typescript/src/arraylist/number-array-list.ts` had only
  `removeAtIndex(index)` / `indexOf(value)` — no remove-by-value at all.
- `MapDbMutableList` in `src/api/index.ts` did not declare remove-by-value.
- `src/validate.ts` `case "remove"` had no `NumberArrayList` branch, so the op
  silently no-opped (the `case` matched, so the `default` throw never fired).
- The generic `src/object/arraylist.ts` already had
  `remove(value: T): boolean` (first occurrence via `indexOf` + `splice`), and
  Java / Go / Rust / Zig all implement first-occurrence remove-by-value on
  their list.

Known-red-cell note recording all this: `cross-language-validation/README.md`
lines 36-52 ("Known red cells").

## Spec sections relied on

- `/home/play2/mapdb/mapdb-collection-spec/spec/collections.md` §"ArrayList —
  dynamic array" (lines 68-80): TypeScript's ArrayList family is
  `<T>ArrayList` / `Number<T>ArrayList`; the operation set is expected to be at
  parity across ports.
- `/home/play2/mapdb/mapdb-collection-spec/spec/algorithms.md` lines 133-150:
  "hashing and equality on floats compares the raw bits ... TS: use
  `Object.is(a, b)` (`Object.is(NaN, NaN) === true`, and
  `Object.is(+0, -0) === false`)" — so remove-by-value must use the same
  `Object.is` equality that `NumberArrayList.indexOf` / `has` already use:
  `NaN` matches `NaN`, `-0` does not match `+0`.
- Runner rule G5 (from this suite): the runner must obtain every value by
  calling the production method the assertion names; no runner-local loops that
  reimplement the operation.

## The change (repo `/home/play2/mapdb/mapdb-typescript`, branch main, base aa56d06)

Full diff of tracked files is in `/tmp/iso2-ts-remove.diff` — read it.
One new untracked file: `src/arraylist/bigint-array-list.test.ts` — read it too.

Summary:
1. `src/arraylist/number-array-list.ts`: added
   `remove(value: number): boolean` = `indexOf` then `removeAtIndex`, returning
   whether anything was found. Placed just above `has`.
2. `src/api/index.ts`: `MapDbMutableList<T>` now declares
   `remove(value: T): boolean`.
3. `src/arraylist/bigint-array-list.ts`: added the same `remove` — required
   because `BigIntArrayList` also implements `MapDbMutableList` (see
   `src/api/verify.ts` `_CheckBigIntArrayList`). The third implementor,
   `src/object/arraylist.ts` `ArrayList<T>`, already satisfied it.
   Note: `src/typed/arraylist/*` (Int32ArrayList etc.) are codegen output and do
   NOT implement `MapDbMutableList` (no assertion in verify.ts), so they were
   left alone; `npm run generate:check` still reports all 268 generated files
   matching templates.
4. `src/validate.ts` `case "remove"`: new first branch
   `if (coll instanceof NumberArrayList) { coll.remove(v()); }` calling the
   production method (with a comment saying why indexOf+removeAtIndex in the
   runner would be a G5 violation).
5. Tests: 8 new cases in `src/arraylist/number-array-list.test.ts` (first
   occurrence only, absent value returns false + list unchanged, empty list,
   removing the last element then re-removing, tail removal, NaN via Object.is,
   -0 vs +0 distinct, vacated slot cleared so a later `add` does not resurrect
   a value) and 4 in the new `bigint-array-list.test.ts`.

## Results

- `npm test`: 210 files, 3018 tests passed.
- `npm run typecheck`, `npm run build`, `npm run generate:check`: all clean
  (these are exactly the CI steps in `.github/workflows/ci.yml`).
- `npx prettier --check` on the touched files: only `src/api/index.ts` warns,
  and it already warned before this change (verified against `git show HEAD:`);
  the repo has 311 pre-existing prettier warnings, so no `format` run was done.
- Conformance, TS only:
  `MAVEN_ARGS=-o ./validate.sh --skip-java --skip-go --skip-rust --skip-zig`
  -> **Scenarios: 306, Pass: 306, Fail: 0; ts: 306 pass / 0 fail** (was 305/306 with `01-basic-crud/arraylist_remove` red before this change).
- `./check-runners.sh --root /home/play2/mapdb` -> **PASS java/go/rust/ts/zig, 26 checked each; "All required production symbols present."**

## What I want from you

Review for correctness and spec/parity fidelity. Specifically:

1. Is `remove` semantically identical to the other four ports and to
   `object/arraylist.ts` (first occurrence only, boolean return, no reordering)?
   Read the reference implementations if useful:
   - Java: search under `/home/play2/mapdb/mapdb-java` for the IntArrayList remove.
   - Go: `/home/play2/mapdb/mapdb-go` arraylist package.
   - Rust: `/home/play2/mapdb/mapdb-rust` `object::ArrayList`.
   - Zig: `/home/play2/mapdb/mapdb-zig` `src/arraylist/array_list.zig`.
2. Is the `Object.is` equality choice right per `algorithms.md`, and are the
   NaN / -0 tests asserting the right thing?
3. Is widening `MapDbMutableList` the right call, or should `remove` have been
   added only to the concrete classes? Did I miss an implementor (check
   `src/api/verify.ts` and grep for `MapDbMutableList`)? Are the immutable list
   types correctly left out (they implement `MapDbList`, not the mutable one)?
4. Does the validate.ts branch satisfy G5, and is its placement (before the
   map/set/bag branches) safe — can any collection be `instanceof`
   NumberArrayList and something else?
5. Any missing edge cases in the tests; anything in the diff that is dead,
   duplicated, or inconsistent with the file's existing style.

Label anything you consider blocking as **MUST-FIX**; everything else as
NIT/OPTIONAL. If you find nothing blocking, say so explicitly.

Write your answer to `/tmp/iso2-ts-remove-codex.md`. Do not modify any repo file.
