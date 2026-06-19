// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { Range } from "../range/range.js";

/**
 * Compact immutable sorted map / set (`sorted-table-map`).
 *
 * A purpose-built, **pointerless** immutable sorted collection: keys (and, for
 * a map, the matching values) are packed into contiguous parallel arrays and
 * queried by binary search. The on-heap analogue of MapDB 3's `SortedTableMap`
 * — we port the observable behaviour and the packed-array + binary-search
 * mechanism, not the off-heap `Volume`/byte-offset machinery.
 *
 * This is **distinct** from the frozen-copy `Immutable*` wrappers (which seal a
 * live structure's per-entry layout against mutation) and from `NumberInterval`
 * (a *virtual* arithmetic progression with no stored elements).
 *
 * ## Layout — flat single sorted array (the reference default)
 *
 * One flat ascending array pair (`keys` + parallel `values` for the map, a
 * single `elems` array for the set). MapDB 3 paged the arrays with a per-page
 * key directory; paging is a legal but **unobservable** implementation choice
 * (lookup, iteration, range, `size`/`isEmpty` results are identical
 * regardless). A flat array is the simplest representation that is trivially
 * paging-invariant, so it is the reference.
 *
 * ## Construction is the only way in — built once from sorted input
 *
 * {@link ImmutableSortedMap.fromSorted} / {@link ImmutableSortedSet.fromSorted}
 * take a **strictly ascending** snapshot. Construction **traps** (throws
 * `RangeError` — the family's bad-input posture, like `Range`'s out-of-order
 * constructor and `Interval`'s minimum step) unless every adjacent input pair
 * satisfies `keys[i-1] < keys[i]` strictly:
 *
 * - out-of-order input (`keys[i] < keys[i-1]`) throws;
 * - a duplicate key (`keys[i] == keys[i-1]`) throws — **no last-wins / dedup**;
 * - (map) a `keys`/`values` length mismatch throws.
 *
 * Empty input (`fromSorted([], [])`) is valid and builds an empty collection;
 * single-element input is valid. Construction **copies** the input, so the
 * built collection is a snapshot independent of the caller's source arrays
 * (mutating them afterwards never affects the collection).
 *
 * ## Immutable — every mutator traps
 *
 * The types expose no value-changing API. The inherited-style mutators
 * (`set`/`add`/`remove`/`clear`) are present only to **throw**, mirroring
 * MapDB 3's `SortedTableMap` "all mutators throw" and the existing frozen-copy
 * `Immutable*` wrappers' contract.
 *
 * ## Iterators: materialized snapshots
 *
 * Ascending/descending/range methods return materialized arrays (matching the
 * `NumberTreeMap` range/descending convention). A materialized snapshot and a
 * lazy iterator are observably identical per `navigable-map.md`.
 *
 * ## TypeScript v1 surface
 *
 * v1 ships the `number`/i32 specialisation (the cross-language validation
 * universe), ordered by signed numeric order via the i32 comparator. The type
 * parameter is reserved for the float / wider-integer matrix; ordering goes
 * through the comparator (binary search), never a bare `<` on a generic — so
 * float keys widen later by supplying a total-order comparator with no
 * algorithm change (the same posture `Range`/`bound-range.md` uses).
 */

/** Validate a v1 `number` key/value to the signed-int32 universe. */
function i32(v: number, what: string): number {
  if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) {
    throw new RangeError(
      `ImmutableSorted: ${what} must be a signed 32-bit integer, got ${String(v)}`,
    );
  }
  return v === 0 ? 0 : v; // canonicalize -0 to +0
}

/** Signed i32 natural order. The ordering primitive (no bare `<` on a generic). */
function cmpI32(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Normalize a 0-based order-statistic index for `selectKey`/`selectEntry`/
 * `select`. The signed-index API ports (Go `int`, TypeScript `number`, Java
 * `int`) MUST return **absence** for an out-of-domain `i` — `i < 0` or a
 * non-integer — and MUST NOT trap (spec/features/rank-select.md §"Exact
 * semantics", adopted verbatim by sorted-table-map.md). Returns the index for a
 * valid `i`, or `-1` as an out-of-domain sentinel (callers map `< 0` to
 * `undefined`, exactly as an in-range `i >= size` already maps to `undefined`).
 */
function selectIndex(i: number): number {
  return Number.isInteger(i) && i >= 0 ? i : -1;
}

/**
 * Verify a slice is strictly ascending under {@link cmpI32}; throw otherwise.
 * Empty and single-element slices vacuously pass. Both bad-input failures
 * (out-of-order and duplicate) reduce to this single check: every adjacent
 * pair must satisfy `xs[i-1] < xs[i]` strictly.
 */
function assertStrictlyAscending(xs: readonly number[]): void {
  for (let i = 1; i < xs.length; i++) {
    if (cmpI32(xs[i - 1], xs[i]) >= 0) {
      throw new RangeError(
        "ImmutableSorted: input must be strictly ascending (no duplicate or out-of-order keys)",
      );
    }
  }
}

/**
 * Binary-search `key` in a strictly-ascending slice. Returns the index of the
 * hit, or `~insertionPoint` (a negative number) for an absent key — mirroring
 * the family's lower-bound convention. The midpoint is `lo + ((hi - lo) >> 1)`,
 * never `(lo + hi) / 2`, so it is overflow-safe at the signed extremes.
 */
function binarySearch(sorted: readonly number[], key: number): number {
  // The query key is an i32 in every typed port (`get`/`contains_key`/
  // `floor_key`/… take `key: &K` where K is i32); a non-i32 JS number has no
  // counterpart and would otherwise silently binary-search to a bogus
  // miss/answer (e.g. `get(1.5)` -> undefined). Validate here — the single
  // choke point all point/navigation/rank queries on both the map and the set
  // funnel through (lowerBound delegates to binarySearch) — so the check fires
  // once per query. Construction validates its keys separately via i32().
  i32(key, "query key");
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    const c = cmpI32(sorted[mid], key);
    if (c < 0) {
      lo = mid + 1;
    } else if (c > 0) {
      hi = mid - 1;
    } else {
      return mid;
    }
  }
  return ~lo; // ~lo === -(lo + 1): lo is the lower-bound insertion point
}

/** The lower-bound insertion index of `key` (hit index, or the gap index). */
function lowerBound(sorted: readonly number[], key: number): number {
  const r = binarySearch(sorted, key);
  return r >= 0 ? r : ~r;
}

const MUTATOR_MESSAGE =
  "ImmutableSorted is immutable; mutators are not supported";

/**
 * A compact immutable sorted map backed by packed parallel arrays
 * (`keys[i]` -> `values[i]`), queried by binary search. Built once from
 * strictly-ascending input via {@link ImmutableSortedMap.fromSorted}; thereafter
 * immutable.
 */
export class ImmutableSortedMap<
  K extends number = number,
  V extends number = number,
> {
  private readonly _keys: number[];
  private readonly _values: number[];

  private constructor(keys: number[], values: number[]) {
    this._keys = keys;
    this._values = values;
  }

  /**
   * Build from **strictly ascending** parallel arrays: `values[i]` is the value
   * of `keys[i]`. The input is **copied** (snapshot — independent of the
   * caller's arrays).
   *
   * @throws RangeError if `keys.length !== values.length`, if the keys are not
   * strictly ascending (out-of-order), or if any key is duplicated. There is no
   * last-wins/dedup and no silent sort — a caller who wants those sorts/dedups
   * first. Empty and single-element input are valid.
   */
  static fromSorted(
    keys: readonly number[],
    values: readonly number[],
  ): ImmutableSortedMap {
    if (keys.length !== values.length) {
      throw new RangeError(
        `ImmutableSortedMap.fromSorted: keys/values length mismatch (${keys.length} !== ${values.length})`,
      );
    }
    const k = keys.map((x) => i32(x, "key"));
    const v = values.map((x) => i32(x, "value"));
    assertStrictlyAscending(k);
    return new ImmutableSortedMap(k, v);
  }

  /** Number of entries. */
  get size(): number {
    return this._keys.length;
  }

  /** Alias for {@link size} (JS array/string convention). */
  get length(): number {
    return this._keys.length;
  }

  /** Whether the map is empty. */
  isEmpty(): boolean {
    return this._keys.length === 0;
  }

  /** The value for `key`, or `undefined` if absent. */
  get(key: number): V | undefined {
    const i = binarySearch(this._keys, key);
    return i >= 0 ? (this._values[i] as V) : undefined;
  }

  /** Whether `key` is present. */
  containsKey(key: number): boolean {
    return binarySearch(this._keys, key) >= 0;
  }

  /** Alias for {@link containsKey}. */
  hasKey(key: number): boolean {
    return this.containsKey(key);
  }

  // ── first / last ────────────────────────────────────────────────────

  /** Minimum key, or `undefined` if empty. */
  firstKey(): K | undefined {
    return this._keys.length === 0 ? undefined : (this._keys[0] as K);
  }

  /** Maximum key, or `undefined` if empty. */
  lastKey(): K | undefined {
    return this._keys.length === 0
      ? undefined
      : (this._keys[this._keys.length - 1] as K);
  }

  /** Minimum `[key, value]` entry, or `undefined`. */
  firstEntry(): [K, V] | undefined {
    return this._keys.length === 0
      ? undefined
      : ([this._keys[0], this._values[0]] as [K, V]);
  }

  /** Maximum `[key, value]` entry, or `undefined`. */
  lastEntry(): [K, V] | undefined {
    const n = this._keys.length;
    return n === 0
      ? undefined
      : ([this._keys[n - 1], this._values[n - 1]] as [K, V]);
  }

  // ── point navigation (NavigableMap surface, reused verbatim) ────────
  //
  // floor `<= k`, ceiling `>= k`, lower `< k` (strict), higher `> k` (strict).
  // All resolve to a single binary search over the packed key array; the index
  // arithmetic never computes a `k ± 1`, so it is overflow-safe at the signed
  // extremes.

  private floorIndex(k: number): number {
    const r = binarySearch(this._keys, k);
    return r >= 0 ? r : ~r - 1; // hit, or one below the insertion point
  }

  private ceilingIndex(k: number): number {
    const i = lowerBound(this._keys, k);
    return i < this._keys.length ? i : -1;
  }

  private lowerIndex(k: number): number {
    return lowerBound(this._keys, k) - 1;
  }

  private higherIndex(k: number): number {
    const r = binarySearch(this._keys, k);
    const i = r >= 0 ? r + 1 : ~r;
    return i < this._keys.length ? i : -1;
  }

  /** Greatest key `<= k`, or `undefined`. */
  floorKey(k: number): K | undefined {
    const i = this.floorIndex(k);
    return i >= 0 ? (this._keys[i] as K) : undefined;
  }

  /** Greatest key `<= k` and its value, or `undefined`. */
  floorEntry(k: number): [K, V] | undefined {
    const i = this.floorIndex(k);
    return i >= 0 ? ([this._keys[i], this._values[i]] as [K, V]) : undefined;
  }

  /** Least key `>= k`, or `undefined`. */
  ceilingKey(k: number): K | undefined {
    const i = this.ceilingIndex(k);
    return i >= 0 ? (this._keys[i] as K) : undefined;
  }

  /** Least key `>= k` and its value, or `undefined`. */
  ceilingEntry(k: number): [K, V] | undefined {
    const i = this.ceilingIndex(k);
    return i >= 0 ? ([this._keys[i], this._values[i]] as [K, V]) : undefined;
  }

  /** Greatest key `< k` (strict), or `undefined`. */
  lowerKey(k: number): K | undefined {
    const i = this.lowerIndex(k);
    return i >= 0 ? (this._keys[i] as K) : undefined;
  }

  /** Greatest key `< k` (strict) and its value, or `undefined`. */
  lowerEntry(k: number): [K, V] | undefined {
    const i = this.lowerIndex(k);
    return i >= 0 ? ([this._keys[i], this._values[i]] as [K, V]) : undefined;
  }

  /** Least key `> k` (strict), or `undefined`. */
  higherKey(k: number): K | undefined {
    const i = this.higherIndex(k);
    return i >= 0 ? (this._keys[i] as K) : undefined;
  }

  /** Least key `> k` (strict) and its value, or `undefined`. */
  higherEntry(k: number): [K, V] | undefined {
    const i = this.higherIndex(k);
    return i >= 0 ? ([this._keys[i], this._values[i]] as [K, V]) : undefined;
  }

  // ── order statistics (rank / select) ────────────────────────────────
  //
  // On a flat ascending array `rank` IS the lower-bound binary-search index and
  // `selectKey(i)` IS `keys[i]`, so they are trivially consistent with the
  // iteration order — no subtree-size augmentation needed.

  /**
   * Number of keys **strictly less than** `key` — the 0-based lower-bound index
   * `key` occupies (if present) or would occupy (if absent), in `0..=size`.
   * Defined for present and absent keys.
   */
  rank(key: number): number {
    return lowerBound(this._keys, key);
  }

  /**
   * The `i`-th smallest key (0-based), or `undefined` if `i >= size` or `i < 0`.
   * Round-trips with {@link rank}: `selectKey(rank(k)) === k` for present `k`.
   */
  selectKey(i: number): K | undefined {
    const idx = selectIndex(i);
    return idx >= 0 && idx < this._keys.length ? (this._keys[idx] as K) : undefined;
  }

  /** The `i`-th smallest `[key, value]` entry (0-based), or `undefined`. */
  selectEntry(i: number): [K, V] | undefined {
    const idx = selectIndex(i);
    return idx >= 0 && idx < this._keys.length
      ? ([this._keys[idx], this._values[idx]] as [K, V])
      : undefined;
  }

  // ── iteration (ascending) ───────────────────────────────────────────

  /** Keys in ascending order (snapshot copy). */
  keys(): K[] {
    return this._keys.slice() as K[];
  }

  /** Values in **ascending-key order** (paired with {@link keys}), NOT value-sorted. */
  values(): V[] {
    return this._values.slice() as V[];
  }

  /** `[key, value]` entries in ascending key order. */
  entries(): [K, V][] {
    return this._keys.map((k, i) => [k, this._values[i]] as [K, V]);
  }

  // ── iteration (descending) — required, not optional ─────────────────

  /** All keys, descending. */
  descendingKeys(): K[] {
    return this._keys.slice().reverse() as K[];
  }

  /** All `[key, value]` entries, descending. */
  descendingEntries(): [K, V][] {
    const out: [K, V][] = [];
    for (let i = this._keys.length - 1; i >= 0; i--) {
      out.push([this._keys[i], this._values[i]] as [K, V]);
    }
    return out;
  }

  // ── range queries (consume `Range`; membership == range.contains) ───
  //
  // The in-range entries form a CONTIGUOUS slice of the packed array (the range
  // is convex), bracketed by two binary searches via `Range.bracket`. The
  // brackets come from the range's CUT semantics (`Below(v)`/`Above(v)`/
  // unbounded), never from `v ± 1` arithmetic, so open/closed bounds at
  // `INT_MIN`/`INT_MAX` do not overflow. `open(1, 2)` over i32 yields an empty
  // slice (membership is `contains`, never inferred cut-emptiness).

  /** Keys whose key ∈ `range`, ascending. */
  rangeKeys(range: Range<number>): K[] {
    const [lo, hi] = range.bracket(this._keys);
    return this._keys.slice(lo, hi) as K[];
  }

  /** `[key, value]` entries whose key ∈ `range`, ascending. */
  rangeEntries(range: Range<number>): [K, V][] {
    const [lo, hi] = range.bracket(this._keys);
    const out: [K, V][] = [];
    for (let i = lo; i < hi; i++) {
      out.push([this._keys[i], this._values[i]] as [K, V]);
    }
    return out;
  }

  /** Keys whose key ∈ `range`, descending. */
  descendingRangeKeys(range: Range<number>): K[] {
    return this.rangeKeys(range).reverse();
  }

  /** `[key, value]` entries whose key ∈ `range`, descending. */
  descendingRangeEntries(range: Range<number>): [K, V][] {
    return this.rangeEntries(range).reverse();
  }

  // ── mutators (present only to trap) ─────────────────────────────────

  /** @throws Error always — the map is immutable. */
  set(_key: number, _value: number): never {
    throw new Error(MUTATOR_MESSAGE);
  }

  /** @throws Error always — the map is immutable. */
  put(_key: number, _value: number): never {
    throw new Error(MUTATOR_MESSAGE);
  }

  /** @throws Error always — the map is immutable. */
  remove(_key: number): never {
    throw new Error(MUTATOR_MESSAGE);
  }

  /** @throws Error always — the map is immutable. */
  clear(): never {
    throw new Error(MUTATOR_MESSAGE);
  }
}

/**
 * A compact immutable sorted set backed by a single packed ascending array,
 * queried by binary search. The element analogue of {@link ImmutableSortedMap}.
 */
export class ImmutableSortedSet<T extends number = number> {
  private readonly _elems: number[];

  private constructor(elems: number[]) {
    this._elems = elems;
  }

  /**
   * Build from a **strictly ascending** element array (copied — snapshot).
   *
   * @throws RangeError if the elements are not strictly ascending or contain a
   * duplicate. Empty and single-element input are valid.
   */
  static fromSorted(elements: readonly number[]): ImmutableSortedSet {
    const e = elements.map((x) => i32(x, "element"));
    assertStrictlyAscending(e);
    return new ImmutableSortedSet(e);
  }

  /** Number of elements. */
  get size(): number {
    return this._elems.length;
  }

  /** Alias for {@link size}. */
  get length(): number {
    return this._elems.length;
  }

  /** Whether the set is empty. */
  isEmpty(): boolean {
    return this._elems.length === 0;
  }

  /** Whether `elem` is present. */
  contains(elem: number): boolean {
    return binarySearch(this._elems, elem) >= 0;
  }

  /** Alias for {@link contains}. */
  has(elem: number): boolean {
    return this.contains(elem);
  }

  /** Minimum element, or `undefined`. */
  first(): T | undefined {
    return this._elems.length === 0 ? undefined : (this._elems[0] as T);
  }

  /** Maximum element, or `undefined`. */
  last(): T | undefined {
    return this._elems.length === 0
      ? undefined
      : (this._elems[this._elems.length - 1] as T);
  }

  // ── point navigation ───────────────────────────────────────────────

  /** Greatest element `<= k`, or `undefined`. */
  floor(k: number): T | undefined {
    const r = binarySearch(this._elems, k);
    const i = r >= 0 ? r : ~r - 1;
    return i >= 0 ? (this._elems[i] as T) : undefined;
  }

  /** Least element `>= k`, or `undefined`. */
  ceiling(k: number): T | undefined {
    const i = lowerBound(this._elems, k);
    return i < this._elems.length ? (this._elems[i] as T) : undefined;
  }

  /** Greatest element `< k` (strict), or `undefined`. */
  lower(k: number): T | undefined {
    const i = lowerBound(this._elems, k) - 1;
    return i >= 0 ? (this._elems[i] as T) : undefined;
  }

  /** Least element `> k` (strict), or `undefined`. */
  higher(k: number): T | undefined {
    const r = binarySearch(this._elems, k);
    const i = r >= 0 ? r + 1 : ~r;
    return i < this._elems.length ? (this._elems[i] as T) : undefined;
  }

  // ── order statistics (rank / select) ────────────────────────────────

  /** Number of elements **strictly less than** `elem` (lower-bound index). */
  rank(elem: number): number {
    return lowerBound(this._elems, elem);
  }

  /** The `i`-th smallest element (0-based), or `undefined` if `i >= size` or `i < 0`. */
  select(i: number): T | undefined {
    const idx = selectIndex(i);
    return idx >= 0 && idx < this._elems.length
      ? (this._elems[idx] as T)
      : undefined;
  }

  // ── iteration ───────────────────────────────────────────────────────

  /** Elements in ascending order (snapshot copy). */
  elements(): T[] {
    return this._elems.slice() as T[];
  }

  /** All elements, descending. */
  descendingElements(): T[] {
    return this._elems.slice().reverse() as T[];
  }

  /** Elements ∈ `range`, ascending. Bracketed by two binary searches from the range's cut semantics. */
  rangeElements(range: Range<number>): T[] {
    const [lo, hi] = range.bracket(this._elems);
    return this._elems.slice(lo, hi) as T[];
  }

  /** Elements ∈ `range`, descending. */
  descendingRangeElements(range: Range<number>): T[] {
    return this.rangeElements(range).reverse();
  }

  // ── mutators (present only to trap) ─────────────────────────────────

  /** @throws Error always — the set is immutable. */
  add(_elem: number): never {
    throw new Error(MUTATOR_MESSAGE);
  }

  /** @throws Error always — the set is immutable. */
  remove(_elem: number): never {
    throw new Error(MUTATOR_MESSAGE);
  }

  /** @throws Error always — the set is immutable. */
  clear(): never {
    throw new Error(MUTATOR_MESSAGE);
  }
}
