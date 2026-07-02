// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Bound / Range value model — a pure in-memory value type describing a region
 * `[lo, hi)`, `(-∞, hi]`, `(lo, +∞)`, … with each endpoint independently
 * unbounded / open / closed.
 *
 * This is NOT {@link NumberInterval} (which materialises an arithmetic
 * progression and enumerates elements). A {@link Range} holds no elements; it
 * only describes a region (`contains(x)`) and supports the open/unbounded
 * endpoints `Interval` cannot.
 *
 * The design follows Google Guava's `Range<C>` / `BoundType` / `Cut`. The
 * algebra (`intersection`, `span`, `isConnected`, `encloses`) is total and
 * unambiguous because endpoints are modelled as cuts *between* values rather
 * than `(value, inclusive)` pairs. See `spec/features/bound-range.md` for the
 * normative algorithms; every operation here reduces to a side-aware cut
 * comparison, never to a `(value, inclusive)` boolean.
 *
 * ## Side-aware cut ordering
 *
 * `Unbounded` is contextual: as a lower cut it is `-∞`, as an upper cut it is
 * `+∞`. There is therefore no single context-free order on one `Unbounded`
 * value. We avoid that trap by splitting the unbounded state into two distinct
 * sentinels — `BelowAll` (`-∞`) and `AboveAll` (`+∞`). With those two sentinels
 * the four-variant cut has a single total order
 * (`BelowAll < Below(v) < Above(v) < AboveAll`, finite cuts breaking ties by
 * value then `Below < Above`), and the three spec comparators
 * (`compareLowerCuts`, `compareUpperCuts`, `compareLowerToUpper`) all collapse
 * onto it. A lower cut never holds `AboveAll`; an upper cut never holds
 * `BelowAll`; that invariant is established by the factories.
 *
 * ## TypeScript v1 surface
 *
 * v1 ships the `number`/i32 specialisation (matching the cross-language
 * validation universe), ordered by numeric order via {@link cmpNumber}. The
 * type parameter `T` is reserved for the float / wider-integer matrix, at which
 * point a comparator is threaded through the factories (mirroring the float
 * total-order contract). Per `spec/style/typescript.md`, a bare `a < b` on a
 * generic `T` is never used as the ordering primitive — comparison goes through
 * the numeric comparator.
 */

/** The kind of a finite endpoint: `Open` (exclusive) or `Closed` (inclusive). */
export enum BoundType {
  Open,
  Closed,
}

/**
 * The four-variant cut tag. A cut sits *between* values (Guava's `Cut`). The
 * two distinct unbounded sentinels (`BelowAll` = `-∞`, `AboveAll` = `+∞`) give
 * the cut a single, total, context-free order — there is no lone `Unbounded`
 * value with an ambiguous position.
 */
export enum CutKind {
  BelowAll,
  Below,
  Above,
  AboveAll,
}

/**
 * A cut between values.
 *
 * - `BelowAll` — `-∞`. Only ever a lower cut.
 * - `Below(v)` — the cut immediately below `v` (closed lower `[v` / open upper `v)`).
 * - `Above(v)` — the cut immediately above `v` (open lower `(v` / closed upper `v]`).
 * - `AboveAll` — `+∞`. Only ever an upper cut.
 *
 * Total order: `BelowAll < Below(v) < Above(v) < AboveAll`. Finite cuts at
 * different values order by value; at the same value `Below(v) < Above(v)`.
 */
export type Cut<T> =
  | { readonly kind: CutKind.BelowAll }
  | { readonly kind: CutKind.Below; readonly value: T }
  | { readonly kind: CutKind.Above; readonly value: T }
  | { readonly kind: CutKind.AboveAll };

const BELOW_ALL: Cut<never> = { kind: CutKind.BelowAll };
const ABOVE_ALL: Cut<never> = { kind: CutKind.AboveAll };

/**
 * The `-∞` lower-cut sentinel, exported for the cut-region structures
 * ({@link RangeSet} complement) that build ranges directly from cuts. Only ever
 * a lower cut.
 */
export const BELOW_ALL_CUT: Cut<never> = BELOW_ALL;

/**
 * The `+∞` upper-cut sentinel, exported for the cut-region structures
 * ({@link RangeSet} complement). Only ever an upper cut.
 */
export const ABOVE_ALL_CUT: Cut<never> = ABOVE_ALL;

function below<T>(value: T): Cut<T> {
  return { kind: CutKind.Below, value };
}
function above<T>(value: T): Cut<T> {
  return { kind: CutKind.Above, value };
}

/**
 * The numeric comparator used for the v1 `number`/i32 specialisation. Returns
 * negative / zero / positive. This is the ordering primitive; no bare `<` is
 * emitted on a generic `T`. For the float widening this will be replaced by the
 * IEEE-754 total-order comparator (see `algorithms.md`).
 */
function cmpNumber(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Validate + canonicalize a v1 `number` endpoint to the signed-int32 universe
 * that the other four ports (Rust i32, Go int32, Zig i32, Java boxed Integer)
 * share. Rejects non-integers, non-finite, and out-of-int32-range values —
 * none have a cross-language i32 counterpart — and normalizes `-0` to `+0` so
 * structural equality (`Object.is`) and the bit-faithful hash stay consistent
 * with the numeric comparator (`cmpNumber` treats `-0 == +0`). Float ranges are
 * a later widening that will use the IEEE-754 total order instead.
 */
function i32Endpoint(v: number): number {
  if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) {
    throw new RangeError(
      `Range<i32>: endpoint must be a signed 32-bit integer, got ${String(v)}`,
    );
  }
  return v === 0 ? 0 : v; // -0 === 0 is true → canonicalize -0 to +0
}

/**
 * Validate a v1 `number` **query point** (the argument of `contains` /
 * `rangeContaining` / RangeMap `get`/`getEntry`) against the signed-int32
 * universe the four typed ports (Rust i32, Go int32, Zig i32, Java boxed
 * Integer) share. The typed ports cannot even *express* a non-i32 point query —
 * the parameter is statically `i32` — so `Range.open(1, 2).contains(1.5)` has no
 * cross-language counterpart and must throw rather than silently answer (it
 * would wrongly report `true` since `1 < 1.5 < 2` numerically, whereas no `i32`
 * lies in `(1, 2)`). Mirrors {@link i32Endpoint}; throws on non-integer,
 * non-finite, or out-of-int32-range. Float-point queries are a later widening.
 */
function i32Point(v: number): void {
  if (!Number.isInteger(v) || v < -2147483648 || v > 2147483647) {
    throw new RangeError(
      `Range<i32>: query point must be a signed 32-bit integer, got ${String(v)}`,
    );
  }
}

/**
 * Validate a v1 point-query argument for the {@link RangeSet}/{@link RangeMap}
 * point queries, so the i32 check fires even when the structure is empty (and so
 * never reaches a {@link Range.contains} call). Mirrors the in-range check in
 * {@link Range.contains}; non-`number` `T` is left for the later widening.
 */
export function validateI32Point<T>(v: T): void {
  if (typeof v === "number") i32Point(v);
}

/**
 * Total order on cuts (the single source of truth for the algebra), using
 * `cmp` to order the finite endpoint values. The three side-aware spec
 * comparators all reduce to this because the two unbounded states are distinct
 * sentinels rather than one ambiguous `Unbounded`.
 */
function compareCuts<T>(
  a: Cut<T>,
  b: Cut<T>,
  cmp: (x: T, y: T) => number,
): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb || ra !== 1) {
    // At least one is a sentinel, or they sit in different rank bands.
    return ra - rb;
  }
  // Both finite (Below/Above). Order by value, then Below(v) < Above(v).
  const av = (a as { value: T }).value;
  const bv = (b as { value: T }).value;
  const byValue = cmp(av, bv);
  if (byValue !== 0) return byValue;
  const sa = a.kind === CutKind.Above ? 1 : 0;
  const sb = b.kind === CutKind.Above ? 1 : 0;
  return sa - sb;
}

function rank<T>(c: Cut<T>): number {
  switch (c.kind) {
    case CutKind.BelowAll:
      return 0;
    case CutKind.Below:
    case CutKind.Above:
      return 1;
    case CutKind.AboveAll:
      return 2;
  }
}

function maxCut<T>(a: Cut<T>, b: Cut<T>, cmp: (x: T, y: T) => number): Cut<T> {
  return compareCuts(a, b, cmp) < 0 ? b : a;
}
function minCut<T>(a: Cut<T>, b: Cut<T>, cmp: (x: T, y: T) => number): Cut<T> {
  return compareCuts(a, b, cmp) > 0 ? b : a;
}

/**
 * An ordered region `(lowerCut, upperCut)` over a totally-ordered `T`, with the
 * invariant `lowerCut <= upperCut`. Equality and hashing are structural on the
 * two cuts — `closedOpen(v, v)` and `openClosed(v, v)` are distinct (both
 * empty) values.
 *
 * v1 public surface is the `number`/i32 specialisation: all factories take and
 * return `Range<number>`.
 */
export class Range<T> {
  private readonly _lower: Cut<T>;
  private readonly _upper: Cut<T>;
  private readonly _cmp: (a: T, b: T) => number;

  private constructor(
    lower: Cut<T>,
    upper: Cut<T>,
    cmp: (a: T, b: T) => number,
  ) {
    this._lower = lower;
    this._upper = upper;
    this._cmp = cmp;
  }

  /**
   * Construct from raw cuts after validating `lower <= upper`. Throws
   * `RangeError` if the cuts are out of order (a programming error, like
   * `Interval` reversed at the minimum step).
   */
  private static fromCuts(
    lower: Cut<number>,
    upper: Cut<number>,
  ): Range<number> {
    if (compareCuts(lower, upper, cmpNumber) > 0) {
      throw new RangeError("Range: lower cut must not exceed upper cut");
    }
    return new Range<number>(lower, upper, cmpNumber);
  }

  // ---- factories (Guava-parity names) -------------------------------------

  /**
   * `(a, b)` — both endpoints open. Throws if `a >= b` (incl. `open(v, v)`,
   * which is empty-but-invalid-as-open).
   */
  static open(a: number, b: number): Range<number> {
    return Range.fromCuts(above(i32Endpoint(a)), below(i32Endpoint(b)));
  }

  /** `[a, b]` — both endpoints closed. Throws if `a > b`. */
  static closed(a: number, b: number): Range<number> {
    return Range.fromCuts(below(i32Endpoint(a)), above(i32Endpoint(b)));
  }

  /** `(a, b]`. Throws if `a > b`. */
  static openClosed(a: number, b: number): Range<number> {
    return Range.fromCuts(above(i32Endpoint(a)), above(i32Endpoint(b)));
  }

  /**
   * `[a, b)`. Throws if `a > b`. `closedOpen(v, v)` is the valid empty range
   * `(Below(v), Below(v))`.
   */
  static closedOpen(a: number, b: number): Range<number> {
    return Range.fromCuts(below(i32Endpoint(a)), below(i32Endpoint(b)));
  }

  /** `(a, +∞)`. */
  static greaterThan(a: number): Range<number> {
    return Range.fromCuts(above(i32Endpoint(a)), ABOVE_ALL);
  }

  /** `[a, +∞)`. */
  static atLeast(a: number): Range<number> {
    return Range.fromCuts(below(i32Endpoint(a)), ABOVE_ALL);
  }

  /** `(-∞, b)`. */
  static lessThan(b: number): Range<number> {
    return Range.fromCuts(BELOW_ALL, below(i32Endpoint(b)));
  }

  /** `(-∞, b]`. */
  static atMost(b: number): Range<number> {
    return Range.fromCuts(BELOW_ALL, above(i32Endpoint(b)));
  }

  /** `(-∞, +∞)`. */
  static all(): Range<number> {
    return new Range<number>(BELOW_ALL, ABOVE_ALL, cmpNumber);
  }

  /** `[v, v]`. */
  static singleton(v: number): Range<number> {
    const e = i32Endpoint(v);
    return Range.fromCuts(below(e), above(e));
  }

  /**
   * Construct a `Range` directly from two already-valid cuts (`lower <= upper`),
   * **bypassing endpoint re-validation**. This is the cut-algebra constructor the
   * {@link RangeSet} / {@link RangeMap} split / complement / clip paths use: the
   * cuts they pass are derived from *existing* (already-validated) ranges via
   * {@link lowerCut} / {@link upperCut} and {@link Cut} comparisons, never from
   * `±1` endpoint arithmetic — so the `i32Endpoint` factory check is neither
   * needed nor desired (it would reject the `BelowAll`/`AboveAll` sentinels that
   * have no numeric endpoint). The `lower <= upper` invariant is still asserted.
   *
   * Mirrors the Rust reference's `Range::from_cuts_internal`. Not part of the
   * public Guava-parity factory surface; it exists for the cut-region structures
   * that own this file's cut model.
   */
  static fromCutsInternal<T>(lower: Cut<T>, upper: Cut<T>): Range<T> {
    // The structures only ever pass i32 cuts (cmpNumber), and the cuts come
    // from existing valid ranges, so the comparator is the numeric one.
    if (compareCuts(lower, upper, cmpNumber as (a: T, b: T) => number) > 0) {
      throw new RangeError("Range: lower cut must not exceed upper cut");
    }
    return new Range<T>(lower, upper, cmpNumber as (a: T, b: T) => number);
  }

  /**
   * Total order on two cuts under the v1 `number`/i32 comparator — the single
   * cut comparator the {@link RangeSet}/{@link RangeMap} cut algebra needs
   * (coalescing position, complement gaps, clip boundaries). Returns
   * negative / zero / positive. Exposed here so those structures reuse this
   * file's one cut-order definition rather than re-deriving it (and never emit a
   * bare `a < b`). For the float widening this routes through the IEEE-754
   * total-order comparator, exactly as the factories will.
   */
  static compareCutsNumeric<T>(a: Cut<T>, b: Cut<T>): number {
    return compareCuts(a, b, cmpNumber as (x: T, y: T) => number);
  }

  // ---- queries ------------------------------------------------------------

  /**
   * Whether `x` falls within the range (normative `contains`).
   *
   * In the v1 `number`/i32 specialisation, `x` is validated to be a signed
   * 32-bit integer (the only point the four typed ports can express): a
   * non-i32 such as `1.5` throws rather than silently answering, since the
   * cross-language contract has no non-i32 query point. This is the single
   * point-query choke point — {@link RangeSet.contains}/`rangeContaining` and
   * {@link RangeMap.get}/`getEntry` all reduce to it.
   */
  contains(x: T): boolean {
    if (typeof x === "number") i32Point(x);
    const lo = this._lower;
    const lowerOk =
      lo.kind === CutKind.BelowAll
        ? true
        : lo.kind === CutKind.Below
          ? this._cmp(lo.value, x) <= 0
          : lo.kind === CutKind.Above
            ? this._cmp(lo.value, x) < 0
            : false; // AboveAll never a lower cut
    if (!lowerOk) return false;
    const hi = this._upper;
    const upperOk =
      hi.kind === CutKind.AboveAll
        ? true
        : hi.kind === CutKind.Below
          ? this._cmp(x, hi.value) < 0
          : hi.kind === CutKind.Above
            ? this._cmp(x, hi.value) <= 0
            : false; // BelowAll never an upper cut
    return upperOk;
  }

  /**
   * Cut-empty: `lowerCut == upperCut`. NOT discrete cardinality — `open(1, 2)`
   * over `i32` is not empty (no `DiscreteDomain` in Phase 0).
   */
  isEmpty(): boolean {
    return compareCuts(this._lower, this._upper, this._cmp) === 0;
  }

  /** The bound type of the lower endpoint; `null` when unbounded. */
  lowerBoundType(): BoundType | null {
    switch (this._lower.kind) {
      case CutKind.Below:
        return BoundType.Closed;
      case CutKind.Above:
        return BoundType.Open;
      default:
        return null;
    }
  }

  /** The bound type of the upper endpoint; `null` when unbounded. */
  upperBoundType(): BoundType | null {
    switch (this._upper.kind) {
      case CutKind.Below:
        return BoundType.Open;
      case CutKind.Above:
        return BoundType.Closed;
      default:
        return null;
    }
  }

  /** The lower endpoint value; `null` when unbounded below. */
  lowerEndpoint(): T | null {
    const lo = this._lower;
    return lo.kind === CutKind.Below || lo.kind === CutKind.Above
      ? lo.value
      : null;
  }

  /** The upper endpoint value; `null` when unbounded above. */
  upperEndpoint(): T | null {
    const hi = this._upper;
    return hi.kind === CutKind.Below || hi.kind === CutKind.Above
      ? hi.value
      : null;
  }

  /** Whether the lower endpoint is finite. */
  hasLowerBound(): boolean {
    return (
      this._lower.kind === CutKind.Below || this._lower.kind === CutKind.Above
    );
  }

  /** Whether the upper endpoint is finite. */
  hasUpperBound(): boolean {
    return (
      this._upper.kind === CutKind.Below || this._upper.kind === CutKind.Above
    );
  }

  /**
   * The lower {@link Cut} of this range (the cut sitting at the lower
   * endpoint); `BelowAll` when unbounded below. Exposed so a packed
   * sorted-array collection (`ImmutableSortedMap`/`ImmutableSortedSet`) can
   * bracket a contiguous in-range slice directly from the cut semantics
   * (`Below(v)`/`Above(v)`/`BelowAll`), never from `±1` endpoint arithmetic —
   * the overflow trap at `INT_MIN`/`INT_MAX` the `sorted-table-map` spec guards
   * against.
   */
  lowerCut(): Cut<T> {
    return this._lower;
  }

  /** The upper {@link Cut} of this range; `AboveAll` when unbounded above. See {@link lowerCut}. */
  upperCut(): Cut<T> {
    return this._upper;
  }

  /**
   * Bracket the contiguous `[start, end)` index window of a **strictly
   * ascending** slice whose elements fall inside this range. Membership over a
   * sorted slice is contiguous (the range is convex), so two binary searches
   * suffice: `start` is the lower bound of the in-range window and `end` is one
   * past the last in-range element.
   *
   * The brackets are derived purely from the cut comparison — `Below(v)` vs
   * `Above(v)` vs the unbounded sentinels — so open/closed bounds at
   * `INT_MIN`/`INT_MAX` never compute a predecessor/successor (`v ± 1`) and
   * never overflow. `start === end` is an empty (possibly cut-empty or
   * discrete-empty, e.g. `open(1, 2)` over `i32`) result, never an error.
   */
  bracket(sorted: readonly T[]): [number, number] {
    const cmp = this._cmp;
    const n = sorted.length;
    // start: lower bound of the in-range window.
    const lo = this._lower;
    let start: number;
    switch (lo.kind) {
      case CutKind.BelowAll:
        start = 0;
        break;
      case CutKind.Below:
        // Closed lower `[v`: include v -> first key >= v.
        start = partitionPoint(sorted, (k) => cmp(k, lo.value) < 0);
        break;
      case CutKind.Above:
        // Open lower `(v`: exclude v -> first key > v.
        start = partitionPoint(sorted, (k) => cmp(k, lo.value) <= 0);
        break;
      case CutKind.AboveAll:
        // A lower cut is never AboveAll (factory invariant); treat as empty.
        start = n;
        break;
    }
    // end: one past the last in-range key.
    const hi = this._upper;
    let end: number;
    switch (hi.kind) {
      case CutKind.AboveAll:
        end = n;
        break;
      case CutKind.Below:
        // Open upper `v)`: exclude v -> first key >= v.
        end = partitionPoint(sorted, (k) => cmp(k, hi.value) < 0);
        break;
      case CutKind.Above:
        // Closed upper `v]`: include v -> first key > v.
        end = partitionPoint(sorted, (k) => cmp(k, hi.value) <= 0);
        break;
      case CutKind.BelowAll:
        // An upper cut is never BelowAll (factory invariant); empty.
        end = 0;
        break;
    }
    // Clamp: a fully-disjoint range can yield start > end; normalise to an
    // empty window so callers can slice safely.
    return start > end ? [end, end] : [start, end];
  }

  // ---- algebra (all via cut comparison) -----------------------------------

  /**
   * Cut-defined containment: `self.lower <= other.lower` and
   * `self.upper >= other.upper`. NOT `∀ value ∈ other: contains(value)` —
   * `[1, 5)` encloses the empty `[5, 5)` though `5 ∉ [1, 5)`.
   */
  encloses(other: Range<T>): boolean {
    return (
      compareCuts(this._lower, other._lower, this._cmp) <= 0 &&
      compareCuts(this._upper, other._upper, this._cmp) >= 0
    );
  }

  /**
   * Whether there is a (possibly empty) range enclosed by both. Cut-equal
   * endpoints count as connected (empty overlap).
   */
  isConnected(other: Range<T>): boolean {
    return (
      compareCuts(this._lower, other._upper, this._cmp) <= 0 &&
      compareCuts(other._lower, this._upper, this._cmp) <= 0
    );
  }

  /**
   * The overlap. `null` only when disconnected; abutting operands return a
   * present cut-empty range at the touch point.
   */
  intersection(other: Range<T>): Range<T> | null {
    if (!this.isConnected(other)) return null;
    const lower = maxCut(this._lower, other._lower, this._cmp);
    const upper = minCut(this._upper, other._upper, this._cmp);
    return new Range<T>(lower, upper, this._cmp);
  }

  /** The smallest range enclosing both. No cross-shape canonicalisation. */
  span(other: Range<T>): Range<T> {
    const lower = minCut(this._lower, other._lower, this._cmp);
    const upper = maxCut(this._upper, other._upper, this._cmp);
    return new Range<T>(lower, upper, this._cmp);
  }

  // ---- equality / hash ----------------------------------------------------

  /**
   * Structural equality on the two cuts. `closedOpen(v, v)` and
   * `openClosed(v, v)` are unequal (distinct empties); empties at different
   * positions are unequal.
   */
  equals(other: Range<T>): boolean {
    return (
      cutEquals(this._lower, other._lower) &&
      cutEquals(this._upper, other._upper)
    );
  }

  /** A hash over `(lowerCut, upperCut)`, consistent with {@link equals}. */
  hashCode(): number {
    let h = 17;
    h = (Math.imul(h, 31) + cutHash(this._lower)) | 0;
    h = (Math.imul(h, 31) + cutHash(this._upper)) | 0;
    return h;
  }

  toString(): string {
    const lo = this._lower;
    const hi = this._upper;
    const left =
      lo.kind === CutKind.BelowAll
        ? "(-∞"
        : lo.kind === CutKind.Below
          ? `[${String(lo.value)}`
          : lo.kind === CutKind.Above
            ? `(${String(lo.value)}`
            : "(+∞";
    const right =
      hi.kind === CutKind.AboveAll
        ? "+∞)"
        : hi.kind === CutKind.Below
          ? `${String(hi.value)})`
          : hi.kind === CutKind.Above
            ? `${String(hi.value)}]`
            : "-∞)";
    return `${left}, ${right}`;
  }
}

/**
 * First index `i` in `[0, len]` for which `pred(sorted[i])` is false, given a
 * `pred` that partitions the slice (all true then all false). The midpoint is
 * `lo + ((hi - lo) >> 1)`, never `(lo + hi) / 2`, so the search is
 * overflow-safe — relevant when ports compute indices from i32 keys at the
 * signed extremes (the brackets here index into the slice, not into the key
 * domain, but the overflow-safe midpoint is kept as the shared convention).
 */
function partitionPoint<T>(
  sorted: readonly T[],
  pred: (x: T) => boolean,
): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (pred(sorted[mid])) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function cutEquals<T>(a: Cut<T>, b: Cut<T>): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === CutKind.Below || a.kind === CutKind.Above) {
    // Object.is so the generic value model preserves float +0/-0 and NaN
    // bit-pattern semantics for the later float widening. In v1, endpoints are
    // canonicalized to int32 at the factory (i32Endpoint normalizes -0 to +0),
    // so no -0 cut ever reaches here and equality stays consistent with cmpNumber.
    return Object.is(a.value, (b as { value: T }).value);
  }
  return true;
}

function cutHash<T>(c: Cut<T>): number {
  switch (c.kind) {
    case CutKind.BelowAll:
      return 1;
    case CutKind.AboveAll:
      return 2;
    case CutKind.Below:
      return (Math.imul(3, 31) + valueHash(c.value)) | 0;
    case CutKind.Above:
      return (Math.imul(5, 31) + valueHash(c.value)) | 0;
  }
}

// Scratch view to derive a bit-faithful hash of a number's f64 pattern so -0
// hashes distinctly from +0 and NaN hashes by its bits (consistent with the
// `Object.is` equality used by cutEquals).
const _hashF64 = new Float64Array(1);
const _hashU32 = new Uint32Array(_hashF64.buffer);

function valueHash<T>(v: T): number {
  if (typeof v === "number") {
    _hashF64[0] = v;
    return (_hashU32[0] ^ _hashU32[1]) | 0;
  }
  return 0;
}
