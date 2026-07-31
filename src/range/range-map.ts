// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * {@link RangeMap} — a mutable piecewise mapping from disjoint non-empty
 * {@link Range}s to values (v1 ships the `number`/i32 → `number`/i32
 * specialisation).
 *
 * Like {@link RangeSet}, a `RangeMap` is **always maximally merged** — but per
 * value: {@link RangeMap.put} is last-writer-wins (it clips/splits every
 * overlapping prior entry) and then **coalesces** the inserted entry with
 * connected neighbours holding an **equal** value. A **different** value is a
 * barrier and is never absorbed or crossed. The normal form therefore carries a
 * global invariant: no two connected entries hold an equal value.
 *
 * ## Divergence from Guava
 *
 * `TreeRangeMap.put` does not coalesce; coalescing lives in a separate
 * `putCoalescing`. We fold it into `put` and do **not** expose `putCoalescing`.
 * Guava's split is a compatibility retrofit (`RangeMap` is `@since 14.0`,
 * `putCoalescing` `@since 22.0`, by which point `put`'s behaviour was observable
 * through `asMapOfRanges()` and could not be changed); we have no such
 * constraint. See `spec/features/range-set-map.md` §Coalescing.
 *
 * Every clip / split / merge / ordering decision reduces to the side-aware cut
 * comparisons of {@link Range}; there is no `±1` endpoint arithmetic (the
 * `INT_MIN`/`INT_MAX` overflow trap).
 *
 * The backing is a flat array of entries kept in normal form: entry ranges
 * non-empty, pairwise disjoint, each value mapped by at most one point,
 * ascending by lower cut. The order is unobservable beyond
 * {@link RangeMap.asMapOfRanges}; a tree keyed by lower cut would give
 * identical results.
 *
 * ## Views are snapshots
 *
 * {@link RangeMap.subRangeMap} returns a **new independent** `RangeMap` snapshot
 * (the intentional Guava divergence; see `spec/features/range-set-map.md`
 * §Views). Mutating the returned map never touches this one and vice versa.
 *
 * @typeParam T - the cut value type (v1 `number`/i32; generic for the matrix).
 * @typeParam V - the mapped value type (v1 `number`/i32).
 */

import { Range, validateI32Point } from "./range.js";

/** One `(range, value)` entry of a {@link RangeMap}, exposed by `asMapOfRanges`. */
export type RangeMapEntry<T, V> = [Range<T>, V];

export class RangeMap<T, V> {
  /** Normal form: non-empty, pairwise disjoint, ascending by lower cut. */
  private entries: { range: Range<T>; value: V }[];

  /** Construct an empty `RangeMap`. */
  constructor() {
    this.entries = [];
  }

  /**
   * Assign `value` to every point of `range`, last-writer-wins over any prior
   * overlap. Existing entries are clipped to the parts outside `range` (a
   * straddling entry splits into two, both keeping the old value); the new
   * `(range, value)` is then **coalesced** with any connected neighbour holding
   * an **equal** value and inserted. A **different** value is a barrier. A
   * cut-empty `range` is a **no-op**, decided before any clipping.
   */
  put(range: Range<T>, value: V): void {
    if (range.isEmpty()) return;
    this.clipOut(range);

    // Coalesce outward from the insertion position. Because the normal form is
    // maintained by every put, AT MOST ONE entry per side is absorbable: if the
    // neighbour is absorbed, the entry beyond it was already either
    // disconnected from it or differently-valued, and stays so against the
    // grown range. Each loop therefore runs at most once. They are loops rather
    // than ifs so a normal form violated by a bug elsewhere degrades into a
    // correct (if slower) result instead of a malformed map.
    const pos = this.insertionPoint(range);
    let merged = range;

    let lo = pos;
    while (lo > 0) {
      const e = this.entries[lo - 1];
      if (e.value !== value || !e.range.isConnected(merged)) break;
      merged = e.range.span(merged);
      lo--;
    }

    let hi = pos;
    while (hi < this.entries.length) {
      const e = this.entries[hi];
      if (e.value !== value || !e.range.isConnected(merged)) break;
      merged = e.range.span(merged);
      hi++;
    }

    this.entries.splice(lo, hi - lo, { range: merged, value });
  }

  /** The value mapped at `value`, or `undefined` if uncovered. */
  get(value: T): V | undefined {
    validateI32Point(value);
    for (const e of this.entries) {
      if (e.range.contains(value)) return e.value;
    }
    return undefined;
  }

  /**
   * The `(range, value)` entry covering `value`, or `undefined` if uncovered.
   */
  getEntry(value: T): RangeMapEntry<T, V> | undefined {
    validateI32Point(value);
    for (const e of this.entries) {
      if (e.range.contains(value)) return [e.range, e.value];
    }
    return undefined;
  }

  /**
   * Unmap `range`, **splitting** any entry straddling either boundary (both
   * fragments keep the old value). A cut-empty `range` is a **no-op**.
   */
  remove(range: Range<T>): void {
    if (range.isEmpty()) return;
    this.clipOut(range);
  }

  /**
   * The minimum range enclosing all entry ranges; `undefined` on an empty map.
   */
  span(): Range<T> | undefined {
    if (this.entries.length === 0) return undefined;
    const first = this.entries[0].range;
    const last = this.entries[this.entries.length - 1].range;
    return Range.fromCutsInternal(first.lowerCut(), last.upperCut());
  }

  /**
   * A **new** independent `RangeMap` restricted to `view` (each entry range
   * clipped to `view`, values preserved). `subRangeMap([3, 6))` of
   * `{[1, 5) → A, [8, 9] → B}` = `{[3, 5) → A}`.
   */
  subRangeMap(view: Range<T>): RangeMap<T, V> {
    const out: { range: Range<T>; value: V }[] = [];
    for (const e of this.entries) {
      const i = e.range.intersection(view);
      if (i !== null && !i.isEmpty()) out.push({ range: i, value: e.value });
    }
    const result = new RangeMap<T, V>();
    result.entries = out;
    return result;
  }

  /**
   * The canonical disjoint `(range, value)` entries, **ascending by lower cut**,
   * as a fresh array (mutating it does not affect the map).
   */
  asMapOfRanges(): RangeMapEntry<T, V>[] {
    return this.entries.map((e) => [e.range, e.value] as RangeMapEntry<T, V>);
  }

  /** Whether the map has no entries. */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /** Remove all entries. */
  clear(): void {
    this.entries = [];
  }

  // ---- internals ----------------------------------------------------------

  /**
   * Clip every entry to the parts outside `range` (the `remove` /
   * overlap-resolution split). A straddling entry becomes two fragments; an
   * entry fully inside `range` is dropped. Pure cut arithmetic — the boundary
   * cuts flip, never `±1`. Abutment alone (cut-empty intersection) leaves an
   * entry untouched.
   */
  private clipOut(range: Range<T>): void {
    const out: { range: Range<T>; value: V }[] = [];
    for (const e of this.entries) {
      const i = e.range.intersection(range);
      if (i !== null && !i.isEmpty()) {
        // Left fragment below the removed range's lower cut.
        if (
          Range.compareCutsNumeric(e.range.lowerCut(), range.lowerCut()) < 0
        ) {
          out.push({
            range: Range.fromCutsInternal(e.range.lowerCut(), range.lowerCut()),
            value: e.value,
          });
        }
        // Right fragment above the removed range's upper cut.
        if (
          Range.compareCutsNumeric(range.upperCut(), e.range.upperCut()) < 0
        ) {
          out.push({
            range: Range.fromCutsInternal(range.upperCut(), e.range.upperCut()),
            value: e.value,
          });
        }
      } else {
        out.push(e);
      }
    }
    this.entries = out;
  }

  /**
   * The ascending-by-lower-cut index at which `range` belongs: the first index
   * whose lower cut is above `range`'s. Callers must have already cleared the
   * overlap (via {@link RangeMap.clipOut}), so `range` is disjoint from every
   * remaining entry and every entry below the returned index lies strictly to
   * its left.
   */
  private insertionPoint(range: Range<T>): number {
    for (let i = 0; i < this.entries.length; i++) {
      if (
        Range.compareCutsNumeric(
          this.entries[i].range.lowerCut(),
          range.lowerCut(),
        ) > 0
      ) {
        return i;
      }
    }
    return this.entries.length;
  }
}
