// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Stream } from "./stream.js";

describe("Stream", () => {
  it("filter and toArray", () => {
    // Java: Stream.of(1,2,3,4,5).filter(x -> x > 2).collect(toList())
    const result = Stream.of(1, 2, 3, 4, 5)
      .filter((x) => x > 2)
      .toArray();
    expect(result).toEqual([3, 4, 5]);
  });

  it("map", () => {
    // Java: Stream.of(1,2,3).map(x -> x * 10).collect(toList())
    const result = Stream.of(1, 2, 3)
      .map((x) => x * 10)
      .toArray();
    expect(result).toEqual([10, 20, 30]);
  });

  it("filter + map + take (full chain)", () => {
    // Java: IntStream.rangeClosed(1, 20).filter(x -> x % 2 == 0).map(x -> x * 10).limit(3).collect(toList())
    const result = Stream.rangeClosed(1, 20)
      .filter((x) => x % 2 === 0)
      .map((x) => x * 10)
      .take(3)
      .toArray();
    expect(result).toEqual([20, 40, 60]);
  });

  it("flatMap", () => {
    const result = Stream.of(1, 2, 3)
      .flatMap((x) => [x, x * 10])
      .toArray();
    expect(result).toEqual([1, 10, 2, 20, 3, 30]);
  });

  it("sorted", () => {
    const result = Stream.of(3, 1, 4, 1, 5)
      .sorted((a, b) => a - b)
      .toArray();
    expect(result).toEqual([1, 1, 3, 4, 5]);
  });

  it("distinct", () => {
    const result = Stream.of(1, 2, 2, 3, 1, 3).distinct().toArray();
    expect(result).toEqual([1, 2, 3]);
  });

  it("reduce", () => {
    // Java: Stream.of(1,2,3,4,5).reduce(0, Integer::sum)
    const sum = Stream.of(1, 2, 3, 4, 5).reduce(0, (a, b) => a + b);
    expect(sum).toBe(15);
  });

  it("first and last", () => {
    expect(Stream.of(10, 20, 30).first()).toBe(10);
    expect(Stream.of(10, 20, 30).last()).toBe(30);
    expect(Stream.empty<number>().first()).toBeUndefined();
  });

  it("anyMatch, allMatch, noneMatch", () => {
    const s = Stream.of(1, 2, 3, 4, 5);
    expect(s.anyMatch((x) => x > 4)).toBe(true);
    expect(Stream.of(1, 2, 3).allMatch((x) => x > 0)).toBe(true);
    expect(Stream.of(1, 2, 3).noneMatch((x) => x < 0)).toBe(true);
  });

  it("groupBy", () => {
    // Java: stream.collect(groupingBy(x -> x % 2 == 0 ? "even" : "odd"))
    const groups = Stream.of(1, 2, 3, 4, 5, 6).groupBy((x) =>
      x % 2 === 0 ? "even" : "odd",
    );
    expect(groups.get("even")).toEqual([2, 4, 6]);
    expect(groups.get("odd")).toEqual([1, 3, 5]);
  });

  it("partition", () => {
    const [evens, odds] = Stream.of(1, 2, 3, 4, 5).partition(
      (x) => x % 2 === 0,
    );
    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3, 5]);
  });

  it("join", () => {
    // Java: Stream.of("a","b","c").collect(Collectors.joining(", "))
    const result = Stream.of("a", "b", "c").join(", ");
    expect(result).toBe("a, b, c");
  });

  it("range", () => {
    expect(Stream.range(0, 5).toArray()).toEqual([0, 1, 2, 3, 4]);
  });

  it("iterate", () => {
    // Java: Stream.iterate(1, x -> x * 2).limit(5)
    const result = Stream.iterate(1, (x) => x * 2)
      .take(5)
      .toArray();
    expect(result).toEqual([1, 2, 4, 8, 16]);
  });

  it("enumerate", () => {
    const result = Stream.of("a", "b", "c").enumerate().toArray();
    expect(result).toEqual([
      [0, "a"],
      [1, "b"],
      [2, "c"],
    ]);
  });

  it("chunk", () => {
    const result = Stream.rangeClosed(1, 7).chunk(3).toArray();
    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("for-of iteration", () => {
    const result: number[] = [];
    for (const v of Stream.of(1, 2, 3)) {
      result.push(v);
    }
    expect(result).toEqual([1, 2, 3]);
  });

  it("complex pipeline", () => {
    // Java: IntStream.rangeClosed(1, 100).filter(x -> x % 3 == 0).map(x -> x * x).limit(5).collect(toList())
    const result = Stream.rangeClosed(1, 100)
      .filter((x) => x % 3 === 0)
      .map((x) => x * x)
      .take(5)
      .toArray();
    expect(result).toEqual([9, 36, 81, 144, 225]);
  });

  it("toMap", () => {
    const m = Stream.of("hello", "go", "java").toMap(
      (s) => s,
      (s) => s.length,
    );
    expect(m.get("hello")).toBe(5);
    expect(m.get("go")).toBe(2);
  });

  it("min and max", () => {
    const cmp = (a: number, b: number) => a - b;
    expect(Stream.of(3, 1, 4, 1, 5).min(cmp)).toBe(1);
    expect(Stream.of(3, 1, 4, 1, 5).max(cmp)).toBe(5);
  });

  it("peek (side effect)", () => {
    const peeked: number[] = [];
    const result = Stream.of(1, 2, 3)
      .peek((v) => peeked.push(v))
      .toArray();
    expect(peeked).toEqual([1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });
});
