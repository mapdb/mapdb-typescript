// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { Comparator } from "./strategy";
import { TreeMap } from "./treemap";

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

  add(value: T): boolean {
    const before = this.tree.size;
    this.tree.put(value, undefined);
    return this.tree.size > before;
  }

  remove(value: T): boolean {
    if (!this.tree.containsKey(value)) return false;
    this.tree.remove(value);
    return true;
  }

  contains(value: T): boolean {
    return this.tree.containsKey(value);
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
