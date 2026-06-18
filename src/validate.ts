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
import { Int32Int32HashMap } from "./typed/hashmap/int32-int32-hash-map.js";
import { BigIntNumberHashMap } from "./hashmap/bigint-number-hash-map.js";
import { BigIntNumberListMultimap } from "./multimap/bigint-number-list-multimap.js";
import { BigIntNumberSetMultimap } from "./multimap/bigint-number-set-multimap.js";
import { NumberArrayList } from "./arraylist/number-array-list.js";
import { Float32ArrayList } from "./typed/arraylist/float32-array-list.js";
import { NumberHashSet } from "./hashset/number-hash-set.js";
import { NumberHashBag } from "./bag/number-hash-bag.js";
import { NumberTreeSet } from "./treeset/number-tree-set.js";
import { NumberNumberTreeMap } from "./treemap/number-number-tree-map.js";
import { NumberArrayStack } from "./stack/number-array-stack.js";
import { totalCmpNumber } from "./internal/float-order.js";
import { Range, BoundType } from "./range/range.js";
import {
  ImmutableSortedMap,
  ImmutableSortedSet,
} from "./immutable_sorted/immutable-sorted-map.js";
import {
  type U64,
  hash32,
  hash64,
  hash32I32,
  hash64I32,
  hash32Bytes,
  hash64Bytes,
  positions as hashPositions,
} from "./hash/hash.js";
import { Bloom } from "./bloom/bloom.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Operation {
  op: string;
  // For f32 scenarios `key` and `value` may arrive as labels like "NaN",
  // "Infinity", "pos_zero", or a {"bits":"0x.."} object (Q4 encoding). For
  // i32 scenarios they are plain numbers. We parse via parseF32Value at the
  // use site rather than narrowing here.
  key?: number | string | { bits?: string };
  value?: number | string | { bits?: string };
  index?: number;
  delta?: number;
  // Bloom `with_params` op + hash-pipeline `positions` op operands: the bit
  // count `m` and hash count `k` (spec/features/bloom.md, hash-pipeline.md).
  m?: number;
  k?: number;
  // Range<i32> constructor operands (spec/features/bound-range.md).
  lower?: number;
  upper?: number;
  // NavigableMap/Set `remove_range` op carries an inline range-builder object
  // (same shape as the top-level `query` / the 10-range builder ops).
  range?: RangeOp;
  // ImmutableSortedMap/Set `from_sorted` construction op carries parallel
  // ascending arrays (`keys`/`values` for a map, `elements` for a set).
  keys?: number[];
  values?: number[];
  elements?: number[];
}

// A range-builder object: one of the 10-range constructor ops. Used by the
// scenario-level `query` field and the `remove_range` op's `range` field.
interface RangeOp {
  op: string;
  lower?: number;
  upper?: number;
  value?: number;
}

// Scratch views to reinterpret an f32 bit pattern <-> JS number. A JS
// number is f64, but it round-trips the 32 bits of any f32 (including NaN
// payloads and the sign bit) faithfully when narrowed through Float32Array.
const _f32scratch = new Float32Array(1);
const _u32scratch = new Uint32Array(_f32scratch.buffer);
function f32FromBits(bits: number): number {
  _u32scratch[0] = bits >>> 0;
  return _f32scratch[0];
}
function f32ToBits(v: number): number {
  _f32scratch[0] = v;
  return _u32scratch[0] >>> 0;
}

// Parse a 0x-prefixed, 8-hex-digit (case-insensitive) string into a raw
// 32-bit IEEE-754 pattern (NaN-payload / signed-bit escape).
function parseF32Bits(hx: string): number {
  // Case-insensitive `0x` prefix to match Rust/Go/Zig (which accept 0X too)
  // per the README's case-insensitive bits contract.
  if (!/^0x[0-9a-fA-F]{8}$/i.test(hx)) {
    throw new Error(`f32 bits literal must be 0x + 8 hex digits: ${hx}`);
  }
  return parseInt(hx.slice(2), 16) >>> 0;
}

// Q4 float operand encoding (see cross-language-validation/README.md
// §"Float operand encoding"): JSON number, human-label string
// ("NaN"/"+NaN"/"-NaN", "Infinity"/"+Infinity"/"-Infinity",
// "0.0"/"+0.0"/"-0.0", or a decimal), or a {"bits":"0x........"} object
// reinterpreting 32 IEEE-754 bits. Canonical NaN bits: +NaN=0x7FC00000,
// -NaN=0xFFC00000.
//
// NOTE on a TS-port limitation: the production hash collections key f32 by
// `Object.is` and canonicalize all NaN to one seed, so distinct NaN
// payloads / NaN sign are NOT distinguishable inside a HashSet/HashMap here
// (a single value DOES round-trip its bits, so ArrayList sort/serialization
// is faithful). Scenarios needing NaN-distinct hash *keys* are deferred —
// see the Phase 5a handoff.
function parseF32Value(
  v: number | string | { bits?: string } | undefined,
): number {
  // Every f32 operand is narrowed to true f32 precision via Math.fround so a
  // list/set/map of floats holds f32-rounded values matching Rust/Go/Zig
  // (which narrow to f32). The bits/label paths below already produce exact
  // f32 (round-tripped through Float32Array), so fround there is a no-op;
  // fround matters for the JSON-number and decimal-string paths, which would
  // otherwise leak f64 precision.
  if (typeof v === "number") return Math.fround(v);
  if (v === undefined) throw new Error("missing f32 value");
  if (typeof v === "object") {
    if (typeof v.bits === "string") return f32FromBits(parseF32Bits(v.bits));
    throw new Error(`expected {"bits":"0x.."} float object`);
  }
  switch (v) {
    case "NaN":
    case "+NaN":
      return f32FromBits(0x7fc00000);
    case "-NaN":
      return f32FromBits(0xffc00000);
    case "Infinity":
    case "+Infinity":
      return Number.POSITIVE_INFINITY;
    case "-Infinity":
      return Number.NEGATIVE_INFINITY;
    case "0.0":
    case "+0.0":
      return 0;
    case "-0.0":
      return -0;
    case "pos_zero":
      return 0;
    case "neg_zero":
      return -0;
  }
  if (/^0x/i.test(v)) return f32FromBits(parseF32Bits(v));
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`invalid f32 literal: ${v}`);
  return Math.fround(n);
}

// Canonical, bit-faithful serialization, matching Rust/Go/Zig. NaN (any
// sign/payload) and ±0.0 render as their 0x-hex f32 bit pattern so distinct
// payloads and signed zeros stay distinguishable and every port emits the
// identical string; finite/inf values keep their human-readable label.
function formatF32(v: number): string {
  if (Number.isNaN(v) || v === 0) {
    return "0x" + f32ToBits(v).toString(16).padStart(8, "0");
  }
  if (v === Number.POSITIVE_INFINITY) return "Infinity";
  if (v === Number.NEGATIVE_INFINITY) return "-Infinity";
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
  // Optional single range (10-range builder-op shape) naming the range that
  // the scenario's range_* assertions refer to (spec/features/navigable-map.md).
  query?: RangeOp;
  assertions: Record<string, unknown>;
}

type Collection =
  | NumberNumberHashMap
  | Int32Int32HashMap
  | NumberArrayList
  | NumberHashSet
  | NumberHashBag
  | NumberTreeSet
  | NumberNumberTreeMap
  | NumberArrayStack;

// ---------------------------------------------------------------------------
// Collection factory + operations
// ---------------------------------------------------------------------------

// The number-keyed collection kinds this runner understands via
// createCollection (Range<i32> and the bigint-keyed kinds are dispatched
// separately in main). Used by the forward-compat skip so an unknown kind is
// skipped rather than crashing createCollection's `default` throw.
const KNOWN_COLLECTIONS = new Set<string>([
  "HashMap<i32, i32>",
  "ArrayList<i32>",
  "HashSet<i32>",
  "HashBag<i32>",
  "TreeSet<i32>",
  "TreeMap<i32, i32>",
  "ArrayStack<i32>",
  "HashMap<f32, i32>",
  "HashSet<f32>",
  "TreeSet<f32>",
  "ArrayList<f32>",
]);

function isKnownCollection(type: string): boolean {
  return KNOWN_COLLECTIONS.has(type);
}

function createCollection(type: string): Collection {
  switch (type) {
    case "HashMap<i32, i32>":
      // Width-aware production map: keys + values are Int32Array-backed, so
      // put/addToValue truncate to i32 (wrapping add is a PRODUCTION property,
      // not a runner-side `| 0`). The f32 HashMap path below stays on the
      // f64-keyed NumberNumberHashMap because f32 needs Object.is ±0 keying.
      return new Int32Int32HashMap();
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
    // f64 so f32 is a subset, and NumberNumberHashMap / NumberHashSet key by
    // Object.is. That distinguishes +0/-0 (Object.is(+0,-0)===false) but
    // CANONICALIZES NaN: Object.is(NaN,-NaN)===true and the production hash
    // collections fold all NaN to one seed, so a TS f32 hash collection holds
    // at most ONE NaN key (distinct payloads/signs collapse). See the TS
    // carve-out in spec/algorithms.md §"NaN must hash and compare by bit
    // pattern" and the README "Port limitation (TypeScript)". Ordering
    // (tree/total-order) still distinguishes signed NaN where representable.
    case "HashMap<f32, i32>":
      return new NumberNumberHashMap();
    case "HashSet<f32>":
      return new NumberHashSet();
    // TreeSet<f32> keys on JS `number` and orders via the production
    // totalCmpNumber (IEEE total order). Unlike the Object.is-keyed hash
    // collections, the tree CAN distinguish +0/-0 (they compare distinctly)
    // and, where V8 preserves the f64 NaN sign bit through a `number`, signed
    // NaN too. Representability of -NaN/payload ordering is verified
    // empirically per scenario; see the README/algorithms.md carve-out.
    case "TreeSet<f32>":
      return new NumberTreeSet();
    case "ArrayList<f32>":
      return new NumberArrayList();
    default:
      throw new Error(`Unknown collection type: ${type}`);
  }
}

// NavigableMap/Set result-log: the runner records each poll/remove_range
// return value in execution order while applying operations, then exposes
// them through the poll_*/remove_range_counts assertion keys (see README
// §NavigableMap). null marks an absent poll on an empty collection.
interface NavLog {
  pollFirstKeys: (number | null)[];
  pollLastKeys: (number | null)[];
  pollFirstValues: (number | null)[];
  pollLastValues: (number | null)[];
  removeRangeCounts: number[];
}

function newNavLog(): NavLog {
  return {
    pollFirstKeys: [],
    pollLastKeys: [],
    pollFirstValues: [],
    pollLastValues: [],
    removeRangeCounts: [],
  };
}

function applyOperation(
  coll: Collection,
  op: Operation,
  f32Mode: boolean,
  log: NavLog,
): void {
  const k = (): number =>
    f32Mode ? parseF32Value(op.key) : (op.key as number);
  const v = (): number =>
    f32Mode ? parseF32Value(op.value) : (op.value as number);
  switch (op.op) {
    case "put":
      if (
        coll instanceof NumberNumberHashMap ||
        coll instanceof Int32Int32HashMap ||
        coll instanceof NumberNumberTreeMap
      ) {
        coll.set(k(), v());
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
        const currentSize = coll.size;
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
        coll instanceof Int32Int32HashMap ||
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
      // Route straight through the production Int32Int32HashMap.addToValue:
      // the i32 MAX+1 -> i32 MIN wrap in 06-overflow/* is enforced by the
      // backing Int32Array store, NOT by any runner-side `| 0`. The library
      // owns the width contract now (see algorithms.md "Integer overflow
      // contract" + the typed-map native test).
      if (coll instanceof Int32Int32HashMap) {
        coll.addToValue(k(), op.delta as number);
      } else {
        // Fail loudly rather than silently no-op: a future addToValue scenario
        // on another collection (e.g. HashMap<f32,i32>) must route through that
        // type's production addToValue, not fall through unhandled.
        throw new Error(
          `addToValue not supported for ${coll.constructor.name}`,
        );
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
    case "poll_first":
      // Map: record key + value; set: record element as the key (no value).
      if (coll instanceof NumberNumberTreeMap) {
        const e = coll.pollFirstEntry();
        log.pollFirstKeys.push(e ? e[0] : null);
        log.pollFirstValues.push(e ? e[1] : null);
      } else if (coll instanceof NumberTreeSet) {
        const e = coll.pollFirst();
        log.pollFirstKeys.push(e ?? null);
      }
      break;
    case "poll_last":
      if (coll instanceof NumberNumberTreeMap) {
        const e = coll.pollLastEntry();
        log.pollLastKeys.push(e ? e[0] : null);
        log.pollLastValues.push(e ? e[1] : null);
      } else if (coll instanceof NumberTreeSet) {
        const e = coll.pollLast();
        log.pollLastKeys.push(e ?? null);
      }
      break;
    case "remove_range":
      if (op.range === undefined) {
        throw new Error("remove_range op requires a range");
      }
      {
        const range = buildRangeObj(op.range);
        if (
          coll instanceof NumberNumberTreeMap ||
          coll instanceof NumberTreeSet
        ) {
          log.removeRangeCounts.push(coll.removeRange(range));
        }
      }
      break;
    default:
      // Forward-compat (per spec/features/navigable-map.md + README): on the
      // ordered tree collections an unknown op is SKIPPED so a newer scenario
      // never breaks an older runner. Other collections still fail loudly so a
      // genuine typo surfaces.
      if (
        coll instanceof NumberNumberTreeMap ||
        coll instanceof NumberTreeSet
      ) {
        break;
      }
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
      return coll.has(probe);
    }
    if (
      coll instanceof NumberHashSet ||
      coll instanceof NumberTreeSet ||
      coll instanceof NumberArrayList
    ) {
      return coll.has(probe);
    }
  }
  // Output convention for f32 arrays mirrors validate.rs exactly: keys
  // and set members render as quoted labels ("NaN", "-0.0", ...); the
  // ArrayList `sorted` form renders unquoted.
  const renderSorted = (vals: number[], quoted: boolean): string => {
    vals.sort(totalCmpFloat);
    const parts = vals.map((v) =>
      quoted ? `"${formatF32(v)}"` : formatF32(v),
    );
    return "[" + parts.join(",") + "]";
  };
  if (key === "sorted_keys" && coll instanceof NumberNumberHashMap) {
    return renderSorted(coll.keysToArray(), true);
  }
  if (
    (key === "sorted_values" || key === "to_sorted_array") &&
    coll instanceof NumberHashSet
  ) {
    return renderSorted(coll.toArray(), true);
  }
  // TreeSet<f32>: the sorted output is the production tree's in-order
  // traversal (toArray) — NEVER re-sorted in the runner — so it exercises the
  // production totalCmpNumber comparator directly. Quoted-label form like the
  // hash set / map keys.
  if (
    (key === "sorted" ||
      key === "sorted_values" ||
      key === "to_sorted_array") &&
    coll instanceof NumberTreeSet
  ) {
    const parts = coll.toArray().map((v) => `"${formatF32(v)}"`);
    return "[" + parts.join(",") + "]";
  }
  if ((key === "min" || key === "max") && coll instanceof NumberTreeSet) {
    const v = key === "min" ? coll.min() : coll.max();
    return v === undefined ? null : new F32Value(v);
  }
  if (key === "sorted" && coll instanceof NumberArrayList) {
    // Drive PRODUCTION NumberArrayList.sort() (fixed to use totalCmpNumber) on
    // a COPY so the live list is not mutated — a later order-sensitive
    // assertion (e.g. get_at_N) must still see the original insertion order.
    const sorted = NumberArrayList.of(coll.toArray());
    sorted.sort();
    const parts = sorted.toArray().map((v) => formatF32(v));
    return "[" + parts.join(",") + "]";
  }
  if (key === "sum") {
    if (coll instanceof NumberArrayList) {
      // Route the f32 sum through the PRODUCTION Float32ArrayList.sum(), which
      // does the per-add f32 left-fold (Math.fround per addition) — matching
      // Rust/Go/Zig (which accumulate in f32, not f64-once). The fold is now a
      // library property, not a runner-local loop. Differs from the i32 list
      // sum, which widens into a 64-bit accumulator (NumberArrayList.sum()).
      const f32 = new Float32ArrayList();
      for (const v of coll.toArray()) f32.add(v);
      return new F32Value(f32.sum());
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
  log: NavLog,
  query: Range<number> | null,
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
  if (key === "size") return coll.size;
  if (key === "is_empty") return coll.isEmpty();

  // --- other_size ---
  if (key === "other_size") return other!.size;

  // --- size_distinct (bags) ---
  if (key === "size_distinct") {
    if (coll instanceof NumberHashBag) return coll.sizeDistinct();
    throw new Error(`size_distinct not supported for ${coll.constructor.name}`);
  }

  // --- sum / min / max (list, treeset, treemap) ---
  // List sum() widens into a 64-bit accumulator (IntList.sum(): long parity)
  // and does NOT wrap at i32 — see algorithms.md "Integer overflow contract"
  // and 06-overflow/i32_sum_overflow.json. JS doubles exactly represent the
  // widened result, so route through the production NumberArrayList.sum().
  if (key === "sum") {
    if (coll instanceof NumberArrayList) {
      return coll.sum();
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

  // --- NavigableMap / NavigableSet (ordered navigation) ---
  // Point-nav and *_keys/*_elements assertions reflect the POST-operation
  // state (the harness applies all ops, then evaluates). Result-log keys
  // (poll_*, remove_range_counts) replay values recorded during execution.
  {
    const navMap = coll instanceof NumberNumberTreeMap ? coll : null;
    const navSet = coll instanceof NumberTreeSet ? coll : null;
    if (navMap !== null || navSet !== null) {
      // floor_<k>/ceiling_<k>/lower_<k>/higher_<k>: <k> is a signed base-10
      // i32 suffix (leading `-` and the full i32 range allowed).
      const nav = key.match(/^(floor|ceiling|lower|higher)_(-?\d+)$/);
      if (nav) {
        const kind = nav[1];
        const n = parseInt(nav[2], 10);
        let r: number | undefined;
        if (navMap !== null) {
          r =
            kind === "floor"
              ? navMap.floorKey(n)
              : kind === "ceiling"
                ? navMap.ceilingKey(n)
                : kind === "lower"
                  ? navMap.lowerKey(n)
                  : navMap.higherKey(n);
        } else {
          r =
            kind === "floor"
              ? navSet!.floor(n)
              : kind === "ceiling"
                ? navSet!.ceiling(n)
                : kind === "lower"
                  ? navSet!.lower(n)
                  : navSet!.higher(n);
        }
        return r === undefined ? null : r;
      }

      // first/last (map: first_key/last_key; set: first/last).
      if (key === "first_key" && navMap !== null)
        return navMap.firstKey() ?? null;
      if (key === "last_key" && navMap !== null)
        return navMap.lastKey() ?? null;
      if (key === "first" && navSet !== null) return navSet.first() ?? null;
      if (key === "last" && navSet !== null) return navSet.last() ?? null;

      // descending iteration over ALL keys/elements (emitted DESCENDING).
      if (key === "descending_keys" && navMap !== null)
        return navMap.descendingKeys();
      if (key === "descending_elements" && navSet !== null)
        return navSet.descending();

      // range_* assertions reference the scenario-level `query` range. With no
      // query the key is unknown for this scenario -> skip (forward-compat).
      if (
        key === "range_keys" ||
        key === "range_elements" ||
        key === "range_keys_desc" ||
        key === "range_elements_desc" ||
        key === "range_size"
      ) {
        if (query === null) {
          throw new Error(`Unknown assertion key: ${key}`);
        }
        if (key === "range_keys" && navMap !== null)
          return navMap.rangeKeysIn(query);
        if (key === "range_elements" && navSet !== null)
          return navSet.rangeElements(query);
        if (key === "range_keys_desc" && navMap !== null)
          return navMap.descendingRangeKeys(query);
        if (key === "range_elements_desc" && navSet !== null)
          return navSet.descendingRangeElements(query);
        if (key === "range_size") {
          return navMap !== null
            ? navMap.rangeKeysIn(query).length
            : navSet!.rangeElements(query).length;
        }
      }

      // Order statistics (rank / select). Matched by EXACT patterns so the
      // functional select_<pred> keys (select_gt_N, select_even) are NOT
      // misclassified: rank_<k> is `^rank_(-?\d+)$` (signed i32, leading `+`
      // rejected), select_<i> is `^select_(\d+)$` (non-negative index).
      const rankMatch = key.match(/^rank_(-?\d+)$/);
      if (rankMatch) {
        const k = parseInt(rankMatch[1], 10);
        return navMap !== null ? navMap.rank(k) : navSet!.rank(k);
      }
      const selectMatch = key.match(/^select_(\d+)$/);
      if (selectMatch) {
        const i = parseInt(selectMatch[1], 10);
        const r = navMap !== null ? navMap.selectKey(i) : navSet!.select(i);
        return r === undefined ? null : r;
      }

      // Result-log keys (replayed from execution order).
      if (key === "poll_first_keys") return log.pollFirstKeys;
      if (key === "poll_last_keys") return log.pollLastKeys;
      if (key === "poll_first_values" && navMap !== null)
        return log.pollFirstValues;
      if (key === "poll_last_values" && navMap !== null)
        return log.pollLastValues;
      if (key === "remove_range_counts") return log.removeRangeCounts;
    }
  }

  // --- get_N (maps) ---
  {
    const m = key.match(/^get_(-?\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (
        coll instanceof NumberNumberHashMap ||
        coll instanceof Int32Int32HashMap ||
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
        coll instanceof Int32Int32HashMap ||
        coll instanceof NumberNumberTreeMap
      ) {
        return coll.has(n);
      }
      if (
        coll instanceof NumberHashSet ||
        coll instanceof NumberTreeSet ||
        coll instanceof NumberHashBag ||
        coll instanceof NumberArrayList ||
        coll instanceof NumberArrayStack
      ) {
        return coll.has(n);
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
    if (coll instanceof Int32Int32HashMap) {
      return [...coll.keysIter()].sort((a, b) => a - b);
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
    if (coll instanceof Int32Int32HashMap) {
      return [...coll.valuesIter()].sort((a, b) => a - b);
    }
    if (coll instanceof NumberNumberTreeMap) {
      return [...coll.values()];
    }
    throw new Error(`sorted_values not supported for ${coll.constructor.name}`);
  }

  // --- to_sorted_array ---
  if (key === "to_sorted_array") {
    if (coll instanceof NumberArrayList) {
      // Drive PRODUCTION sort (totalCmpNumber) on a COPY rather than re-sorting
      // here, and without mutating the live list (order-sensitive assertions
      // must still observe insertion order).
      const sorted = NumberArrayList.of(coll.toArray());
      sorted.sort();
      return sorted.toArray();
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
  // injectInto with a + reduction accumulates in the i32 seed type and wraps
  // two's-complement at i32 (algorithms.md "Integer overflow contract"). The
  // TS production list has no injectInto, so the wrap is applied here (per the
  // spec note that the TS runner applies wrapping in the runner): `| 0`
  // coerces each step back to i32.
  if (key === "inject_into_sum") {
    if (coll instanceof NumberArrayList) {
      let acc = 0;
      for (const v of coll.toArray()) acc = (acc + v) | 0;
      return acc;
    }
    throw new Error(
      `inject_into_sum not supported for ${coll.constructor.name}`,
    );
  }

  // --- inject_into_product ---
  // i32-seed-width wrapping fold (Math.imul coerces each step to i32).
  if (key === "inject_into_product") {
    if (coll instanceof NumberArrayList) {
      let acc = 1;
      for (const v of coll.toArray()) acc = Math.imul(acc, v);
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
      return coll.union(other).size;
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
      return coll.intersect(other).size;
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
      return coll.difference(other).size;
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
      return aMinusB.union(bMinusA).size;
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
function renderExpected(
  expected: unknown,
  key: string,
  f32Mode: boolean,
): string {
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
  if (
    f32Mode &&
    typeof expected === "object" &&
    expected !== null &&
    !Array.isArray(expected) &&
    typeof (expected as { bits?: unknown }).bits === "string"
  ) {
    // Bits-escape float scalar (e.g. sum: {"bits":"0xffc00000"}).
    return formatF32(parseF32Value(expected as { bits: string }));
  }
  if (typeof expected === "number") {
    if (f32ScalarKey) return formatF32(Math.fround(expected));
    return String(expected);
  }
  if (Array.isArray(expected)) {
    if (f32ArrayQuoted) {
      return `[${expected.map((e) => `"${formatF32(parseF32Value(e as number | string | { bits?: string }))}"`).join(",")}]`;
    }
    if (f32ArrayUnquoted) {
      return `[${expected.map((e) => formatF32(parseF32Value(e as number | string | { bits?: string }))).join(",")}]`;
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
  if (computed !== want && !looseNanMatch(expected, f32Mode, computed)) {
    console.log(`FAIL ${name} ${key}: expected=${want} got=${computed}`);
    anyFail = true;
  }
}

// Loose-NaN scalar match. When the EXPECTED operand is a bare NaN *label*
// ("NaN"/"+NaN"/"-NaN") — NOT a {"bits":"0x.."} object and NOT an array
// element — the assertion passes against ANY NaN the runner computed,
// regardless of sign/payload. This covers impl/arch-defined arithmetic NaNs
// such as (+Inf)+(-Inf), whose bits differ across x86 vs ARM. {"bits"}
// operands stay bitwise-exact and array elements stay exact/positional
// (renderExpected is unchanged for both). See cross-language-validation/README.md
// §"Float operand encoding".
function looseNanMatch(
  expected: unknown,
  f32Mode: boolean,
  computed: string,
): boolean {
  if (!f32Mode || typeof expected !== "string") return false;
  if (!Number.isNaN(parseF32Value(expected))) return false;
  // Computed must itself be a NaN bit pattern (canonical "0x........").
  if (!/^0x[0-9a-fA-F]{8}$/.test(computed)) return false;
  return Number.isNaN(f32FromBits(parseInt(computed.slice(2), 16) >>> 0));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HashMap<i64, i32> runner — routes through the PRODUCTION BigIntNumberHashMap
// (bigint key, number value). i64 keys are decimal strings (they exceed 2^53),
// parsed straight to bigint via BigInt(...) — never through a Number() cast,
// which would collapse 2^53-adjacent keys. See README §"Wide-integer (i64)
// operand encoding".
// ---------------------------------------------------------------------------

const I64_MIN = -9223372036854775808n;
const I64_MAX = 9223372036854775807n;

// Construct an i64 bigint from a decimal string, enforcing the i64 range so a
// string like "9223372036854775808" (2^63, OUT of range) FATALs instead of
// being silently accepted as an oversized bigint. Used by the string-key path
// AND the get_/contains_ assertion-name suffixes.
function i64FromString(s: string): bigint {
  let n: bigint;
  try {
    n = BigInt(s);
  } catch {
    throw new Error(`invalid i64 decimal-string key: ${s}`);
  }
  if (n < I64_MIN || n > I64_MAX) {
    throw new Error(`i64 key out of range [-2^63, 2^63-1]: ${s}`);
  }
  return n;
}

function parseI64Operand(v: unknown): bigint {
  if (typeof v === "string") return i64FromString(v);
  if (typeof v === "number") {
    // JSON.parse already rounded a large bare number before we ever saw it, so
    // the only SAFE bare-number key is one inside the f64 safe-integer range.
    // Anything larger must be encoded as a decimal STRING; FATAL rather than
    // silently using a rounded value.
    if (!Number.isSafeInteger(v)) {
      throw new Error(
        `bare i64 number key ${v} is not a safe integer; encode large i64 keys as a decimal string`,
      );
    }
    return BigInt(v);
  }
  throw new Error(
    `expected i64 key (decimal string or number), got ${typeof v}`,
  );
}

function runI64HashMap(scenario: Scenario): void {
  const m = new BigIntNumberHashMap();
  for (const op of scenario.operations) {
    switch (op.op) {
      case "put":
        m.set(parseI64Operand(op.key), op.value as number);
        break;
      case "remove":
        m.remove(parseI64Operand(op.key));
        break;
      case "clear":
        m.clear();
        break;
      default:
        throw new Error(`unknown i64-hashmap op: ${op.op}`);
    }
  }

  console.log(`=== scenario: ${scenario.name} ===`);

  for (const key of Object.keys(scenario.assertions)) {
    if (key === "comment") continue;
    const computed = evalI64MapAssertion(key, m);
    if (computed === undefined) continue; // unknown key -> skip
    console.log(`${key}: ${computed}`);
    const want = renderI64Expected(scenario.assertions[key]);
    if (computed !== want) {
      console.log(
        `FAIL ${scenario.name} ${key}: expected=${want} got=${computed}`,
      );
      anyFail = true;
    }
  }
}

function evalI64MapAssertion(
  key: string,
  m: BigIntNumberHashMap,
): string | undefined {
  if (key === "size") return String(m.size);
  if (key === "is_empty") return String(m.isEmpty());
  if (key === "sorted_keys") {
    // i64 keys exceed 2^53: serialize each as a plain decimal STRING in a
    // quoted array, sorted numerically as i64 (bigint) ascending.
    const keys = m.keysToArray().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `[${keys.map((k) => `"${k.toString()}"`).join(",")}]`;
  }
  if (key.startsWith("get_")) {
    const v = m.get(i64FromString(key.slice(4)));
    return v !== undefined ? String(v) : "null";
  }
  if (key.startsWith("contains_")) {
    return String(m.has(i64FromString(key.slice(9))));
  }
  return undefined;
}

// Render an expected i64-map assertion value into the same canonical string the
// runner emits. `sorted_keys` is a decimal-string array (quoted); scalars are
// numbers/booleans/null.
function renderI64Expected(expected: unknown): string {
  if (expected === null || expected === undefined) return "null";
  if (typeof expected === "boolean") return expected ? "true" : "false";
  if (typeof expected === "number") return String(expected);
  if (Array.isArray(expected)) {
    return `[${expected.map((e) => `"${String(e)}"`).join(",")}]`;
  }
  return String(expected);
}

// ---------------------------------------------------------------------------
// {List,Set}Multimap<i64, i32> runner — routes through the PRODUCTION
// BigIntNumber{List,Set}Multimap (bigint key, number value). i64 keys are
// decimal strings (they exceed 2^53), parsed straight to bigint via BigInt(...)
// like the i64 HashMap path. The multimaps back onto a JS `Map<bigint, ...>`
// (the stdlib hash map), NOT the production OpenHashMap high-bit fold — so this
// verifies full-range i64 keys keep their identity (stay distinct and
// retrievable) through the JS Map. It checks key identity, not
// bucket-distribution quality. List keeps duplicate values; Set dedups.
//
// Assertions (identical to the other ports):
//   distinct_key_count -> uniqueKeys().length (integer string)
//   sorted_keys        -> DISTINCT keys, ascending i64, quoted decimal strings
//   get_<k>            -> values for the key, ascending-sorted number array
//                         (sort a COPY); absent/removed => []
//   contains_key_<k>   -> bool
// ---------------------------------------------------------------------------

interface I64Multimap {
  set(key: bigint, value: number): this;
  get(key: bigint): readonly number[];
  removeAll(key: bigint): number[];
  has(key: bigint): boolean;
  uniqueKeys(): bigint[];
  readonly keysCount: number;
}

function runI64Multimap(scenario: Scenario, m: I64Multimap): void {
  for (const op of scenario.operations) {
    switch (op.op) {
      case "put":
        m.set(parseI64Operand(op.key), op.value as number);
        break;
      case "removeAll":
        m.removeAll(parseI64Operand(op.key));
        break;
      default:
        throw new Error(`unknown i64-multimap op: ${op.op}`);
    }
  }

  console.log(`=== scenario: ${scenario.name} ===`);

  for (const key of Object.keys(scenario.assertions)) {
    if (key === "comment") continue;
    const computed = evalI64MultimapAssertion(key, m);
    if (computed === undefined) continue; // unknown key -> skip
    console.log(`${key}: ${computed}`);
    const want = renderI64MultimapExpected(key, scenario.assertions[key]);
    if (computed !== want) {
      console.log(
        `FAIL ${scenario.name} ${key}: expected=${want} got=${computed}`,
      );
      anyFail = true;
    }
  }
}

function evalI64MultimapAssertion(
  key: string,
  m: I64Multimap,
): string | undefined {
  if (key === "distinct_key_count") return String(m.keysCount);
  if (key === "sorted_keys") {
    const keys = m.uniqueKeys().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `[${keys.map((k) => `"${k.toString()}"`).join(",")}]`;
  }
  if (key.startsWith("get_")) {
    const vals = [...m.get(i64FromString(key.slice(4)))].sort((a, b) => a - b);
    return `[${vals.join(",")}]`;
  }
  if (key.startsWith("contains_key_")) {
    return String(m.has(i64FromString(key.slice(13))));
  }
  return undefined;
}

// Render an expected i64-multimap assertion value into the runner's canonical
// string. `sorted_keys` is a decimal-string array (quoted); `get_<k>` is a
// plain number array (UNQUOTED); scalars are numbers/booleans.
function renderI64MultimapExpected(key: string, expected: unknown): string {
  if (typeof expected === "boolean") return expected ? "true" : "false";
  if (typeof expected === "number") return String(expected);
  if (Array.isArray(expected)) {
    if (key === "sorted_keys") {
      return `[${expected.map((e) => `"${String(e)}"`).join(",")}]`;
    }
    // get_<k> value array: plain numbers, unquoted.
    return `[${expected.map((e) => String(e)).join(",")}]`;
  }
  return String(expected);
}

// ---------------------------------------------------------------------------
// Range<i32> runner — the Bound/Range value model (spec/features/bound-range.md).
// Exactly ONE constructor op builds the range under test; an optional "other"
// block (same single-builder shape) supplies the second range for binary ops.
// Routed through the production Range — every assertion is proved against the
// real cut algebra, not re-derived here.
// ---------------------------------------------------------------------------

// Build a Range<i32> from a single range-builder object (the 10-range op
// shape). Shared by the Range<i32> runner and the NavigableMap/Set
// `range`/`query` fields.
function buildRangeObj(op: RangeOp): Range<number> {
  const lower = (): number => op.lower as number;
  const upper = (): number => op.upper as number;
  switch (op.op) {
    case "closed":
      return Range.closed(lower(), upper());
    case "open":
      return Range.open(lower(), upper());
    case "closed_open":
      return Range.closedOpen(lower(), upper());
    case "open_closed":
      return Range.openClosed(lower(), upper());
    case "at_least":
      return Range.atLeast(lower());
    case "greater_than":
      return Range.greaterThan(lower());
    case "at_most":
      return Range.atMost(upper());
    case "less_than":
      return Range.lessThan(upper());
    case "all":
      return Range.all();
    case "singleton":
      return Range.singleton(op.value as number);
    default:
      throw new Error(`unknown range op: ${op.op}`);
  }
}

function buildRange(ops: Operation[]): Range<number> {
  if (ops.length !== 1) {
    throw new Error("Range<i32> scenario must have exactly one constructor op");
  }
  const op = ops[0];
  // A Range<i32> scenario op carries numeric lower/upper/value operands; the
  // wider Operation.value (string in f32 mode) never appears here.
  return buildRangeObj({
    op: op.op,
    lower: op.lower,
    upper: op.upper,
    value: op.value as number | undefined,
  });
}

function boundTypeStr(bt: BoundType | null): string {
  if (bt === BoundType.Open) return "open";
  if (bt === BoundType.Closed) return "closed";
  return "null";
}

function optIntStr(v: number | null): string {
  return v === null ? "null" : String(v);
}

function evalRangeAssertion(
  key: string,
  range: Range<number>,
  other: Range<number> | null,
): string | undefined {
  if (key === "is_empty") return String(range.isEmpty());
  if (key === "has_lower_bound") return String(range.hasLowerBound());
  if (key === "has_upper_bound") return String(range.hasUpperBound());
  if (key === "lower_bound_type") return boundTypeStr(range.lowerBoundType());
  if (key === "upper_bound_type") return boundTypeStr(range.upperBoundType());
  if (key === "lower_endpoint") return optIntStr(range.lowerEndpoint());
  if (key === "upper_endpoint") return optIntStr(range.upperEndpoint());
  {
    const m = key.match(/^contains_(-?\d+)$/);
    if (m) return String(range.contains(parseInt(m[1], 10)));
  }

  // Binary ops require "other"; if absent, the key is treated as unknown
  // (skip) rather than crashing.
  if (other === null) return undefined;

  if (key === "encloses_other") return String(range.encloses(other));
  if (key === "is_connected_other") return String(range.isConnected(other));
  if (key === "span_lower") return optIntStr(range.span(other).lowerEndpoint());
  if (key === "span_upper") return optIntStr(range.span(other).upperEndpoint());
  if (key === "span_lower_type")
    return boundTypeStr(range.span(other).lowerBoundType());
  if (key === "span_upper_type")
    return boundTypeStr(range.span(other).upperBoundType());

  // Intersection: null = disjoint, present (possibly cut-empty) = abut/overlap.
  const inter = range.intersection(other);
  if (key === "intersection_is_none") return String(inter === null);
  if (key === "intersection_is_empty")
    return String(inter !== null && inter.isEmpty());
  if (key === "intersection_lower")
    return optIntStr(inter === null ? null : inter.lowerEndpoint());
  if (key === "intersection_upper")
    return optIntStr(inter === null ? null : inter.upperEndpoint());
  if (key === "intersection_lower_type")
    return boundTypeStr(inter === null ? null : inter.lowerBoundType());
  if (key === "intersection_upper_type")
    return boundTypeStr(inter === null ? null : inter.upperBoundType());
  if (key === "intersection_has_lower_bound")
    return String(inter !== null && inter.hasLowerBound());
  if (key === "intersection_has_upper_bound")
    return String(inter !== null && inter.hasUpperBound());

  return undefined; // unknown assertion key -> skip
}

function runRange(scenario: Scenario): void {
  const range = buildRange(scenario.operations);
  const other = scenario.other ? buildRange(scenario.other.operations) : null;

  console.log(`=== scenario: ${scenario.name} ===`);

  for (const key of Object.keys(scenario.assertions)) {
    if (key === "comment") continue;
    const computed = evalRangeAssertion(key, range, other);
    if (computed === undefined) continue; // unknown key -> skip (forward-compat)
    console.log(`${key}: ${computed}`);
    const want = renderRangeExpected(scenario.assertions[key]);
    if (computed !== want) {
      console.log(
        `FAIL ${scenario.name} ${key}: expected=${want} got=${computed}`,
      );
      anyFail = true;
    }
  }
}

// Render an expected Range assertion value into the runner's canonical string.
// Endpoints are numbers or null; bound types are "open"/"closed"/null strings;
// the remaining keys are booleans.
function renderRangeExpected(expected: unknown): string {
  if (expected === null || expected === undefined) return "null";
  if (typeof expected === "boolean") return expected ? "true" : "false";
  if (typeof expected === "number") return String(expected);
  return String(expected); // bound-type strings ("open"/"closed")
}

// ---------------------------------------------------------------------------
// ImmutableSortedMap / ImmutableSortedSet (sorted-table-map)
// ---------------------------------------------------------------------------

// A sorted-table collection is built by a SINGLE `from_sorted` bulk op (it has
// no incremental mutators). Per spec/features/sorted-table-map.md §"Authoring
// rules", a scenario with zero or multiple `from_sorted` ops is malformed and
// the runner SKIPs it (returns false = not-applied) rather than failing or
// silently applying the first. Returns the built collection, or null to SKIP.
function buildSortedTable(
  scenario: Scenario,
  isMap: boolean,
): ImmutableSortedMap | ImmutableSortedSet | null {
  const ops = scenario.operations.filter((o) => o.op === "from_sorted");
  if (ops.length !== 1 || scenario.operations.length !== 1) {
    return null; // zero/multiple/unknown ops -> malformed -> SKIP
  }
  const op = ops[0];
  if (isMap) {
    if (!Array.isArray(op.keys) || !Array.isArray(op.values)) return null;
    return ImmutableSortedMap.fromSorted(op.keys, op.values);
  }
  if (!Array.isArray(op.elements)) return null;
  return ImmutableSortedSet.fromSorted(op.elements);
}

// Evaluate one assertion key against the built sorted-table collection. Returns
// `undefined` for an unknown key (forward-compat SKIP). The key vocabulary is
// the UNION of the structural/lookup keys, the navigable-map nav/range keys,
// and the rank-select order-statistic keys — all already in the harness.
function evalSortedTableAssertion(
  key: string,
  coll: ImmutableSortedMap | ImmutableSortedSet,
  query: Range<number> | null,
): unknown {
  const isMap = coll instanceof ImmutableSortedMap;
  const map = isMap ? (coll as ImmutableSortedMap) : null;
  const set = isMap ? null : (coll as ImmutableSortedSet);

  // structural
  if (key === "size") return coll.size;
  if (key === "is_empty") return coll.isEmpty();

  // get_<k> (map only)
  {
    const m = key.match(/^get_(-?\d+)$/);
    if (m) {
      if (map === null) return undefined;
      const v = map.get(parseInt(m[1], 10));
      return v !== undefined ? v : null;
    }
  }
  // contains_<k>
  {
    const m = key.match(/^contains_(-?\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      return map !== null ? map.containsKey(n) : set!.contains(n);
    }
  }
  // sorted_keys / sorted_values (map projection); to_sorted_array (set)
  if (key === "sorted_keys") {
    if (map === null) return undefined;
    return map.keys();
  }
  if (key === "sorted_values") {
    if (map === null) return undefined;
    // Per the harness README, sorted_values is "all values sorted ascending"
    // (the value multiset sorted) — NOT the key-ordered values() iterator
    // (that pairing is a native-test obligation). Sort the value snapshot.
    return map.values().sort((a, b) => a - b);
  }
  if (key === "to_sorted_array") {
    if (set === null) return undefined;
    return set.elements();
  }

  // first/last + min/max
  if (key === "first_key" && map !== null) return map.firstKey() ?? null;
  if (key === "last_key" && map !== null) return map.lastKey() ?? null;
  if (key === "first" && set !== null) return set.first() ?? null;
  if (key === "last" && set !== null) return set.last() ?? null;
  if (key === "min")
    return map !== null ? (map.firstKey() ?? null) : (set!.first() ?? null);
  if (key === "max")
    return map !== null ? (map.lastKey() ?? null) : (set!.last() ?? null);

  // point-nav: floor/ceiling/lower/higher
  {
    const nav = key.match(/^(floor|ceiling|lower|higher)_(-?\d+)$/);
    if (nav) {
      const n = parseInt(nav[2], 10);
      let r: number | undefined;
      if (map !== null) {
        r =
          nav[1] === "floor"
            ? map.floorKey(n)
            : nav[1] === "ceiling"
              ? map.ceilingKey(n)
              : nav[1] === "lower"
                ? map.lowerKey(n)
                : map.higherKey(n);
      } else {
        r =
          nav[1] === "floor"
            ? set!.floor(n)
            : nav[1] === "ceiling"
              ? set!.ceiling(n)
              : nav[1] === "lower"
                ? set!.lower(n)
                : set!.higher(n);
      }
      return r === undefined ? null : r;
    }
  }

  // descending iteration (required, not optional)
  if (key === "descending_keys" && map !== null) return map.descendingKeys();
  if (key === "descending_elements" && set !== null)
    return set.descendingElements();

  // range_* assertions reference the scenario-level `query`. With no query the
  // key is unknown for this scenario -> SKIP (forward-compat).
  if (
    key === "range_keys" ||
    key === "range_elements" ||
    key === "range_keys_desc" ||
    key === "range_elements_desc" ||
    key === "range_size"
  ) {
    if (query === null) return undefined;
    if (key === "range_keys" && map !== null) return map.rangeKeys(query);
    if (key === "range_elements" && set !== null)
      return set.rangeElements(query);
    if (key === "range_keys_desc" && map !== null)
      return map.descendingRangeKeys(query);
    if (key === "range_elements_desc" && set !== null)
      return set.descendingRangeElements(query);
    if (key === "range_size") {
      return map !== null
        ? map.rangeKeys(query).length
        : set!.rangeElements(query).length;
    }
    return undefined;
  }

  // order statistics: rank_<k> (signed) / select_<i> (non-negative)
  {
    const m = key.match(/^rank_(-?\d+)$/);
    if (m) {
      const k = parseInt(m[1], 10);
      return map !== null ? map.rank(k) : set!.rank(k);
    }
  }
  {
    const m = key.match(/^select_(\d+)$/);
    if (m) {
      const i = parseInt(m[1], 10);
      const r = map !== null ? map.selectKey(i) : set!.select(i);
      return r === undefined ? null : r;
    }
  }

  return undefined; // unknown assertion key -> SKIP (forward-compat)
}

function runSortedTable(scenario: Scenario, isMap: boolean): void {
  const coll = buildSortedTable(scenario, isMap);
  if (coll === null) {
    // Malformed (zero/multiple from_sorted ops or missing arrays) -> SKIP.
    console.error(
      `skip: malformed sorted-table scenario (need exactly one from_sorted op): ${scenario.name}`,
    );
    return;
  }
  const query: Range<number> | null = scenario.query
    ? buildRangeObj(scenario.query)
    : null;

  console.log(`=== scenario: ${scenario.name} ===`);
  for (const key of Object.keys(scenario.assertions)) {
    if (key === "comment") continue;
    const computed = evalSortedTableAssertion(key, coll, query);
    if (computed === undefined) continue; // unknown key -> SKIP (forward-compat)
    emit(
      scenario.name,
      key,
      formatValue(computed),
      scenario.assertions[key],
      false,
    );
  }
}

// ---------------------------------------------------------------------------
// HashPipeline (spec/features/hash-pipeline.md)
//
// A stateless probe (not a stored collection): exactly ONE hash op carries the
// input + seed under test; the assertions read the deterministic hash output.
// Outputs are serialized as fixed-width, lower-case, `0x`-prefixed hex strings
// (8 digits for a u32, 16 for a u64) so a 64-bit hash survives the JSON `2^53`
// ceiling. `positions` is an int[] in derivation order (NOT sorted). Unknown
// ops/keys SKIP (forward-compat).
// ---------------------------------------------------------------------------

// Parse a `seed` operand: a DECIMAL STRING parsed straight to a U64 lane pair
// via BigInt, NEVER through a JS number/float (which would collapse seeds above
// 2^53). A bare JSON number is accepted only for small (safe-integer) seeds.
function parseSeedU64(v: unknown): U64 {
  let n: bigint;
  if (typeof v === "string") {
    // Decimal-only grammar, matching the Rust runner's `s.parse::<u64>()`.
    // BigInt() would otherwise also accept 0x.. / 0o.. / 0b.. forms, diverging
    // from the reference (which requires a plain decimal seed string).
    if (!/^[0-9]+$/.test(v)) {
      throw new Error(`invalid u64 decimal-string seed: ${v}`);
    }
    n = BigInt(v);
  } else if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) {
      throw new Error(
        `bare seed number ${v} is not a safe integer; encode large seeds as a decimal string`,
      );
    }
    n = BigInt(v);
  } else {
    throw new Error(`expected u64 seed (decimal string or number)`);
  }
  if (n < 0n || n > 0xffffffffffffffffn) {
    throw new Error(`seed out of u64 range [0, 2^64-1]: ${v}`);
  }
  return {
    hi: Number((n >> 32n) & 0xffffffffn) >>> 0,
    lo: Number(n & 0xffffffffn) >>> 0,
  };
}

// Parse a `0x`-prefixed hex word operand to a U64 lane pair (the caller narrows
// to a u32 number where the op needs a 32-bit word).
function parseHexWordU64(v: unknown): U64 {
  if (typeof v !== "string") {
    throw new Error("hash-pipeline `word` must be a 0x-hex string");
  }
  if (!/^0x[0-9a-fA-F]+$/.test(v) || v.length > 18) {
    throw new Error(`invalid hex word (must be 0x + <=16 hex digits): ${v}`);
  }
  const n = BigInt(v);
  return {
    hi: Number((n >> 32n) & 0xffffffffn) >>> 0,
    lo: Number(n & 0xffffffffn) >>> 0,
  };
}

// Parse a `0x`-hex byte string (e.g. "0x01020304") to a Uint8Array.
function parseHexBytes(v: unknown): Uint8Array {
  if (typeof v !== "string") {
    throw new Error("hash-pipeline `bytes` must be a 0x-hex string");
  }
  const body = v.replace(/^0[xX]/, "");
  if (body === v || body.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(body)) {
    throw new Error(`invalid 0x-hex byte string: ${v}`);
  }
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(body.slice(2 * i, 2 * i + 2), 16);
  }
  return out;
}

function u32Hex(h: number): string {
  return "0x" + (h >>> 0).toString(16).padStart(8, "0");
}
function u64Hex(h: U64): string {
  return (
    "0x" +
    (h.hi >>> 0).toString(16).padStart(8, "0") +
    (h.lo >>> 0).toString(16).padStart(8, "0")
  );
}

// The probe a hash op builds. Word32/Word64 carry an already-computed hash;
// I32/Bytes carry the logical input so EITHER the 32- or 64-bit form (incl.
// lanes) can be asserted; Positions carries the derived-position array.
type HashProbe =
  | { kind: "word32"; h: number }
  | { kind: "word64"; h: U64 }
  | { kind: "i32"; value: number; seed: U64 }
  | { kind: "bytes"; bytes: Uint8Array; seed: U64 }
  | { kind: "positions"; p: number[] };

// Evaluate one assertion key against the probe; returns undefined for an
// unknown/unsupported key (forward-compat SKIP).
function evalHashProbe(probe: HashProbe, key: string): string | undefined {
  switch (probe.kind) {
    case "word32":
      return key === "hash32" ? u32Hex(probe.h) : undefined;
    case "word64":
      return evalH64(probe.h, key);
    case "positions":
      // Emitted in DERIVATION order (p_0 … p_{k-1}), NOT sorted.
      return key === "positions"
        ? `[${probe.p.map((x) => String(x)).join(",")}]`
        : undefined;
    case "i32":
      if (key === "hash32") return u32Hex(hash32I32(probe.value, probe.seed));
      if (key === "hash64" || key === "hash64_hi" || key === "hash64_lo") {
        return evalH64(hash64I32(probe.value, probe.seed), key);
      }
      return undefined;
    case "bytes":
      if (key === "hash32") return u32Hex(hash32Bytes(probe.bytes, probe.seed));
      if (key === "hash64" || key === "hash64_hi" || key === "hash64_lo") {
        return evalH64(hash64Bytes(probe.bytes, probe.seed), key);
      }
      return undefined;
  }
}

function evalH64(h: U64, key: string): string | undefined {
  if (key === "hash64") return u64Hex(h);
  if (key === "hash64_hi") return u32Hex(h.hi);
  if (key === "hash64_lo") return u32Hex(h.lo);
  return undefined;
}

// Render an expected hash-pipeline assertion value (a hex string for the hash
// keys, an int[] for positions) into the runner's canonical string.
function renderHashExpected(key: string, expected: unknown): string {
  if (key === "positions" && Array.isArray(expected)) {
    return `[${expected.map((e) => String(e)).join(",")}]`;
  }
  if (typeof expected === "string") return expected;
  return String(expected);
}

function runHashPipeline(scenario: Scenario): void {
  // Authoring rule: exactly ONE hash op. Zero or multiple => malformed => SKIP
  // (like the sorted-table `from_sorted` rule). An unrecognised op kind also
  // makes the scenario un-runnable here => SKIP (forward-compat).
  if (scenario.operations.length !== 1) {
    console.error(
      `skip: hash-pipeline scenario must have exactly one op (forward-compat): got ${scenario.operations.length}`,
    );
    return;
  }
  const op = scenario.operations[0] as Operation & {
    word?: unknown;
    seed?: unknown;
    bytes?: unknown;
    m?: number;
    k?: number;
  };
  let probe: HashProbe;
  switch (op.op) {
    case "hash_word32": {
      const word = parseHexWordU64(op.word);
      if (word.hi !== 0) {
        throw new Error(`hash_word32 word exceeds 32 bits: ${op.word}`);
      }
      probe = {
        kind: "word32",
        h: hash32(word.lo >>> 0, parseSeedU64(op.seed)),
      };
      break;
    }
    case "hash_word64": {
      probe = {
        kind: "word64",
        h: hash64(parseHexWordU64(op.word), parseSeedU64(op.seed)),
      };
      break;
    }
    case "hash_i32": {
      probe = {
        kind: "i32",
        value: op.value as number,
        seed: parseSeedU64(op.seed),
      };
      break;
    }
    case "hash_bytes": {
      probe = {
        kind: "bytes",
        bytes: parseHexBytes(op.bytes),
        seed: parseSeedU64(op.seed),
      };
      break;
    }
    case "positions": {
      // The byte encoding of an i32 element drives positions: encode the i32 to
      // its little-endian 4-byte form, then derive. No op-level seed (the scheme
      // fixes the internal seeds 0 and SALT2).
      const value = (op.value as number) >>> 0;
      const bytes = new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]);
      probe = {
        kind: "positions",
        p: hashPositions(bytes, op.m as number, op.k as number),
      };
      break;
    }
    default:
      console.error(
        `skip: unknown hash-pipeline op (forward-compat): ${op.op}`,
      );
      return;
  }

  console.log(`=== scenario: ${scenario.name} ===`);
  for (const key of Object.keys(scenario.assertions)) {
    if (key === "comment") continue;
    const computed = evalHashProbe(probe, key);
    if (computed === undefined) continue; // unknown key -> SKIP (forward-compat)
    console.log(`${key}: ${computed}`);
    const want = renderHashExpected(key, scenario.assertions[key]);
    if (computed !== want) {
      console.log(
        `FAIL ${scenario.name} ${key}: expected=${want} got=${computed}`,
      );
      anyFail = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Bloom (spec/features/bloom.md)
//
// A new collection kind: "Bloom". A scenario's `operations` array begins with
// EXACTLY ONE `with_params` op carrying the explicit (m, k) (never `optimal` —
// the float trap is quarantined to native tests), then zero or more `add` ops.
// Zero or multiple `with_params` ⇒ malformed ⇒ SKIP (the from_sorted /
// HashPipeline rule). A `union` scenario carries a second filter in the
// top-level `other` block (same with_params + add shape); the `union_*`
// assertions then describe the union's bits.
//
// Assertion keys: bytes/union_bytes (0x-hex, byte 0 first), set_bits/
// union_set_bits (sorted ascending), contains_<v>/union_contains_<v> (signed
// i32 suffix), bit_count/union_bit_count, m_bits, k, is_empty. Unknown ops/keys
// SKIP (forward-compat). m=0 / m,k out of range / union-param-mismatch guard to
// SKIP.
// ---------------------------------------------------------------------------

// Build a Bloom filter from a scenario's (or `other` block's) operations:
// exactly one `with_params` (else malformed → null → SKIP), then `add` ops.
// Returns null on malformed structure or an out-of-range / m=0 construction
// (guarded so the runner SKIPs rather than crashing).
function buildBloom(ops: Operation[]): Bloom | null {
  const withParams = ops.filter((o) => o.op === "with_params");
  if (withParams.length !== 1 || ops[0]?.op !== "with_params") {
    return null; // zero/multiple/misplaced with_params -> malformed -> SKIP
  }
  const wp = withParams[0];
  const m = wp.m;
  const k = wp.k;
  if (typeof m !== "number" || typeof k !== "number") return null;
  try {
    const bloom = Bloom.withParams(m, k);
    for (const op of ops) {
      if (op.op === "with_params") continue;
      if (op.op === "add") {
        if (typeof op.value !== "number") return null;
        bloom.add(op.value); // throws on a non-i32 value -> SKIP below
      } else {
        return null; // unknown op -> malformed -> SKIP (forward-compat)
      }
    }
    return bloom;
  } catch {
    // m=0 / out-of-range construction, or a non-i32 add value -> malformed -> SKIP.
    return null;
  }
}

// Evaluate one Bloom assertion key. `self` is the primary filter; `other` is the
// union partner (or null when the scenario has no `other` block). Returns
// `undefined` for an unknown key (forward-compat SKIP).
function evalBloomAssertion(
  key: string,
  self: Bloom,
  other: Bloom | null,
): unknown {
  if (key === "m_bits") return self.mBits();
  if (key === "k") return self.k();
  if (key === "bit_count") return self.bitCount();
  if (key === "is_empty") return self.isEmpty();
  if (key === "set_bits") return self.setBits(); // already sorted ascending
  if (key === "bytes") return self.toHex();

  {
    const m = key.match(/^contains_(-?\d+)$/);
    if (m) return self.mightContain(parseInt(m[1], 10));
  }

  // union_* keys require the `other` partner; absent it the key is unknown for
  // this scenario -> SKIP (forward-compat). union() throws on a param mismatch.
  if (key.startsWith("union_")) {
    if (other === null) return undefined;
    const u = self.union(other);
    if (key === "union_bit_count") return u.bitCount();
    if (key === "union_set_bits") return u.setBits();
    if (key === "union_bytes") return u.toHex();
    const m = key.match(/^union_contains_(-?\d+)$/);
    if (m) return u.mightContain(parseInt(m[1], 10));
  }

  return undefined; // unknown assertion key -> SKIP (forward-compat)
}

function runBloom(scenario: Scenario): void {
  const self = buildBloom(scenario.operations);
  if (self === null) {
    console.error(
      `skip: malformed Bloom scenario (need exactly one with_params op): ${scenario.name}`,
    );
    return;
  }
  let other: Bloom | null = null;
  if (scenario.other) {
    other = buildBloom(scenario.other.operations);
    if (other === null) {
      console.error(`skip: malformed Bloom 'other' filter: ${scenario.name}`);
      return;
    }
  }

  console.log(`=== scenario: ${scenario.name} ===`);
  for (const key of Object.keys(scenario.assertions)) {
    if (key === "comment") continue;
    let computed: unknown;
    try {
      computed = evalBloomAssertion(key, self, other);
    } catch {
      // union param-mismatch (or similar) -> SKIP rather than crash the runner.
      continue;
    }
    if (computed === undefined) continue; // unknown key -> SKIP (forward-compat)
    const got = formatValue(computed);
    console.log(`${key}: ${got}`);
    const want = renderBloomExpected(scenario.assertions[key]);
    if (got !== want) {
      console.log(`FAIL ${scenario.name} ${key}: expected=${want} got=${got}`);
      anyFail = true;
    }
  }
}

// Render an expected Bloom assertion value into the runner's canonical string.
// Bloom outputs are plain: a `0x`-hex byte STRING (bytes/union_bytes, compared
// verbatim — NOT reinterpreted as an f32 like the generic renderExpected does),
// a boolean (contains/is_empty), an int (bit_count/m_bits/k), or an int[]
// (set_bits/union_set_bits).
function renderBloomExpected(expected: unknown): string {
  if (expected === null || expected === undefined) return "null";
  if (typeof expected === "boolean") return expected ? "true" : "false";
  if (typeof expected === "string") return expected; // 0x-hex byte string, verbatim
  if (typeof expected === "number") return String(expected);
  if (Array.isArray(expected)) {
    return `[${expected.map((e) => String(e)).join(",")}]`;
  }
  return String(expected);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npx tsx src/validate.ts <scenario.json>");
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  const raw = fs.readFileSync(filePath, "utf-8");
  const scenario: Scenario = JSON.parse(raw);

  // HashMap<i64, i32> takes a separate dispatch path: its keys are bigints
  // (decimal strings in the scenario, since i64 exceeds 2^53) and the
  // production map is BigIntNumberHashMap, which is not in the number-keyed
  // Collection union. See cross-language-validation/README.md
  // §"Wide-integer (i64) operand encoding".
  if (scenario.collection === "HashMap<i64, i32>") {
    runI64HashMap(scenario);
    if (anyFail) process.exit(1);
    return;
  }

  // ListMultimap/SetMultimap<i64, i32> take the same separate bigint-keyed
  // dispatch path: production BigIntNumber{List,Set}Multimap, not in the
  // number-keyed Collection union. See README §"Wide-integer (i64) operand
  // encoding".
  if (scenario.collection === "ListMultimap<i64, i32>") {
    runI64Multimap(scenario, new BigIntNumberListMultimap());
    if (anyFail) process.exit(1);
    return;
  }
  if (scenario.collection === "SetMultimap<i64, i32>") {
    runI64Multimap(scenario, new BigIntNumberSetMultimap());
    if (anyFail) process.exit(1);
    return;
  }

  // Range<i32> — the Bound/Range value model, built by a single constructor
  // op and probed by the range assertion keys. Separate dispatch (it is a
  // value type, not in the number-keyed Collection union).
  if (scenario.collection === "Range<i32>") {
    runRange(scenario);
    if (anyFail) process.exit(1);
    return;
  }

  // ImmutableSortedMap<i32, i32> / ImmutableSortedSet<i32> — the compact
  // sorted-table-map types, built by a single `from_sorted` op and probed by
  // the union of structural / navigable-map / rank-select assertion keys.
  // Separate dispatch (the `from_sorted` op is a bulk construction, not in the
  // mutate-an-existing-collection applyOperation model).
  if (scenario.collection === "ImmutableSortedMap<i32, i32>") {
    runSortedTable(scenario, true);
    if (anyFail) process.exit(1);
    return;
  }
  if (scenario.collection === "ImmutableSortedSet<i32>") {
    runSortedTable(scenario, false);
    if (anyFail) process.exit(1);
    return;
  }

  // HashPipeline — the deterministic, byte-exact named hash (hash-pipeline.md).
  // A stateless probe built by exactly one hash op; outputs are fixed-width hex
  // strings (hash32/hash64) or an int[] (positions). Separate dispatch.
  if (scenario.collection === "HashPipeline") {
    runHashPipeline(scenario);
    if (anyFail) process.exit(1);
    return;
  }

  // Bloom — approximate set membership on the hash pipeline (bloom.md). A new
  // collection kind, built by exactly one `with_params` op + `add` ops and
  // probed by the bytes/set_bits/bit_count/contains_/union_* keys. Separate
  // dispatch (the Bloom filter is not in the number-keyed Collection union).
  if (scenario.collection === "Bloom") {
    runBloom(scenario);
    if (anyFail) process.exit(1);
    return;
  }

  // Forward-compat (README "unknown collection kinds skip"): a runner that does
  // not understand a collection kind must SKIP, not fail, so newer scenarios
  // never break an older runner. Mirrors the unknown-assertion-key skip below.
  if (!isKnownCollection(scenario.collection)) {
    console.error(
      `skip: unsupported collection kind (forward-compat): ${scenario.collection}`,
    );
    return;
  }

  // f32 mode controls how labels and outputs are formatted. Operands are
  // narrowed to true f32 via Math.fround (see parseF32Value) so the backing
  // JS-number collection holds f32-rounded values matching Rust/Go/Zig.
  // Caveat: Number*HashMap/Set key by Object.is, which canonicalizes NaN
  // (Object.is(NaN,-NaN)===true) — so a TS f32 hash collection collapses all
  // NaN to one key (the ArrayList sort/total-order path stays bit-faithful).
  // See the TS carve-out in spec/algorithms.md §"NaN must hash and compare by
  // bit pattern".
  const f32Mode = scenario.collection.includes("<f32");

  // Create and populate main collection. The NavLog records poll/remove_range
  // return values in execution order for the result-log assertion keys.
  const coll = createCollection(scenario.collection);
  const log = newNavLog();
  for (const op of scenario.operations) {
    applyOperation(coll, op, f32Mode, log);
  }

  // The optional scenario-level `query` range names the range that range_*
  // assertions refer to (same builder-op shape as 10-range / remove_range).
  const query: Range<number> | null = scenario.query
    ? buildRangeObj(scenario.query)
    : null;

  // Create and populate "other" collection if present
  let other: Collection | null = null;
  if (scenario.other) {
    other = createCollection(scenario.other.collection);
    const otherLog = newNavLog();
    for (const op of scenario.other.operations) {
      applyOperation(other, op, f32Mode, otherLog);
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
      actual = evaluateAssertion(key, coll, other, f32Mode, log, query);
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
    emit(
      scenario.name,
      key,
      formatValue(actual),
      scenario.assertions[key],
      f32Mode,
    );
  }

  if (anyFail) process.exit(1);
}

main();
