// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Shared building blocks for the data pump (bulk import): single-pass,
// insert-only, O(n) construction of a fresh collection.
//
// The per-collection fill loops live INSIDE each class (they touch private
// fields and the private `hash()`); this module holds the parts that are
// identical across every family: the error classes, the input/size guards, the
// open-addressing capacity formula, and the bottom-up balanced red-black tree
// builder. Each collection imports these by name so the algorithm and error
// surface live in one place.

/** Duplicate-handling policy for a pump. Bags ignore this (they count runs). */
export type DuplicatePolicy = "error" | "ignore";

/** Options accepted by the ordered (`fromSorted`) and hash (`bulkLoad`) pumps. */
export interface PumpOptions {
  /** What to do when a duplicate key/value is seen. Defaults to "error". */
  onDuplicate?: DuplicatePolicy;
}

/** Options accepted by `bulkLoad` (size is a growth hint, not a guarantee). */
export interface BulkLoadOptions extends PumpOptions {
  /** Expected element count, used to pre-size the table in one allocation. */
  size?: number;
}

/**
 * Thrown when an ordered pump (`fromSorted` / a tree `Sink`) sees input that is
 * not in ascending order under the collection's own comparator.
 */
export class PumpNotSortedError extends Error {
  constructor(index: number) {
    super(`pump input not sorted at index ${index}`);
    this.name = "PumpNotSortedError";
  }
}

/**
 * Thrown when a pump sees a duplicate key (or, for a BiMap, a duplicate value)
 * while `onDuplicate` is "error".
 */
export class PumpDuplicateError extends Error {
  constructor(index: number, kind: "key" | "value" = "key") {
    super(`pump input has duplicate ${kind} at index ${index}`);
    this.name = "PumpDuplicateError";
  }
}

// Largest length a JS Array (and any TypedArray) can hold. Sizing for more than
// this can never succeed, so reject it up front rather than OOM mid-load.
const MAX_ARRAY_LENGTH = 0xffffffff; // 2^32 - 1
// Largest power-of-two capacity that still fits in a JS array (nextPow2 of
// anything larger would exceed MAX_ARRAY_LENGTH).
const MAX_POW2_CAPACITY = 0x80000000; // 2^31

/**
 * Validate a caller-supplied expected/exact size. Programmer errors (NaN,
 * fractional, negative, or absurdly large counts) throw `RangeError`
 * unconditionally, before any allocation — they are not data errors.
 */
export function checkExpectedSize(n: number): void {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    throw new RangeError(`expected size must be an integer, got ${n}`);
  }
  if (n < 0) {
    throw new RangeError(`expected size must not be negative, got ${n}`);
  }
  if (n > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(`expected size exceeds Number.MAX_SAFE_INTEGER: ${n}`);
  }
  if (n > MAX_ARRAY_LENGTH) {
    throw new RangeError(`expected size exceeds maximum array length: ${n}`);
  }
}

/** `nextPow2`, 32-bit portable (matches each collection's private helper). */
function nextPow2(n: number): number {
  if (n <= 0) return 16;
  n--;
  n |= n >> 1;
  n |= n >> 2;
  n |= n >> 4;
  n |= n >> 8;
  n |= n >> 16;
  n++;
  return n;
}

/**
 * Open-addressing table capacity that fits `n` entries at load factor 0.75 with
 * ZERO mid-load rehash, per the spec:
 *
 *     required = floor(4*n / 3) + 1     // == ceil((4n + 1) / 3)
 *     cap      = nextPow2(required)     // n = 0 -> empty-table sentinel (16)
 *
 * `floor(4n/3)` is computed without overflowing `4*n` past 2^53 by splitting
 * the multiply. `required > 4n/3` guarantees `cap * 0.75 > n`, so loading all
 * `n` entries keeps the table strictly below the resize threshold (`size + 1 >=
 * cap * 0.75`) for every element up to and including the `n`th — i.e. an
 * incremental build into this capacity would never have rehashed. The `+1` is
 * what makes the boundary `n = 3*2^k` work (without it the table would resize at
 * exactly those sizes). Throws `RangeError` if the derived capacity cannot fit
 * in a JS array.
 */
export function hashCapacityFor(n: number): number {
  if (n <= 0) return 16;
  // floor(4n/3) without forming 4*n directly: split via n mod 3 to stay exact
  // up to MAX_SAFE_INTEGER.
  const q = Math.floor(n / 3);
  const r = n - q * 3; // n mod 3, in {0,1,2}
  const required = 4 * q + Math.floor((4 * r) / 3) + 1;
  if (required > MAX_POW2_CAPACITY) {
    throw new RangeError(`pump capacity for ${n} entries exceeds array limit`);
  }
  return Math.max(16, nextPow2(required));
}

/**
 * A node in a red-black tree being built bottom-up. The builder only needs to
 * read/write children, parent, and color; the concrete node type supplies the
 * payload (key/value/count).
 */
export interface RbBuildNode {
  left: this | null;
  right: this | null;
  parent: this | null;
  /** RED = false, BLACK = true — matching the tree implementations. */
  color: boolean;
}

const RED = false;
const BLACK = true;

/**
 * Build a perfectly balanced binary search tree over `n` already-sorted,
 * already-deduplicated items and return its root, colored as a valid red-black
 * tree. This is the classic JDK `TreeMap.buildFromSorted`: a recursive midpoint
 * build (so the in-order traversal reproduces the sorted input exactly) with
 * the deepest, possibly-incomplete level colored RED and every other level
 * BLACK. Equal black-height holds on every root-to-null path, with no red-red
 * edge, in O(n) and zero rotations.
 *
 * `makeNode(i)` materializes the node for sorted index `i` (it must return a
 * node whose payload is item `i`; color is overwritten by the builder).
 */
export function buildRedBlack<N extends RbBuildNode>(
  n: number,
  makeNode: (i: number) => N,
): N | null {
  if (n <= 0) return null;
  const redLevel = computeRedLevel(n);

  const build = (
    lo: number,
    hi: number,
    level: number,
    parent: N | null,
  ): N => {
    const mid = lo + Math.floor((hi - lo) / 2);
    const node = makeNode(mid);
    node.parent = parent;
    node.color = level === redLevel ? RED : BLACK;
    node.left = lo < mid ? build(lo, mid - 1, level + 1, node) : null;
    node.right = mid < hi ? build(mid + 1, hi, level + 1, node) : null;
    return node;
  };

  return build(0, n - 1, 0, null);
}

/**
 * The level (root = 0) whose nodes are colored RED — the deepest, possibly
 * incomplete level. Exact JDK `TreeMap.computeRedLevel` integer loop (avoids
 * floating-point edge cases at powers of two). For `n = 1` it returns 1, so the
 * singleton root at level 0 stays BLACK.
 */
function computeRedLevel(size: number): number {
  let level = 0;
  for (let m = size - 1; m >= 0; m = Math.floor(m / 2) - 1) {
    level++;
  }
  return level;
}

/** Assert RED/BLACK constants stay in sync with the tree files (RED=false). */
export const PUMP_RED = RED;
export const PUMP_BLACK = BLACK;
