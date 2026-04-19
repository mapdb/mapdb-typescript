// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, test, expect } from "vitest";
import { ArrayList } from "./arraylist";
import { HashSet } from "./hashset";
import { HashBag } from "./hashbag";

// ═══════════════════════════════════════════════════════════════════════
// Pet Kata — Eclipse Collections for TypeScript
//
// This is a learning exercise. Each test has a TODO where you need to
// write code using the object collection API. The assertions are already
// written — your job is to make them pass.
//
// Run:  cd generated/mapdb-typescript && npx vitest run src/object/pet-kata.test.ts
// ═══════════════════════════════════════════════════════════════════════

// ── Domain types ──────────────────────────────────────────────────────

enum PetType {
  CAT = "CAT",
  DOG = "DOG",
  HAMSTER = "HAMSTER",
  TURTLE = "TURTLE",
  BIRD = "BIRD",
  SNAKE = "SNAKE",
}

interface Pet {
  name: string;
  type: PetType;
}

class Person {
  constructor(
    public firstName: string,
    public lastName: string,
    public pets: ArrayList<Pet>,
  ) {}

  hasPetType(pt: PetType): boolean {
    return this.pets.some((pet) => pet.type === pt);
  }

  fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}

// ── Test data ─────────────────────────────────────────────────────────

function setupPeople(): ArrayList<Person> {
  const people = new ArrayList<Person>();

  const mary = new Person(
    "Mary",
    "Smith",
    ArrayList.of<Pet>({ name: "Tabby", type: PetType.CAT }),
  );
  const bob = new Person(
    "Bob",
    "Smith",
    ArrayList.of<Pet>(
      { name: "Dolly", type: PetType.DOG },
      { name: "Spot", type: PetType.DOG },
    ),
  );
  const ted = new Person(
    "Ted",
    "Smith",
    ArrayList.of<Pet>(
      { name: "Spike", type: PetType.DOG },
      { name: "Serpy", type: PetType.SNAKE },
    ),
  );
  const jake = new Person(
    "Jake",
    "Snake",
    ArrayList.of<Pet>(
      { name: "Speedy", type: PetType.TURTLE },
      { name: "Tweety", type: PetType.BIRD },
    ),
  );
  const barry = new Person(
    "Barry",
    "Jones",
    ArrayList.of<Pet>(
      { name: "Fluffy", type: PetType.CAT },
      { name: "Crunchie", type: PetType.HAMSTER },
    ),
  );
  const terry = new Person(
    "Terry",
    "Schneider",
    ArrayList.of<Pet>(
      { name: "Cozy", type: PetType.CAT },
      { name: "Rumple", type: PetType.HAMSTER },
    ),
  );
  const harry = new Person("Harry", "Harrison", new ArrayList<Pet>());

  people.add(mary);
  people.add(bob);
  people.add(ted);
  people.add(jake);
  people.add(barry);
  people.add(terry);
  people.add(harry);

  return people;
}

// ── Exercises ─────────────────────────────────────────────────────────

describe("Pet Kata", () => {
  // Exercise 1: Do any people have cats?
  // Hint: Use people.some(...) with the hasPetType helper.
  test("Exercise 1 — do any people have cats?", () => {
    const people = setupPeople();
    void people; // TODO: replace false with an expression using people.some(...)
    const hasCats = false;

    expect(hasCats).toBe(true);
  });

  // Exercise 2: Do all people have pets?
  // Hint: Use people.every(...). Harry has no pets.
  test("Exercise 2 — do all people have pets?", () => {
    const people = setupPeople();
    void people; // TODO: replace true with people.every(...)
    const allHavePets = true;

    expect(allHavePets).toBe(false);
  });

  // Exercise 3: Does nobody have snakes?
  // Hint: Check that no person has a snake. Ted does!
  test("Exercise 3 — does nobody have snakes?", () => {
    const people = setupPeople();
    void people; // TODO: replace true with an expression
    const noSnakes = true;

    expect(noSnakes).toBe(false);
  });

  // Exercise 4: How many people have cats?
  // Hint: Use people.count(...)
  test("Exercise 4 — how many people have cats?", () => {
    const people = setupPeople();
    void people; // TODO: replace 0 with people.count(...)
    const catPeopleCount = 0;

    expect(catPeopleCount).toBe(3);
  });

  // Exercise 5: Get the people who have cats.
  // Hint: Use people.select(...)
  test("Exercise 5 — get people with cats", () => {
    const people = setupPeople();
    void people; // TODO: replace with people.select(...)
    const catPeople = new ArrayList<Person>();

    expect(catPeople.size()).toBe(3);
    const names = new HashSet<string>();
    catPeople.forEach((p) => names.add(p.firstName));
    expect(names.contains("Mary")).toBe(true);
    expect(names.contains("Barry")).toBe(true);
    expect(names.contains("Terry")).toBe(true);
  });

  // Exercise 6: Get the people who do NOT have cats.
  // Hint: Use people.reject(...)
  test("Exercise 6 — get people without cats", () => {
    const people = setupPeople();
    void people; // TODO: replace with people.reject(...)
    const noCatPeople = new ArrayList<Person>();

    expect(noCatPeople.size()).toBe(4);
  });

  // Exercise 7: Find Mary Smith.
  // Hint: Use people.detect(...) to find the first match.
  test("Exercise 7 — find Mary Smith", () => {
    const people = setupPeople();
    void people; // TODO: replace with people.detect(...)
    const mary: Person | undefined = undefined;

    expect(mary).toBeDefined();
    expect(mary!.fullName()).toBe("Mary Smith");
    expect(mary!.pets.size()).toBe(1);
  });

  // Exercise 8: Collect all pet names across all people.
  // Hint: Use people.forEach, then person.pets.forEach.
  test("Exercise 8 — collect all pet names", () => {
    const people = setupPeople();
    const petNames = new ArrayList<string>();
    void people; // TODO: iterate people and their pets, add each pet name

    expect(petNames.size()).toBe(11);
    expect(petNames.contains("Tabby")).toBe(true);
    expect(petNames.contains("Tweety")).toBe(true);
  });

  // Exercise 9: Count pet types using a HashBag.
  // Hint: Create a HashBag<PetType>, iterate all pets, add each type.
  test("Exercise 9 — count pet types with HashBag", () => {
    const people = setupPeople();
    const petTypeBag = new HashBag<PetType>();
    void people; // TODO: populate petTypeBag

    expect(petTypeBag.occurrencesOf(PetType.CAT)).toBe(3);
    expect(petTypeBag.occurrencesOf(PetType.DOG)).toBe(3);
    expect(petTypeBag.occurrencesOf(PetType.HAMSTER)).toBe(2);
    expect(petTypeBag.occurrencesOf(PetType.SNAKE)).toBe(1);
    expect(petTypeBag.occurrencesOf(PetType.TURTLE)).toBe(1);
    expect(petTypeBag.occurrencesOf(PetType.BIRD)).toBe(1);
    expect(petTypeBag.size()).toBe(11);

    const top = petTypeBag.topOccurrences(2);
    expect(top).toHaveLength(2);
    expect(top[0].count).toBe(3);
  });

  // Exercise 10: Collect all unique pet types using a HashSet.
  // Hint: Create a HashSet<PetType>, iterate all pets, add each type.
  test("Exercise 10 — unique pet types with HashSet", () => {
    const people = setupPeople();
    const petTypes = new HashSet<PetType>();
    void people; // TODO: populate petTypes

    expect(petTypes.size()).toBe(6);
    for (const pt of [
      PetType.CAT,
      PetType.DOG,
      PetType.HAMSTER,
      PetType.TURTLE,
      PetType.BIRD,
      PetType.SNAKE,
    ]) {
      expect(petTypes.contains(pt)).toBe(true);
    }
  });

  // Exercise 11: Count total pets using injectInto (fold/reduce).
  // Hint: people.injectInto(0, (acc, person) => acc + person.pets.size())
  test("Exercise 11 — total pet count via injectInto", () => {
    const people = setupPeople();
    void people; // TODO: replace 0 with people.injectInto(...)
    const total = 0;

    expect(total).toBe(11);
  });

  // Exercise 12: Search for a person who doesn't exist.
  // Hint: people.detect(...) should return undefined.
  test("Exercise 12 — detect returns undefined when not found", () => {
    const people = setupPeople();
    void people; // TODO: replace "placeholder" with people.detect(...)
    const nobody: Person | undefined = "placeholder" as unknown as Person;

    expect(nobody).toBeUndefined();
  });
});
