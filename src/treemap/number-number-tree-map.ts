// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { MapDbMutableMap } from "../api/index.js";
import type { Range } from "../range/range.js";
import { totalCmpNumber } from "../internal/float-order.js";

const RED = false;
const BLACK = true;

interface NumberNumberTreeMapNode {
  key: number;
  value: number;
  left: NumberNumberTreeMapNode | null;
  right: NumberNumberTreeMapNode | null;
  parent: NumberNumberTreeMapNode | null;
  color: boolean;
}

/**
 * Sorted map with number keys and number values, backed by a red-black tree.
 * Keys are maintained in ascending order.
 */
export class NumberNumberTreeMap implements MapDbMutableMap<number, number> {
  private root: NumberNumberTreeMapNode | null = null;
  private _size = 0;

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
          };
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
          };
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
    const child = z.left ?? z.right;
    if (child) {
      child.parent = z.parent;
      if (!z.parent) this.root = child;
      else if (z === z.parent.left) z.parent.left = child;
      else z.parent.right = child;
      if (z.color === BLACK) this.fixAfterDelete(child);
    } else if (!z.parent) {
      this.root = null;
    } else {
      if (z.color === BLACK) this.fixAfterDelete(z);
      if (z.parent) {
        if (z === z.parent.left) z.parent.left = null;
        else z.parent.right = null;
      }
    }
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
