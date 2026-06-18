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
 * Unlike {@link RangeSet}, a `RangeMap` does **NOT** coalesce across different
 * values. {@link RangeMap.put} is last-writer-wins: it clips/splits every
 * overlapping prior entry and inserts the new `(range, value)`, but leaves
 * adjacent equal-valued entries distinct. {@link RangeMap.putCoalescing} is the
 * variant that merges connected neighbours holding an **equal** value.
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

import { Range } from "./range.js";

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
   * `(range, value)` is then inserted. A cut-empty `range` is a **no-op**.
   * `put` does **NOT** coalesce — an adjacent equal value stays a distinct
   * entry.
   */
  put(range: Range<T>, value: V): void {
    if (range.isEmpty()) return;
    this.clipOut(range);
    this.insertEntry(range, value);
  }

  /**
   * Like {@link RangeMap.put}, then merges the inserted entry with any connected
   * (overlapping or abutting) neighbour whose value **equals** `value`,
   * producing one entry spanning the union. Neighbours with a **different**
   * value are left untouched (clipped by the `put` step as usual). A cut-empty
   * `range` is a **no-op**.
   */
  putCoalescing(range: Range<T>, value: V): void {
    if (range.isEmpty()) return;
    this.clipOut(range);
    // Span over every connected entry with an EQUAL value, dropping them.
    let merged = range;
    const out: { range: Range<T>; value: V }[] = [];
    for (const e of this.entries) {
      if (e.value === value && e.range.isConnected(merged)) {
        merged = e.range.span(merged);
      } else {
        out.push(e);
      }
    }
    this.entries = out;
    this.insertEntry(merged, value);
  }

  /** The value mapped at `value`, or `undefined` if uncovered. */
  get(value: T): V | undefined {
    for (const e of this.entries) {
      if (e.range.contains(value)) return e.value;
    }
    return undefined;
  }

  /**
   * The `(range, value)` entry covering `value`, or `undefined` if uncovered.
   */
  getEntry(value: T): RangeMapEntry<T, V> | undefined {
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
   * Insert `(range, value)` at its ascending-by-lower-cut position. Callers
   * must have already cleared the overlap (via {@link RangeMap.clipOut}); the
   * range is disjoint from every remaining entry.
   */
  private insertEntry(range: Range<T>, value: V): void {
    let pos = this.entries.length;
    for (let i = 0; i < this.entries.length; i++) {
      if (
        Range.compareCutsNumeric(
          this.entries[i].range.lowerCut(),
          range.lowerCut(),
        ) > 0
      ) {
        pos = i;
        break;
      }
    }
    this.entries.splice(pos, 0, { range, value });
  }
}
