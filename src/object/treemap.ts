// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import type { Comparator } from "./strategy";

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

  put(key: K, value: V): V | undefined {
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
      return undefined;
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
          return undefined;
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
          return undefined;
        }
        n = n.right;
      } else {
        const old = n.value;
        n.value = value;
        return old;
      }
    }
  }

  get(key: K): V | undefined {
    const n = this.findNode(key);
    return n !== null ? n.value : undefined;
  }

  containsKey(key: K): boolean {
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
      if (predicate(k, v)) result.put(k, v);
    });
    return result;
  }

  reject(predicate: (key: K, value: V) => boolean): TreeMap<K, V> {
    const result = new TreeMap<K, V>(this.cmp);
    this.forEach((k, v) => {
      if (!predicate(k, v)) result.put(k, v);
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
