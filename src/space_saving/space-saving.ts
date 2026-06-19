// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Space-Saving — a bounded heavy-hitters / top-k summary tracking at most `m`
 * monitored `(item, count, error)` triples with a deterministic eviction rule
 * (see `spec/features/count-min.md`).
 *
 * Unlike the Count-Min Sketch, Space-Saving is **order-DEPENDENT** (eviction
 * depends on which item is the current min when the set is full, which depends
 * on add order). For an identical capacity `m` and an identical add-sequence
 * **in the same order**, the monitored set in canonical order is bit-identical
 * across all five ports. **No floating point** appears in any asserted value.
 *
 * Pinned rulings:
 * - **Eviction tie-break:** the victim is the monitored item minimizing
 *   `(count, signed-i32 item)` — smallest count, then smallest **signed** i32
 *   item (`INT_MIN` < … < `-1` < `0` < `1`). `error` is NOT part of the
 *   tie-break.
 * - **Error accounting:** a displaced new item gets
 *   `count = evicted_count + count`, `error = evicted_count`; an
 *   already-monitored item's `error` NEVER changes; a freshly-admitted (room)
 *   item has `error = 0`.
 * - **Saturating add** at `u64::MAX` (does NOT wrap).
 * - **Canonical order:** `count` DESCENDING, then signed `item` ASCENDING (a
 *   total order; `error` rides along but never decides order). `topK(k)` is the
 *   first `k` of this order; `topK(size())` == `monitoredSet()`.
 * - **`count === 0n` add is a no-op** (no admit, no increment, no eviction).
 *
 * **u64 count/error are carried as `bigint`** (a plain `number` loses precision
 * above `2^53` and is non-conforming).
 */

/** `u64::MAX = 2^64 - 1`, the saturating ceiling for count/error. */
const U64_MAX = 0xffffffffffffffffn;

/** Saturating `u64` add: `min(a + b, u64::MAX)`, never wrapping. */
function saturatingAddU64(a: bigint, b: bigint): bigint {
  const c = a + b;
  return c > U64_MAX ? U64_MAX : c;
}

/** A monitored `(item, count, error)` triple. */
export interface SSEntry {
  item: number;
  count: bigint;
  error: bigint;
}

/** A monitored entry's `(count, error)` pair (the item is the map key). */
interface Entry {
  count: bigint;
  error: bigint;
}

/**
 * A bounded Space-Saving heavy-hitters summary of capacity `m`.
 *
 * Construct with {@link SpaceSaving.withCapacity}.
 */
export class SpaceSaving {
  private readonly cap: number;
  /** item -> (count, error). Keyed by the signed i32 item. */
  private readonly monitored: Map<number, Entry>;

  private constructor(m: number) {
    this.cap = m;
    this.monitored = new Map<number, Entry>();
  }

  /**
   * Construct an empty summary monitoring at most `m` items.
   *
   * @throws if `m === 0` (a zero-capacity summary can monitor nothing; every
   * `add` would have to evict from an empty set) — mirrors CMS `w = 0`.
   */
  static withCapacity(m: number): SpaceSaving {
    if (!Number.isInteger(m) || m < 0) {
      throw new Error(
        "SpaceSaving.withCapacity requires a non-negative integer m",
      );
    }
    if (m === 0) {
      throw new Error("SpaceSaving capacity m must be non-zero");
    }
    return new SpaceSaving(m);
  }

  /**
   * Add `item` with weight `count`.
   *
   * - `count === 0n` is a no-op (no admit, increment, or eviction).
   * - If `item` is already monitored: its `count` grows (saturating); its
   *   `error` is unchanged.
   * - If there is room (`size < m`): admit with `error = 0`.
   * - If full: evict the `(count, signed item)`-min victim; the new item takes
   *   `count = evicted_count + count` (saturating) and `error = evicted_count`.
   *
   * @throws if `count` is negative or exceeds `u64::MAX`.
   */
  add(item: number, count: bigint): void {
    if (count < 0n || count > U64_MAX) {
      throw new Error(`SpaceSaving.add count out of u64 range: ${count}`);
    }
    if (count === 0n) {
      return; // zero-weight add changes nothing.
    }
    const existing = this.monitored.get(item);
    if (existing !== undefined) {
      existing.count = saturatingAddU64(existing.count, count);
      // error unchanged for an already-monitored item.
      return;
    }
    if (this.monitored.size < this.cap) {
      this.monitored.set(item, { count, error: 0n });
      return;
    }
    // Full + unmonitored item: evict the (count, signed item)-min victim.
    const victim = this.argminVictim();
    const evictedCount = this.monitored.get(victim)!.count;
    this.monitored.delete(victim);
    this.monitored.set(item, {
      count: saturatingAddU64(evictedCount, count),
      error: evictedCount,
    });
  }

  /** Convenience for `add(item, 1n)`. */
  addOne(item: number): void {
    this.add(item, 1n);
  }

  /**
   * The monitored item minimizing `(count, signed item)`: smallest count, then
   * smallest signed i32 item on a count tie. Items are distinct, so the victim
   * is unique. Caller guarantees the set is non-empty.
   */
  private argminVictim(): number {
    let bestItem = 0;
    let bestCount = 0n;
    let first = true;
    for (const [item, entry] of this.monitored) {
      if (
        first ||
        entry.count < bestCount ||
        (entry.count === bestCount && item < bestItem)
      ) {
        bestItem = item;
        bestCount = entry.count;
        first = false;
      }
    }
    return bestItem;
  }

  /** The monitored `count` for `item`, or `0n` if not monitored. */
  count(item: number): bigint {
    return this.monitored.get(item)?.count ?? 0n;
  }

  /** The monitored `error` for `item`, or `0n` if not monitored. */
  error(item: number): bigint {
    return this.monitored.get(item)?.error ?? 0n;
  }

  /** Whether `item` is currently monitored. */
  isMonitored(item: number): boolean {
    return this.monitored.has(item);
  }

  /** The number of currently monitored items (`<= m`). */
  size(): number {
    return this.monitored.size;
  }

  /** The capacity `m`. */
  capacity(): number {
    return this.cap;
  }

  /**
   * The entire monitored set as `(item, count, error)` triples in canonical
   * order: `count` DESCENDING, then signed `item` ASCENDING.
   */
  monitoredSet(): SSEntry[] {
    const out: SSEntry[] = [];
    for (const [item, entry] of this.monitored) {
      out.push({ item, count: entry.count, error: entry.error });
    }
    // count DESC, then signed item ASC.
    out.sort((a, b) => {
      if (a.count !== b.count) return a.count > b.count ? -1 : 1;
      return a.item - b.item;
    });
    return out;
  }

  /**
   * The `k` highest-`count` monitored items in canonical order (the first `k`
   * of {@link SpaceSaving.monitoredSet}). `k > size()` returns all monitored
   * items (no padding); `k = 0` returns the empty list.
   */
  topK(k: number): SSEntry[] {
    return this.monitoredSet().slice(0, Math.max(0, k));
  }
}
