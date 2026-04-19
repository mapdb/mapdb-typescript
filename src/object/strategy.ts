// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// ── HashingStrategy ─────────────────────────────────────────────────

/**
 * Externalises identity for hash-based collections.
 * Instead of relying on the element's own hash/equals, the collection
 * uses the strategy. This enables case-insensitive keys, identity by
 * extracted field, etc.
 *
 * This is the TypeScript equivalent of Eclipse Collections' HashingStrategy<T>.
 */
export interface HashingStrategy<T> {
  hashCode(value: T): number;
  equals(a: T, b: T): boolean;
}

/**
 * Defines an ordering between two values.
 * Returns negative if a < b, zero if a == b, positive if a > b.
 */
export type Comparator<T> = (a: T, b: T) => number;

// ── hash utility ────────────────────────────────────────────────────

/** djb2 string hash, returning an unsigned 32-bit integer. */
function hashString(s: string): number {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** Simple hash for numbers — bit-mix via integer multiplication. */
function hashNumber(n: number): number {
  // Convert to 32-bit integer and mix
  let h = n | 0;
  h = (((h >>> 16) ^ h) * 0x45d9f3b) | 0;
  h = (((h >>> 16) ^ h) * 0x45d9f3b) | 0;
  h = (h >>> 16) ^ h;
  return h >>> 0;
}

// ── Strategy builders ───────────────────────────────────────────────

/** Default hashing strategy for strings. */
export function stringHashingStrategy(): HashingStrategy<string> {
  return {
    hashCode: hashString,
    equals: (a, b) => a === b,
  };
}

/** Hashing strategy for strings that ignores case. */
export function caseInsensitiveHashingStrategy(): HashingStrategy<string> {
  return {
    hashCode: (s) => hashString(s.toLowerCase()),
    equals: (a, b) => a.toLowerCase() === b.toLowerCase(),
  };
}

/**
 * Hashing strategy that hashes and compares by an extracted field.
 *
 * @example
 *   const strategy = byFieldHashingStrategy((p: Person) => p.name);
 */
export function byFieldHashingStrategy<T>(
  extract: (v: T) => string | number,
): HashingStrategy<T> {
  return {
    hashCode: (v) => {
      const f = extract(v);
      return typeof f === "string" ? hashString(f) : hashNumber(f);
    },
    equals: (a, b) => extract(a) === extract(b),
  };
}

// ── Comparator builders ─────────────────────────────────────────────

/**
 * Natural comparator for numbers and strings using < and >.
 */
export function naturalComparator<T extends number | string>(): Comparator<T> {
  return (a, b) => (a < b ? -1 : a > b ? 1 : 0);
}

/**
 * Reversed natural comparator.
 */
export function reverseComparator<T extends number | string>(): Comparator<T> {
  return (a, b) => (a < b ? 1 : a > b ? -1 : 0);
}

/**
 * Comparator that orders by an extracted field.
 *
 * @example
 *   const cmp = comparatorByField((p: Person) => p.name);
 */
export function comparatorByField<T, F extends number | string>(
  extract: (v: T) => F,
): Comparator<T> {
  return (a, b) => {
    const fa = extract(a);
    const fb = extract(b);
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  };
}

/**
 * Chains two comparators: uses the secondary when the primary returns zero.
 */
export function thenComparing<T>(
  primary: Comparator<T>,
  secondary: Comparator<T>,
): Comparator<T> {
  return (a, b) => {
    const r = primary(a, b);
    return r !== 0 ? r : secondary(a, b);
  };
}

/**
 * Returns a comparator that reverses the given one. Works on any
 * comparator (unlike reverseComparator which requires natural ordering).
 *
 * @example
 *   const byName = comparatorByField((p: Person) => p.name);
 *   const byNameDesc = reversed(byName);
 */
export function reversed<T>(cmp: Comparator<T>): Comparator<T> {
  return (a, b) => cmp(b, a);
}

/**
 * Returns a comparator that orders by an extracted field using a custom
 * sub-comparator (instead of natural ordering). Useful for e.g. sorting
 * by a string field case-insensitively.
 *
 * @example
 *   const byNameCI = comparatorByFieldWith(
 *     (p: Person) => p.name,
 *     (a, b) => a.toLowerCase().localeCompare(b.toLowerCase())
 *   );
 */
export function comparatorByFieldWith<T, F>(
  extract: (v: T) => F,
  sub: Comparator<F>,
): Comparator<T> {
  return (a, b) => sub(extract(a), extract(b));
}
