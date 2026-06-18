// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableSet } from "../api/index.js";

import {
  buildRedBlack,
  PumpDuplicateError,
  PumpNotSortedError,
  type PumpOptions,
} from "../internal/pump.js";

const RED = false;
const BLACK = true;

interface TreeNode {
  key: bigint;
  left: TreeNode | null;
  right: TreeNode | null;
  parent: TreeNode | null;
  color: boolean;
}

/** Sorted set of bigint values, backed by a red-black tree. */
export class BigIntTreeSet implements MapDbMutableSet<bigint> {
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
    sorted: Iterable<bigint>,
    opts?: PumpOptions,
  ): BigIntTreeSet {
    const sink = new BigIntTreeSetSink(opts);
    sink.putAll(sorted);
    return sink.create();
  }

  /** @internal Builds the tree from a validated, deduplicated sorted buffer. */
  static buildFromSortedBuffer(keys: bigint[]): BigIntTreeSet {
    const set = new BigIntTreeSet();
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

  static of(values: bigint[]): BigIntTreeSet {
    const s = new BigIntTreeSet();
    for (const v of values) s.add(v);
    return s;
  }

  add(value: bigint): this {
    if (this.root === null) {
      this.root = {
        key: value,
        left: null,
        right: null,
        parent: null,
        color: BLACK,
      };
      this._size++;
      return this;
    }
    let node = this.root;
    while (true) {
      if (value < node.key) {
        if (!node.left) {
          node.left = {
            key: value,
            left: null,
            right: null,
            parent: node,
            color: RED,
          };
          this.fixInsert(node.left);
          this._size++;
          return this;
        }
        node = node.left;
      } else if (value > node.key) {
        if (!node.right) {
          node.right = {
            key: value,
            left: null,
            right: null,
            parent: node,
            color: RED,
          };
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

  remove(value: bigint): boolean {
    const node = this.findNode(value);
    if (!node) return false;
    this.deleteNode(node);
    this._size--;
    return true;
  }

  has(value: bigint): boolean {
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

  min(): bigint | undefined {
    if (!this.root) return undefined;
    let n = this.root;
    while (n.left) n = n.left;
    return n.key;
  }

  max(): bigint | undefined {
    if (!this.root) return undefined;
    let n = this.root;
    while (n.right) n = n.right;
    return n.key;
  }

  floor(value: bigint): bigint | undefined {
    let result: TreeNode | null = null;
    let node = this.root;
    while (node) {
      if (value === node.key) return node.key;
      if (value > node.key) {
        result = node;
        node = node.right;
      } else {
        node = node.left;
      }
    }
    return result?.key;
  }

  ceiling(value: bigint): bigint | undefined {
    let result: TreeNode | null = null;
    let node = this.root;
    while (node) {
      if (value === node.key) return node.key;
      if (value < node.key) {
        result = node;
        node = node.left;
      } else {
        node = node.right;
      }
    }
    return result?.key;
  }

  *values(): Generator<bigint> {
    function* inorder(node: TreeNode | null): Generator<bigint> {
      if (!node) return;
      yield* inorder(node.left);
      yield node.key;
      yield* inorder(node.right);
    }
    yield* inorder(this.root);
  }

  *rangeValues(from: bigint, to: bigint): Generator<bigint> {
    for (const v of this.values()) {
      if (v < from) continue;
      if (v >= to) return;
      yield v;
    }
  }

  forEach(f: (value: bigint) => void): void {
    for (const v of this.values()) f(v);
  }

  /** Returns a new array with the results of calling `f` on each element (in ascending order). */
  map<U>(f: (value: bigint) => U): U[] {
    const result: U[] = [];
    for (const v of this.values()) result.push(f(v));
    return result;
  }

  /** Returns a new array with elements satisfying the predicate (in ascending order). */
  filter(predicate: (value: bigint) => boolean): bigint[] {
    const result: bigint[] = [];
    for (const v of this.values()) if (predicate(v)) result.push(v);
    return result;
  }

  /** Returns the first (smallest) element satisfying the predicate, or undefined. */
  find(predicate: (value: bigint) => boolean): bigint | undefined {
    for (const v of this.values()) if (predicate(v)) return v;
    return undefined;
  }

  /** Returns true if every element satisfies the predicate. */
  every(predicate: (value: bigint) => boolean): boolean {
    for (const v of this.values()) if (!predicate(v)) return false;
    return true;
  }

  /** Returns true if at least one element satisfies the predicate. */
  some(predicate: (value: bigint) => boolean): boolean {
    for (const v of this.values()) if (predicate(v)) return true;
    return false;
  }

  /** Reduces the set to a single value using the accumulator function (in ascending order). */
  reduce<U>(f: (acc: U, value: bigint) => U, initial: U): U {
    let acc = initial;
    for (const v of this.values()) acc = f(acc, v);
    return acc;
  }

  /** Returns true if the set contains the value. Alias for `has`. */
  includes(value: bigint): boolean {
    return this.has(value);
  }

  /** Makes the set iterable with for-of loops. Yields elements in ascending order. */
  *[Symbol.iterator](): IterableIterator<bigint> {
    yield* this.values();
  }

  select(pred: (v: bigint) => boolean): BigIntTreeSet {
    const r = new BigIntTreeSet();
    for (const v of this.values()) if (pred(v)) r.add(v);
    return r;
  }

  union(other: BigIntTreeSet): BigIntTreeSet {
    const r = new BigIntTreeSet();
    for (const v of this.values()) r.add(v);
    for (const v of other.values()) r.add(v);
    return r;
  }

  intersect(other: BigIntTreeSet): BigIntTreeSet {
    const r = new BigIntTreeSet();
    for (const v of this.values()) if (other.has(v)) r.add(v);
    return r;
  }

  difference(other: BigIntTreeSet): BigIntTreeSet {
    const r = new BigIntTreeSet();
    for (const v of this.values()) if (!other.has(v)) r.add(v);
    return r;
  }

  toArray(): bigint[] {
    return [...this.values()];
  }

  toString(): string {
    const parts: string[] = [];
    for (const v of this.values()) parts.push(`${v}`);
    return `{${parts.join(", ")}}`;
  }

  // --- RB tree internals ---
  private findNode(key: bigint): TreeNode | null {
    let n = this.root;
    while (n) {
      if (key < n.key) n = n.left;
      else if (key > n.key) n = n.right;
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
    const child = z.left ?? z.right;
    if (child) {
      child.parent = z.parent;
      if (!z.parent) this.root = child;
      else if (z === z.parent.left) z.parent.left = child;
      else z.parent.right = child;
      if (z.color === BLACK) this.fixDelete(child);
    } else if (!z.parent) {
      this.root = null;
    } else {
      if (z.color === BLACK) this.fixDelete(z);
      if (z.parent) {
        if (z === z.parent.left) z.parent.left = null;
        else z.parent.right = null;
      }
    }
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
 * Streaming builder for a {@link BigIntTreeSet} from ascending-sorted values (the
 * data pump's Sink form). Buffer values with {@link put} / {@link putAll} then
 * call {@link create} once. Poisoned after an order/duplicate error; `create`
 * is once-only.
 */
export class BigIntTreeSetSink {
  private readonly keys: bigint[] = [];
  private readonly onDuplicate: "error" | "ignore";
  private index = 0;
  private poisoned = false;
  private done = false;

  constructor(opts?: PumpOptions) {
    this.onDuplicate = opts?.onDuplicate ?? "error";
  }

  put(value: bigint): void {
    if (this.poisoned) throw new Error("sink is poisoned after a prior error");
    if (this.done) throw new Error("sink already created");
    const i = this.index++;
    if (this.keys.length > 0) {
      const cmp =
        this.keys[this.keys.length - 1] < value
          ? -1
          : this.keys[this.keys.length - 1] > value
            ? 1
            : 0;
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

  putAll(items: Iterable<bigint>): void {
    for (const e of items) this.put(e);
  }

  create(): BigIntTreeSet {
    if (this.poisoned) throw new Error("sink is poisoned after a prior error");
    if (this.done) throw new Error("sink already created");
    this.done = true;
    return BigIntTreeSet.buildFromSortedBuffer(this.keys);
  }
}
