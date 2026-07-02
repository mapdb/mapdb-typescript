// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableSet } from "../api/index.js";
import type { Range } from "../range/range.js";
import { totalCmpNumber } from "../internal/float-order.js";

import {
  buildRedBlack,
  PumpDuplicateError,
  PumpNotSortedError,
  type PumpOptions,
} from "../internal/pump.js";

const RED = false;
const BLACK = true;

interface TreeNode {
  key: number;
  left: TreeNode | null;
  right: TreeNode | null;
  parent: TreeNode | null;
  color: boolean;
  /**
   * Number of nodes in the subtree rooted here (this node plus both children's
   * subtrees), maintained in O(1) on every structural change — insert, remove,
   * and all rotations — so order-statistic rank/select run in O(log n).
   * Invariant after any operation: `size === 1 + size(left) + size(right)`.
   */
  size: number;
}

/** Subtree size of a node link (`0` if null). */
function nodeSize(n: TreeNode | null): number {
  return n === null ? 0 : n.size;
}

/** Sorted set of number values, backed by a red-black tree. */
export class NumberTreeSet implements MapDbMutableSet<number> {
  private root: TreeNode | null = null;
  private _size = 0;

  /**
   * Bulk-loads a fresh set from ascending-sorted values in a single O(n) pass
   * (the data pump), bypassing per-element rebalancing. Order is validated with
   * the set's own comparator; out-of-order input throws
   * {@link PumpNotSortedError}. Duplicate values throw {@link PumpDuplicateError}
   * unless `onDuplicate` is "ignore" (keeps the first of each run). The result
   * is observably identical to adding the values one by one.
   */
  static fromSorted(
    sorted: Iterable<number>,
    opts?: PumpOptions,
  ): NumberTreeSet {
    const sink = new NumberTreeSetSink(opts);
    sink.putAll(sorted);
    return sink.create();
  }

  /** @internal Builds the tree from a validated, deduplicated sorted buffer. */
  static buildFromSortedBuffer(keys: number[]): NumberTreeSet {
    const set = new NumberTreeSet();
    set.root = buildRedBlack<TreeNode>(keys.length, (j) => ({
      key: keys[j],
      left: null,
      right: null,
      parent: null,
      color: BLACK,
    }));
    set._size = keys.length;
    return set;
  }

  static of(values: number[]): NumberTreeSet {
    const s = new NumberTreeSet();
    for (const v of values) s.add(v);
    return s;
  }

  add(value: number): this {
    if (this.root === null) {
      this.root = {
        key: value,
        left: null,
        right: null,
        parent: null,
        color: BLACK,
        size: 1,
      };
      this._size++;
      return this;
    }
    let node = this.root;
    while (true) {
      const cmp = totalCmpNumber(value, node.key);
      if (cmp < 0) {
        if (!node.left) {
          node.left = {
            key: value,
            left: null,
            right: null,
            parent: node,
            color: RED,
            size: 1,
          };
          this.incSizeToRoot(node);
          this.fixInsert(node.left);
          this._size++;
          return this;
        }
        node = node.left;
      } else if (cmp > 0) {
        if (!node.right) {
          node.right = {
            key: value,
            left: null,
            right: null,
            parent: node,
            color: RED,
            size: 1,
          };
          this.incSizeToRoot(node);
          this.fixInsert(node.right);
          this._size++;
          return this;
        }
        node = node.right;
      } else {
        return this;
      }
    }
  }

  remove(value: number): boolean {
    const node = this.findNode(value);
    if (!node) return false;
    this.deleteNode(node);
    this._size--;
    return true;
  }

  has(value: number): boolean {
    return this.findNode(value) !== null;
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

  min(): number | undefined {
    if (!this.root) return undefined;
    let n = this.root;
    while (n.left) n = n.left;
    return n.key;
  }

  max(): number | undefined {
    if (!this.root) return undefined;
    let n = this.root;
    while (n.right) n = n.right;
    return n.key;
  }

  floor(value: number): number | undefined {
    let result: TreeNode | null = null;
    let node = this.root;
    while (node) {
      const cmp = totalCmpNumber(value, node.key);
      if (cmp === 0) return node.key;
      if (cmp > 0) {
        result = node;
        node = node.right;
      } else {
        node = node.left;
      }
    }
    return result?.key;
  }

  ceiling(value: number): number | undefined {
    let result: TreeNode | null = null;
    let node = this.root;
    while (node) {
      const cmp = totalCmpNumber(value, node.key);
      if (cmp === 0) return node.key;
      if (cmp < 0) {
        result = node;
        node = node.left;
      } else {
        node = node.right;
      }
    }
    return result?.key;
  }

  // ── point navigation (NavigableSet surface) ─────────────────────────
  //
  // floor `<= x`, ceiling `>= x`, lower `< x` (strict), higher `> x`
  // (strict). All comparisons go through the production totalCmpNumber.

  /** Greatest element `< x` (strict), or `undefined`. */
  lower(value: number): number | undefined {
    let result: TreeNode | null = null;
    let node = this.root;
    while (node) {
      if (totalCmpNumber(value, node.key) > 0) {
        result = node;
        node = node.right;
      } else {
        node = node.left;
      }
    }
    return result?.key;
  }

  /** Least element `> x` (strict), or `undefined`. */
  higher(value: number): number | undefined {
    let result: TreeNode | null = null;
    let node = this.root;
    while (node) {
      if (totalCmpNumber(value, node.key) < 0) {
        result = node;
        node = node.left;
      } else {
        node = node.right;
      }
    }
    return result?.key;
  }

  /** Minimum element, or `undefined`. Alias for {@link min}. */
  first(): number | undefined {
    return this.min();
  }

  /** Maximum element, or `undefined`. Alias for {@link max}. */
  last(): number | undefined {
    return this.max();
  }

  // ── poll (positional removal) ───────────────────────────────────────

  /**
   * Removes and returns the minimum element, or `undefined` if empty. Does
   * not trap on an empty set.
   */
  pollFirst(): number | undefined {
    const e = this.min();
    if (e === undefined) return undefined;
    this.remove(e);
    return e;
  }

  /**
   * Removes and returns the maximum element, or `undefined` if empty. Does
   * not trap on an empty set.
   */
  pollLast(): number | undefined {
    const e = this.max();
    if (e === undefined) return undefined;
    this.remove(e);
    return e;
  }

  // ── range slice & descending iteration (consume Range) ──────────────
  //
  // Range membership is EXACTLY `range.contains(element)`.

  /** Elements ∈ `range`, ascending. Snapshot at call time; read-only. */
  rangeElements(range: Range<number>): number[] {
    const out: number[] = [];
    for (const v of this.values()) if (range.contains(v)) out.push(v);
    return out;
  }

  /** Elements ∈ `range`, descending. */
  descendingRangeElements(range: Range<number>): number[] {
    return this.rangeElements(range).reverse();
  }

  /** All elements, descending. */
  descending(): number[] {
    return [...this.values()].reverse();
  }

  /**
   * A new independent set of the elements ∈ `range` (materialized snapshot;
   * mutating it never affects the original and vice versa).
   */
  subSet(range: Range<number>): NumberTreeSet {
    const out = new NumberTreeSet();
    for (const v of this.rangeElements(range)) out.add(v);
    return out;
  }

  /**
   * Removes every element ∈ `range`; returns the count removed. A range that
   * matches nothing is a no-op returning `0`.
   */
  removeRange(range: Range<number>): number {
    const victims = this.rangeElements(range);
    for (const v of victims) this.remove(v);
    return victims.length;
  }

  *values(): Generator<number> {
    function* inorder(node: TreeNode | null): Generator<number> {
      if (!node) return;
      yield* inorder(node.left);
      yield node.key;
      yield* inorder(node.right);
    }
    yield* inorder(this.root);
  }

  *rangeValues(from: number, to: number): Generator<number> {
    for (const v of this.values()) {
      if (totalCmpNumber(v, from) < 0) continue;
      if (totalCmpNumber(v, to) >= 0) return;
      yield v;
    }
  }

  forEach(f: (value: number) => void): void {
    for (const v of this.values()) f(v);
  }

  /** Returns a new array with the results of calling `f` on each element (in ascending order). */
  map<U>(f: (value: number) => U): U[] {
    const result: U[] = [];
    for (const v of this.values()) result.push(f(v));
    return result;
  }

  /** Returns a new array with elements satisfying the predicate (in ascending order). */
  filter(predicate: (value: number) => boolean): number[] {
    const result: number[] = [];
    for (const v of this.values()) if (predicate(v)) result.push(v);
    return result;
  }

  /** Returns the first (smallest) element satisfying the predicate, or undefined. */
  find(predicate: (value: number) => boolean): number | undefined {
    for (const v of this.values()) if (predicate(v)) return v;
    return undefined;
  }

  /** Returns true if every element satisfies the predicate. */
  every(predicate: (value: number) => boolean): boolean {
    for (const v of this.values()) if (!predicate(v)) return false;
    return true;
  }

  /** Returns true if at least one element satisfies the predicate. */
  some(predicate: (value: number) => boolean): boolean {
    for (const v of this.values()) if (predicate(v)) return true;
    return false;
  }

  /** Reduces the set to a single value using the accumulator function (in ascending order). */
  reduce<U>(f: (acc: U, value: number) => U, initial: U): U {
    let acc = initial;
    for (const v of this.values()) acc = f(acc, v);
    return acc;
  }

  /** Returns true if the set contains the value. Alias for `has`. */
  includes(value: number): boolean {
    return this.has(value);
  }

  /** Makes the set iterable with for-of loops. Yields elements in ascending order. */
  *[Symbol.iterator](): IterableIterator<number> {
    yield* this.values();
  }

  /**
   * Returns a new set of the elements matching the predicate.
   *
   * Named `selectWhere` (not `select`) so the bare `select` name is reserved
   * for the order-statistic {@link select} (i-th smallest by 0-based rank),
   * per `spec/features/rank-select.md`.
   */
  selectWhere(pred: (v: number) => boolean): NumberTreeSet {
    const r = new NumberTreeSet();
    for (const v of this.values()) if (pred(v)) r.add(v);
    return r;
  }

  // ── order statistics (rank / select) ────────────────────────────────
  //
  // Backed by the per-node subtree-size augmentation; both run in O(log n).
  // Comparisons go through the production totalCmpNumber. Pure queries.

  /**
   * Returns the number of elements strictly less than `value` (the 0-based
   * lower-bound index it occupies if present, or would occupy if absent).
   * Result is in `0..=size`.
   */
  rank(value: number): number {
    let rank = 0;
    let node = this.root;
    while (node) {
      const cmp = totalCmpNumber(value, node.key);
      if (cmp < 0) {
        node = node.left;
      } else if (cmp > 0) {
        rank += 1 + nodeSize(node.left);
        node = node.right;
      } else {
        return rank + nodeSize(node.left);
      }
    }
    return rank;
  }

  /**
   * Returns the `i`-th smallest element (0-based), or `undefined` if
   * `i >= size` (including on an empty set) or `i < 0`. No trap. Round-trips
   * with {@link rank}: `select(rank(x)) === x` for present `x`, and
   * `rank(select(i)) === i` for every `0 <= i < size`.
   */
  select(i: number): number | undefined {
    if (i < 0) return undefined;
    let node = this.root;
    while (node) {
      const left = nodeSize(node.left);
      if (i < left) {
        node = node.left;
      } else if (i === left) {
        return node.key;
      } else {
        i -= left + 1;
        node = node.right;
      }
    }
    return undefined;
  }

  /**
   * Test-only: assert the subtree-size invariant `size === 1 + left + right`
   * at every node and that the root total equals {@link size}.
   */
  checkSizeInvariant(): void {
    const check = (n: TreeNode | null): number => {
      if (n === null) return 0;
      const l = check(n.left);
      const r = check(n.right);
      if (n.size !== 1 + l + r) {
        throw new Error("subtree-size invariant violated");
      }
      return n.size;
    };
    if (check(this.root) !== this._size) {
      throw new Error("root size mismatch with size");
    }
  }

  union(other: NumberTreeSet): NumberTreeSet {
    const r = new NumberTreeSet();
    for (const v of this.values()) r.add(v);
    for (const v of other.values()) r.add(v);
    return r;
  }

  intersect(other: NumberTreeSet): NumberTreeSet {
    const r = new NumberTreeSet();
    for (const v of this.values()) if (other.has(v)) r.add(v);
    return r;
  }

  difference(other: NumberTreeSet): NumberTreeSet {
    const r = new NumberTreeSet();
    for (const v of this.values()) if (!other.has(v)) r.add(v);
    return r;
  }

  toArray(): number[] {
    return [...this.values()];
  }

  toString(): string {
    const parts: string[] = [];
    for (const v of this.values()) parts.push(`${v}`);
    return `{${parts.join(", ")}}`;
  }

  // --- RB tree internals ---
  private findNode(key: number): TreeNode | null {
    let n = this.root;
    while (n) {
      const cmp = totalCmpNumber(key, n.key);
      if (cmp < 0) n = n.left;
      else if (cmp > 0) n = n.right;
      else return n;
    }
    return null;
  }
  private rotateLeft(x: TreeNode): void {
    const y = x.right!;
    x.right = y.left;
    if (y.left) y.left.parent = x;
    y.parent = x.parent;
    if (!x.parent) this.root = y;
    else if (x === x.parent.left) x.parent.left = y;
    else x.parent.right = y;
    y.left = x;
    x.parent = y;
    // `y` takes `x`'s former position so it inherits `x`'s old subtree size;
    // recompute the demoted `x` from its children, then carry the total up.
    y.size = x.size;
    x.size = 1 + nodeSize(x.left) + nodeSize(x.right);
  }
  private rotateRight(x: TreeNode): void {
    const y = x.left!;
    x.left = y.right;
    if (y.right) y.right.parent = x;
    y.parent = x.parent;
    if (!x.parent) this.root = y;
    else if (x === x.parent.right) x.parent.right = y;
    else x.parent.left = y;
    y.right = x;
    x.parent = y;
    y.size = x.size;
    x.size = 1 + nodeSize(x.left) + nodeSize(x.right);
  }

  /** Adds one to the subtree size of `node` and every ancestor. */
  private incSizeToRoot(node: TreeNode | null): void {
    for (let p = node; p !== null; p = p.parent) p.size++;
  }

  /**
   * Recomputes the subtree size of `node` and every ancestor from their
   * children. Used after a delete splice (rotations inside {@link fixDelete}
   * maintain their own sizes).
   */
  private fixSizeToRoot(node: TreeNode | null): void {
    for (let p = node; p !== null; p = p.parent) {
      p.size = 1 + nodeSize(p.left) + nodeSize(p.right);
    }
  }
  private fixInsert(z: TreeNode): void {
    while (z.parent && z.parent.color === RED) {
      if (z.parent === z.parent.parent!.left) {
        const y = z.parent.parent!.right;
        if (y && y.color === RED) {
          z.parent.color = BLACK;
          y.color = BLACK;
          z.parent.parent!.color = RED;
          z = z.parent.parent!;
        } else {
          if (z === z.parent.right) {
            z = z.parent;
            this.rotateLeft(z);
          }
          z.parent!.color = BLACK;
          z.parent!.parent!.color = RED;
          this.rotateRight(z.parent!.parent!);
        }
      } else {
        const y = z.parent.parent!.left;
        if (y && y.color === RED) {
          z.parent.color = BLACK;
          y.color = BLACK;
          z.parent.parent!.color = RED;
          z = z.parent.parent!;
        } else {
          if (z === z.parent.left) {
            z = z.parent;
            this.rotateRight(z);
          }
          z.parent!.color = BLACK;
          z.parent!.parent!.color = RED;
          this.rotateLeft(z.parent!.parent!);
        }
      }
    }
    this.root!.color = BLACK;
  }
  private deleteNode(z: TreeNode): void {
    if (z.left && z.right) {
      let s = z.right;
      while (s.left) s = s.left;
      z.key = s.key;
      z = s;
    }
    // `z` is now the node physically spliced out. `fixSizeFrom` is the lowest
    // node whose cached subtree size must be refreshed; recomputing that path
    // to the root once the structure is final restores the invariant.
    let fixSizeFrom: TreeNode | null = null;
    const child = z.left ?? z.right;
    if (child) {
      child.parent = z.parent;
      if (!z.parent) this.root = child;
      else if (z === z.parent.left) z.parent.left = child;
      else z.parent.right = child;
      fixSizeFrom = child;
      if (z.color === BLACK) this.fixDelete(child);
    } else if (!z.parent) {
      this.root = null;
    } else {
      if (z.color === BLACK) this.fixDelete(z);
      // fixDelete may have rotated `z` to a new parent; read it now.
      fixSizeFrom = z.parent;
      if (z.parent) {
        if (z === z.parent.left) z.parent.left = null;
        else z.parent.right = null;
      }
    }
    this.fixSizeToRoot(fixSizeFrom);
  }
  private fixDelete(x: TreeNode): void {
    while (x !== this.root && x.color === BLACK) {
      if (x === x.parent!.left) {
        let w = x.parent!.right;
        if (!w) {
          x = x.parent!;
          continue;
        }
        if (w.color === RED) {
          w.color = BLACK;
          x.parent!.color = RED;
          this.rotateLeft(x.parent!);
          w = x.parent!.right;
        }
        if (!w) {
          x = x.parent!;
          continue;
        }
        if (
          (!w.left || w.left.color === BLACK) &&
          (!w.right || w.right.color === BLACK)
        ) {
          w.color = RED;
          x = x.parent!;
        } else {
          if (!w.right || w.right.color === BLACK) {
            if (w.left) w.left.color = BLACK;
            w.color = RED;
            this.rotateRight(w);
            w = x.parent!.right!;
          }
          w.color = x.parent!.color;
          x.parent!.color = BLACK;
          if (w.right) w.right.color = BLACK;
          this.rotateLeft(x.parent!);
          x = this.root!;
        }
      } else {
        let w = x.parent!.left;
        if (!w) {
          x = x.parent!;
          continue;
        }
        if (w.color === RED) {
          w.color = BLACK;
          x.parent!.color = RED;
          this.rotateRight(x.parent!);
          w = x.parent!.left;
        }
        if (!w) {
          x = x.parent!;
          continue;
        }
        if (
          (!w.left || w.left.color === BLACK) &&
          (!w.right || w.right.color === BLACK)
        ) {
          w.color = RED;
          x = x.parent!;
        } else {
          if (!w.left || w.left.color === BLACK) {
            if (w.right) w.right.color = BLACK;
            w.color = RED;
            this.rotateLeft(w);
            w = x.parent!.left!;
          }
          w.color = x.parent!.color;
          x.parent!.color = BLACK;
          if (w.left) w.left.color = BLACK;
          this.rotateRight(x.parent!);
          x = this.root!;
        }
      }
    }
    x.color = BLACK;
  }
}

/**
 * Streaming builder for a {@link NumberTreeSet} from ascending-sorted values (the
 * data pump's Sink form). Buffer values with {@link put} / {@link putAll} then
 * call {@link create} once. Poisoned after an order/duplicate error; `create`
 * is once-only.
 */
export class NumberTreeSetSink {
  private readonly keys: number[] = [];
  private readonly onDuplicate: "error" | "ignore";
  private index = 0;
  private poisoned = false;
  private done = false;

  constructor(opts?: PumpOptions) {
    this.onDuplicate = opts?.onDuplicate ?? "error";
  }

  put(value: number): void {
    if (this.poisoned) throw new Error("sink is poisoned after a prior error");
    if (this.done) throw new Error("sink already created");
    const i = this.index++;
    if (this.keys.length > 0) {
      const cmp = totalCmpNumber(this.keys[this.keys.length - 1], value);
      if (cmp > 0) {
        this.poisoned = true;
        throw new PumpNotSortedError(i);
      }
      if (cmp === 0) {
        if (this.onDuplicate === "error") {
          this.poisoned = true;
          throw new PumpDuplicateError(i);
        }
        return;
      }
    }
    this.keys.push(value);
  }

  putAll(items: Iterable<number>): void {
    for (const e of items) this.put(e);
  }

  create(): NumberTreeSet {
    if (this.poisoned) throw new Error("sink is poisoned after a prior error");
    if (this.done) throw new Error("sink already created");
    this.done = true;
    return NumberTreeSet.buildFromSortedBuffer(this.keys);
  }
}
