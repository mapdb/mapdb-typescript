// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.


/**
 * Immutable pair of (bigint, number) values.
 */
export class BigIntNumberPair {
  private readonly _one: bigint;
  private readonly _two: number;

  constructor(one: bigint, two: number) {
    this._one = one;
    this._two = two;
  }

  /** Returns the first element. */
  one(): bigint {
    return this._one;
  }

  /** Returns the second element. */
  two(): number {
    return this._two;
  }

  /** Returns true if both elements are equal to the other pair's elements. */
  equals(other: BigIntNumberPair): boolean {
    return this._one === other.one() && this._two === other.two();
  }

  /** Compares this pair to another lexicographically (first by one, then by two). */
  compareTo(other: BigIntNumberPair): number {
    const cmp1 = this._one < other.one() ? -1 : this._one > other.one() ? 1 : 0;
    if (cmp1 !== 0) return cmp1;
    return this._two - other.two();
  }

  /** Returns a string representation. */
  toString(): string {
    return `(${this._one}, ${this._two})`;
  }
}
