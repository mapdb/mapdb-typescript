// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


/**
 * Immutable pair of (number, bigint) values.
 */
export class NumberBigIntPair {
  private readonly _one: number;
  private readonly _two: bigint;

  constructor(one: number, two: bigint) {
    this._one = one;
    this._two = two;
  }

  /** Returns the first element. */
  one(): number {
    return this._one;
  }

  /** Returns the second element. */
  two(): bigint {
    return this._two;
  }

  /** Returns true if both elements are equal to the other pair's elements. */
  equals(other: NumberBigIntPair): boolean {
    return this._one === other.one() && this._two === other.two();
  }

  /** Compares this pair to another lexicographically (first by one, then by two). */
  compareTo(other: NumberBigIntPair): number {
    const cmp1 = this._one - other.one();
    if (cmp1 !== 0) return cmp1;
    return this._two < other.two() ? -1 : this._two > other.two() ? 1 : 0;
  }

  /** Returns a string representation. */
  toString(): string {
    return `(${this._one}, ${this._two})`;
  }
}
