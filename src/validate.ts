// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Cross-language validation runner for the TypeScript collection port.
 *
 * Usage:
 *   npx tsx src/validate.ts <scenario.json>
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { NumberNumberHashMap } from "./hashmap/number-number-hash-map.js";
import { NumberArrayList } from "./arraylist/number-array-list.js";
import { NumberHashSet } from "./hashset/number-hash-set.js";
import { NumberHashBag } from "./bag/number-hash-bag.js";
import { NumberTreeSet } from "./treeset/number-tree-set.js";
import { NumberNumberTreeMap } from "./treemap/number-number-tree-map.js";
import { NumberArrayStack } from "./stack/number-array-stack.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Operation {
  op: string;
  key?: number;
  value?: number;
  index?: number;
}

interface Scenario {
  name: string;
  collection: string;
  operations: Operation[];
  other?: {
    collection: string;
    operations: Operation[];
  };
  assertions: Record<string, unknown>;
}

type Collection =
  | NumberNumberHashMap
  | NumberArrayList
  | NumberHashSet
  | NumberHashBag
  | NumberTreeSet
  | NumberNumberTreeMap
  | NumberArrayStack;

// ---------------------------------------------------------------------------
// Collection factory + operations
// ---------------------------------------------------------------------------

function createCollection(type: string): Collection {
  switch (type) {
    case "HashMap<i32, i32>":
      return new NumberNumberHashMap();
    case "ArrayList<i32>":
      return new NumberArrayList();
    case "HashSet<i32>":
      return new NumberHashSet();
    case "HashBag<i32>":
      return new NumberHashBag();
    case "TreeSet<i32>":
      return new NumberTreeSet();
    case "TreeMap<i32, i32>":
      return new NumberNumberTreeMap();
    case "ArrayStack<i32>":
      return new NumberArrayStack();
    default:
      throw new Error(`Unknown collection type: ${type}`);
  }
}

function applyOperation(coll: Collection, op: Operation): void {
  switch (op.op) {
    case "put":
      if (
        coll instanceof NumberNumberHashMap ||
        coll instanceof NumberNumberTreeMap
      ) {
        coll.put(op.key!, op.value!);
      }
      break;
    case "add":
      if (coll instanceof NumberArrayList) {
        coll.add(op.value!);
      } else if (
        coll instanceof NumberHashSet ||
        coll instanceof NumberTreeSet
      ) {
        coll.add(op.value!);
      } else if (coll instanceof NumberHashBag) {
        coll.add(op.value!);
      } else if (coll instanceof NumberArrayStack) {
        coll.push(op.value!);
      }
      break;
    case "add_at":
      if (coll instanceof NumberArrayList) {
        // NumberArrayList doesn't have addAtIndex, so we implement it manually:
        // shift elements right, then set.
        // First, add a dummy at the end to grow the list, then shift.
        const idx = op.index!;
        const val = op.value!;
        const currentSize = coll.size();
        // add a placeholder at the end
        coll.add(0);
        // shift elements from end-1 down to idx
        for (let i = currentSize; i > idx; i--) {
          coll.set(i, coll.get(i - 1));
        }
        coll.set(idx, val);
      }
      break;
    case "remove":
      if (
        coll instanceof NumberNumberHashMap ||
        coll instanceof NumberNumberTreeMap
      ) {
        coll.remove(op.key!);
      } else if (
        coll instanceof NumberHashSet ||
        coll instanceof NumberTreeSet
      ) {
        coll.remove(op.value!);
      } else if (coll instanceof NumberHashBag) {
        coll.remove(op.value!);
      }
      break;
    case "clear":
      coll.clear();
      break;
    case "push":
      if (coll instanceof NumberArrayStack) {
        coll.push(op.value!);
      }
      break;
    case "pop":
      if (coll instanceof NumberArrayStack) {
        coll.pop();
      }
      break;
    default:
      throw new Error(`Unknown operation: ${op.op}`);
  }
}

// ---------------------------------------------------------------------------
// Assertion evaluation
// ---------------------------------------------------------------------------

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    return `[${v.map((x) => formatValue(x)).join(", ")}]`;
  }
  return String(v);
}

function evaluateAssertion(
  key: string,
  coll: Collection,
  other: Collection | null,
): unknown {
  // --- simple properties ---
  if (key === "size") return coll.size();
  if (key === "is_empty") return coll.isEmpty();

  // --- other_size ---
  if (key === "other_size") return other!.size();

  // --- size_distinct (bags) ---
  if (key === "size_distinct") {
    if (coll instanceof NumberHashBag) return coll.sizeDistinct();
    throw new Error(`size_distinct not supported for ${coll.constructor.name}`);
  }

  // --- sum / min / max (list, treeset, treemap) ---
  if (key === "sum") {
    if (coll instanceof NumberArrayList) return coll.sum();
    throw new Error(`sum not supported for ${coll.constructor.name}`);
  }
  if (key === "min") {
    if (coll instanceof NumberArrayList) return coll.min() ?? null;
    if (coll instanceof NumberTreeSet) return coll.min() ?? null;
    if (coll instanceof NumberNumberTreeMap) {
      const m = coll.min();
      return m !== undefined ? m[0] : null;
    }
    throw new Error(`min not supported for ${coll.constructor.name}`);
  }
  if (key === "max") {
    if (coll instanceof NumberArrayList) return coll.max() ?? null;
    if (coll instanceof NumberTreeSet) return coll.max() ?? null;
    if (coll instanceof NumberNumberTreeMap) {
      const m = coll.max();
      return m !== undefined ? m[0] : null;
    }
    throw new Error(`max not supported for ${coll.constructor.name}`);
  }

  // --- get_N (maps) ---
  {
    const m = key.match(/^get_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (
        coll instanceof NumberNumberHashMap ||
        coll instanceof NumberNumberTreeMap
      ) {
        const v = coll.get(n);
        return v !== undefined ? v : null;
      }
      throw new Error(`get_N not supported for ${coll.constructor.name}`);
    }
  }

  // --- get_at_N (lists) ---
  {
    const m = key.match(/^get_at_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) {
        return coll.get(n);
      }
      throw new Error(`get_at_N not supported for ${coll.constructor.name}`);
    }
  }

  // --- contains_N ---
  {
    const m = key.match(/^contains_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (
        coll instanceof NumberNumberHashMap ||
        coll instanceof NumberNumberTreeMap
      ) {
        return coll.containsKey(n);
      }
      if (
        coll instanceof NumberHashSet ||
        coll instanceof NumberTreeSet ||
        coll instanceof NumberHashBag ||
        coll instanceof NumberArrayList ||
        coll instanceof NumberArrayStack
      ) {
        return coll.contains(n);
      }
      throw new Error(
        `contains_N not supported for ${(coll as Collection).constructor.name}`,
      );
    }
  }

  // --- occurrences_N ---
  {
    const m = key.match(/^occurrences_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberHashBag) return coll.occurrencesOf(n);
      throw new Error(
        `occurrences_N not supported for ${coll.constructor.name}`,
      );
    }
  }

  // --- sorted_keys ---
  if (key === "sorted_keys") {
    if (coll instanceof NumberNumberHashMap) {
      return coll.keysToArray().sort((a, b) => a - b);
    }
    if (coll instanceof NumberNumberTreeMap) {
      return [...coll.keys()];
    }
    throw new Error(`sorted_keys not supported for ${coll.constructor.name}`);
  }

  // --- sorted_values ---
  if (key === "sorted_values") {
    if (coll instanceof NumberNumberHashMap) {
      return coll.valuesToArray().sort((a, b) => a - b);
    }
    if (coll instanceof NumberNumberTreeMap) {
      return [...coll.values()];
    }
    throw new Error(`sorted_values not supported for ${coll.constructor.name}`);
  }

  // --- to_sorted_array ---
  if (key === "to_sorted_array") {
    if (coll instanceof NumberArrayList) {
      return coll.toArray().sort((a, b) => a - b);
    }
    if (coll instanceof NumberHashSet) {
      return coll.toArray().sort((a, b) => a - b);
    }
    if (coll instanceof NumberTreeSet) {
      return coll.toArray(); // already sorted
    }
    if (coll instanceof NumberHashBag) {
      return coll.toArray().sort((a, b) => a - b);
    }
    throw new Error(
      `to_sorted_array not supported for ${coll.constructor.name}`,
    );
  }

  // --- select_gt_N ---
  {
    const m = key.match(/^select_gt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) {
        return coll
          .select((v) => v > n)
          .toArray()
          .sort((a, b) => a - b);
      }
      if (coll instanceof NumberHashSet) {
        return coll
          .select((v) => v > n)
          .toArray()
          .sort((a, b) => a - b);
      }
      throw new Error(`select_gt_N not supported for ${coll.constructor.name}`);
    }
  }

  // --- reject_gt_N ---
  {
    const m = key.match(/^reject_gt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) {
        return coll
          .reject((v) => v > n)
          .toArray()
          .sort((a, b) => a - b);
      }
      throw new Error(`reject_gt_N not supported for ${coll.constructor.name}`);
    }
  }

  // --- detect_gt_N ---
  {
    const m = key.match(/^detect_gt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) {
        const result = coll.detect((v) => v > n);
        return result !== undefined ? result : null;
      }
      throw new Error(`detect_gt_N not supported for ${coll.constructor.name}`);
    }
  }

  // --- count_gt_N ---
  {
    const m = key.match(/^count_gt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) return coll.count((v) => v > n);
      throw new Error(`count_gt_N not supported for ${coll.constructor.name}`);
    }
  }

  // --- count_lt_N ---
  {
    const m = key.match(/^count_lt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) return coll.count((v) => v < n);
      throw new Error(`count_lt_N not supported for ${coll.constructor.name}`);
    }
  }

  // --- count_even ---
  if (key === "count_even") {
    if (coll instanceof NumberArrayList) return coll.count((v) => v % 2 === 0);
    throw new Error(`count_even not supported for ${coll.constructor.name}`);
  }

  // --- count_odd ---
  if (key === "count_odd") {
    if (coll instanceof NumberArrayList) return coll.count((v) => v % 2 !== 0);
    throw new Error(`count_odd not supported for ${coll.constructor.name}`);
  }

  // --- any_satisfy_gt_N ---
  {
    const m = key.match(/^any_satisfy_gt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) return coll.anySatisfy((v) => v > n);
      throw new Error(
        `any_satisfy_gt_N not supported for ${coll.constructor.name}`,
      );
    }
  }

  // --- all_satisfy_gt_N ---
  {
    const m = key.match(/^all_satisfy_gt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList) return coll.allSatisfy((v) => v > n);
      throw new Error(
        `all_satisfy_gt_N not supported for ${coll.constructor.name}`,
      );
    }
  }

  // --- none_satisfy_gt_N ---
  {
    const m = key.match(/^none_satisfy_gt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList)
        return !coll.anySatisfy((v) => v > n);
      throw new Error(
        `none_satisfy_gt_N not supported for ${coll.constructor.name}`,
      );
    }
  }

  // --- none_satisfy_lt_N ---
  {
    const m = key.match(/^none_satisfy_lt_(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (coll instanceof NumberArrayList)
        return !coll.anySatisfy((v) => v < n);
      throw new Error(
        `none_satisfy_lt_N not supported for ${coll.constructor.name}`,
      );
    }
  }

  // --- any_satisfy_even ---
  if (key === "any_satisfy_even") {
    if (coll instanceof NumberArrayList)
      return coll.anySatisfy((v) => v % 2 === 0);
    throw new Error(
      `any_satisfy_even not supported for ${coll.constructor.name}`,
    );
  }

  // --- all_satisfy_even ---
  if (key === "all_satisfy_even") {
    if (coll instanceof NumberArrayList)
      return coll.allSatisfy((v) => v % 2 === 0);
    throw new Error(
      `all_satisfy_even not supported for ${coll.constructor.name}`,
    );
  }

  // --- none_satisfy_odd ---
  if (key === "none_satisfy_odd") {
    if (coll instanceof NumberArrayList)
      return !coll.anySatisfy((v) => v % 2 !== 0);
    throw new Error(
      `none_satisfy_odd not supported for ${coll.constructor.name}`,
    );
  }

  // --- any_satisfy_gt_N  (already handled above) ---
  // --- none_satisfy_gt_N (already handled above) ---

  // --- inject_into_sum ---
  if (key === "inject_into_sum") {
    if (coll instanceof NumberArrayList) {
      let acc = 0;
      const arr = coll.toArray();
      for (const v of arr) acc += v;
      return acc;
    }
    throw new Error(
      `inject_into_sum not supported for ${coll.constructor.name}`,
    );
  }

  // --- inject_into_product ---
  if (key === "inject_into_product") {
    if (coll instanceof NumberArrayList) {
      let acc = 1;
      const arr = coll.toArray();
      for (const v of arr) acc *= v;
      return acc;
    }
    throw new Error(
      `inject_into_product not supported for ${coll.constructor.name}`,
    );
  }

  // --- Set operations: union_sorted, union_size ---
  if (key === "union_sorted") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      return coll
        .union(other)
        .toArray()
        .sort((a, b) => a - b);
    }
    throw new Error(`union_sorted not supported for ${coll.constructor.name}`);
  }
  if (key === "union_size") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      return coll.union(other).size();
    }
    throw new Error(`union_size not supported for ${coll.constructor.name}`);
  }

  // --- intersect_sorted, intersect_size ---
  if (key === "intersect_sorted") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      return coll
        .intersect(other)
        .toArray()
        .sort((a, b) => a - b);
    }
    throw new Error(
      `intersect_sorted not supported for ${coll.constructor.name}`,
    );
  }
  if (key === "intersect_size") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      return coll.intersect(other).size();
    }
    throw new Error(
      `intersect_size not supported for ${coll.constructor.name}`,
    );
  }

  // --- difference_sorted, difference_size ---
  if (key === "difference_sorted") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      return coll
        .difference(other)
        .toArray()
        .sort((a, b) => a - b);
    }
    throw new Error(
      `difference_sorted not supported for ${coll.constructor.name}`,
    );
  }
  if (key === "difference_size") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      return coll.difference(other).size();
    }
    throw new Error(
      `difference_size not supported for ${coll.constructor.name}`,
    );
  }

  // --- symmetric_difference_sorted, symmetric_difference_size ---
  if (key === "symmetric_difference_sorted") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      // symmetric difference = (A - B) union (B - A)
      const aMinusB = coll.difference(other);
      const bMinusA = other.difference(coll);
      return aMinusB
        .union(bMinusA)
        .toArray()
        .sort((a, b) => a - b);
    }
    throw new Error(
      `symmetric_difference_sorted not supported for ${coll.constructor.name}`,
    );
  }
  if (key === "symmetric_difference_size") {
    if (coll instanceof NumberHashSet && other instanceof NumberHashSet) {
      const aMinusB = coll.difference(other);
      const bMinusA = other.difference(coll);
      return aMinusB.union(bMinusA).size();
    }
    throw new Error(
      `symmetric_difference_size not supported for ${coll.constructor.name}`,
    );
  }

  throw new Error(`Unknown assertion key: ${key}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npx tsx src/validate.ts <scenario.json>");
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  const raw = fs.readFileSync(filePath, "utf-8");
  const scenario: Scenario = JSON.parse(raw);

  // Create and populate main collection
  const coll = createCollection(scenario.collection);
  for (const op of scenario.operations) {
    applyOperation(coll, op);
  }

  // Create and populate "other" collection if present
  let other: Collection | null = null;
  if (scenario.other) {
    other = createCollection(scenario.other.collection);
    for (const op of scenario.other.operations) {
      applyOperation(other, op);
    }
  }

  // Output header
  console.log(`=== scenario: ${scenario.name} ===`);

  // Evaluate and print each assertion in order
  for (const key of Object.keys(scenario.assertions)) {
    const actual = evaluateAssertion(key, coll, other);
    console.log(`${key}: ${formatValue(actual)}`);
  }
}

main();
