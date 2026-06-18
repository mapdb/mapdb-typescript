// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { Comparator } from "./strategy.js";
import type { Range } from "../range/range.js";

/**
 * Which side of `k` a point-navigation query selects, and whether the match
 * at `k` itself is admissible. Drives the shared {@link TreeMap.boundEntry}
 * walk for `floor`/`ceiling`/`lower`/`higher`.
 */
const enum Bound {
  /** Greatest key `<= k`. */
  Floor,
  /** Least key `>= k`. */
  Ceiling,
  /** Greatest key `< k` (strict). */
  Lower,
  /** Least key `> k` (strict). */
  Higher,
}

interface Node<K, V> {
  key: K;
  value: V;
  left: Node<K, V> | null;
  right: Node<K, V> | null;
  parent: Node<K, V> | null;
  red: boolean;
}

/**
 * Sorted map backed by a red-black tree with a pluggable {@link Comparator}.
 * Keys are maintained in the order defined by the comparator.
 */
export class TreeMap<K, V> {
  private root: Node<K, V> | null = null;
  private _size = 0;
  readonly cmp: Comparator<K>;

  constructor(cmp: Comparator<K>) {
    this.cmp = cmp;
  }

  // ── core ────────────────────────────────────────────────────────────

  set(key: K, value: V): this {
    if (this.root === null) {
      this.root = {
        key,
        value,
        left: null,
        right: null,
        parent: null,
        red: false,
      };
      this._size++;
      return this;
    }
    let n = this.root;
    for (;;) {
      const c = this.cmp(key, n.key);
      if (c < 0) {
        if (n.left === null) {
          const node: Node<K, V> = {
            key,
            value,
            left: null,
            right: null,
            parent: n,
            red: true,
          };
          n.left = node;
          this.fixAfterInsert(node);
          this._size++;
          return this;
        }
        n = n.left;
      } else if (c > 0) {
        if (n.right === null) {
          const node: Node<K, V> = {
            key,
            value,
            left: null,
            right: null,
            parent: n,
            red: true,
          };
          n.right = node;
          this.fixAfterInsert(node);
          this._size++;
          return this;
        }
        n = n.right;
      } else {
        n.value = value;
        return this;
      }
    }
  }

  get(key: K): V | undefined {
    const n = this.findNode(key);
    return n !== null ? n.value : undefined;
  }

  has(key: K): boolean {
    return this.findNode(key) !== null;
  }

  remove(key: K): V | undefined {
    const n = this.findNode(key);
    if (n === null) return undefined;
    const old = n.value;
    this.deleteNode(n);
    this._size--;
    return old;
  }

  get size(): number {
    return this._size;
  }

  isEmpty(): boolean {
    return this._size === 0;
  }

  clear(): void {
    this.root = null;
    this._size = 0;
  }

  min(): { key: K; value: V } | undefined {
    if (this.root === null) return undefined;
    const n = this.minNode(this.root);
    return { key: n.key, value: n.value };
  }

  max(): { key: K; value: V } | undefined {
    if (this.root === null) return undefined;
    const n = this.maxNode(this.root);
    return { key: n.key, value: n.value };
  }

  // ── point navigation (NavigableMap surface) ─────────────────────────
  //
  // floor `<= k`, ceiling `>= k`, lower `< k` (strict), higher `> k`
  // (strict). All comparisons go through the tree comparator, so the float
  // total order carries through for float keys exactly as in-order iteration
  // does. Absence is `undefined` (the repo's tree-absence convention).

  /** Greatest key `<= k` with its value, or `undefined`. */
  floorEntry(k: K): { key: K; value: V } | undefined {
    return this.boundEntry(k, Bound.Floor);
  }

  /** Greatest key `<= k`, or `undefined`. */
  floorKey(k: K): K | undefined {
    return this.boundEntry(k, Bound.Floor)?.key;
  }

  /** Least key `>= k` with its value, or `undefined`. */
  ceilingEntry(k: K): { key: K; value: V } | undefined {
    return this.boundEntry(k, Bound.Ceiling);
  }

  /** Least key `>= k`, or `undefined`. */
  ceilingKey(k: K): K | undefined {
    return this.boundEntry(k, Bound.Ceiling)?.key;
  }

  /** Greatest key `< k` (strict) with its value, or `undefined`. */
  lowerEntry(k: K): { key: K; value: V } | undefined {
    return this.boundEntry(k, Bound.Lower);
  }

  /** Greatest key `< k` (strict), or `undefined`. */
  lowerKey(k: K): K | undefined {
    return this.boundEntry(k, Bound.Lower)?.key;
  }

  /** Least key `> k` (strict) with its value, or `undefined`. */
  higherEntry(k: K): { key: K; value: V } | undefined {
    return this.boundEntry(k, Bound.Higher);
  }

  /** Least key `> k` (strict), or `undefined`. */
  higherKey(k: K): K | undefined {
    return this.boundEntry(k, Bound.Higher)?.key;
  }

  /** Minimum entry, or `undefined`. Alias for {@link min}. */
  firstEntry(): { key: K; value: V } | undefined {
    return this.min();
  }

  /** Minimum key, or `undefined`. */
  firstKey(): K | undefined {
    return this.min()?.key;
  }

  /** Maximum entry, or `undefined`. Alias for {@link max}. */
  lastEntry(): { key: K; value: V } | undefined {
    return this.max();
  }

  /** Maximum key, or `undefined`. */
  lastKey(): K | undefined {
    return this.max()?.key;
  }

  /**
   * Shared walk for the four point-navigation queries: descend the tree
   * tracking the best candidate seen on the relevant side.
   */
  private boundEntry(k: K, bound: Bound): { key: K; value: V } | undefined {
    let current = this.root;
    let best: Node<K, V> | null = null;
    while (current !== null) {
      const ord = this.cmp(k, current.key);
      let take: boolean;
      switch (bound) {
        case Bound.Floor:
          take = ord >= 0; // current.key <= k
          break;
        case Bound.Lower:
          take = ord > 0; // current.key < k
          break;
        case Bound.Ceiling:
          take = ord <= 0; // current.key >= k
          break;
        default: // Bound.Higher
          take = ord < 0; // current.key > k
          break;
      }
      if (take) {
        best = current;
        // candidate qualifies; move toward k for a tighter one.
        current =
          bound === Bound.Floor || bound === Bound.Lower
            ? current.right
            : current.left;
      } else {
        // current.key on the wrong side; move toward the accepted side.
        current =
          bound === Bound.Floor || bound === Bound.Lower
            ? current.left
            : current.right;
      }
    }
    return best === null ? undefined : { key: best.key, value: best.value };
  }

  // ── poll (positional removal) ───────────────────────────────────────

  /**
   * Removes and returns the minimum entry, or `undefined` if empty. Does not
   * trap on an empty map.
   */
  pollFirstEntry(): { key: K; value: V } | undefined {
    const e = this.min();
    if (e === undefined) return undefined;
    this.remove(e.key);
    return e;
  }

  /**
   * Removes and returns the maximum entry, or `undefined` if empty. Does not
   * trap on an empty map.
   */
  pollLastEntry(): { key: K; value: V } | undefined {
    const e = this.max();
    if (e === undefined) return undefined;
    this.remove(e.key);
    return e;
  }

  // ── range slice & descending iteration (consume Range<K>) ───────────
  //
  // Range membership is EXACTLY `range.contains(key)`: e.g. `open(1, 2)` over
  // i32 matches no key yet is a valid, non-cut-empty range. We never infer
  // discrete-domain emptiness from the cuts.

  /** Keys whose key ∈ `range`, ascending. Snapshot at call time; read-only. */
  rangeKeys(range: Range<K>): K[] {
    const out: K[] = [];
    for (const [k] of this) if (range.contains(k)) out.push(k);
    return out;
  }

  /** `[key, value]` pairs whose key ∈ `range`, ascending. */
  rangeEntries(range: Range<K>): [K, V][] {
    const out: [K, V][] = [];
    for (const [k, v] of this) if (range.contains(k)) out.push([k, v]);
    return out;
  }

  /** Keys whose key ∈ `range`, descending. */
  descendingRangeKeys(range: Range<K>): K[] {
    return this.rangeKeys(range).reverse();
  }

  /** `[key, value]` pairs whose key ∈ `range`, descending. */
  descendingRangeEntries(range: Range<K>): [K, V][] {
    return this.rangeEntries(range).reverse();
  }

  /** All keys, descending. */
  descendingKeys(): K[] {
    return [...this.keys()].reverse();
  }

  /** All `[key, value]` pairs, descending. */
  descendingEntries(): [K, V][] {
    return [...this].reverse();
  }

  /**
   * A new independent map of the entries whose key ∈ `range`. Mutating the
   * snapshot never affects the original and vice versa (it is a materialized
   * copy, not a live view). The snapshot preserves the source map's
   * comparator, so reverse/custom/float-total-order keyed maps keep their
   * ordering semantics in the slice.
   */
  subMap(range: Range<K>): TreeMap<K, V> {
    const out = new TreeMap<K, V>(this.cmp);
    for (const [k, v] of this) if (range.contains(k)) out.set(k, v);
    return out;
  }

  /**
   * Removes every entry whose key ∈ `range`; returns the count removed. A
   * range that matches nothing is a no-op returning `0`.
   */
  removeRange(range: Range<K>): number {
    const victims = this.rangeKeys(range);
    for (const k of victims) this.remove(k);
    return victims.length;
  }

  /** Iterator over keys in ascending key order. */
  *keys(): Generator<K> {
    for (const [k] of this) yield k;
  }

  /** Iterator over values in key-sorted order. */
  *values(): Generator<V> {
    for (const [, v] of this) yield v;
  }

  // ── functional ──────────────────────────────────────────────────────

  forEach(fn: (key: K, value: V) => void): void {
    this.inOrder(this.root, (k, v) => {
      fn(k, v);
      return true;
    });
  }

  select(predicate: (key: K, value: V) => boolean): TreeMap<K, V> {
    const result = new TreeMap<K, V>(this.cmp);
    this.forEach((k, v) => {
      if (predicate(k, v)) result.set(k, v);
    });
    return result;
  }

  reject(predicate: (key: K, value: V) => boolean): TreeMap<K, V> {
    const result = new TreeMap<K, V>(this.cmp);
    this.forEach((k, v) => {
      if (!predicate(k, v)) result.set(k, v);
    });
    return result;
  }

  // ── iteration ───────────────────────────────────────────────────────

  *[Symbol.iterator](): Iterator<[K, V]> {
    yield* this.iterateInOrder(this.root);
  }

  private *iterateInOrder(n: Node<K, V> | null): Generator<[K, V]> {
    if (n === null) return;
    yield* this.iterateInOrder(n.left);
    yield [n.key, n.value];
    yield* this.iterateInOrder(n.right);
  }

  // ── internal: lookup ──────────────────────────────────────────────

  private findNode(key: K): Node<K, V> | null {
    let n = this.root;
    while (n !== null) {
      const c = this.cmp(key, n.key);
      if (c < 0) n = n.left;
      else if (c > 0) n = n.right;
      else return n;
    }
    return null;
  }

  private minNode(n: Node<K, V>): Node<K, V> {
    while (n.left !== null) n = n.left;
    return n;
  }

  private maxNode(n: Node<K, V>): Node<K, V> {
    while (n.right !== null) n = n.right;
    return n;
  }

  private inOrder(
    n: Node<K, V> | null,
    yield_: (k: K, v: V) => boolean,
  ): boolean {
    if (n === null) return true;
    if (!this.inOrder(n.left, yield_)) return false;
    if (!yield_(n.key, n.value)) return false;
    return this.inOrder(n.right, yield_);
  }

  // ── internal: red-black tree operations ───────────────────────────

  private isRed(n: Node<K, V> | null): boolean {
    return n !== null && n.red;
  }

  private rotateLeft(n: Node<K, V>): void {
    const r = n.right!;
    n.right = r.left;
    if (r.left !== null) r.left.parent = n;
    r.parent = n.parent;
    if (n.parent === null) this.root = r;
    else if (n === n.parent.left) n.parent.left = r;
    else n.parent.right = r;
    r.left = n;
    n.parent = r;
  }

  private rotateRight(n: Node<K, V>): void {
    const l = n.left!;
    n.left = l.right;
    if (l.right !== null) l.right.parent = n;
    l.parent = n.parent;
    if (n.parent === null) this.root = l;
    else if (n === n.parent.right) n.parent.right = l;
    else n.parent.left = l;
    l.right = n;
    n.parent = l;
  }

  private fixAfterInsert(n_: Node<K, V>): void {
    let n: Node<K, V> | null = n_;
    n.red = true;
    while (n !== null && n !== this.root && n.parent!.red) {
      if (n.parent === n.parent!.parent!.left) {
        const uncle = n.parent!.parent!.right;
        if (this.isRed(uncle)) {
          n.parent!.red = false;
          uncle!.red = false;
          n.parent!.parent!.red = true;
          n = n.parent!.parent;
        } else {
          if (n === n.parent!.right) {
            n = n.parent!;
            this.rotateLeft(n);
          }
          n.parent!.red = false;
          n.parent!.parent!.red = true;
          this.rotateRight(n.parent!.parent!);
        }
      } else {
        const uncle = n.parent!.parent!.left;
        if (this.isRed(uncle)) {
          n.parent!.red = false;
          uncle!.red = false;
          n.parent!.parent!.red = true;
          n = n.parent!.parent;
        } else {
          if (n === n.parent!.left) {
            n = n.parent!;
            this.rotateRight(n);
          }
          n.parent!.red = false;
          n.parent!.parent!.red = true;
          this.rotateLeft(n.parent!.parent!);
        }
      }
    }
    this.root!.red = false;
  }

  private deleteNode(n_: Node<K, V>): void {
    let n = n_;
    if (n.left !== null && n.right !== null) {
      const succ = this.minNode(n.right);
      n.key = succ.key;
      n.value = succ.value;
      n = succ;
    }
    const child = n.left !== null ? n.left : n.right;
    if (child !== null) {
      child.parent = n.parent;
      if (n.parent === null) this.root = child;
      else if (n === n.parent.left) n.parent.left = child;
      else n.parent.right = child;
      if (!n.red) this.fixAfterDelete(child);
    } else if (n.parent === null) {
      this.root = null;
    } else {
      if (!n.red) this.fixAfterDelete(n);
      if (n.parent !== null) {
        if (n === n.parent.left) n.parent.left = null;
        else n.parent.right = null;
      }
    }
  }

  private fixAfterDelete(n_: Node<K, V>): void {
    let n: Node<K, V> | null = n_;
    while (n !== this.root && !this.isRed(n)) {
      if (n === n!.parent!.left) {
        let sib = n!.parent!.right;
        if (this.isRed(sib)) {
          sib!.red = false;
          n!.parent!.red = true;
          this.rotateLeft(n!.parent!);
          sib = n!.parent!.right;
        }
        if (sib === null) {
          n = n!.parent;
          continue;
        }
        if (!this.isRed(sib.left) && !this.isRed(sib.right)) {
          sib.red = true;
          n = n!.parent;
        } else {
          if (!this.isRed(sib.right)) {
            if (sib.left !== null) sib.left.red = false;
            sib.red = true;
            this.rotateRight(sib);
            sib = n!.parent!.right!;
          }
          sib.red = n!.parent!.red;
          n!.parent!.red = false;
          if (sib.right !== null) sib.right.red = false;
          this.rotateLeft(n!.parent!);
          n = this.root;
        }
      } else {
        let sib = n!.parent!.left;
        if (this.isRed(sib)) {
          sib!.red = false;
          n!.parent!.red = true;
          this.rotateRight(n!.parent!);
          sib = n!.parent!.left;
        }
        if (sib === null) {
          n = n!.parent;
          continue;
        }
        if (!this.isRed(sib.right) && !this.isRed(sib.left)) {
          sib.red = true;
          n = n!.parent;
        } else {
          if (!this.isRed(sib.left)) {
            if (sib.right !== null) sib.right.red = false;
            sib.red = true;
            this.rotateLeft(sib);
            sib = n!.parent!.left!;
          }
          sib.red = n!.parent!.red;
          n!.parent!.red = false;
          if (sib.left !== null) sib.left.red = false;
          this.rotateRight(n!.parent!);
          n = this.root;
        }
      }
    }
    if (n !== null) n.red = false;
  }
}
