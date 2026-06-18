// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

export * from "./api/index.js";
export * as object from "./object/index.js";
export {
  Stream,
  range,
  rangeClosed,
  generate,
  iterate,
  repeat,
  of,
  empty,
} from "./stream/stream.js";
export { NumberArrayList } from "./arraylist/number-array-list.js";
export { BigIntArrayList } from "./arraylist/bigint-array-list.js";
export { NumberHashSet } from "./hashset/number-hash-set.js";
export { BigIntHashSet } from "./hashset/bigint-hash-set.js";
export { NumberHashBag } from "./bag/number-hash-bag.js";
export { BigIntHashBag } from "./bag/bigint-hash-bag.js";
export { NumberArrayStack } from "./stack/number-array-stack.js";
export { BigIntArrayStack } from "./stack/bigint-array-stack.js";
export { NumberNumberHashMap } from "./hashmap/number-number-hash-map.js";
export { BigIntBigIntHashMap } from "./hashmap/bigint-bigint-hash-map.js";
export { NumberTreeSet } from "./treeset/number-tree-set.js";
export { BigIntTreeSet } from "./treeset/bigint-tree-set.js";
export { NumberNumberTreeMap } from "./treemap/number-number-tree-map.js";
export { BigIntBigIntTreeMap } from "./treemap/bigint-bigint-tree-map.js";
export { NumberNumberPair } from "./tuple/number-number-pair.js";
export { BigIntBigIntPair } from "./tuple/bigint-bigint-pair.js";
export { NumberInterval } from "./interval/number-interval.js";
export { Range, BoundType, CutKind } from "./range/range.js";
export * as hash from "./hash/hash.js";
export type { U64 } from "./hash/hash.js";
export type { Cut } from "./range/range.js";
export {
  ImmutableSortedMap,
  ImmutableSortedSet,
} from "./immutable_sorted/immutable-sorted-map.js";
export { BoundedLruMap } from "./bounded_lru/bounded-lru-map.js";
export type {
  EvictionCause,
  EvictCallback,
  BoundedLruMapOptions,
} from "./bounded_lru/bounded-lru-map.js";

// Full typed primitive collection surface (mutable + immutable; all six
// element types and 36 key×value hash-map pairs). See src/typed/index.ts.
export * from "./typed/index.js";
