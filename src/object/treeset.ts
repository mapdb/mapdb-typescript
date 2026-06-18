// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { Comparator } from "./strategy.js";
import type { Range } from "../range/range.js";
import { TreeMap } from "./treemap.js";

/**
 * Sorted set backed by a red-black tree with a pluggable {@link Comparator}.
 * Elements are maintained in the order defined by the comparator.
 */
export class TreeSet<T> {
  private readonly tree: TreeMap<T, undefined>;

  constructor(cmp: Comparator<T>) {
    this.tree = new TreeMap<T, undefined>(cmp);
  }

  // ── core ────────────────────────────────────────────────────────────

  add(value: T): this {
    this.tree.set(value, undefined);
    return this;
  }

  remove(value: T): boolean {
    if (!this.tree.has(value)) return false;
    this.tree.remove(value);
    return true;
  }

  has(value: T): boolean {
    return this.tree.has(value);
  }

  get size(): number {
    return this.tree.size;
  }

  isEmpty(): boolean {
    return this.tree.isEmpty();
  }

  clear(): void {
    this.tree.clear();
  }

  min(): T | undefined {
    const entry = this.tree.min();
    return entry !== undefined ? entry.key : undefined;
  }

  max(): T | undefined {
    const entry = this.tree.max();
    return entry !== undefined ? entry.key : undefined;
  }

  // ── point navigation (NavigableSet surface) ─────────────────────────

  /** Greatest element `<= x`, or `undefined`. */
  floor(x: T): T | undefined {
    return this.tree.floorKey(x);
  }

  /** Least element `>= x`, or `undefined`. */
  ceiling(x: T): T | undefined {
    return this.tree.ceilingKey(x);
  }

  /** Greatest element `< x` (strict), or `undefined`. */
  lower(x: T): T | undefined {
    return this.tree.lowerKey(x);
  }

  /** Least element `> x` (strict), or `undefined`. */
  higher(x: T): T | undefined {
    return this.tree.higherKey(x);
  }

  /** Minimum element, or `undefined`. Alias for {@link min}. */
  first(): T | undefined {
    return this.min();
  }

  /** Maximum element, or `undefined`. Alias for {@link max}. */
  last(): T | undefined {
    return this.max();
  }

  // ── poll (positional removal) ───────────────────────────────────────

  /**
   * Removes and returns the minimum element, or `undefined` if empty. Does
   * not trap on an empty set.
   */
  pollFirst(): T | undefined {
    return this.tree.pollFirstEntry()?.key;
  }

  /**
   * Removes and returns the maximum element, or `undefined` if empty. Does
   * not trap on an empty set.
   */
  pollLast(): T | undefined {
    return this.tree.pollLastEntry()?.key;
  }

  // ── range slice & descending iteration (consume Range<T>) ───────────
  //
  // Range membership is EXACTLY `range.contains(element)`.

  /** Elements ∈ `range`, ascending. Snapshot at call time; read-only. */
  rangeElements(range: Range<T>): T[] {
    return this.tree.rangeKeys(range);
  }

  /** Elements ∈ `range`, descending. */
  descendingRangeElements(range: Range<T>): T[] {
    return this.tree.descendingRangeKeys(range);
  }

  /** All elements, descending. */
  descending(): T[] {
    return this.tree.descendingKeys();
  }

  /**
   * A new independent set of the elements ∈ `range` (materialized snapshot;
   * mutating it never affects the original and vice versa). The snapshot
   * preserves the source set's comparator so reverse/custom/float-total-order
   * ordering is retained.
   */
  subSet(range: Range<T>): TreeSet<T> {
    const out = new TreeSet<T>(this.tree.cmp);
    for (const x of this.rangeElements(range)) out.add(x);
    return out;
  }

  /**
   * Removes every element ∈ `range`; returns the count removed. A range that
   * matches nothing is a no-op returning `0`.
   */
  removeRange(range: Range<T>): number {
    return this.tree.removeRange(range);
  }

  // ── functional ──────────────────────────────────────────────────────

  forEach(fn: (value: T) => void): void {
    this.tree.forEach((k) => fn(k));
  }

  toArray(): T[] {
    const result: T[] = [];
    this.forEach((v) => result.push(v));
    return result;
  }

  select(predicate: (value: T) => boolean): TreeSet<T> {
    const result = new TreeSet<T>(this.tree.cmp);
    this.forEach((v) => {
      if (predicate(v)) result.add(v);
    });
    return result;
  }

  reject(predicate: (value: T) => boolean): TreeSet<T> {
    const result = new TreeSet<T>(this.tree.cmp);
    this.forEach((v) => {
      if (!predicate(v)) result.add(v);
    });
    return result;
  }

  // ── iteration ───────────────────────────────────────────────────────

  *[Symbol.iterator](): Iterator<T> {
    for (const [k] of this.tree) {
      yield k;
    }
  }
}
