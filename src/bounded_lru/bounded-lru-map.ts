// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Bounded LRU map (max-size v1) — `spec/features/bounded-lru.md`.
 *
 * A fixed-capacity {@link BoundedLruMap} that evicts its least-recently-used
 * entry when an insert would exceed the capacity. Recency is kept by a
 * doubly-linked LRU list of nodes: the head is the LRU end (the eviction
 * victim), the tail is the MRU end. A recency refresh is an O(1) unlink +
 * push-to-tail; eviction is an O(1) pop-from-head. A side `Map<K, Node>` gives
 * O(1) key lookup.
 *
 * Recency is **position-implicit** (head = least-recently-used): there is no
 * stored `last_use` stamp, so nothing can overflow (spec §"`useSeq` width /
 * overflow" — the reference position-implicit form). Only the observable
 * order (LRU-order contents, eviction log, results) is pinned.
 *
 * v1 has **no wall clock**: all time is the caller-supplied logical tick,
 * carried as an unsigned 64-bit value via {@link bigint}. TTL is an
 * after-write `expireAt = saturating(now + ttl)`; {@link BoundedLruMap.expireEntries}
 * removes every entry with `expireAt <= now` (inclusive), firing the callback
 * with cause `expired` in ascending-`expireAt` then ascending-`last_use`
 * (LRU) order. Plain {@link BoundedLruMap.put} is defined as `putAt(k, v, 0n)`.
 */

/** Why an entry left the map (the eviction-callback cause). Only `size` and
 * `expired` exist in v1 — `put`-update, `remove`, and `clear` are NOT
 * evictions and never invoke the callback. */
export type EvictionCause = "size" | "expired";

/** The eviction callback: invoked with `(key, value-at-eviction, cause)`. */
export type EvictCallback<K, V> = (
  key: K,
  value: V,
  cause: EvictionCause,
) => void;

/** Construction options for {@link BoundedLruMap}. `maxSize` is required; `ttl`
 * (logical-tick after-write TTL) and `onEvict` are optional. */
export interface BoundedLruMapOptions<K, V> {
  /** Capacity `n` (the maximum number of resident entries). `0` permanently
   * empty — every insert drops. */
  maxSize: number;
  /** After-write TTL in logical ticks (unsigned 64-bit). Omitted/`null` for a
   * pure max-size map. Accepts a `bigint` or a decimal string. */
  ttl?: bigint | number | string | null;
  /** Optional recording/eviction callback `(key, value, cause)`. */
  onEvict?: EvictCallback<K, V>;
}

/** The unsigned 64-bit "never expires" sentinel: `2^64 - 1`. A computed
 * `expireAt` that lands on (or saturated up to) this value never expires. */
const NEVER: bigint = (1n << 64n) - 1n;

/** One LRU-list node. `prev`/`next` link the doubly-linked recency list (head =
 * LRU, tail = MRU). `expireAt` is the logical expiry tick (unsigned 64-bit
 * BigInt); {@link NEVER} means "never". */
class Node<K, V> {
  prev: Node<K, V> | null = null;
  next: Node<K, V> | null = null;
  constructor(
    public key: K,
    public value: V,
    public expireAt: bigint,
  ) {}
}

/** Parse a `now`/`ttl` operand into an unsigned 64-bit BigInt tick. Decimal
 * strings (used when the value exceeds 2^53) parse straight to BigInt — never
 * through a JS number, which would lose precision above 2^53. The result is
 * range-checked to `[0, 2^64-1]`: the spec/Rust reference carries ticks as
 * `u64`, so a negative or oversized operand is a value the reference cannot
 * represent and is rejected (rather than silently producing an out-of-range
 * `expireAt` no other port could). */
function toTick(v: bigint | number | string): bigint {
  let tick: bigint;
  if (typeof v === "bigint") {
    tick = v;
  } else if (typeof v === "string") {
    tick = BigInt(v);
  } else {
    // A plain JS number: must be a safe integer to round-trip exactly.
    if (!Number.isSafeInteger(v)) {
      throw new Error(
        `bare tick ${v} is not a safe integer; encode large ticks as a decimal string`,
      );
    }
    tick = BigInt(v);
  }
  if (tick < 0n || tick > NEVER) {
    throw new Error(`u64 tick out of range [0, 2^64-1]: ${tick}`);
  }
  return tick;
}

/**
 * A fixed-capacity LRU map from `K` to `V`.
 *
 * The map holds at most `maxSize` entries; a new-key insert that would exceed
 * it evicts the least-recently-used entry first (evict-before-insert), so the
 * inserted key is never its own victim. Defaults: `K = number`, `V = number`.
 */
export class BoundedLruMap<K = number, V = number> {
  private readonly index = new Map<K, Node<K, V>>();
  private head: Node<K, V> | null = null; // LRU end (eviction victim)
  private tail: Node<K, V> | null = null; // MRU end
  private readonly maxSize: number;
  private readonly ttl: bigint | null;
  private readonly onEvict: EvictCallback<K, V> | null;

  constructor(options: BoundedLruMapOptions<K, V>) {
    if (!Number.isInteger(options.maxSize) || options.maxSize < 0) {
      throw new Error(`maxSize must be a non-negative integer`);
    }
    this.maxSize = options.maxSize;
    this.ttl =
      options.ttl === undefined || options.ttl === null
        ? null
        : toTick(options.ttl);
    this.onEvict = options.onEvict ?? null;
  }

  /** A pure max-size LRU map of capacity `n` (no TTL, no callback). */
  static withMaxSize<K = number, V = number>(n: number): BoundedLruMap<K, V> {
    return new BoundedLruMap<K, V>({ maxSize: n });
  }

  /** Current entry count (`0 ..= maxSize`). */
  size(): number {
    return this.index.size;
  }

  /** Whether the map is empty. */
  isEmpty(): boolean {
    return this.index.size === 0;
  }

  /** The configured capacity `n`. */
  capacity(): number {
    return this.maxSize;
  }

  // --- intrusive-list primitives (non-observable) -----------------------

  /** Unlink a node from the LRU list (O(1)); the node object stays allocated. */
  private unlink(node: Node<K, V>): void {
    const { prev, next } = node;
    if (prev !== null) prev.next = next;
    else this.head = next;
    if (next !== null) next.prev = prev;
    else this.tail = prev;
    node.prev = null;
    node.next = null;
  }

  /** Push a (currently unlinked) node onto the MRU end (tail). */
  private pushTail(node: Node<K, V>): void {
    const oldTail = this.tail;
    node.prev = oldTail;
    node.next = null;
    if (oldTail !== null) oldTail.next = node;
    else this.head = node;
    this.tail = node;
  }

  /** Move an existing live node to the MRU end (a recency refresh). */
  private touch(node: Node<K, V>): void {
    if (this.tail === node) return; // already MRU
    this.unlink(node);
    this.pushTail(node);
  }

  /** Remove a victim node entirely (unlink + index-remove) and fire the
   * eviction callback with the given cause and the value-at-eviction. */
  private evictNode(node: Node<K, V>, cause: EvictionCause): void {
    this.index.delete(node.key);
    this.unlink(node);
    if (this.onEvict !== null) this.onEvict(node.key, node.value, cause);
  }

  // --- map surface ------------------------------------------------------

  /** `put(k, v)` == `putAt(k, v, 0n)` (no hidden clock). On a no-TTL map `now`
   * is irrelevant; on a TTL map this writes with `now = 0`. Returns the
   * previous value, or `undefined`. */
  put(key: K, value: V): V | undefined {
    return this.putAt(key, value, 0n);
  }

  /** Insert-or-update with a logical write tick. Refreshes recency of `key`; a
   * new-key insert at capacity evicts the LRU entry first
   * (evict-before-insert). Returns the previous value, or `undefined`. */
  putAt(key: K, value: V, now: bigint | number | string): V | undefined {
    const nowTick = toTick(now);
    const expireAt =
      this.ttl === null ? NEVER : saturatingAddU64(nowTick, this.ttl);

    const existing = this.index.get(key);
    if (existing !== undefined) {
      // Update: value replaced, expiry reset, recency refreshed; NO evict.
      const old = existing.value;
      existing.value = value;
      existing.expireAt = expireAt;
      this.touch(existing);
      return old;
    }

    // Genuine insertion of a new key.
    if (this.maxSize === 0) {
      // Capacity 0: the entry is dropped, never resident, no callback.
      return undefined;
    }

    // Evict-before-insert: a new-key insert raises size by one and needs AT
    // MOST ONE size eviction when maxSize >= 1. The `if` (not a loop) makes
    // the one-eviction contract explicit.
    if (this.index.size >= this.maxSize) {
      const victim = this.head; // LRU end; always non-null since size >= 1.
      if (victim !== null) this.evictNode(victim, "size");
    }

    const node = new Node<K, V>(key, value, expireAt);
    this.pushTail(node);
    this.index.set(key, node);
    return undefined;
  }

  /** Lookup. On a hit refreshes recency; on a miss does nothing. */
  get(key: K): V | undefined {
    const node = this.index.get(key);
    if (node === undefined) return undefined;
    this.touch(node);
    return node.value;
  }

  /** A `get` that returns `def` on a miss. A hit refreshes recency exactly like
   * {@link get}; a miss does NOT refresh recency and does NOT insert `def`. */
  getOrDefault(key: K, def: V): V {
    const v = this.get(key);
    return v === undefined ? def : v;
  }

  /** Membership test. Does NOT refresh recency and never evicts. */
  containsKey(key: K): boolean {
    return this.index.has(key);
  }

  /** Delete `key`. Does not evict and does NOT invoke the eviction callback
   * (manual removal is not an eviction). Returns the removed value, or
   * `undefined`. */
  remove(key: K): V | undefined {
    const node = this.index.get(key);
    if (node === undefined) return undefined;
    this.index.delete(key);
    this.unlink(node);
    return node.value;
  }

  /** Remove all entries. Does NOT invoke the eviction callback for the cleared
   * entries (bulk manual removal is not eviction). */
  clear(): void {
    this.index.clear();
    this.head = null;
    this.tail = null;
  }

  /** Logical-time expiry pass: remove every entry with `expireAt <= now`
   * (inclusive), firing the callback with cause `expired` in ascending
   * `expireAt`, then ascending `last_use` (LRU) order. Returns the count
   * removed. The only time-driven eviction; surviving entries' recency is
   * unchanged. A no-TTL map expires nothing for any `now`. */
  expireEntries(now: bigint | number | string): number {
    if (this.ttl === null) return 0;
    const nowTick = toTick(now);

    // Collect victims by walking head->tail (ascending last_use). The
    // never-sentinel never expires even at now == 2^64-1.
    const victims: Node<K, V>[] = [];
    for (let cur = this.head; cur !== null; cur = cur.next) {
      if (cur.expireAt !== NEVER && cur.expireAt <= nowTick) {
        victims.push(cur);
      }
    }
    // Stable sort by expireAt preserves the head->tail (ascending last_use)
    // order within each expireAt tie. Array.prototype.sort is stable.
    victims.sort((a, b) =>
      a.expireAt < b.expireAt ? -1 : a.expireAt > b.expireAt ? 1 : 0,
    );
    for (const node of victims) this.evictNode(node, "expired");
    return victims.length;
  }

  // --- iteration (LRU order, read-only snapshots) -----------------------

  /** All keys in LRU order (least-recently-used first). A read-only snapshot:
   * does NOT refresh recency and never evicts. */
  keys(): K[] {
    const out: K[] = [];
    for (let cur = this.head; cur !== null; cur = cur.next) out.push(cur.key);
    return out;
  }

  /** All values in LRU order, parallel to {@link keys}. Read-only snapshot. */
  values(): V[] {
    const out: V[] = [];
    for (let cur = this.head; cur !== null; cur = cur.next) out.push(cur.value);
    return out;
  }

  /** All `[key, value]` entries in LRU order. Read-only snapshot. */
  entries(): [K, V][] {
    const out: [K, V][] = [];
    for (let cur = this.head; cur !== null; cur = cur.next) {
      out.push([cur.key, cur.value]);
    }
    return out;
  }
}

/** `saturating(a + b)` over unsigned 64-bit ticks: a sum that would exceed
 * `2^64 - 1` saturates to the {@link NEVER} sentinel (never wraps). */
function saturatingAddU64(a: bigint, b: bigint): bigint {
  const sum = a + b;
  return sum > NEVER ? NEVER : sum;
}
