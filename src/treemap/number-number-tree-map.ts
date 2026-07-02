// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableMap } from "../api/index.js";
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

interface NumberNumberTreeMapNode {
  key: number;
  value: number;
  left: NumberNumberTreeMapNode | null;
  right: NumberNumberTreeMapNode | null;
  parent: NumberNumberTreeMapNode | null;
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
function nodeSize(n: NumberNumberTreeMapNode | null): number {
  return n === null ? 0 : n.size;
}

/**
 * Sorted map with number keys and number values, backed by a red-black tree.
 * Keys are maintained in ascending order.
 */
export class NumberNumberTreeMap implements MapDbMutableMap<number, number> {
  private root: NumberNumberTreeMapNode | null = null;
  private _size = 0;

  /**
   * Bulk-loads a fresh map from ascending-sorted key/value pairs in a single
   * O(n) pass (the data pump), bypassing per-element rebalancing. Input order is
   * validated with the map's own IEEE-754 total-order comparator; out-of-order
   * input throws {@link PumpNotSortedError}. Duplicate keys throw
   * {@link PumpDuplicateError} unless `onDuplicate` is "ignore" (keeps the first
   * pair of each run). The result is observably identical to inserting the same
   * pairs one by one with {@link set}.
   */
  static fromSorted(
    sortedPairs: Iterable<readonly [number, number]>,
    opts?: PumpOptions,
  ): NumberNumberTreeMap {
    const sink = new NumberNumberTreeMapSink(opts);
    sink.putAll(sortedPairs);
    return sink.create();
  }

  /** @internal Builds the tree from a validated, deduplicated sorted buffer. */
  static buildFromSortedBuffer(
    keys: number[],
    values: number[],
  ): NumberNumberTreeMap {
    const map = new NumberNumberTreeMap();
    map.root = buildRedBlack<NumberNumberTreeMapNode>(keys.length, (j) => ({
      key: keys[j],
      value: values[j],
      left: null,
      right: null,
      parent: null,
      color: BLACK,
    }));
    map._size = keys.length;
    return map;
  }

  /** Inserts or updates. Returns the map for chaining, like JS Map.set. */
  set(key: number, value: number): this {
    if (this.root === null) {
      this.root = {
        key,
        value,
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
      const cmp = totalCmpNumber(key, node.key);
      if (cmp < 0) {
        if (node.left === null) {
          node.left = {
            key,
            value,
            left: null,
            right: null,
            parent: node,
            color: RED,
            size: 1,
          };
          this.incSizeToRoot(node);
          this.fixAfterInsert(node.left);
          this._size++;
          return this;
        }
        node = node.left;
      } else if (cmp > 0) {
        if (node.right === null) {
          node.right = {
            key,
            value,
            left: null,
            right: null,
            parent: node,
            color: RED,
            size: 1,
          };
          this.incSizeToRoot(node);
          this.fixAfterInsert(node.right);
          this._size++;
          return this;
        }
        node = node.right;
      } else {
        node.value = value;
        return this;
      }
    }
  }

  get(key: number): number | undefined {
    const node = this.findNode(key);
    return node ? node.value : undefined;
  }

  getOrDefault(key: number, defaultValue: number): number {
    const v = this.get(key);
    return v !== undefined ? v : defaultValue;
  }

  has(key: number): boolean {
    return this.findNode(key) !== null;
  }

  remove(key: number): number | undefined {
    const node = this.findNode(key);
    if (!node) return undefined;
    const old = node.value;
    this.deleteNode(node);
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

  min(): [number, number] | undefined {
    if (!this.root) return undefined;
    const n = this.minNode(this.root);
    return [n.key, n.value];
  }

  max(): [number, number] | undefined {
    if (!this.root) return undefined;
    const n = this.maxNode(this.root);
    return [n.key, n.value];
  }

  floor(key: number): [number, number] | undefined {
    let result: NumberNumberTreeMapNode | null = null;
    let node = this.root;
    while (node) {
      const cmp = totalCmpNumber(key, node.key);
      if (cmp === 0) return [node.key, node.value];
      if (cmp > 0) {
        result = node;
        node = node.right;
      } else node = node.left;
    }
    return result ? [result.key, result.value] : undefined;
  }

  ceiling(key: number): [number, number] | undefined {
    let result: NumberNumberTreeMapNode | null = null;
    let node = this.root;
    while (node) {
      const cmp = totalCmpNumber(key, node.key);
      if (cmp === 0) return [node.key, node.value];
      if (cmp < 0) {
        result = node;
        node = node.left;
      } else node = node.right;
    }
    return result ? [result.key, result.value] : undefined;
  }

  // ── point navigation (NavigableMap surface) ─────────────────────────
  //
  // floor `<= k`, ceiling `>= k`, lower `< k` (strict), higher `> k`
  // (strict). All comparisons go through the production totalCmpNumber
  // (IEEE-754 total order). Absence is `undefined`.

  /** Greatest key `<= k` and its value, or `undefined`. */
  floorEntry(key: number): [number, number] | undefined {
    return this.floor(key);
  }

  /** Greatest key `<= k`, or `undefined`. */
  floorKey(key: number): number | undefined {
    return this.floor(key)?.[0];
  }

  /** Least key `>= k` and its value, or `undefined`. */
  ceilingEntry(key: number): [number, number] | undefined {
    return this.ceiling(key);
  }

  /** Least key `>= k`, or `undefined`. */
  ceilingKey(key: number): number | undefined {
    return this.ceiling(key)?.[0];
  }

  /** Greatest key `< k` (strict) and its value, or `undefined`. */
  lowerEntry(key: number): [number, number] | undefined {
    let result: NumberNumberTreeMapNode | null = null;
    let node = this.root;
    while (node) {
      if (totalCmpNumber(key, node.key) > 0) {
        result = node;
        node = node.right;
      } else node = node.left;
    }
    return result ? [result.key, result.value] : undefined;
  }

  /** Greatest key `< k` (strict), or `undefined`. */
  lowerKey(key: number): number | undefined {
    return this.lowerEntry(key)?.[0];
  }

  /** Least key `> k` (strict) and its value, or `undefined`. */
  higherEntry(key: number): [number, number] | undefined {
    let result: NumberNumberTreeMapNode | null = null;
    let node = this.root;
    while (node) {
      if (totalCmpNumber(key, node.key) < 0) {
        result = node;
        node = node.left;
      } else node = node.right;
    }
    return result ? [result.key, result.value] : undefined;
  }

  /** Least key `> k` (strict), or `undefined`. */
  higherKey(key: number): number | undefined {
    return this.higherEntry(key)?.[0];
  }

  /** Minimum entry, or `undefined`. Alias for {@link min}. */
  firstEntry(): [number, number] | undefined {
    return this.min();
  }

  /** Minimum key, or `undefined`. */
  firstKey(): number | undefined {
    return this.min()?.[0];
  }

  /** Maximum entry, or `undefined`. Alias for {@link max}. */
  lastEntry(): [number, number] | undefined {
    return this.max();
  }

  /** Maximum key, or `undefined`. */
  lastKey(): number | undefined {
    return this.max()?.[0];
  }

  // ── poll (positional removal) ───────────────────────────────────────

  /**
   * Removes and returns the minimum entry, or `undefined` if empty. Does not
   * trap on an empty map.
   */
  pollFirstEntry(): [number, number] | undefined {
    const e = this.min();
    if (e === undefined) return undefined;
    this.remove(e[0]);
    return e;
  }

  /**
   * Removes and returns the maximum entry, or `undefined` if empty. Does not
   * trap on an empty map.
   */
  pollLastEntry(): [number, number] | undefined {
    const e = this.max();
    if (e === undefined) return undefined;
    this.remove(e[0]);
    return e;
  }

  // ── range slice & descending iteration (consume Range) ──────────────
  //
  // Range membership is EXACTLY `range.contains(key)`: e.g. `open(1, 2)` over
  // i32 matches no key yet is a valid, non-cut-empty range. We never infer
  // discrete-domain emptiness from the cuts.

  /** Keys whose key ∈ `range`, ascending. Snapshot at call time; read-only. */
  rangeKeysIn(range: Range<number>): number[] {
    const out: number[] = [];
    for (const k of this.keys()) if (range.contains(k)) out.push(k);
    return out;
  }

  /** `[key, value]` pairs whose key ∈ `range`, ascending. */
  rangeEntriesIn(range: Range<number>): [number, number][] {
    const out: [number, number][] = [];
    for (const [k, v] of this.entries())
      if (range.contains(k)) out.push([k, v]);
    return out;
  }

  /** Keys whose key ∈ `range`, descending. */
  descendingRangeKeys(range: Range<number>): number[] {
    return this.rangeKeysIn(range).reverse();
  }

  /** `[key, value]` pairs whose key ∈ `range`, descending. */
  descendingRangeEntries(range: Range<number>): [number, number][] {
    return this.rangeEntriesIn(range).reverse();
  }

  /** All keys, descending. */
  descendingKeys(): number[] {
    return [...this.keys()].reverse();
  }

  /** All `[key, value]` pairs, descending. */
  descendingEntries(): [number, number][] {
    return [...this.entries()].reverse();
  }

  /**
   * A new independent map of the entries whose key ∈ `range`. Mutating the
   * snapshot never affects the original and vice versa (it is a materialized
   * copy, not a live view).
   */
  subMap(range: Range<number>): NumberNumberTreeMap {
    const out = new NumberNumberTreeMap();
    for (const [k, v] of this.entries()) if (range.contains(k)) out.set(k, v);
    return out;
  }

  /**
   * Removes every entry whose key ∈ `range`; returns the count removed. A
   * range that matches nothing is a no-op returning `0`.
   */
  removeRange(range: Range<number>): number {
    const victims = this.rangeKeysIn(range);
    for (const k of victims) this.remove(k);
    return victims.length;
  }

  /** Yields entries in ascending key order. */
  *entries(): Generator<[number, number]> {
    function* inorder(
      node: NumberNumberTreeMapNode | null,
    ): Generator<[number, number]> {
      if (!node) return;
      yield* inorder(node.left);
      yield [node.key, node.value];
      yield* inorder(node.right);
    }
    yield* inorder(this.root);
  }

  /** Yields [key, value] pairs in ascending key order (delegates to
   * {@link entries}), so the map is spreadable and for-of-iterable like a JS
   * Map. */
  [Symbol.iterator](): Generator<[number, number]> {
    return this.entries();
  }

  *keys(): Generator<number> {
    for (const [k] of this.entries()) yield k;
  }

  *values(): Generator<number> {
    for (const [, v] of this.entries()) yield v;
  }

  /** Yields entries with keys in [fromKey, toKey). */
  *rangeKeys(fromKey: number, toKey: number): Generator<[number, number]> {
    for (const [k, v] of this.entries()) {
      if (totalCmpNumber(k, fromKey) < 0) continue;
      if (totalCmpNumber(k, toKey) >= 0) return;
      yield [k, v];
    }
  }

  forEach(f: (key: number, value: number) => void): void {
    for (const [k, v] of this.entries()) f(k, v);
  }

  select(
    predicate: (key: number, value: number) => boolean,
  ): NumberNumberTreeMap {
    const result = new NumberNumberTreeMap();
    for (const [k, v] of this.entries()) {
      if (predicate(k, v)) result.set(k, v);
    }
    return result;
  }

  // ── order statistics (rank / select) ────────────────────────────────
  //
  // Backed by the per-node subtree-size augmentation; both run in O(log n) on
  // the balanced tree. Comparisons go through the production totalCmpNumber,
  // so the order is exactly in-order traversal order. Pure queries.

  /**
   * Returns the number of keys strictly less than `key` (the 0-based
   * lower-bound index the key occupies if present, or would occupy if absent).
   * Defined for present and absent keys alike; result is in `0..=size`.
   */
  rank(key: number): number {
    let rank = 0;
    let node = this.root;
    while (node) {
      const cmp = totalCmpNumber(key, node.key);
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
   * Returns the `i`-th smallest key (0-based), or `undefined` if `i >= size`
   * (including on an empty map) or `i < 0`. No trap. Round-trips with
   * {@link rank}: `selectKey(rank(k)) === k` for present `k`, and
   * `rank(selectKey(i)) === i` for every `0 <= i < size`.
   */
  selectKey(i: number): number | undefined {
    return this.selectNode(i)?.key;
  }

  /**
   * Returns the `i`-th smallest `[key, value]` entry (0-based), or `undefined`
   * if `i >= size` or `i < 0`. Same index domain as {@link selectKey}.
   */
  selectEntry(i: number): [number, number] | undefined {
    const n = this.selectNode(i);
    return n === null ? undefined : [n.key, n.value];
  }

  /**
   * Walks to the node at 0-based sorted index `i`, or `null` if out of range
   * (`i < 0` or `i >= size`). O(log n) via the subtree-size augmentation.
   */
  private selectNode(i: number): NumberNumberTreeMapNode | null {
    if (i < 0) return null;
    let node = this.root;
    while (node) {
      const left = nodeSize(node.left);
      if (i < left) {
        node = node.left;
      } else if (i === left) {
        return node;
      } else {
        i -= left + 1;
        node = node.right;
      }
    }
    return null;
  }

  /**
   * Test-only: assert the subtree-size invariant `size === 1 + left + right`
   * at every node and that the root total equals {@link size}.
   */
  checkSizeInvariant(): void {
    const check = (n: NumberNumberTreeMapNode | null): number => {
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

  toString(): string {
    const parts: string[] = [];
    for (const [k, v] of this.entries()) parts.push(`${k}: ${v}`);
    return `{${parts.join(", ")}}`;
  }

  // --- Red-black tree internals ---

  private findNode(key: number): NumberNumberTreeMapNode | null {
    let node = this.root;
    while (node) {
      const cmp = totalCmpNumber(key, node.key);
      if (cmp < 0) node = node.left;
      else if (cmp > 0) node = node.right;
      else return node;
    }
    return null;
  }

  private minNode(node: NumberNumberTreeMapNode): NumberNumberTreeMapNode {
    while (node.left) node = node.left;
    return node;
  }

  private maxNode(node: NumberNumberTreeMapNode): NumberNumberTreeMapNode {
    while (node.right) node = node.right;
    return node;
  }

  private rotateLeft(x: NumberNumberTreeMapNode): void {
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

  private rotateRight(x: NumberNumberTreeMapNode): void {
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
  private incSizeToRoot(node: NumberNumberTreeMapNode | null): void {
    for (let p = node; p !== null; p = p.parent) p.size++;
  }

  /**
   * Recomputes the subtree size of `node` and every ancestor from their
   * children. Used after a delete splice (rotations inside
   * {@link fixAfterDelete} maintain their own sizes).
   */
  private fixSizeToRoot(node: NumberNumberTreeMapNode | null): void {
    for (let p = node; p !== null; p = p.parent) {
      p.size = 1 + nodeSize(p.left) + nodeSize(p.right);
    }
  }

  private fixAfterInsert(z: NumberNumberTreeMapNode): void {
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

  private deleteNode(z: NumberNumberTreeMapNode): void {
    if (z.left && z.right) {
      const succ = this.minNode(z.right);
      z.key = succ.key;
      z.value = succ.value;
      z = succ;
    }
    // `z` is now the node physically spliced out. `fixSizeFrom` is the lowest
    // node whose cached subtree size must be refreshed; recomputing that path
    // to the root once the structure is final restores the invariant.
    let fixSizeFrom: NumberNumberTreeMapNode | null = null;
    const child = z.left ?? z.right;
    if (child) {
      child.parent = z.parent;
      if (!z.parent) this.root = child;
      else if (z === z.parent.left) z.parent.left = child;
      else z.parent.right = child;
      fixSizeFrom = child;
      if (z.color === BLACK) this.fixAfterDelete(child);
    } else if (!z.parent) {
      this.root = null;
    } else {
      if (z.color === BLACK) this.fixAfterDelete(z);
      // fixAfterDelete may have rotated `z` to a new parent; read it now.
      fixSizeFrom = z.parent;
      if (z.parent) {
        if (z === z.parent.left) z.parent.left = null;
        else z.parent.right = null;
      }
    }
    this.fixSizeToRoot(fixSizeFrom);
  }

  private fixAfterDelete(x: NumberNumberTreeMapNode): void {
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
        const lb = !w.left || w.left.color === BLACK;
        const rb = !w.right || w.right.color === BLACK;
        if (lb && rb) {
          w.color = RED;
          x = x.parent!;
        } else {
          if (rb) {
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
        const lb = !w.left || w.left.color === BLACK;
        const rb = !w.right || w.right.color === BLACK;
        if (lb && rb) {
          w.color = RED;
          x = x.parent!;
        } else {
          if (lb) {
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
 * Streaming builder for a {@link NumberNumberTreeMap} from ascending-sorted
 * pairs (the data pump's Sink form). Buffer pairs with {@link put} / {@link
 * putAll} — each is validated against the previous key — then call {@link
 * create} once to get the finished map. After an order/duplicate error the sink
 * is poisoned: every later `put`/`putAll`/`create` throws. `create` is
 * once-only.
 */
export class NumberNumberTreeMapSink {
  private readonly keys: number[] = [];
  private readonly values: number[] = [];
  private readonly onDuplicate: "error" | "ignore";
  private index = 0;
  private poisoned = false;
  private done = false;

  constructor(opts?: PumpOptions) {
    this.onDuplicate = opts?.onDuplicate ?? "error";
  }

  /** Appends one prepared pair. Throws if out of order or (per policy) duplicate. */
  put(entry: readonly [number, number]): void {
    if (this.poisoned) throw new Error("sink is poisoned after a prior error");
    if (this.done) throw new Error("sink already created");
    const [k, v] = entry;
    const i = this.index++;
    if (this.keys.length > 0) {
      const cmp = totalCmpNumber(this.keys[this.keys.length - 1], k);
      if (cmp > 0) {
        this.poisoned = true;
        throw new PumpNotSortedError(i);
      }
      if (cmp === 0) {
        if (this.onDuplicate === "error") {
          this.poisoned = true;
          throw new PumpDuplicateError(i);
        }
        return; // ignore: keep first pair of the run
      }
    }
    this.keys.push(k);
    this.values.push(v);
  }

  /** Convenience: {@link put} every element of `items`. */
  putAll(items: Iterable<readonly [number, number]>): void {
    for (const e of items) this.put(e);
  }

  /** Finishes the build and returns the map. Once-only. */
  create(): NumberNumberTreeMap {
    if (this.poisoned) throw new Error("sink is poisoned after a prior error");
    if (this.done) throw new Error("sink already created");
    this.done = true;
    return NumberNumberTreeMap.buildFromSortedBuffer(this.keys, this.values);
  }
}
