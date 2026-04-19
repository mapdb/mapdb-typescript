// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Real-world examples demonstrating HashingStrategy, Comparator, TreeMap, TreeSet.
// These run as regular tests but double as usage documentation.

import { describe, it, expect } from "vitest";
import {
  caseInsensitiveHashingStrategy,
  stringHashingStrategy,
  comparatorByField,
  reverseComparator,
  thenComparing,
} from "./strategy";
import type { HashingStrategy, Comparator } from "./strategy";
import { HashMapWithStrategy } from "./strategy-hashmap";
import { HashSetWithStrategy } from "./strategy-hashset";
import { TreeMap } from "./treemap";
import { TreeSet } from "./treeset";

// ── Example 1: Case-insensitive HTTP headers ──────────────────────────
//
// HTTP header names are case-insensitive per RFC 7230. A plain Map would
// treat "Content-Type" and "content-type" as different keys. Using a
// caseInsensitiveHashingStrategy fixes this.

describe("Example: HTTPHeaders", () => {
  it("treats header names case-insensitively", () => {
    const headers = new HashMapWithStrategy<string, string>(
      caseInsensitiveHashingStrategy(),
    );

    headers.put("Content-Type", "application/json");
    headers.put("Content-Length", "42");
    headers.put("Authorization", "Bearer xyz");

    // Case-insensitive lookup
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("AUTHORIZATION")).toBe("Bearer xyz");

    // Overwriting with different case
    headers.put("content-TYPE", "text/html");
    expect(headers.size).toBe(3);
    expect(headers.get("Content-Type")).toBe("text/html");
  });
});

// ── Example 2: Deduplicating users by email ───────────────────────────
//
// Real-world scenario: you're processing a stream of user records from
// multiple sources. The same user may appear with different casing in
// email or different metadata. You want unique users by email only.

interface User {
  email: string;
  name: string;
  source: string;
  loginCount: number;
}

describe("Example: DeduplicateUsers", () => {
  it("deduplicates users by email case-insensitively", () => {
    // Strategy: two users are "the same" if their emails match case-insensitively.
    const ciStr = caseInsensitiveHashingStrategy();
    const emailStrategy: HashingStrategy<User> = {
      hashCode: (u) => ciStr.hashCode(u.email),
      equals: (a, b) => ciStr.equals(a.email, b.email),
    };

    const unique = new HashSetWithStrategy<User>(emailStrategy);

    // Duplicate-ish records from multiple sources
    const users: User[] = [
      {
        email: "alice@example.com",
        name: "Alice",
        source: "source-a",
        loginCount: 5,
      },
      {
        email: "ALICE@example.com",
        name: "Alice A.",
        source: "source-b",
        loginCount: 10,
      },
      {
        email: "bob@example.com",
        name: "Bob",
        source: "source-a",
        loginCount: 3,
      },
      {
        email: "Alice@Example.Com",
        name: "Alice",
        source: "source-c",
        loginCount: 0,
      },
    ];
    for (const u of users) unique.add(u);

    expect(unique.size).toBe(2);
  });
});

// ── Example 3: Log lines sorted by timestamp, then severity ───────────

interface LogLine {
  timestamp: number;
  severity: number; // 0=debug, 1=info, 2=warn, 3=error
  message: string;
}

describe("Example: LogSorting", () => {
  it("sorts logs by timestamp asc, then severity desc", () => {
    // Sort: timestamp ascending, then severity descending (errors first
    // within the same timestamp).
    const bySeverity = comparatorByField<LogLine, number>((l) => l.severity);
    const bySeverityDesc: Comparator<LogLine> = (a, b) => bySeverity(b, a);

    const cmp = thenComparing<LogLine>(
      comparatorByField<LogLine, number>((l) => l.timestamp),
      bySeverityDesc,
    );

    const logs = new TreeSet<LogLine>(cmp);
    logs.add({ timestamp: 100, severity: 1, message: "info first" });
    logs.add({ timestamp: 100, severity: 3, message: "error same time" });
    logs.add({ timestamp: 50, severity: 0, message: "debug earliest" });
    logs.add({ timestamp: 200, severity: 2, message: "warn latest" });

    const ordered = logs.toArray();

    // Expected order:
    //   t=50  severity=0 "debug earliest"
    //   t=100 severity=3 "error same time"  (higher severity first)
    //   t=100 severity=1 "info first"
    //   t=200 severity=2 "warn latest"
    const got = ordered.map((l) => l.message);
    expect(got).toEqual([
      "debug earliest",
      "error same time",
      "info first",
      "warn latest",
    ]);
  });
});

// ── Example 4: Leaderboard with TreeMap ───────────────────────────────
//
// Use a TreeMap keyed by score (descending) to get sorted leaderboards.

describe("Example: Leaderboard", () => {
  it("orders players by score descending", () => {
    // Key: score, Value: player name.
    // Higher scores first → reverse comparator.
    const board = new TreeMap<number, string>(reverseComparator<number>());

    board.put(100, "Alice");
    board.put(250, "Bob");
    board.put(175, "Charlie");
    board.put(50, "Dave");

    // Top player — Min under reverse = highest score
    const top = board.min();
    expect(top).toBeDefined();
    expect(top!.key).toBe(250);
    expect(top!.value).toBe("Bob");

    // Iterate in rank order
    const ranked: string[] = [];
    board.forEach((_k, name) => ranked.push(name));
    expect(ranked).toEqual(["Bob", "Charlie", "Alice", "Dave"]);
  });
});

// ── Example 5: Grouping by normalized name ────────────────────────────
//
// Merging data from external systems where names have inconsistent
// whitespace or casing ("New York", "new york", "NEW  YORK" are the same).

const normalizeName = (s: string): string =>
  s
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .join(" ");

describe("Example: NormalizedGrouping", () => {
  it("groups strings by normalized form", () => {
    // Reuse one strategy so hash seed is stable across calls.
    const base = stringHashingStrategy();
    const normStrategy: HashingStrategy<string> = {
      hashCode: (s) => base.hashCode(normalizeName(s)),
      equals: (a, b) => normalizeName(a) === normalizeName(b),
    };

    const m = new HashMapWithStrategy<string, number>(normStrategy);
    m.put("New York", 1);
    m.put("new york", 2); // merges with above
    m.put("NEW  YORK", 3); // merges with above
    m.put("Boston", 10);

    expect(m.size).toBe(2);
  });
});
