// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, expect, it } from "vitest";
import { BigIntBigIntListMultimap } from "./bigint-bigint-list-multimap.js";
import { BigIntBigIntSetMultimap } from "./bigint-bigint-set-multimap.js";
import { BigIntNumberListMultimap } from "./bigint-number-list-multimap.js";
import { BigIntNumberSetMultimap } from "./bigint-number-set-multimap.js";
import { Multimap } from "./multimap.js";
import { NumberBigIntListMultimap } from "./number-bigint-list-multimap.js";
import { NumberBigIntSetMultimap } from "./number-bigint-set-multimap.js";
import { NumberNumberListMultimap } from "./number-number-list-multimap.js";
import { NumberNumberSetMultimap } from "./number-number-set-multimap.js";

interface GeneratedMultimap<K, V> {
  set(key: K, value: V): void;
  get(key: K): readonly V[];
  forEachKey(fn: (key: K, values: readonly V[]) => void): void;
}

function expectGeneratedMultimapIsDefensive<K, V>(params: {
  create: () => GeneratedMultimap<K, V>;
  key: K;
  otherKey: K;
  first: V;
  second: V;
  other: V;
  replacement: V;
  appended: V;
}): void {
  const m = params.create();
  m.set(params.key, params.first);
  m.set(params.key, params.second);
  m.set(params.otherKey, params.other);

  const got = m.get(params.key) as V[];
  got[0] = params.replacement;
  got.push(params.appended);
  expect(m.get(params.key)).toEqual([params.first, params.second]);

  const firstGet = m.get(params.key) as V[];
  const secondGet = m.get(params.key);
  firstGet[0] = params.replacement;
  expect(secondGet).toEqual([params.first, params.second]);

  let visited = 0;
  m.forEachKey((_key, values) => {
    visited++;
    const mutable = values as V[];
    mutable[0] = params.replacement;
    mutable.push(params.appended);
  });
  expect(visited).toBe(2);
  expect(m.get(params.key)).toEqual([params.first, params.second]);
  expect(m.get(params.otherKey)).toEqual([params.other]);
}

describe("multimap defensive copies", () => {
  it("generic get returns independent arrays", () => {
    const m = new Multimap<string, number>();
    m.putAll("a", 1, 2);

    const got = m.get("a");
    got[0] = 99;
    got.push(100);
    expect(m.get("a")).toEqual([1, 2]);

    const firstGet = m.get("a");
    const secondGet = m.get("a");
    firstGet[0] = 88;
    expect(secondGet).toEqual([1, 2]);
  });

  it("generic forEachKey does not expose internal arrays", () => {
    const m = new Multimap<string, number>();
    m.putAll("a", 1, 2);
    m.putAll("b", 3);

    let visited = 0;
    m.forEachKey((_key, values) => {
      visited++;
      values[0] = 77;
      values.push(78);
    });
    expect(visited).toBe(2);
    expect(m.get("a")).toEqual([1, 2]);
    expect(m.get("b")).toEqual([3]);
  });

  describe.each([
    {
      name: "number-number list",
      create: () => new NumberNumberListMultimap(),
      key: 1,
      otherKey: 2,
      first: 10,
      second: 20,
      other: 30,
      replacement: 99,
      appended: 100,
    },
    {
      name: "number-number set",
      create: () => new NumberNumberSetMultimap(),
      key: 1,
      otherKey: 2,
      first: 10,
      second: 20,
      other: 30,
      replacement: 99,
      appended: 100,
    },
    {
      name: "number-bigint list",
      create: () => new NumberBigIntListMultimap(),
      key: 1,
      otherKey: 2,
      first: 10n,
      second: 20n,
      other: 30n,
      replacement: 99n,
      appended: 100n,
    },
    {
      name: "number-bigint set",
      create: () => new NumberBigIntSetMultimap(),
      key: 1,
      otherKey: 2,
      first: 10n,
      second: 20n,
      other: 30n,
      replacement: 99n,
      appended: 100n,
    },
    {
      name: "bigint-number list",
      create: () => new BigIntNumberListMultimap(),
      key: 1n,
      otherKey: 2n,
      first: 10,
      second: 20,
      other: 30,
      replacement: 99,
      appended: 100,
    },
    {
      name: "bigint-number set",
      create: () => new BigIntNumberSetMultimap(),
      key: 1n,
      otherKey: 2n,
      first: 10,
      second: 20,
      other: 30,
      replacement: 99,
      appended: 100,
    },
    {
      name: "bigint-bigint list",
      create: () => new BigIntBigIntListMultimap(),
      key: 1n,
      otherKey: 2n,
      first: 10n,
      second: 20n,
      other: 30n,
      replacement: 99n,
      appended: 100n,
    },
    {
      name: "bigint-bigint set",
      create: () => new BigIntBigIntSetMultimap(),
      key: 1n,
      otherKey: 2n,
      first: 10n,
      second: 20n,
      other: 30n,
      replacement: 99n,
      appended: 100n,
    },
  ])("$name", (params) => {
    it("get and forEachKey do not expose internal arrays", () => {
      expectGeneratedMultimapIsDefensive(params);
    });
  });
});
