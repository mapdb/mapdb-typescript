// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

//
// Compile-time verification — never executed. Each `Check_*` const uses
// a conditional type that resolves to `true` only if the concrete class
// is structurally assignable to the api interface, and to `never`
// otherwise. The const literal `true` is then assigned to that type —
// if the type collapses to `never`, tsc rejects this file.

import type {
  MapDbCollection,
  MapDbList,
  MapDbMutableList,
  MapDbSet,
  MapDbMutableSet,
  MapDbBag,
  MapDbMutableBag,
  MapDbStack,
  MapDbMutableStack,
  MapDbMap,
  MapDbMutableMap,
} from "./index.js";

import type { NumberArrayList } from "../arraylist/number-array-list.js";
import type { ImmutableNumberArrayList } from "../arraylist/immutable-number-array-list.js";
import type { BigIntArrayList } from "../arraylist/bigint-array-list.js";
import type { ImmutableBigIntArrayList } from "../arraylist/immutable-bigint-array-list.js";

import type { NumberHashSet } from "../hashset/number-hash-set.js";
import type { ImmutableNumberHashSet } from "../hashset/immutable-number-hash-set.js";
import type { BigIntHashSet } from "../hashset/bigint-hash-set.js";
import type { ImmutableBigIntHashSet } from "../hashset/immutable-bigint-hash-set.js";

import type { NumberHashBag } from "../bag/number-hash-bag.js";
import type { ImmutableNumberHashBag } from "../bag/immutable-number-hash-bag.js";
import type { BigIntHashBag } from "../bag/bigint-hash-bag.js";
import type { ImmutableBigIntHashBag } from "../bag/immutable-bigint-hash-bag.js";

import type { NumberArrayStack } from "../stack/number-array-stack.js";
import type { ImmutableNumberArrayStack } from "../stack/immutable-number-array-stack.js";
import type { BigIntArrayStack } from "../stack/bigint-array-stack.js";
import type { ImmutableBigIntArrayStack } from "../stack/immutable-bigint-array-stack.js";

import type { NumberTreeSet } from "../treeset/number-tree-set.js";
import type { BigIntTreeSet } from "../treeset/bigint-tree-set.js";

import type { NumberInterval } from "../interval/number-interval.js";
import type { BigIntInterval } from "../interval/bigint-interval.js";

import type { NumberNumberHashMap } from "../hashmap/number-number-hash-map.js";
import type { ImmutableNumberNumberHashMap } from "../hashmap/immutable-number-number-hash-map.js";
import type { NumberNumberTreeMap } from "../treemap/number-number-tree-map.js";

type Assert<Concrete, Iface> = Concrete extends Iface ? true : never;

// Lists
const _CheckNumberArrayList: Assert<
  NumberArrayList,
  MapDbMutableList<number>
> = true;
const _CheckImmutableNumberArrayList: Assert<
  ImmutableNumberArrayList,
  MapDbList<number>
> = true;
const _CheckBigIntArrayList: Assert<
  BigIntArrayList,
  MapDbMutableList<bigint>
> = true;
const _CheckImmutableBigIntArrayList: Assert<
  ImmutableBigIntArrayList,
  MapDbList<bigint>
> = true;

// Sets
const _CheckNumberHashSet: Assert<
  NumberHashSet,
  MapDbMutableSet<number>
> = true;
const _CheckImmutableNumberHashSet: Assert<
  ImmutableNumberHashSet,
  MapDbSet<number>
> = true;
const _CheckBigIntHashSet: Assert<
  BigIntHashSet,
  MapDbMutableSet<bigint>
> = true;
const _CheckImmutableBigIntHashSet: Assert<
  ImmutableBigIntHashSet,
  MapDbSet<bigint>
> = true;
const _CheckNumberTreeSet: Assert<
  NumberTreeSet,
  MapDbMutableSet<number>
> = true;
const _CheckBigIntTreeSet: Assert<
  BigIntTreeSet,
  MapDbMutableSet<bigint>
> = true;

// Bags
const _CheckNumberHashBag: Assert<
  NumberHashBag,
  MapDbMutableBag<number>
> = true;
const _CheckImmutableNumberHashBag: Assert<
  ImmutableNumberHashBag,
  MapDbBag<number>
> = true;
const _CheckBigIntHashBag: Assert<
  BigIntHashBag,
  MapDbMutableBag<bigint>
> = true;
const _CheckImmutableBigIntHashBag: Assert<
  ImmutableBigIntHashBag,
  MapDbBag<bigint>
> = true;

// Stacks
const _CheckNumberArrayStack: Assert<
  NumberArrayStack,
  MapDbMutableStack<number>
> = true;
const _CheckImmutableNumberArrayStack: Assert<
  ImmutableNumberArrayStack,
  MapDbStack<number>
> = true;
const _CheckBigIntArrayStack: Assert<
  BigIntArrayStack,
  MapDbMutableStack<bigint>
> = true;
const _CheckImmutableBigIntArrayStack: Assert<
  ImmutableBigIntArrayStack,
  MapDbStack<bigint>
> = true;

// Maps
const _CheckNumberNumberHashMap: Assert<
  NumberNumberHashMap,
  MapDbMutableMap<number, number>
> = true;
const _CheckImmutableNumberNumberHashMap: Assert<
  ImmutableNumberNumberHashMap,
  MapDbMap<number, number>
> = true;
const _CheckNumberNumberTreeMap: Assert<
  NumberNumberTreeMap,
  MapDbMutableMap<number, number>
> = true;

// ── MapDbCollection (Array.prototype-style) checks ────────────────────
// These verify that every concrete collection satisfies the expanded
// MapDbCollection<T> interface (forEach, map, filter, find, every,
// some, reduce, includes, toArray, [Symbol.iterator]).
const _CheckNumberArrayListCollection: Assert<
  NumberArrayList,
  MapDbCollection<number>
> = true;
const _CheckImmutableNumberArrayListCollection: Assert<
  ImmutableNumberArrayList,
  MapDbCollection<number>
> = true;
const _CheckNumberHashSetCollection: Assert<
  NumberHashSet,
  MapDbCollection<number>
> = true;
const _CheckImmutableNumberHashSetCollection: Assert<
  ImmutableNumberHashSet,
  MapDbCollection<number>
> = true;
const _CheckNumberTreeSetCollection: Assert<
  NumberTreeSet,
  MapDbCollection<number>
> = true;
const _CheckNumberHashBagCollection: Assert<
  NumberHashBag,
  MapDbCollection<number>
> = true;
const _CheckImmutableNumberHashBagCollection: Assert<
  ImmutableNumberHashBag,
  MapDbCollection<number>
> = true;
const _CheckNumberArrayStackCollection: Assert<
  NumberArrayStack,
  MapDbCollection<number>
> = true;
const _CheckImmutableNumberArrayStackCollection: Assert<
  ImmutableNumberArrayStack,
  MapDbCollection<number>
> = true;
const _CheckBigIntArrayListCollection: Assert<
  BigIntArrayList,
  MapDbCollection<bigint>
> = true;
const _CheckImmutableBigIntArrayListCollection: Assert<
  ImmutableBigIntArrayList,
  MapDbCollection<bigint>
> = true;
const _CheckBigIntHashSetCollection: Assert<
  BigIntHashSet,
  MapDbCollection<bigint>
> = true;
const _CheckImmutableBigIntHashSetCollection: Assert<
  ImmutableBigIntHashSet,
  MapDbCollection<bigint>
> = true;
const _CheckBigIntTreeSetCollection: Assert<
  BigIntTreeSet,
  MapDbCollection<bigint>
> = true;
const _CheckBigIntHashBagCollection: Assert<
  BigIntHashBag,
  MapDbCollection<bigint>
> = true;
const _CheckImmutableBigIntHashBagCollection: Assert<
  ImmutableBigIntHashBag,
  MapDbCollection<bigint>
> = true;
const _CheckBigIntArrayStackCollection: Assert<
  BigIntArrayStack,
  MapDbCollection<bigint>
> = true;
const _CheckImmutableBigIntArrayStackCollection: Assert<
  ImmutableBigIntArrayStack,
  MapDbCollection<bigint>
> = true;

// Intervals
const _CheckNumberIntervalCollection: Assert<
  NumberInterval,
  MapDbCollection<number>
> = true;
const _CheckBigIntIntervalCollection: Assert<
  BigIntInterval,
  MapDbCollection<bigint>
> = true;

// Suppress unused-const lint — these are intentional compile-time checks.
export type _ApiVerifyTypeCheck = [
  typeof _CheckNumberArrayList,
  typeof _CheckImmutableNumberArrayList,
  typeof _CheckBigIntArrayList,
  typeof _CheckImmutableBigIntArrayList,
  typeof _CheckNumberHashSet,
  typeof _CheckImmutableNumberHashSet,
  typeof _CheckBigIntHashSet,
  typeof _CheckImmutableBigIntHashSet,
  typeof _CheckNumberTreeSet,
  typeof _CheckBigIntTreeSet,
  typeof _CheckNumberHashBag,
  typeof _CheckImmutableNumberHashBag,
  typeof _CheckBigIntHashBag,
  typeof _CheckImmutableBigIntHashBag,
  typeof _CheckNumberArrayStack,
  typeof _CheckImmutableNumberArrayStack,
  typeof _CheckBigIntArrayStack,
  typeof _CheckImmutableBigIntArrayStack,
  typeof _CheckNumberNumberHashMap,
  typeof _CheckImmutableNumberNumberHashMap,
  typeof _CheckNumberNumberTreeMap,
  typeof _CheckNumberArrayListCollection,
  typeof _CheckImmutableNumberArrayListCollection,
  typeof _CheckNumberHashSetCollection,
  typeof _CheckImmutableNumberHashSetCollection,
  typeof _CheckNumberTreeSetCollection,
  typeof _CheckNumberHashBagCollection,
  typeof _CheckImmutableNumberHashBagCollection,
  typeof _CheckNumberArrayStackCollection,
  typeof _CheckImmutableNumberArrayStackCollection,
  typeof _CheckBigIntArrayListCollection,
  typeof _CheckImmutableBigIntArrayListCollection,
  typeof _CheckBigIntHashSetCollection,
  typeof _CheckImmutableBigIntHashSetCollection,
  typeof _CheckBigIntTreeSetCollection,
  typeof _CheckBigIntHashBagCollection,
  typeof _CheckImmutableBigIntHashBagCollection,
  typeof _CheckBigIntArrayStackCollection,
  typeof _CheckImmutableBigIntArrayStackCollection,
  typeof _CheckNumberIntervalCollection,
  typeof _CheckBigIntIntervalCollection,
];
