// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * nanprobe inserts IEEE 754 edge cases (NaN, -0.0, +0.0, +Inf, -Inf) into
 * float-keyed maps and float element sets, then reports observed behavior
 * in a canonical per-line format so outputs can be diffed across languages.
 *
 * Usage:
 *   npx tsx src/nanprobe.ts
 */

import { NumberNumberHashMap } from "./hashmap/number-number-hash-map.js";
import { NumberHashSet } from "./hashset/number-hash-set.js";

function main(): void {
  console.log("lang: typescript");
  probeMapNaN();
  probeMapNegZero();
  probeMapInfinity();
  probeSetNaN();
  probeSetNegZero();
  probeSetMixed();
}

function probeMapNaN(): void {
  const m = new NumberNumberHashMap();
  m.put(NaN, 1);
  console.log(`map_nan_size_after_put1: ${m.size()}`);

  m.put(NaN, 2);
  console.log(`map_nan_size_after_put2: ${m.size()}`);

  m.put(NaN, 3);
  console.log(`map_nan_size_after_put3: ${m.size()}`);

  const v = m.get(NaN);
  console.log(`map_nan_get_found: ${v !== undefined}`);
  console.log(`map_nan_get_value: ${v !== undefined ? v : 0}`);

  console.log(`map_nan_contains_key: ${m.containsKey(NaN)}`);

  const removed = m.remove(NaN);
  console.log(`map_nan_remove_found: ${removed !== undefined}`);
  console.log(`map_nan_size_after_remove: ${m.size()}`);
}

function probeMapNegZero(): void {
  const m = new NumberNumberHashMap();
  m.put(0.0, 100);
  m.put(-0.0, 200);

  console.log(`map_zero_size: ${m.size()}`);

  const v1 = m.get(0.0);
  const v2 = m.get(-0.0);
  console.log(`map_zero_get_pos: ${v1 !== undefined ? v1 : 0}`);
  console.log(`map_zero_get_neg: ${v2 !== undefined ? v2 : 0}`);

  // Which zero is stored? Check first iterated key's sign bit.
  let firstKey = 0.0;
  // NumberNumberHashMap does not expose an iterator; peek via keysView() if present,
  // else use forEachKeyValue which is standard.
  // Fallback: read the first occupied slot via a loop that short-circuits.
  (
    m as unknown as { forEachKey?: (f: (k: number) => void) => void }
  ).forEachKey?.((k: number) => {
    firstKey = k;
  });
  // Detect sign via Object.is (distinguishes -0 from +0)
  const isNegZero = Object.is(firstKey, -0);
  console.log(`map_zero_stored_negative: ${isNegZero}`);
}

function probeMapInfinity(): void {
  const m = new NumberNumberHashMap();
  m.put(Number.POSITIVE_INFINITY, 111);
  m.put(Number.NEGATIVE_INFINITY, 222);

  console.log(`map_inf_size: ${m.size()}`);

  const v1 = m.get(Number.POSITIVE_INFINITY);
  const v2 = m.get(Number.NEGATIVE_INFINITY);
  console.log(`map_pinf_get: ${v1 !== undefined ? v1 : 0}`);
  console.log(`map_ninf_get: ${v2 !== undefined ? v2 : 0}`);

  console.log(`map_pinf_contains: ${m.containsKey(Number.POSITIVE_INFINITY)}`);
  console.log(`map_ninf_contains: ${m.containsKey(Number.NEGATIVE_INFINITY)}`);
}

function probeSetNaN(): void {
  const s = new NumberHashSet();
  s.add(NaN);
  s.add(NaN);
  s.add(NaN);
  console.log(`set_nan_size: ${s.size()}`);
  console.log(`set_nan_contains: ${s.contains(NaN)}`);
}

function probeSetNegZero(): void {
  const s = new NumberHashSet();
  s.add(0.0);
  s.add(-0.0);
  console.log(`set_zero_size: ${s.size()}`);
  console.log(`set_pos_zero_contains: ${s.contains(0.0)}`);
  console.log(`set_neg_zero_contains: ${s.contains(-0.0)}`);
}

function probeSetMixed(): void {
  const s = new NumberHashSet();
  s.add(1.0);
  s.add(NaN);
  s.add(Number.POSITIVE_INFINITY);
  s.add(Number.NEGATIVE_INFINITY);
  s.add(0.0);
  console.log(`set_mixed_size: ${s.size()}`);
}

main();
