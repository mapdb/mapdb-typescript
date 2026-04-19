// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import {
  stringHashingStrategy,
  caseInsensitiveHashingStrategy,
  byFieldHashingStrategy,
  naturalComparator,
  reverseComparator,
  comparatorByField,
  thenComparing,
  reversed,
  comparatorByFieldWith,
} from "./strategy";
import { HashSetWithStrategy } from "./strategy-hashset";
import { HashMapWithStrategy } from "./strategy-hashmap";
import { TreeMap } from "./treemap";
import { TreeSet } from "./treeset";

// ── test types ──────────────────────────────────────────────────────

interface Person {
  name: string;
  age: number;
  city: string;
}

// ── HashingStrategy tests ───────────────────────────────────────────

describe("HashSetWithStrategy", () => {
  it("case-insensitive set", () => {
    const s = new HashSetWithStrategy(caseInsensitiveHashingStrategy());
    s.add("Hello");
    s.add("hello"); // duplicate
    s.add("HELLO"); // duplicate
    expect(s.size).toBe(1);
    expect(s.contains("hElLo")).toBe(true);
    s.remove("HELLO");
    expect(s.size).toBe(0);
  });

  it("string hashing strategy", () => {
    const s = new HashSetWithStrategy(stringHashingStrategy());
    s.add("a");
    s.add("b");
    s.add("c");
    s.add("a"); // duplicate
    expect(s.size).toBe(3);
    expect(s.contains("a")).toBe(true);
    expect(s.contains("z")).toBe(false);
  });

  it("by-field hashing (Person by name)", () => {
    const strategy = byFieldHashingStrategy<Person>((p) => p.name);
    const s = new HashSetWithStrategy(strategy);
    s.add({ name: "Alice", age: 30, city: "NYC" });
    s.add({ name: "Alice", age: 25, city: "LA" }); // same name = duplicate
    s.add({ name: "Bob", age: 30, city: "NYC" });
    expect(s.size).toBe(2);
    expect(s.contains({ name: "Alice", age: 99, city: "Mars" })).toBe(true);
  });

  it("select and reject", () => {
    const s = new HashSetWithStrategy(stringHashingStrategy());
    s.add("a");
    s.add("b");
    s.add("c");

    const sel = s.select((v) => v !== "b");
    expect(sel.size).toBe(2);
    expect(sel.contains("a")).toBe(true);
    expect(sel.contains("c")).toBe(true);

    const rej = s.reject((v) => v === "a");
    expect(rej.size).toBe(2);
    expect(rej.contains("b")).toBe(true);
    expect(rej.contains("c")).toBe(true);
  });

  it("forEach and toArray", () => {
    const s = new HashSetWithStrategy(stringHashingStrategy());
    s.add("x");
    s.add("y");
    const collected: string[] = [];
    s.forEach((v) => collected.push(v));
    expect(collected.sort()).toEqual(["x", "y"]);
    expect(s.toArray().sort()).toEqual(["x", "y"]);
  });

  it("Symbol.iterator", () => {
    const s = new HashSetWithStrategy(stringHashingStrategy());
    s.add("a");
    s.add("b");
    const items = [...s];
    expect(items.sort()).toEqual(["a", "b"]);
  });

  it("resize on many elements", () => {
    const s = new HashSetWithStrategy(stringHashingStrategy());
    for (let i = 0; i < 1000; i++) {
      s.add(`item-${i}`);
    }
    expect(s.size).toBe(1000);
    for (let i = 0; i < 1000; i++) {
      expect(s.contains(`item-${i}`)).toBe(true);
    }
  });

  it("clear", () => {
    const s = new HashSetWithStrategy(stringHashingStrategy());
    s.add("a");
    s.add("b");
    s.clear();
    expect(s.size).toBe(0);
    expect(s.isEmpty()).toBe(true);
  });
});

describe("HashMapWithStrategy", () => {
  it("case-insensitive map", () => {
    const m = new HashMapWithStrategy<string, number>(
      caseInsensitiveHashingStrategy(),
    );
    m.put("Content-Type", 1);
    m.put("content-type", 2); // should overwrite
    expect(m.size).toBe(1);
    expect(m.get("CONTENT-TYPE")).toBe(2);
  });

  it("by-field hashing (Person by name)", () => {
    const strategy = byFieldHashingStrategy<Person>((p) => p.name);
    const m = new HashMapWithStrategy<Person, string>(strategy);
    m.put({ name: "Alice", age: 30, city: "NYC" }, "first");
    m.put({ name: "Alice", age: 25, city: "LA" }, "second"); // overwrites by name
    expect(m.size).toBe(1);
    expect(m.get({ name: "Alice", age: 0, city: "" })).toBe("second");
  });

  it("remove", () => {
    const m = new HashMapWithStrategy<string, number>(stringHashingStrategy());
    m.put("a", 1);
    m.put("b", 2);
    expect(m.remove("a")).toBe(1);
    expect(m.size).toBe(1);
    expect(m.containsKey("a")).toBe(false);
  });

  it("select and reject", () => {
    const m = new HashMapWithStrategy<string, number>(stringHashingStrategy());
    m.put("a", 1);
    m.put("b", 2);
    m.put("c", 3);

    const sel = m.select((_, v) => v > 1);
    expect(sel.size).toBe(2);

    const rej = m.reject((k) => k === "c");
    expect(rej.size).toBe(2);
  });

  it("keysToArray and valuesToArray", () => {
    const m = new HashMapWithStrategy<string, number>(stringHashingStrategy());
    m.put("x", 10);
    m.put("y", 20);
    expect(m.keysToArray().sort()).toEqual(["x", "y"]);
    expect(m.valuesToArray().sort()).toEqual([10, 20]);
  });

  it("Symbol.iterator", () => {
    const m = new HashMapWithStrategy<string, number>(stringHashingStrategy());
    m.put("a", 1);
    m.put("b", 2);
    const entries = [...m];
    expect(entries.sort()).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("clear", () => {
    const m = new HashMapWithStrategy<string, number>(stringHashingStrategy());
    m.put("a", 1);
    m.clear();
    expect(m.isEmpty()).toBe(true);
  });
});

// ── TreeMap tests ───────────────────────────────────────────────────

describe("TreeMap", () => {
  it("basic put/get with natural comparator", () => {
    const m = new TreeMap<string, number>(naturalComparator());
    m.put("banana", 2);
    m.put("apple", 1);
    m.put("cherry", 3);
    expect(m.size).toBe(3);
    expect(m.get("apple")).toBe(1);
    expect(m.containsKey("banana")).toBe(true);
    expect(m.containsKey("dragonfruit")).toBe(false);
  });

  it("sorted iteration order", () => {
    const m = new TreeMap<string, number>(naturalComparator());
    m.put("banana", 2);
    m.put("apple", 1);
    m.put("cherry", 3);

    const keys: string[] = [];
    m.forEach((k) => keys.push(k));
    expect(keys).toEqual(["apple", "banana", "cherry"]);
  });

  it("overwrite returns old value", () => {
    const m = new TreeMap<number, string>(naturalComparator());
    m.put(1, "one");
    const old = m.put(1, "ONE");
    expect(old).toBe("one");
    expect(m.size).toBe(1);
  });

  it("remove many elements", () => {
    const m = new TreeMap<number, number>(naturalComparator());
    for (let i = 0; i < 100; i++) m.put(i, i * 10);
    for (let i = 0; i < 100; i += 2) m.remove(i);
    expect(m.size).toBe(50);
    m.forEach((k) => {
      expect(k % 2).toBe(1);
    });
  });

  it("min and max", () => {
    const m = new TreeMap<number, string>(naturalComparator());
    m.put(5, "five");
    m.put(1, "one");
    m.put(9, "nine");
    expect(m.min()).toEqual({ key: 1, value: "one" });
    expect(m.max()).toEqual({ key: 9, value: "nine" });
  });

  it("reverse comparator", () => {
    const m = new TreeMap<number, number>(reverseComparator());
    m.put(1, 10);
    m.put(3, 30);
    m.put(2, 20);

    const keys: number[] = [];
    m.forEach((k) => keys.push(k));
    expect(keys).toEqual([3, 2, 1]);
  });

  it("by-field comparator", () => {
    const m = new TreeMap<Person, string>(
      comparatorByField((p: Person) => p.name),
    );
    m.put({ name: "Charlie", age: 30, city: "NYC" }, "c");
    m.put({ name: "Alice", age: 25, city: "LA" }, "a");
    m.put({ name: "Bob", age: 35, city: "SF" }, "b");

    const names: string[] = [];
    m.forEach((k) => names.push(k.name));
    expect(names).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("Symbol.iterator yields sorted pairs", () => {
    const m = new TreeMap<number, string>(naturalComparator());
    m.put(3, "c");
    m.put(1, "a");
    m.put(2, "b");
    const entries = [...m];
    expect(entries).toEqual([
      [1, "a"],
      [2, "b"],
      [3, "c"],
    ]);
  });

  it("clear", () => {
    const m = new TreeMap<number, number>(naturalComparator());
    m.put(1, 1);
    m.put(2, 2);
    m.clear();
    expect(m.isEmpty()).toBe(true);
    expect(m.size).toBe(0);
  });

  it("empty min/max", () => {
    const m = new TreeMap<number, number>(naturalComparator());
    expect(m.min()).toBeUndefined();
    expect(m.max()).toBeUndefined();
  });
});

// ── TreeSet tests ───────────────────────────────────────────────────

describe("TreeSet", () => {
  it("basic add/contains/size", () => {
    const s = new TreeSet<number>(naturalComparator());
    s.add(3);
    s.add(1);
    s.add(2);
    s.add(1); // duplicate
    expect(s.size).toBe(3);
    expect(s.contains(1)).toBe(true);
    expect(s.contains(4)).toBe(false);
  });

  it("sorted iteration", () => {
    const s = new TreeSet<number>(naturalComparator());
    s.add(3);
    s.add(1);
    s.add(2);
    expect(s.toArray()).toEqual([1, 2, 3]);
  });

  it("min and max", () => {
    const s = new TreeSet<string>(naturalComparator());
    s.add("banana");
    s.add("apple");
    s.add("cherry");
    expect(s.min()).toBe("apple");
    expect(s.max()).toBe("cherry");
  });

  it("remove", () => {
    const s = new TreeSet<number>(naturalComparator());
    for (let i = 0; i < 50; i++) s.add(i);
    for (let i = 0; i < 50; i += 2) s.remove(i);
    expect(s.size).toBe(25);
    expect(s.contains(0)).toBe(false);
    expect(s.contains(2)).toBe(false);
    expect(s.contains(1)).toBe(true);
    expect(s.contains(3)).toBe(true);
  });

  it("select and reject", () => {
    const s = new TreeSet<number>(naturalComparator());
    for (let i = 1; i <= 5; i++) s.add(i);
    const evens = s.select((v) => v % 2 === 0);
    expect(evens.toArray()).toEqual([2, 4]);
  });

  it("Symbol.iterator", () => {
    const s = new TreeSet<number>(naturalComparator());
    s.add(3);
    s.add(1);
    s.add(2);
    expect([...s]).toEqual([1, 2, 3]);
  });

  it("clear", () => {
    const s = new TreeSet<number>(naturalComparator());
    s.add(1);
    s.add(2);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });

  it("empty min/max", () => {
    const s = new TreeSet<number>(naturalComparator());
    expect(s.min()).toBeUndefined();
    expect(s.max()).toBeUndefined();
  });

  it("stress: 1000 elements insert and remove", () => {
    const s = new TreeSet<number>(naturalComparator());
    for (let i = 999; i >= 0; i--) s.add(i);
    expect(s.size).toBe(1000);

    // Verify sorted
    let prev = -1;
    for (const v of s) {
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }

    // Remove all
    for (let i = 0; i < 1000; i++) s.remove(i);
    expect(s.isEmpty()).toBe(true);
  });
});

// ── thenComparing test ──────────────────────────────────────────────

describe("reversed", () => {
  it("reverses an arbitrary comparator (by-age descending)", () => {
    const byAge = comparatorByField<Person, number>((p) => p.age);
    const byAgeDesc = reversed(byAge);

    const s = new TreeSet<Person>(byAgeDesc);
    s.add({ name: "A", age: 20, city: "" });
    s.add({ name: "B", age: 30, city: "" });
    s.add({ name: "C", age: 10, city: "" });

    const ages: number[] = [];
    s.forEach((p) => ages.push(p.age));
    expect(ages).toEqual([30, 20, 10]);
  });
});

describe("comparatorByFieldWith", () => {
  it("sorts persons by name case-insensitively", () => {
    const byNameCI = comparatorByFieldWith(
      (p: Person) => p.name,
      (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
    );

    const s = new TreeSet<Person>(byNameCI);
    s.add({ name: "bob", age: 0, city: "" });
    s.add({ name: "Alice", age: 0, city: "" });
    s.add({ name: "CAROL", age: 0, city: "" });

    const names: string[] = [];
    s.forEach((p) => names.push(p.name));
    expect(names).toEqual(["Alice", "bob", "CAROL"]);
  });
});

describe("thenComparing", () => {
  it("sorts by age then name", () => {
    const byAge = comparatorByField<Person, number>((p) => p.age);
    const byName = comparatorByField<Person, string>((p) => p.name);
    const cmp = thenComparing(byAge, byName);

    const s = new TreeSet<Person>(cmp);
    s.add({ name: "Charlie", age: 30, city: "" });
    s.add({ name: "Alice", age: 30, city: "" });
    s.add({ name: "Bob", age: 25, city: "" });

    const names: string[] = [];
    s.forEach((p) => names.push(p.name));
    // Bob(25) < Alice(30) < Charlie(30) -- age first, then name
    expect(names).toEqual(["Bob", "Alice", "Charlie"]);
  });
});
