// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { BoundedLruMap, type EvictionCause } from "./bounded-lru-map.js";

type Triple = [number, number, EvictionCause];

function mapWithLog(n: number): {
  m: BoundedLruMap<number, number>;
  log: Triple[];
} {
  const log: Triple[] = [];
  const m = new BoundedLruMap<number, number>({
    maxSize: n,
    onEvict: (k, v, c) => log.push([k, v, c]),
  });
  return { m, log };
}

function mapWithLogTtl(
  n: number,
  ttl: bigint,
): { m: BoundedLruMap<number, number>; log: Triple[] } {
  const log: Triple[] = [];
  const m = new BoundedLruMap<number, number>({
    maxSize: n,
    ttl,
    onEvict: (k, v, c) => log.push([k, v, c]),
  });
  return { m, log };
}

const U64_MAX = (1n << 64n) - 1n;

describe("BoundedLruMap eviction & order", () => {
  it("evict victim is the LRU and order is correct", () => {
    const { m, log } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20);
    m.put(3, 30); // evicts 1 (LRU)
    expect(m.keys()).toEqual([2, 3]);
    expect(m.values()).toEqual([20, 30]);
    expect(log).toEqual([[1, 10, "size"]]);
  });

  it("get refreshes recency (changes the victim)", () => {
    const { m, log } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20);
    expect(m.get(1)).toBe(10); // 1 now MRU, 2 is LRU
    m.put(3, 30); // evicts 2
    expect(m.keys()).toEqual([1, 3]);
    expect(log).toEqual([[2, 20, "size"]]);
  });

  it("getOrDefault hit refreshes, miss does not", () => {
    const { m } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20);
    expect(m.getOrDefault(1, -1)).toBe(10); // hit: 1 MRU
    expect(m.getOrDefault(99, -1)).toBe(-1); // miss: no insert, no refresh
    expect(m.size()).toBe(2);
    expect(m.containsKey(99)).toBe(false);
    m.put(3, 30); // evicts 2
    expect(m.keys()).toEqual([1, 3]);
  });

  it("containsKey does NOT refresh recency", () => {
    const { m, log } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20);
    expect(m.containsKey(1)).toBe(true); // must NOT refresh 1
    m.put(3, 30); // evicts 1 (still LRU)
    expect(m.keys()).toEqual([2, 3]);
    expect(log).toEqual([[1, 10, "size"]]);
  });

  it("update at capacity does not evict", () => {
    const { m, log } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20);
    expect(m.put(1, 11)).toBe(10); // update: no evict, 1 becomes MRU
    expect(log).toEqual([]);
    expect(m.keys()).toEqual([2, 1]);
    m.put(3, 30); // now evicts 2 (LRU)
    expect(m.keys()).toEqual([1, 3]);
    expect(log).toEqual([[2, 20, "size"]]);
  });

  it("iteration does not refresh or evict", () => {
    const { m, log } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20);
    expect(m.keys()).toEqual([1, 2]); // snapshot must not touch recency
    expect(log).toEqual([]);
    m.put(3, 30); // 1 still LRU -> evicted
    expect(m.keys()).toEqual([2, 3]);
    expect(log).toEqual([[1, 10, "size"]]);
  });

  it("snapshot independence (keys/values/entries are fresh arrays)", () => {
    const { m } = mapWithLog(3);
    m.put(1, 10);
    m.put(2, 20);
    const k = m.keys();
    k.push(999);
    expect(m.keys()).toEqual([1, 2]); // mutating the snapshot does not affect the map
    expect(m.entries()).toEqual([
      [1, 10],
      [2, 20],
    ]);
  });
});

describe("BoundedLruMap recency-refresh set", () => {
  it("recency is per-op (useSeq), not now — same-now writes", () => {
    const { m, log } = mapWithLogTtl(2, 100n);
    m.putAt(1, 10, 5n);
    m.putAt(2, 20, 5n); // both written at now=5
    expect(m.get(1)).toBe(10); // 1 refreshed -> 2 is LRU
    m.putAt(3, 30, 5n); // evicts 2, NOT 1 (recency != now)
    expect(m.keys()).toEqual([1, 3]);
    expect(log).toEqual([[2, 20, "size"]]);
  });

  it("miss does not refresh or insert", () => {
    const { m } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20); // {1(LRU), 2}
    expect(m.get(99)).toBeUndefined();
    expect(m.getOrDefault(99, -1)).toBe(-1);
    expect(m.size()).toBe(2);
    m.put(4, 40); // 1 still LRU -> evicted
    expect(m.keys()).toEqual([2, 4]);
  });

  it("remove fires no callback, no other recency change", () => {
    const { m, log } = mapWithLog(3);
    m.put(1, 10);
    m.put(2, 20);
    m.put(3, 30);
    expect(m.remove(2)).toBe(20);
    expect(log).toEqual([]);
    expect(m.keys()).toEqual([1, 3]);
    m.put(4, 40);
    m.put(5, 50); // capacity 3: full {1,3,4} -> 5 evicts 1
    expect(m.keys()).toEqual([3, 4, 5]);
    expect(log).toEqual([[1, 10, "size"]]);
  });

  it("remove then reinsert gets fresh MRU recency", () => {
    const { m, log } = mapWithLog(3);
    m.put(1, 10);
    m.put(2, 20);
    m.put(3, 30); // {1,2,3}
    m.remove(1);
    m.put(1, 11); // fresh insert: 1 MRU, order {2,3,1}
    m.put(4, 40); // evicts 2 (LRU)
    expect(m.keys()).toEqual([3, 1, 4]);
    expect(log).toEqual([[2, 20, "size"]]);
  });

  it("clear fires no callback and stays usable", () => {
    const { m, log } = mapWithLog(3);
    m.put(1, 10);
    m.put(2, 20);
    m.clear();
    expect(m.isEmpty()).toBe(true);
    expect(m.size()).toBe(0);
    expect(log).toEqual([]);
    m.put(7, 70);
    expect(m.keys()).toEqual([7]);
  });
});

describe("BoundedLruMap evict-before-insert & capacity edges", () => {
  it("evict-before-insert: new key is never its own victim", () => {
    const { m, log } = mapWithLog(1);
    m.put(1, 10);
    m.put(2, 20); // 2 inserted, 1 evicted
    expect(m.containsKey(2)).toBe(true);
    expect(m.containsKey(1)).toBe(false);
    expect(log).toEqual([[1, 10, "size"]]);
  });

  it("capacity 0 drops everything, no callback", () => {
    const { m, log } = mapWithLog(0);
    expect(m.put(1, 10)).toBeUndefined();
    expect(m.put(2, 20)).toBeUndefined();
    expect(m.put(3, 30)).toBeUndefined();
    expect(m.size()).toBe(0);
    expect(m.isEmpty()).toBe(true);
    expect(m.get(1)).toBeUndefined();
    expect(log).toEqual([]);
  });

  it("capacity 1 evicts then inserts; update logs nothing", () => {
    const { m, log } = mapWithLog(1);
    m.put(1, 10);
    m.put(2, 20); // evicts 1
    expect(m.keys()).toEqual([2]);
    expect(log).toEqual([[1, 10, "size"]]);
    expect(m.put(2, 22)).toBe(20); // update: no new log entry
    expect(log.length).toBe(1);
    expect(m.keys()).toEqual([2]);
    expect(m.values()).toEqual([22]);
  });

  it("capacity() reports configured n", () => {
    expect(BoundedLruMap.withMaxSize(5).capacity()).toBe(5);
  });
});

describe("BoundedLruMap callback ordering (SIZE / EXPIRED)", () => {
  it("expire basic, inclusive boundary", () => {
    const { m, log } = mapWithLogTtl(10, 10n);
    m.putAt(1, 10, 0n); // expire_at 10
    m.putAt(2, 20, 0n); // expire_at 10
    m.putAt(3, 30, 5n); // expire_at 15
    expect(m.expireEntries(10n)).toBe(2); // 1,2 expire (<=10); 3 survives
    expect(m.keys()).toEqual([3]);
    expect(log).toEqual([
      [1, 10, "expired"],
      [2, 20, "expired"],
    ]);
  });

  it("expire tiebreak: ascending last_use among an expire_at tie", () => {
    const { m, log } = mapWithLogTtl(10, 10n);
    m.putAt(1, 10, 0n);
    m.putAt(2, 20, 0n);
    m.putAt(3, 30, 0n); // all expire_at 10
    m.get(2); // last_use order asc becomes 2, 3, 1
    m.get(3);
    m.get(1);
    expect(m.expireEntries(10n)).toBe(3);
    expect(log).toEqual([
      [2, 20, "expired"],
      [3, 30, "expired"],
      [1, 10, "expired"],
    ]);
  });

  it("expire orders by expire_at then last_use", () => {
    const { m, log } = mapWithLogTtl(10, 0n);
    m.putAt(1, 10, 5n); // expire_at 5
    m.putAt(2, 20, 3n); // expire_at 3
    m.putAt(3, 30, 5n); // expire_at 5
    m.putAt(4, 40, 3n); // expire_at 3
    expect(m.expireEntries(5n)).toBe(4);
    expect(log).toEqual([
      [2, 20, "expired"],
      [4, 40, "expired"],
      [1, 10, "expired"],
      [3, 30, "expired"],
    ]);
  });
});

describe("BoundedLruMap logical time / u64 ticks", () => {
  it("ttl=0 boundary: inclusive expiry", () => {
    const { m } = mapWithLogTtl(10, 0n);
    m.putAt(1, 10, 5n); // expire_at = 5
    expect(m.expireEntries(4n)).toBe(0); // 5 > 4 survives
    expect(m.containsKey(1)).toBe(true);
    expect(m.expireEntries(5n)).toBe(1); // 5 <= 5 removed (inclusive)
    expect(m.containsKey(1)).toBe(false);
  });

  it("no TTL: nothing expires ever (pure LRU)", () => {
    const { m } = mapWithLog(2);
    m.put(1, 10);
    m.put(2, 20);
    expect(m.expireEntries(U64_MAX)).toBe(0);
    expect(m.keys()).toEqual([1, 2]);
  });

  it("u64 saturation: now+ttl overflowing saturates to the never sentinel", () => {
    const { m, log } = mapWithLogTtl(10, U64_MAX);
    m.putAt(1, 10, 5n); // 5 + (2^64-1) saturates to never
    expect(m.expireEntries(U64_MAX - 1n)).toBe(0);
    expect(m.containsKey(1)).toBe(true);
    expect(log).toEqual([]);
  });

  it("u64::MAX computed expire_at is the never sentinel", () => {
    const { m, log } = mapWithLogTtl(10, 1n);
    m.putAt(1, 10, U64_MAX - 1n); // now+ttl = u64::MAX exactly -> sentinel
    expect(m.expireEntries(U64_MAX)).toBe(0); // never expires
    expect(m.containsKey(1)).toBe(true);
    expect(log).toEqual([]);
  });

  it("ticks above 2^53 carried as bigint (decimal-string equivalent)", () => {
    // 2^63 ttl, written at now=0 -> finite expire_at 2^63; second written at
    // now=2^63 -> 2^64 saturates to never. Mirrors lru_expire_inclusive_saturate.
    const big = 1n << 63n;
    const { m, log } = mapWithLogTtl(10, big);
    m.putAt(1, 10, 0n); // expire_at = 2^63 (finite)
    m.putAt(2, 20, big); // now+ttl = 2^64 saturates to never
    expect(m.expireEntries(big)).toBe(1); // only 1 (2^63 <= 2^63 inclusive)
    expect(m.keys()).toEqual([2]);
    expect(log).toEqual([[1, 10, "expired"]]);
  });

  it("rejects out-of-range u64 ticks (negative or > 2^64-1)", () => {
    const { m } = mapWithLogTtl(10, 10n);
    expect(() => m.putAt(1, 10, -1n)).toThrow(/out of range/);
    expect(() => m.putAt(1, 10, U64_MAX + 1n)).toThrow(/out of range/);
    expect(() => m.expireEntries(-1n)).toThrow(/out of range/);
    expect(
      () => new BoundedLruMap<number, number>({ maxSize: 1, ttl: -5n }),
    ).toThrow(/out of range/);
    // The boundary values are accepted.
    expect(() => m.putAt(1, 10, U64_MAX)).not.toThrow();
    expect(() => m.putAt(2, 20, 0n)).not.toThrow();
  });

  it("update before expire resets expiry and value", () => {
    const { m, log } = mapWithLogTtl(10, 10n);
    m.putAt(1, 10, 0n); // expire_at 10
    expect(m.putAt(1, 11, 5n)).toBe(10); // update: value 11, expire_at 15
    expect(m.expireEntries(10n)).toBe(0); // survives (15 > 10)
    expect(m.containsKey(1)).toBe(true);
    expect(m.expireEntries(15n)).toBe(1); // expires with UPDATED value 11
    expect(log).toEqual([[1, 11, "expired"]]);
  });

  it("expire then size interaction: no spurious SIZE eviction", () => {
    const { m, log } = mapWithLogTtl(2, 10n);
    m.putAt(1, 10, 0n);
    m.putAt(2, 20, 0n);
    expect(m.expireEntries(10n)).toBe(2);
    expect(m.isEmpty()).toBe(true);
    m.putAt(3, 30, 20n); // below capacity: no SIZE eviction
    expect(m.keys()).toEqual([3]);
    expect(log).toEqual([
      [1, 10, "expired"],
      [2, 20, "expired"],
    ]);
  });

  it("plain put on a TTL map is putAt(k, v, 0)", () => {
    const { m } = mapWithLogTtl(10, 10n);
    m.put(1, 10); // == putAt(1, 10, 0) -> expire_at 10
    expect(m.expireEntries(9n)).toBe(0);
    expect(m.expireEntries(10n)).toBe(1);
  });
});

describe("BoundedLruMap tie-free determinism", () => {
  it("replaying a deterministic op sequence is identical", () => {
    function replay(): {
      keys: number[];
      values: number[];
      log: Triple[];
    } {
      const log: Triple[] = [];
      const m = new BoundedLruMap<number, number>({
        maxSize: 5,
        onEvict: (k, v, c) => log.push([k, v, c]),
      });
      let state = 0x12345678n;
      const MASK = (1n << 64n) - 1n;
      for (let i = 0; i < 2000; i++) {
        state = (state * 6364136223846793005n + 1n) & MASK;
        const k = Number((state >> 33n) % 20n);
        switch (Number((state >> 30n) & 3n)) {
          case 0:
            m.put(k, k * 100);
            break;
          case 1:
            m.get(k);
            break;
          case 2:
            m.containsKey(k);
            break;
          default:
            m.remove(k);
            break;
        }
      }
      return { keys: m.keys(), values: m.values(), log };
    }
    const a = replay();
    const b = replay();
    expect(a).toEqual(b);
  });

  it("slot/node reuse after eviction has no dangling state", () => {
    const { m } = mapWithLog(3);
    for (let k = 0; k < 1000; k++) {
      m.put(k, k * 10);
      expect(m.size()).toBeLessThanOrEqual(3);
    }
    expect(m.keys()).toEqual([997, 998, 999]);
    expect(m.values()).toEqual([9970, 9980, 9990]);
  });
});
