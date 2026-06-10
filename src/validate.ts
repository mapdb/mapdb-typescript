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
import { totalCmpNumber } from "./internal/float-order.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Operation {
  op: string;
  // For f32 scenarios `key` and `value` may arrive as labels like "NaN",
  // "Infinity", "pos_zero". For i32 scenarios they are plain numbers. We
  // parse via parseF32Value at the use site rather than narrowing here.
  key?: number | string;
  value?: number | string;
  index?: number;
  delta?: number;
}

// f32 label parser. Accepts the same five sentinels every port supports:
// "NaN", "Infinity"/"+Infinity", "-Infinity", "pos_zero", "neg_zero". Any
// other string falls through to parseFloat. A plain number is returned
// untouched.
function parseF32Value(v: number | string | undefined): number {
  if (typeof v === "number") return v;
  if (v === undefined) throw new Error("missing f32 value");
  switch (v) {
    case "NaN":
      return NaN;
    case "Infinity":
    case "+Infinity":
      return Number.POSITIVE_INFINITY;
    case "-Infinity":
      return Number.NEGATIVE_INFINITY;
    case "pos_zero":
      return 0;
    case "neg_zero":
      return -0;
  }
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`invalid f32 literal: ${v}`);
  return n;
}

// Inverse: format an f32 the way Rust/Go/Zig do. NaN/Infinity/-Infinity
// stay symbolic; -0 keeps its sign; integer-valued floats get a ".0"
// suffix; everything else uses the JS default.
function formatF32(v: number): string {
  if (Number.isNaN(v)) return "NaN";
  if (v === Number.POSITIVE_INFINITY) return "Infinity";
  if (v === Number.NEGATIVE_INFINITY) return "-Infinity";
  if (v === 0 && Object.is(v, -0)) return "-0.0";
  if (v === Math.trunc(v) && Math.abs(v) < 1e16) return `${v}.0`;
  return String(v);
}

// IEEE total order on numbers — matches Rust's `f32::total_cmp` and the
// bit-pattern ordering in algorithms.md §"Float ordering for tree
// collections". This is now the SAME production comparator the tree
// collections, NumberArrayList.sort() and NumberPriorityQueue use (it was
// previously reimplemented locally to route around the production bug). It is
// retained here ONLY to give a deterministic harness-side ordering of the
// genuinely-unordered output of the open-addressing hash collections
// (keysToArray / valuesToArray / HashSet.toArray) for assertion comparison.
const totalCmpFloat = totalCmpNumber;

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
    // f32 collections re-use the Number* implementations: JS `number` is
    // f64 so f32 is a subset, and NumberNumberHashMap / NumberHashSet
    // already key by Object.is (bit-pattern eq -- NaN distinct, +0/-0
    // distinct), which matches the spec's float semantics in
    // algorithms.md §"Float ordering for tree collections".
    case "HashMap<f32, i32>":
      return new NumberNumberHashMap();
    case "HashSet<f32>":
      return new NumberHashSet();
    case "ArrayList<f32>":
      return new NumberArrayList();
    default:
      throw new Error(`Unknown collection type: ${type}`);
  }
}

function applyOperation(coll: Collection, op: Operation, f32Mode: boolean): void {
  const k = (): number => (f32Mode ? parseF32Value(op.key) : (op.key as number));
  const v = (): number => (f32Mode ? parseF32Value(op.value) : (op.value as number));
  switch (op.op) {
    case "put":
      if (
        coll instanceof NumberNumberHashMap ||
        coll instanceof NumberNumberTreeMap
      ) {
        coll.put(k(), v());
      }
      break;
    case "add":
      if (coll instanceof NumberArrayList) {
        coll.add(v());
      } else if (
        coll instanceof NumberHashSet ||
        coll instanceof NumberTreeSet
      ) {
        coll.add(v());
      } else if (coll instanceof NumberHashBag) {
        coll.add(v());
      } else if (coll instanceof NumberArrayStack) {
        coll.push(v());
      }
      break;
    case "add_at":
      if (coll instanceof NumberArrayList) {
        // NumberArrayList doesn't have addAtIndex, so we implement it manually:
        // shift elements right, then set.
        // First, add a dummy at the end to grow the list, then shift.
        const idx = op.index!;
        const val = v();
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
        coll.remove(k());
      } else if (
        coll instanceof NumberHashSet ||
        coll instanceof NumberTreeSet
      ) {
        coll.remove(v());
      } else if (coll instanceof NumberHashBag) {
        coll.remove(v());
      }
      break;
    case "addToValue":
      // Cross-language scenarios in 06-overflow/* require wrapping i32
      // semantics. JS number is f64; emulate i32 wrapping with bit ops.
      if (coll instanceof NumberNumberHashMap) {
        const cur = coll.get(k()) ?? 0;
        const wrapped = (cur + (op.delta as number)) | 0;
        coll.put(k(), wrapped);
      }
      break;
    case "clear":
      coll.clear();
      break;
    case "push":
      if (coll instanceof NumberArrayStack) {
        coll.push(v());
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
  if (v instanceof F32Value) return formatF32(v.v);
  if (Array.isArray(v)) {
    // Canonical no-space-after-comma format -- matches validate.rs,
    // cmd/validate/main.go, and validate.zig so harness diffs line up.
    return `[${v.map((x) => formatValue(x)).join(",")}]`;
  }
  return String(v);
}

// Try to satisfy an assertion using the f32 view of a collection. Returns
// undefined if the key isn't an f32-specific one — the caller falls back
// to the generic i32 evaluator. Output values are either primitives (size,
// booleans) or `F32Value` instances that formatValue knows how to print
// using the labelled form (NaN, Infinity, -0.0, 3.0, ...).
function evaluateF32Assertion(key: string, coll: Collection): unknown {
  if (key === "size" || key === "is_empty") return undefined; // i32 path
  const labelProbe = (rest: string): number => parseF32Value(rest);

  if (key.startsWith("get_")) {
    const probe = labelProbe(key.slice(4));
    if (
      coll instanceof NumberNumberHashMap ||
      coll instanceof NumberNumberTreeMap
    ) {
      const v = coll.get(probe);
      return v !== undefined ? v : null;
    }
  }
  if (key.startsWith("contains_")) {
    const probe = labelProbe(key.slice(9));
    if (
      coll instanceof NumberNumberHashMap ||
      coll instanceof NumberNumberTreeMap
    ) {
      return coll.containsKey(probe);
    }
    if (
      coll instanceof NumberHashSet ||
      coll instanceof NumberTreeSet ||
      coll instanceof NumberArrayList
    ) {
      return coll.contains(probe);
    }
  }
  // Output convention for f32 arrays mirrors validate.rs exactly: keys
  // and set members render as quoted labels ("NaN", "-0.0", ...); the
  // ArrayList `sorted` form renders unquoted.
  const renderSorted = (vals: number[], quoted: boolean): string => {
    vals.sort(totalCmpFloat);
    const parts = vals.map((v) => (quoted ? `"${formatF32(v)}"` : formatF32(v)));
    return "[" + parts.join(",") + "]";
  };
  if (key === "sorted_keys" && coll instanceof NumberNumberHashMap) {
    return renderSorted(coll.keysToArray(), true);
  }
  if ((key === "sorted_values" || key === "to_sorted_array") && coll instanceof NumberHashSet) {
    return renderSorted(coll.toArray(), true);
  }
  if (key === "sorted" && coll instanceof NumberArrayList) {
    // Drive PRODUCTION NumberArrayList.sort() (fixed to use totalCmpNumber);
    // the harness no longer re-sorts the array itself.
    coll.sort();
    const parts = coll.toArray().map((v) => formatF32(v));
    return "[" + parts.join(",") + "]";
  }
  if (key === "sum") {
    if (coll instanceof NumberArrayList) {
      let acc = 0;
      for (const v of coll.toArray()) acc += v;
      return new F32Value(Math.fround(acc));
    }
  }
  if (key === "min" || key === "max") {
    if (coll instanceof NumberArrayList) {
      const vals = coll.toArray();
      if (vals.length === 0) return null;
      let best = vals[0];
      const cmp = key === "min" ? -1 : 1;
      for (let i = 1; i < vals.length; i++) {
        if (totalCmpFloat(vals[i], best) === cmp) best = vals[i];
      }
      return new F32Value(best);
    }
  }
  return undefined;
}

// Sentinel used by formatValue to emit `formatF32`-style labels for f32
// scenarios without paying per-call format cost on the i32 hot path.
class F32Value {
  constructor(public readonly v: number) {}
}

function evaluateAssertion(
  key: string,
  coll: Collection,
  other: Collection | null,
  f32Mode: boolean,
): unknown {
  // f32 dispatch: scenarios in 05-float-edge-cases/* use string-labelled
  // probes (get_NaN, contains_pos_zero, ...) and quoted-string outputs
  // (sorted -> ["NaN", "Infinity"]). Handle that here before falling
  // through to the i32 logic.
  if (f32Mode) {
    const r = evaluateF32Assertion(key, coll);
    if (r !== undefined) return r;
  }

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
  // `sum` is wrapping i32 per the cross-language contract (validate.rs
  // uses wrapping_add); the bitwise `| 0` coerces each step. `coll.sum()`
  // would return the un-wrapped JS-number sum and break scenarios in
  // 06-overflow/.
  if (key === "sum") {
    if (coll instanceof NumberArrayList) {
      let acc = 0;
      for (const v of coll.toArray()) acc = (acc + v) | 0;
      return acc;
    }
    throw new Error(`sum not supported for ${coll.constructor.name}`);
  }
  // Wrapping i32 product (06-overflow/i32_multiply_overflow.json).
  if (key === "product" || key === "inject_into_wrapping_product") {
    if (coll instanceof NumberArrayList) {
      let acc = 1;
      for (const v of coll.toArray()) acc = Math.imul(acc, v);
      return acc;
    }
    throw new Error(`product not supported for ${coll.constructor.name}`);
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
    const m = key.match(/^get_(-?\d+)$/);
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
    const m = key.match(/^contains_(-?\d+)$/);
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
      // Drive PRODUCTION sort (totalCmpNumber) rather than re-sorting here.
      coll.sort();
      return coll.toArray();
    }
    if (coll instanceof NumberHashSet) {
      // Hash output is genuinely unordered -> harness-side total-order sort.
      return coll.toArray().sort(totalCmpFloat);
    }
    if (coll instanceof NumberTreeSet) {
      return coll.toArray(); // already in production tree order
    }
    if (coll instanceof NumberHashBag) {
      return coll.toArray().sort(totalCmpFloat);
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
// Assertion comparison
// ---------------------------------------------------------------------------

// Set whenever any assertion mismatches; the process exits non-zero at the
// end so the harness treats assertion failures as the primary pass/fail.
let anyFail = false;

// Render an expected JSON assertion value into the same canonical string the
// runner emits for its computed value. Float comparisons go through
// formatF32, which encodes bit-pattern identity (NaN -> "NaN",
// -0.0 -> "-0.0" distinct from "0.0").
function renderExpected(expected: unknown, key: string, f32Mode: boolean): string {
  if (expected === null || expected === undefined) return "null";
  if (typeof expected === "boolean") return expected ? "true" : "false";

  // f32 ArrayList scalars (sum/min/max) are floats; `size` stays an integer.
  const f32ScalarKey =
    f32Mode && (key === "sum" || key === "min" || key === "max");
  // f32 arrays render quoted ("NaN") for map keys / set members, unquoted
  // for the ArrayList `sorted` form — matching evaluateF32Assertion output.
  const f32ArrayQuoted =
    f32Mode &&
    (key === "sorted_keys" ||
      key === "sorted_values" ||
      key === "to_sorted_array");
  const f32ArrayUnquoted = f32Mode && key === "sorted";

  if (typeof expected === "string") {
    // A float label scalar (e.g. sum: "NaN", max: "NaN").
    return formatF32(parseF32Value(expected));
  }
  if (typeof expected === "number") {
    if (f32ScalarKey) return formatF32(Math.fround(expected));
    return String(expected);
  }
  if (Array.isArray(expected)) {
    if (f32ArrayQuoted) {
      return `[${expected.map((e) => `"${formatF32(parseF32Value(e as number | string))}"`).join(",")}]`;
    }
    if (f32ArrayUnquoted) {
      return `[${expected.map((e) => formatF32(parseF32Value(e as number | string))).join(",")}]`;
    }
    return `[${expected.map((e) => String(e)).join(",")}]`;
  }
  return String(expected);
}

// Print a computed assertion and compare against the expected JSON value.
function emit(
  name: string,
  key: string,
  computed: string,
  expected: unknown,
  f32Mode: boolean,
): void {
  console.log(`${key}: ${computed}`);
  const want = renderExpected(expected, key, f32Mode);
  if (computed !== want) {
    console.log(`FAIL ${name} ${key}: expected=${want} got=${computed}`);
    anyFail = true;
  }
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

  // f32 mode is purely about how labels and outputs are formatted; the
  // backing collection is identical (JS `number` is f64 and the
  // Number*HashMap/Set use Object.is for key equality, which already
  // matches algorithms.md §"Float ordering for tree collections").
  const f32Mode = scenario.collection.includes("<f32");

  // Create and populate main collection
  const coll = createCollection(scenario.collection);
  for (const op of scenario.operations) {
    applyOperation(coll, op, f32Mode);
  }

  // Create and populate "other" collection if present
  let other: Collection | null = null;
  if (scenario.other) {
    other = createCollection(scenario.other.collection);
    for (const op of scenario.other.operations) {
      applyOperation(other, op, f32Mode);
    }
  }

  // Output header
  console.log(`=== scenario: ${scenario.name} ===`);

  // Evaluate and print each assertion in order. The "comment" key is a
  // scenario-author doc string; Rust/Go/Zig all skip it, so do the same
  // here for harness-diff parity.
  for (const key of Object.keys(scenario.assertions)) {
    if (key === "comment") continue;
    let actual: unknown;
    try {
      actual = evaluateAssertion(key, coll, other, f32Mode);
    } catch (e) {
      // Unrecognised assertion key for this collection -> skip silently,
      // per the README unknown-assertion-skip rule. ONLY skip the specific
      // unknown-key / unsupported-for-collection errors; rethrow any other
      // error so genuine runtime bugs in assertion evaluation surface
      // instead of being silently swallowed (which would falsely pass).
      if (
        e instanceof Error &&
        /unknown assertion key|not supported for/i.test(e.message)
      ) {
        continue;
      }
      throw e;
    }
    emit(scenario.name, key, formatValue(actual), scenario.assertions[key], f32Mode);
  }

  if (anyFail) process.exit(1);
}

main();
