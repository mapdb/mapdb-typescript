// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Hand-written stream/multimap API.

/**
 * Lazy stream pipeline API for TypeScript.
 * Equivalent to Java Streams, with full method chaining.
 *
 * Usage:
 *   Stream.of(1, 2, 3, 4, 5)
 *     .filter(x => x > 2)
 *     .map(x => x * 10)
 *     .sorted((a, b) => a - b)
 *     .take(3)
 *     .toArray()
 */
export class Stream<T> {
  private constructor(private readonly iterable: Iterable<T>) {}

  // --- Generators ---

  /** Creates a Stream from values. Java: Stream.of(1, 2, 3) */
  static of<T>(...values: T[]): Stream<T> {
    return new Stream(values);
  }

  /** Creates a Stream from an iterable (array, Set, Map.values(), generator, etc.) */
  static from<T>(iterable: Iterable<T>): Stream<T> {
    return new Stream(iterable);
  }

  /** Creates an empty Stream. Java: Stream.empty() */
  static empty<T>(): Stream<T> {
    return new Stream([]);
  }

  /** Creates a Stream of integers [start, end). Java: IntStream.range(start, end) */
  static range(start: number, end: number): Stream<number> {
    return new Stream(
      (function* () {
        for (let i = start; i < end; i++) yield i;
      })(),
    );
  }

  /** Creates a Stream of integers [start, end]. Java: IntStream.rangeClosed(start, end) */
  static rangeClosed(start: number, end: number): Stream<number> {
    return new Stream(
      (function* () {
        for (let i = start; i <= end; i++) yield i;
      })(),
    );
  }

  /** Creates an infinite Stream from a supplier. Use take(n) to limit. */
  static generate<T>(supplier: () => T): Stream<T> {
    return new Stream(
      (function* () {
        while (true) yield supplier();
      })(),
    );
  }

  /** Creates an infinite Stream: seed, f(seed), f(f(seed)), ... */
  static iterate<T>(seed: T, f: (value: T) => T): Stream<T> {
    return new Stream(
      (function* () {
        let v = seed;
        while (true) {
          yield v;
          v = f(v);
        }
      })(),
    );
  }

  /** Creates a Stream that repeats a value n times. */
  static repeat<T>(value: T, n: number): Stream<T> {
    return new Stream(
      (function* () {
        for (let i = 0; i < n; i++) yield value;
      })(),
    );
  }

  /** Concatenates multiple streams. */
  static concat<T>(...streams: Stream<T>[]): Stream<T> {
    return new Stream(
      (function* () {
        for (const s of streams) yield* s.iterable;
      })(),
    );
  }

  // --- Intermediate operations (lazy, return new Stream) ---

  /** Keeps only elements satisfying the predicate. Java: stream.filter(predicate) */
  filter(predicate: (value: T) => boolean): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        for (const v of source) {
          if (predicate(v)) yield v;
        }
      })(),
    );
  }

  /** Transforms each element. Java: stream.map(function) */
  map<U>(transform: (value: T) => U): Stream<U> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        for (const v of source) yield transform(v);
      })(),
    );
  }

  /** Transforms each element into a stream and flattens. Java: stream.flatMap(function) */
  flatMap<U>(transform: (value: T) => Iterable<U>): Stream<U> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        for (const v of source) yield* transform(v);
      })(),
    );
  }

  /** Takes at most n elements. Java: stream.limit(n) */
  take(n: number): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        let count = 0;
        for (const v of source) {
          if (count >= n) return;
          yield v;
          count++;
        }
      })(),
    );
  }

  /** Skips the first n elements. Java: stream.skip(n) */
  drop(n: number): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        let count = 0;
        for (const v of source) {
          if (count < n) {
            count++;
            continue;
          }
          yield v;
        }
      })(),
    );
  }

  /** Takes elements while predicate is true, then stops. Java: stream.takeWhile(predicate) */
  takeWhile(predicate: (value: T) => boolean): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        for (const v of source) {
          if (!predicate(v)) return;
          yield v;
        }
      })(),
    );
  }

  /** Skips elements while predicate is true, then yields the rest. */
  dropWhile(predicate: (value: T) => boolean): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        let dropping = true;
        for (const v of source) {
          if (dropping) {
            if (predicate(v)) continue;
            dropping = false;
          }
          yield v;
        }
      })(),
    );
  }

  /** Calls function for each element without consuming (for debugging). Java: stream.peek(action) */
  peek(action: (value: T) => void): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        for (const v of source) {
          action(v);
          yield v;
        }
      })(),
    );
  }

  /** Sorts elements. Note: eager — collects all elements to sort. Java: stream.sorted(comparator) */
  sorted(compare: (a: T, b: T) => number): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        const items = [...source];
        items.sort(compare);
        yield* items;
      })(),
    );
  }

  /** Removes duplicates (by reference/value equality). Java: stream.distinct() */
  distinct(): Stream<T> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        const seen = new Set<T>();
        for (const v of source) {
          if (!seen.has(v)) {
            seen.add(v);
            yield v;
          }
        }
      })(),
    );
  }

  /** Appends another stream. */
  concat(other: Stream<T>): Stream<T> {
    return Stream.concat(this, other);
  }

  /** Pairs each element with its index. */
  enumerate(): Stream<[number, T]> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        let i = 0;
        for (const v of source) {
          yield [i, v] as [number, T];
          i++;
        }
      })(),
    );
  }

  /** Splits into chunks of at most n elements. */
  chunk(n: number): Stream<T[]> {
    const source = this.iterable;
    return new Stream(
      (function* () {
        let chunk: T[] = [];
        for (const v of source) {
          chunk.push(v);
          if (chunk.length === n) {
            yield chunk;
            chunk = [];
          }
        }
        if (chunk.length > 0) yield chunk;
      })(),
    );
  }

  // --- Terminal operations (consume the stream) ---

  /** Collects all elements into an array. Java: stream.collect(toList()) */
  toArray(): T[] {
    return [...this.iterable];
  }

  /** Calls function for each element. Java: stream.forEach(action) */
  forEach(action: (value: T) => void): void {
    for (const v of this.iterable) action(v);
  }

  /** Returns the count of elements. Java: stream.count() */
  count(): number {
    let n = 0;
    for (const _ of this.iterable) n++;
    return n;
  }

  /** Left fold. Java: stream.reduce(identity, accumulator) */
  reduce(initial: T, accumulator: (acc: T, value: T) => T): T {
    let result = initial;
    for (const v of this.iterable) result = accumulator(result, v);
    return result;
  }

  /** Fold with a different result type. */
  fold<R>(initial: R, accumulator: (acc: R, value: T) => R): R {
    let result = initial;
    for (const v of this.iterable) result = accumulator(result, v);
    return result;
  }

  /** Returns the first element, or undefined. Java: stream.findFirst() */
  first(): T | undefined {
    for (const v of this.iterable) return v;
    return undefined;
  }

  /** Returns the last element, or undefined. */
  last(): T | undefined {
    let last: T | undefined;
    for (const v of this.iterable) last = v;
    return last;
  }

  /** Returns true if any element satisfies the predicate. Java: stream.anyMatch(predicate) */
  anyMatch(predicate: (value: T) => boolean): boolean {
    for (const v of this.iterable) {
      if (predicate(v)) return true;
    }
    return false;
  }

  /** Returns true if all elements satisfy the predicate. Java: stream.allMatch(predicate) */
  allMatch(predicate: (value: T) => boolean): boolean {
    for (const v of this.iterable) {
      if (!predicate(v)) return false;
    }
    return true;
  }

  /** Returns true if no elements satisfy the predicate. Java: stream.noneMatch(predicate) */
  noneMatch(predicate: (value: T) => boolean): boolean {
    return !this.anyMatch(predicate);
  }

  /** Groups elements by a key function. Java: stream.collect(groupingBy(classifier)) */
  groupBy<K>(keyFunc: (value: T) => K): Map<K, T[]> {
    const result = new Map<K, T[]>();
    for (const v of this.iterable) {
      const key = keyFunc(v);
      const group = result.get(key);
      if (group) group.push(v);
      else result.set(key, [v]);
    }
    return result;
  }

  /** Partitions into [matching, notMatching]. Java: stream.collect(partitioningBy(predicate)) */
  partition(predicate: (value: T) => boolean): [T[], T[]] {
    const matching: T[] = [];
    const notMatching: T[] = [];
    for (const v of this.iterable) {
      if (predicate(v)) matching.push(v);
      else notMatching.push(v);
    }
    return [matching, notMatching];
  }

  /** Joins string elements with separator. Java: stream.collect(joining(delimiter)) */
  join(separator: string = ", "): string {
    return this.toArray().join(separator);
  }

  /** Converts to a Map using key/value extractors. Java: stream.collect(toMap(keyMapper, valueMapper)) */
  toMap<K, V>(keyFunc: (value: T) => K, valueFunc: (value: T) => V): Map<K, V> {
    const result = new Map<K, V>();
    for (const v of this.iterable) {
      result.set(keyFunc(v), valueFunc(v));
    }
    return result;
  }

  /** Converts to a Set. Java: stream.collect(toSet()) */
  toSet(): Set<T> {
    return new Set(this.iterable);
  }

  /** Returns the underlying iterable for use with for-of. */
  [Symbol.iterator](): Iterator<T> {
    return this.iterable[Symbol.iterator]();
  }

  /** Min by comparator. Java: stream.min(comparator) */
  min(compare: (a: T, b: T) => number): T | undefined {
    let min: T | undefined;
    for (const v of this.iterable) {
      if (min === undefined || compare(v, min) < 0) min = v;
    }
    return min;
  }

  /** Max by comparator. Java: stream.max(comparator) */
  max(compare: (a: T, b: T) => number): T | undefined {
    let max: T | undefined;
    for (const v of this.iterable) {
      if (max === undefined || compare(v, max) > 0) max = v;
    }
    return max;
  }
}
