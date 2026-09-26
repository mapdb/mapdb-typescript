// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Hand-written regression tests for audit 04-typescript F1 (typed hash
// collections must normalise a key to the storage width ONCE at the API
// boundary, then hash + compare the narrowed value) and F4 (typed float
// lists/stacks min/max follow the IEEE 754 totalOrder rule: NaN above +Inf,
// scenario 05-float-edge-cases/float_min_max_with_nan).

import { describe, expect, it } from "vitest";
import { Float32HashSet } from "./hashset/float32-hash-set.js";
import { Float64HashSet } from "./hashset/float64-hash-set.js";
import { Int8HashSet } from "./hashset/int8-hash-set.js";
import { Int16HashSet } from "./hashset/int16-hash-set.js";
import { Int32HashSet } from "./hashset/int32-hash-set.js";
import { BigInt64HashSet } from "./hashset/bigint64-hash-set.js";
import { ImmutableFloat32HashSet } from "./hashset/immutable_float32-hash-set.js";
import { ImmutableInt8HashSet } from "./hashset/immutable_int8-hash-set.js";
import { Float32Float32HashMap } from "./hashmap/float32-float32-hash-map.js";
import { Int32Int32HashMap } from "./hashmap/int32-int32-hash-map.js";
import { Int8Int32HashMap } from "./hashmap/int8-int32-hash-map.js";
import { BigInt64Int32HashMap } from "./hashmap/bigint64-int32-hash-map.js";
import { ImmutableFloat32Int32HashMap } from "./hashmap/immutable_float32-int32-hash-map.js";
import { Float32ArrayList } from "./arraylist/float32-array-list.js";
import { Float64ArrayList } from "./arraylist/float64-array-list.js";
import { Int8ArrayList } from "./arraylist/int8-array-list.js";
import { ImmutableFloat32ArrayList } from "./arraylist/immutable_float32-array-list.js";
import { ImmutableFloat64ArrayList } from "./arraylist/immutable_float64-array-list.js";
import { Float32ArrayStack } from "./stack/float32-array-stack.js";
import { Float64ArrayStack } from "./stack/float64-array-stack.js";
import { ImmutableFloat32ArrayStack } from "./stack/immutable_float32-array-stack.js";
import { ImmutableFloat64ArrayStack } from "./stack/immutable_float64-array-stack.js";

describe("F1: typed hash sets normalise to storage width", () => {
  it("Float32HashSet: 0.1 twice is one element and findable", () => {
    const s = new Float32HashSet();
    s.add(0.1).add(0.1);
    expect(s.size).toBe(1);
    expect(s.has(0.1)).toBe(true);
    expect(s.has(Math.fround(0.1))).toBe(true);
    expect(s.remove(0.1)).toBe(true);
    expect(s.size).toBe(0);
  });

  it("Float32HashSet: -0/+0 stay distinct, NaN findable", () => {
    const s = new Float32HashSet();
    s.add(-0).add(0).add(NaN).add(NaN);
    expect(s.size).toBe(3);
    expect(s.has(NaN)).toBe(true);
  });

  it("Float32HashSet bulk-load dedups by narrowed value", () => {
    expect(
      Float32HashSet.bulkLoad([0.1, 0.1], { onDuplicate: "ignore" }).size,
    ).toBe(1);
    expect(() => Float32HashSet.bulkLoadExact([0.1, 0.1], 2)).toThrow();
    const s = Float32HashSet.bulkLoadExact([0.1], 1);
    expect(s.has(0.1)).toBe(true);
  });

  it("Float64HashSet unaffected: 0.1 findable", () => {
    const s = new Float64HashSet();
    s.add(0.1).add(0.1);
    expect(s.size).toBe(1);
    expect(s.has(0.1)).toBe(true);
  });

  it("Int8HashSet: 200 and -56 are the same stored key", () => {
    const s = new Int8HashSet();
    s.add(200).add(200).add(-56);
    expect(s.size).toBe(1);
    expect([...s.toArray()]).toEqual([-56]);
    expect(s.has(200)).toBe(true);
    expect(s.has(-56)).toBe(true);
    expect(s.remove(200)).toBe(true);
    expect(s.size).toBe(0);
  });

  it("Int16HashSet: 40000 wraps to -25536", () => {
    const s = new Int16HashSet();
    s.add(40000).add(-25536);
    expect(s.size).toBe(1);
    expect(s.has(40000)).toBe(true);
  });

  it("Int32HashSet: 2**31 twice is one element", () => {
    const s = new Int32HashSet();
    s.add(2 ** 31).add(2 ** 31);
    expect(s.size).toBe(1);
    expect(s.has(2 ** 31)).toBe(true);
    expect(s.has(-(2 ** 31))).toBe(true);
  });

  it("BigInt64HashSet: 2n**63n twice is one element", () => {
    const s = new BigInt64HashSet();
    s.add(2n ** 63n).add(2n ** 63n);
    expect(s.size).toBe(1);
    expect(s.has(2n ** 63n)).toBe(true);
    expect(s.has(-(2n ** 63n))).toBe(true);
  });

  it("immutable typed sets normalise on construction and lookup", () => {
    const f = ImmutableFloat32HashSet.of([0.1, 0.1]);
    expect(f.size).toBe(1);
    expect(f.has(0.1)).toBe(true);
    const i = ImmutableInt8HashSet.of([200, -56]);
    expect(i.size).toBe(1);
    expect(i.has(200)).toBe(true);
  });
});

describe("F1: typed hash maps normalise keys to storage width", () => {
  it("Float32Float32HashMap: key 0.1 twice replaces, get finds it", () => {
    const m = new Float32Float32HashMap();
    m.set(0.1, 1).set(0.1, 2);
    expect(m.size).toBe(1);
    expect(m.get(0.1)).toBe(2);
    expect(m.has(0.1)).toBe(true);
    expect(m.remove(0.1)).toBe(2);
    expect(m.size).toBe(0);
  });

  it("Float32Float32HashMap bulk-load dedups by narrowed key", () => {
    expect(() =>
      Float32Float32HashMap.bulkLoadExact(
        [
          [0.1, 1],
          [0.1, 2],
        ],
        2,
      ),
    ).toThrow();
    const m = Float32Float32HashMap.bulkLoad(
      [
        [0.1, 1],
        [0.1, 2],
      ],
      { onDuplicate: "ignore" },
    );
    expect(m.size).toBe(1);
    expect(m.get(0.1)).toBe(1);
  });

  it("Int32Int32HashMap: key 2**31 twice is one entry", () => {
    const m = new Int32Int32HashMap();
    m.set(2 ** 31, 1).set(2 ** 31, 2);
    expect(m.size).toBe(1);
    expect(m.get(2 ** 31)).toBe(2);
    expect(m.get(-(2 ** 31))).toBe(2);
    m.addToValue(2 ** 31, 5);
    expect(m.size).toBe(1);
    expect(m.get(2 ** 31)).toBe(7);
  });

  it("Int8Int32HashMap: 200 and -56 are one key", () => {
    const m = new Int8Int32HashMap();
    m.set(200, 1).set(-56, 2);
    expect(m.size).toBe(1);
    expect(m.get(200)).toBe(2);
  });

  it("BigInt64Int32HashMap: 2n**63n twice is one key", () => {
    const m = new BigInt64Int32HashMap();
    m.set(2n ** 63n, 1).set(2n ** 63n, 2);
    expect(m.size).toBe(1);
    expect(m.get(2n ** 63n)).toBe(2);
  });

  it("ImmutableFloat32Int32HashMap: of + get normalise", () => {
    const m = ImmutableFloat32Int32HashMap.of([
      [0.1, 1],
      [0.1, 2],
    ]);
    expect(m.size).toBe(1);
    expect(m.get(0.1)).toBe(2);
  });
});

describe("F1: typed lists narrow the probe on has/indexOf", () => {
  it("Float32ArrayList: add(0.1) then has(0.1)", () => {
    const l = new Float32ArrayList();
    l.add(0.1);
    expect(l.has(0.1)).toBe(true);
    expect(l.indexOf(0.1)).toBe(0);
    expect(ImmutableFloat32ArrayList.of([0.1]).has(0.1)).toBe(true);
    const s = new Float32ArrayStack();
    s.push(0.1);
    expect(s.has(0.1)).toBe(true);
  });

  it("Int8ArrayList: add(200) then has(200)", () => {
    const l = new Int8ArrayList();
    l.add(200);
    expect(l.has(200)).toBe(true);
    expect(l.has(-56)).toBe(true);
  });
});

describe("F4: typed float min/max use IEEE 754 totalOrder", () => {
  const vals = [3, NaN, 1, 2];
  const cases: [
    string,
    { min(): number | undefined; max(): number | undefined },
  ][] = [
    ["Float32ArrayList", Float32ArrayList.bulkLoad(vals)],
    ["Float64ArrayList", Float64ArrayList.bulkLoad(vals)],
    ["ImmutableFloat32ArrayList", ImmutableFloat32ArrayList.of(vals)],
    ["ImmutableFloat64ArrayList", ImmutableFloat64ArrayList.of(vals)],
    ["Float32ArrayStack", Float32ArrayStack.of(vals)],
    ["Float64ArrayStack", Float64ArrayStack.of(vals)],
    ["ImmutableFloat32ArrayStack", ImmutableFloat32ArrayStack.of(vals)],
    ["ImmutableFloat64ArrayStack", ImmutableFloat64ArrayStack.of(vals)],
  ];
  for (const [name, c] of cases) {
    it(`${name}: [3,NaN,1,2] -> min 1, max NaN`, () => {
      expect(c.min()).toBe(1);
      expect(c.max()).toBeNaN();
    });
  }

  it("-0 < +0 under totalOrder", () => {
    const l = Float64ArrayList.bulkLoad([0, -0]);
    expect(Object.is(l.min(), -0)).toBe(true);
    expect(Object.is(l.max(), 0)).toBe(true);
  });
});
