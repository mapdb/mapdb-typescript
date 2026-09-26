// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * A virtual collection representing a range of number values [from, to] with
 * a given step. No elements are materialised in memory — iteration computes
 * values on the fly.
 *
 * This is the `Interval<i32>` surface (algorithms.md §"Interval over signed
 * integers"): `from`, `to` and `step` must be int32 values
 * (`Number.isInteger` and within `[-2^31, 2^31 - 1]`); every factory throws a
 * `RangeError` otherwise. Enforcing the domain keeps `to - from` and
 * `from + step * i` exact in IEEE doubles, so `size` is an exact integer
 * division and iteration is index-driven (`get(i)` for `i < size`), never a
 * `current += step` cursor that can round at 2^53 and loop forever.
 */
export class NumberInterval {
  private readonly _from: number;
  private readonly _to: number;
  private readonly _step: number;

  private constructor(from: number, to: number, step: number) {
    this._from = from;
    this._to = to;
    this._step = step;
  }

  /**
   * Rejects anything outside the int32 domain: fractions, NaN, ±Infinity and
   * integers beyond ±2^31. Called by every public factory so no path (in
   * particular `fromTo`, which does not go through `fromToBy`) can build an
   * interval whose arithmetic is inexact.
   */
  private static checkI32(name: string, value: number): void {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
      throw new RangeError(
        `NumberInterval: ${name} must be an int32, got ${String(value)}`,
      );
    }
  }

  /** Creates an interval from `from` to `to` (inclusive) with the given step. */
  static fromToBy(from: number, to: number, step: number): NumberInterval {
    NumberInterval.checkI32("from", from);
    NumberInterval.checkI32("to", to);
    NumberInterval.checkI32("step", step);
    if (step === 0) throw new Error("NumberInterval: step must not be zero");
    if (from < to && step < 0)
      throw new Error("NumberInterval: step must be positive when from < to");
    if (from > to && step > 0)
      throw new Error("NumberInterval: step must be negative when from > to");
    return new NumberInterval(from, to, step);
  }

  /** Creates an interval from `from` to `to` (inclusive) with step 1 or -1. */
  static fromTo(from: number, to: number): NumberInterval {
    NumberInterval.checkI32("from", from);
    NumberInterval.checkI32("to", to);
    const step: number = from <= to ? 1 : (-1 as number);
    return new NumberInterval(from, to, step);
  }

  /** Creates an interval from 1 to `to` (inclusive). */
  static oneTo(to: number): NumberInterval {
    return NumberInterval.fromTo(1 as number, to);
  }

  /** Creates an interval from 0 to `to` (inclusive). */
  static zeroTo(to: number): NumberInterval {
    return NumberInterval.fromTo(0, to);
  }

  /** Returns the start of the interval. */
  from(): number {
    return this._from;
  }

  /** Returns the end of the interval (inclusive). */
  to(): number {
    return this._to;
  }

  /** Returns the step. */
  step(): number {
    return this._step;
  }

  /** Returns the number of elements. */
  get size(): number {
    if (
      (this._step > 0 && this._from > this._to) ||
      (this._step < 0 && this._from < this._to)
    ) {
      return 0;
    }
    // Both operands are int32, so the distance (< 2^32) is exact. The
    // intermediate quotient may round (10 / 3 is not representable), but the
    // rounding error is far below the gap to the next integer boundary, so
    // the floor is the exact integer quotient and the count is exact: the
    // canonical `distance / absStep + 1`, never a fractional size (which let
    // `get` return elements outside the interval).
    return (
      Math.floor(Math.abs(this._to - this._from) / Math.abs(this._step)) + 1
    );
  }

  /** Returns true if the interval is empty. */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Returns true if the interval contains the given value. A non-integer
   * query can never be a member, and it must be rejected before the
   * subtraction: `Number.EPSILON - (-2147483648)` rounds to an integer, so
   * the remainder test alone would report it as a member. Out-of-int32
   * integers fail the endpoint comparisons.
   */
  has(value: number): boolean {
    if (!Number.isInteger(value)) return false;
    if (this._step > 0) {
      return (
        value >= this._from &&
        value <= this._to &&
        (value - this._from) % this._step === 0
      );
    }
    return (
      value <= this._from &&
      value >= this._to &&
      (this._from - value) % (-this._step as number) === 0
    );
  }

  /** Returns the element at the given index, or throws if out of bounds. */
  get(index: number): number {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(
        `${index} out of bounds for interval size ${this.size}`,
      );
    }
    return this._from + this._step * (index as number);
  }

  /** Calls the function for each element in order. */
  forEach(f: (value: number) => void): void {
    for (const v of this) {
      f(v);
    }
  }

  /** Returns a new array with the results of calling `f` on each element. */
  map<U>(f: (value: number) => U): U[] {
    const result: U[] = [];
    for (const v of this) {
      result.push(f(v));
    }
    return result;
  }

  /** Returns elements satisfying the predicate as an array. */
  filter(predicate: (value: number) => boolean): number[] {
    const result: number[] = [];
    for (const v of this) {
      if (predicate(v)) result.push(v);
    }
    return result;
  }

  /** Returns the first element satisfying the predicate, or undefined. */
  find(predicate: (value: number) => boolean): number | undefined {
    for (const v of this) {
      if (predicate(v)) return v;
    }
    return undefined;
  }

  /** Returns true if every element satisfies the predicate. */
  every(predicate: (value: number) => boolean): boolean {
    for (const v of this) {
      if (!predicate(v)) return false;
    }
    return true;
  }

  /** Returns true if at least one element satisfies the predicate. */
  some(predicate: (value: number) => boolean): boolean {
    for (const v of this) {
      if (predicate(v)) return true;
    }
    return false;
  }

  /** Reduces to a single value using the accumulator function. */
  reduce<U>(f: (acc: U, value: number) => U, initial: U): U {
    let acc = initial;
    for (const v of this) {
      acc = f(acc, v);
    }
    return acc;
  }

  /** Alias for `has`. */
  includes(value: number): boolean {
    return this.has(value);
  }

  /** Returns all elements as an array. */
  toArray(): number[] {
    const result: number[] = [];
    for (const v of this) {
      result.push(v);
    }
    return result;
  }

  /** Makes the interval iterable with for-of loops. */
  *[Symbol.iterator](): IterableIterator<number> {
    // Index-driven, per algorithms.md: `from + step * i` for `i < size` is
    // exact in the int32 domain, whereas a `current += step` cursor is not
    // guaranteed to cross `to` once values round (2^53 + 1 == 2^53).
    const n = this.size;
    for (let i = 0; i < n; i++) {
      yield this._from + this._step * i;
    }
  }

  /**
   * Returns a new interval with the same elements in reverse order. The
   * result starts from the last element of the complete progression and
   * walks back to `from`; that equals `get(size - 1), ..., get(0)` whenever
   * the element count is representable by the index API, but the general
   * definition is the complete progression, as the spec states.
   *
   * Its `from` is the last element actually produced, not this interval's
   * `to`: `to` is only an inclusive bound and may sit off the step grid
   * (`fromToBy(0, 10, 3)` is `0, 3, 6, 9`, so its reverse is `9, 6, 3, 0`).
   * The last element is `to` pulled back onto the grid by the remainder of
   * the distance (algorithms.md §"Reversed() starts from the last element");
   * both operands are int32, so the distance and remainder are exact.
   *
   * Throws at the int32 minimum step, before anything is computed. JS
   * numbers can represent the negation, but this class is the Interval<i32>
   * surface and algorithms.md requires the trap (same as
   * IntInterval.toReversed).
   */
  reversed(): NumberInterval {
    if (this._step === -2147483648) {
      throw new Error(
        "NumberInterval: cannot reverse interval with minimum step",
      );
    }
    // rem <= distance, so pulling `to` back by rem cannot leave [from, to].
    const rem = Math.abs(this._to - this._from) % Math.abs(this._step);
    const last = this._step > 0 ? this._to - rem : this._to + rem;
    return new NumberInterval(last, this._from, -this._step as number);
  }

  toString(): string {
    return `NumberInterval(${this._from}, ${this._to}, step ${this._step})`;
  }
}
