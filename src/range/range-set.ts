// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * {@link RangeSet} — a mutable, auto-coalescing set of cut-regions over a
 * totally-ordered `T` (v1 ships the `number`/i32 specialisation).
 *
 * A `RangeSet` stores a collection of **disjoint, non-empty, pairwise
 * non-connected** {@link Range}s (the *normal form*). It auto-coalesces on
 * {@link RangeSet.add}: two ranges merge iff they are
 * {@link Range.isConnected} — which is **broader** than mere overlap, because an
 * *abutment* (a cut-touch, e.g. `[1, 3)` & `[3, 5)`) is also connected. Every
 * coalescing / split / complement / ordering decision reduces to the side-aware
 * cut comparisons of {@link Range} (`./range`); there is no `(value, inclusive)`
 * boolean reasoning and **no `±1` endpoint arithmetic** (the `INT_MIN`/`INT_MAX`
 * overflow trap).
 *
 * ## Cut-region, not integer-value-set
 *
 * Because Phase 0 has no `DiscreteDomain`, a `RangeSet` models *cut-regions*,
 * not the set of `i32` values they happen to contain. `add(open(1, 2))` over
 * `i32` produces a **non-empty** set whose single stored range `(1, 2)` is
 * cut-non-empty even though {@link RangeSet.contains} is false for every `i32`.
 * So `{}` and `{(1, 2)}` are **distinct** RangeSets. Every set-level predicate
 * ({@link RangeSet.isEmpty}, canonicality, {@link RangeSet.complement},
 * {@link RangeSet.intersects}, {@link RangeSet.span}) is defined on the stored
 * cut-regions; only the point queries ({@link RangeSet.contains} /
 * {@link RangeSet.rangeContaining}) ask about an actual `i32`.
 *
 * ## Backing
 *
 * The backing is a flat array of {@link Range}s kept in the normal form
 * (non-empty, pairwise non-connected, ascending by lower cut). The order is
 * unobservable beyond {@link RangeSet.asRanges}; a tree keyed by lower cut would
 * give identical results. The flat array is the cleanest match for the `i32`
 * validation universe and keeps the cut algebra in one place.
 *
 * ## Views are snapshots
 *
 * {@link RangeSet.complement} and {@link RangeSet.subRangeSet} return **new
 * independent** `RangeSet` snapshots (the intentional Guava divergence; see
 * `spec/features/range-set-map.md` §Views). Mutating the returned set never
 * touches this one and vice versa.
 *
 * @typeParam T - the cut value type. v1 publishes the `number`/i32
 *   specialisation; the generic parameter is reserved for the float / wider
 *   matrix (a comparator threaded through `Range`). Per `style/typescript.md` a
 *   bare `a < b` on a generic `T` is never emitted — comparison is the cut
 *   algebra of {@link Range}.
 */

import { Range, type Cut, BELOW_ALL_CUT, ABOVE_ALL_CUT } from "./range.js";

export class RangeSet<T> {
  /** Normal form: non-empty, pairwise non-connected, ascending by lower cut. */
  private ranges: Range<T>[];

  /** Construct an empty `RangeSet`. */
  constructor() {
    this.ranges = [];
  }

  /**
   * Union `range` in, coalescing **all connected** stored ranges. A
   * **cut-empty** `range` (e.g. `closedOpen(5, 5)`) is a **no-op**, decided by
   * {@link Range.isEmpty} (cut-empty), never by discrete cardinality —
   * `add(open(1, 2))` over `i32` **stores** the range. The merged range keeps
   * the **outer** cuts of every connected member (the cut `min`/`max`, no `±1`
   * math).
   */
  add(range: Range<T>): void {
    // Empty-range no-op (cut-empty), per the normative empty-range rule.
    if (range.isEmpty()) return;
    // Merge `range` with every connected stored range, spanning all of them.
    // Connectivity (overlap OR abutment) is the coalescing predicate.
    let merged = range;
    const out: Range<T>[] = [];
    for (const r of this.ranges) {
      if (r.isConnected(merged)) {
        merged = r.span(merged);
      } else {
        out.push(r);
      }
    }
    // Insert `merged` at its ascending-by-lower-cut position.
    let pos = out.length;
    for (let i = 0; i < out.length; i++) {
      if (cmpLower(out[i], merged) > 0) {
        pos = i;
        break;
      }
    }
    out.splice(pos, 0, merged);
    this.ranges = out;
  }

  /**
   * {@link RangeSet.add} each range; the final normal form is order-independent.
   */
  addAll(ranges: Iterable<Range<T>>): void {
    for (const r of ranges) this.add(r);
  }

  /**
   * Subtract `range`, **splitting** any stored range straddling either boundary.
   * A cut-empty `range` is a **no-op**. The split is pure cut arithmetic — the
   * boundary cuts flip (`remove([4, 7))` from `[1, 9]` leaves `[1, 4)` and
   * `[7, 9]`), never `±1`.
   */
  remove(range: Range<T>): void {
    if (range.isEmpty()) return;
    const out: Range<T>[] = [];
    for (const r of this.ranges) {
      const i = r.intersection(range);
      if (i !== null && !i.isEmpty()) {
        // Left fragment: r below the removed range's lower cut.
        if (compareCut(r.lowerCut(), range.lowerCut()) < 0) {
          out.push(Range.fromCutsInternal(r.lowerCut(), range.lowerCut()));
        }
        // Right fragment: r above the removed range's upper cut.
        if (compareCut(range.upperCut(), r.upperCut()) < 0) {
          out.push(Range.fromCutsInternal(range.upperCut(), r.upperCut()));
        }
      } else {
        out.push(r);
      }
    }
    this.ranges = out;
  }

  /**
   * Whether `value` falls in some stored range. This is the **only**
   * integer-point predicate — `(1, 2)` correctly contains no `i32`.
   */
  contains(value: T): boolean {
    return this.ranges.some((r) => r.contains(value));
  }

  /** The stored range containing `value`, or `undefined`. */
  rangeContaining(value: T): Range<T> | undefined {
    return this.ranges.find((r) => r.contains(value));
  }

  /**
   * Whether some **single** stored range encloses `range` (cut-defined
   * {@link Range.encloses}). A set covering `{[1, 3), [5, 9)}` does **not**
   * enclose `[2, 6)` — no single stored range does.
   */
  encloses(range: Range<T>): boolean {
    return this.ranges.some((r) => r.encloses(range));
  }

  /**
   * Whether {@link RangeSet.encloses} holds for **every** argument range.
   */
  enclosesAll(ranges: Iterable<Range<T>>): boolean {
    for (const r of ranges) {
      if (!this.encloses(r)) return false;
    }
    return true;
  }

  /**
   * Whether `range` has a **cut-non-empty intersection** with some stored
   * range — pure cut algebra. An **abutment** is *not* an intersection
   * (`intersects([3, 5))` against `[5, 9)` is false); a cut-empty query never
   * intersects; but a discrete-empty-yet-cut-non-empty overlap **does** count
   * (`intersects(open(1, 2))` against stored `(1, 2)` is **true**, though no
   * `i32` lies in it).
   */
  intersects(range: Range<T>): boolean {
    return this.ranges.some((r) => {
      const i = r.intersection(range);
      return i !== null && !i.isEmpty();
    });
  }

  /**
   * The minimum enclosing range `[min lower cut, max upper cut]`; `undefined`
   * on an empty set.
   */
  span(): Range<T> | undefined {
    if (this.ranges.length === 0) return undefined;
    const first = this.ranges[0];
    const last = this.ranges[this.ranges.length - 1];
    return Range.fromCutsInternal(first.lowerCut(), last.upperCut());
  }

  /**
   * A **new** independent `RangeSet` of the cut-region **gaps** between the
   * stored ranges over the full `(-∞, +∞)` domain. `complement(empty)` =
   * `{all()}`; `complement({all()})` = `{}`; no spurious `±∞` gap when an end is
   * already unbounded; the boundary side flips (closed↔open at the same cut
   * value). `complement ∘ complement == identity`.
   */
  complement(): RangeSet<T> {
    const out: Range<T>[] = [];
    // Walking cut: the lower cut of the next gap. Starts at `-∞`.
    let cursor: Cut<T> = BELOW_ALL_CUT as Cut<T>;
    for (const r of this.ranges) {
      // Gap from `cursor` up to this range's lower cut, when non-empty.
      if (compareCut(cursor, r.lowerCut()) < 0) {
        out.push(Range.fromCutsInternal(cursor, r.lowerCut()));
      }
      // Next gap starts just past this range's upper cut.
      cursor = r.upperCut();
    }
    // Trailing gap from the last upper cut to `+∞`, when non-empty.
    if (compareCut(cursor, ABOVE_ALL_CUT as Cut<T>) < 0) {
      out.push(Range.fromCutsInternal(cursor, ABOVE_ALL_CUT as Cut<T>));
    }
    const result = new RangeSet<T>();
    result.ranges = out;
    return result;
  }

  /**
   * A **new** independent `RangeSet` = this set **intersected** with `view`
   * (each stored range clipped to `view`). `subRangeSet([3, 6))` of
   * `{[1, 5), [8, 9]}` = `{[3, 5)}`.
   */
  subRangeSet(view: Range<T>): RangeSet<T> {
    const out: Range<T>[] = [];
    for (const r of this.ranges) {
      const i = r.intersection(view);
      if (i !== null && !i.isEmpty()) out.push(i);
    }
    // The stored ranges are ascending and disjoint, so their clipped images
    // stay ascending, disjoint, and non-connected.
    const result = new RangeSet<T>();
    result.ranges = out;
    return result;
  }

  /**
   * The canonical disjoint ranges, **ascending by lower cut**, as a fresh array
   * (mutating it does not affect the set).
   */
  asRanges(): Range<T>[] {
    return this.ranges.slice();
  }

  /**
   * Whether the set has **no stored ranges**. A cut-region predicate —
   * `{(1, 2)}` is **not** empty even though it contains no `i32`.
   */
  isEmpty(): boolean {
    return this.ranges.length === 0;
  }

  /** Remove all ranges. */
  clear(): void {
    this.ranges = [];
  }
}

/**
 * Total cut comparison (the four-variant `Cut` order; see {@link Range}). The
 * structures only ever hold i32 cuts, so this routes through the numeric cut
 * comparator that {@link Range} exposes.
 */
function compareCut<T>(a: Cut<T>, b: Cut<T>): number {
  return Range.compareCutsNumeric(a, b);
}

/** Compare two ranges by their lower cut. */
function cmpLower<T>(a: Range<T>, b: Range<T>): number {
  return compareCut(a.lowerCut(), b.lowerCut());
}
