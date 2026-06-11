// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Barrel re-exporting every typed primitive collection class (mutable +
// immutable, all six element types / 36 key×value pairs). The concrete
// classes themselves are CODE GENERATED (see src/codegen/); this barrel is
// hand-maintained — add the matching export when a new typed family lands.

// ---- ArrayList (mutable + immutable) ----
export { Int8ArrayList } from "./arraylist/int8-array-list.js";
export { ImmutableInt8ArrayList } from "./arraylist/immutable_int8-array-list.js";
export { Int16ArrayList } from "./arraylist/int16-array-list.js";
export { ImmutableInt16ArrayList } from "./arraylist/immutable_int16-array-list.js";
export { Int32ArrayList } from "./arraylist/int32-array-list.js";
export { ImmutableInt32ArrayList } from "./arraylist/immutable_int32-array-list.js";
export { Float32ArrayList } from "./arraylist/float32-array-list.js";
export { ImmutableFloat32ArrayList } from "./arraylist/immutable_float32-array-list.js";
export { Float64ArrayList } from "./arraylist/float64-array-list.js";
export { ImmutableFloat64ArrayList } from "./arraylist/immutable_float64-array-list.js";
export { BigInt64ArrayList } from "./arraylist/bigint64-array-list.js";
export { ImmutableBigInt64ArrayList } from "./arraylist/immutable_bigint64-array-list.js";

// ---- HashSet (mutable + immutable) ----
export { Int8HashSet } from "./hashset/int8-hash-set.js";
export { ImmutableInt8HashSet } from "./hashset/immutable_int8-hash-set.js";
export { Int16HashSet } from "./hashset/int16-hash-set.js";
export { ImmutableInt16HashSet } from "./hashset/immutable_int16-hash-set.js";
export { Int32HashSet } from "./hashset/int32-hash-set.js";
export { ImmutableInt32HashSet } from "./hashset/immutable_int32-hash-set.js";
export { Float32HashSet } from "./hashset/float32-hash-set.js";
export { ImmutableFloat32HashSet } from "./hashset/immutable_float32-hash-set.js";
export { Float64HashSet } from "./hashset/float64-hash-set.js";
export { ImmutableFloat64HashSet } from "./hashset/immutable_float64-hash-set.js";
export { BigInt64HashSet } from "./hashset/bigint64-hash-set.js";
export { ImmutableBigInt64HashSet } from "./hashset/immutable_bigint64-hash-set.js";

// ---- ArrayStack (mutable + immutable) ----
export { Int8ArrayStack } from "./stack/int8-array-stack.js";
export { ImmutableInt8ArrayStack } from "./stack/immutable_int8-array-stack.js";
export { Int16ArrayStack } from "./stack/int16-array-stack.js";
export { ImmutableInt16ArrayStack } from "./stack/immutable_int16-array-stack.js";
export { Int32ArrayStack } from "./stack/int32-array-stack.js";
export { ImmutableInt32ArrayStack } from "./stack/immutable_int32-array-stack.js";
export { Float32ArrayStack } from "./stack/float32-array-stack.js";
export { ImmutableFloat32ArrayStack } from "./stack/immutable_float32-array-stack.js";
export { Float64ArrayStack } from "./stack/float64-array-stack.js";
export { ImmutableFloat64ArrayStack } from "./stack/immutable_float64-array-stack.js";
export { BigInt64ArrayStack } from "./stack/bigint64-array-stack.js";
export { ImmutableBigInt64ArrayStack } from "./stack/immutable_bigint64-array-stack.js";

// ---- HashBag (mutable + immutable) ----
export { Int8HashBag } from "./bag/int8-hash-bag.js";
export { ImmutableInt8HashBag } from "./bag/immutable_int8-hash-bag.js";
export { Int16HashBag } from "./bag/int16-hash-bag.js";
export { ImmutableInt16HashBag } from "./bag/immutable_int16-hash-bag.js";
export { Int32HashBag } from "./bag/int32-hash-bag.js";
export { ImmutableInt32HashBag } from "./bag/immutable_int32-hash-bag.js";
export { Float32HashBag } from "./bag/float32-hash-bag.js";
export { ImmutableFloat32HashBag } from "./bag/immutable_float32-hash-bag.js";
export { Float64HashBag } from "./bag/float64-hash-bag.js";
export { ImmutableFloat64HashBag } from "./bag/immutable_float64-hash-bag.js";
export { BigInt64HashBag } from "./bag/bigint64-hash-bag.js";
export { ImmutableBigInt64HashBag } from "./bag/immutable_bigint64-hash-bag.js";

// ---- HashMap (mutable + immutable, 36 key×value pairs) ----
export { Int8Int8HashMap } from "./hashmap/int8-int8-hash-map.js";
export { ImmutableInt8Int8HashMap } from "./hashmap/immutable_int8-int8-hash-map.js";
export { Int8Int16HashMap } from "./hashmap/int8-int16-hash-map.js";
export { ImmutableInt8Int16HashMap } from "./hashmap/immutable_int8-int16-hash-map.js";
export { Int8Int32HashMap } from "./hashmap/int8-int32-hash-map.js";
export { ImmutableInt8Int32HashMap } from "./hashmap/immutable_int8-int32-hash-map.js";
export { Int8Float32HashMap } from "./hashmap/int8-float32-hash-map.js";
export { ImmutableInt8Float32HashMap } from "./hashmap/immutable_int8-float32-hash-map.js";
export { Int8Float64HashMap } from "./hashmap/int8-float64-hash-map.js";
export { ImmutableInt8Float64HashMap } from "./hashmap/immutable_int8-float64-hash-map.js";
export { Int8BigInt64HashMap } from "./hashmap/int8-bigint64-hash-map.js";
export { ImmutableInt8BigInt64HashMap } from "./hashmap/immutable_int8-bigint64-hash-map.js";
export { Int16Int8HashMap } from "./hashmap/int16-int8-hash-map.js";
export { ImmutableInt16Int8HashMap } from "./hashmap/immutable_int16-int8-hash-map.js";
export { Int16Int16HashMap } from "./hashmap/int16-int16-hash-map.js";
export { ImmutableInt16Int16HashMap } from "./hashmap/immutable_int16-int16-hash-map.js";
export { Int16Int32HashMap } from "./hashmap/int16-int32-hash-map.js";
export { ImmutableInt16Int32HashMap } from "./hashmap/immutable_int16-int32-hash-map.js";
export { Int16Float32HashMap } from "./hashmap/int16-float32-hash-map.js";
export { ImmutableInt16Float32HashMap } from "./hashmap/immutable_int16-float32-hash-map.js";
export { Int16Float64HashMap } from "./hashmap/int16-float64-hash-map.js";
export { ImmutableInt16Float64HashMap } from "./hashmap/immutable_int16-float64-hash-map.js";
export { Int16BigInt64HashMap } from "./hashmap/int16-bigint64-hash-map.js";
export { ImmutableInt16BigInt64HashMap } from "./hashmap/immutable_int16-bigint64-hash-map.js";
export { Int32Int8HashMap } from "./hashmap/int32-int8-hash-map.js";
export { ImmutableInt32Int8HashMap } from "./hashmap/immutable_int32-int8-hash-map.js";
export { Int32Int16HashMap } from "./hashmap/int32-int16-hash-map.js";
export { ImmutableInt32Int16HashMap } from "./hashmap/immutable_int32-int16-hash-map.js";
export { Int32Int32HashMap } from "./hashmap/int32-int32-hash-map.js";
export { ImmutableInt32Int32HashMap } from "./hashmap/immutable_int32-int32-hash-map.js";
export { Int32Float32HashMap } from "./hashmap/int32-float32-hash-map.js";
export { ImmutableInt32Float32HashMap } from "./hashmap/immutable_int32-float32-hash-map.js";
export { Int32Float64HashMap } from "./hashmap/int32-float64-hash-map.js";
export { ImmutableInt32Float64HashMap } from "./hashmap/immutable_int32-float64-hash-map.js";
export { Int32BigInt64HashMap } from "./hashmap/int32-bigint64-hash-map.js";
export { ImmutableInt32BigInt64HashMap } from "./hashmap/immutable_int32-bigint64-hash-map.js";
export { Float32Int8HashMap } from "./hashmap/float32-int8-hash-map.js";
export { ImmutableFloat32Int8HashMap } from "./hashmap/immutable_float32-int8-hash-map.js";
export { Float32Int16HashMap } from "./hashmap/float32-int16-hash-map.js";
export { ImmutableFloat32Int16HashMap } from "./hashmap/immutable_float32-int16-hash-map.js";
export { Float32Int32HashMap } from "./hashmap/float32-int32-hash-map.js";
export { ImmutableFloat32Int32HashMap } from "./hashmap/immutable_float32-int32-hash-map.js";
export { Float32Float32HashMap } from "./hashmap/float32-float32-hash-map.js";
export { ImmutableFloat32Float32HashMap } from "./hashmap/immutable_float32-float32-hash-map.js";
export { Float32Float64HashMap } from "./hashmap/float32-float64-hash-map.js";
export { ImmutableFloat32Float64HashMap } from "./hashmap/immutable_float32-float64-hash-map.js";
export { Float32BigInt64HashMap } from "./hashmap/float32-bigint64-hash-map.js";
export { ImmutableFloat32BigInt64HashMap } from "./hashmap/immutable_float32-bigint64-hash-map.js";
export { Float64Int8HashMap } from "./hashmap/float64-int8-hash-map.js";
export { ImmutableFloat64Int8HashMap } from "./hashmap/immutable_float64-int8-hash-map.js";
export { Float64Int16HashMap } from "./hashmap/float64-int16-hash-map.js";
export { ImmutableFloat64Int16HashMap } from "./hashmap/immutable_float64-int16-hash-map.js";
export { Float64Int32HashMap } from "./hashmap/float64-int32-hash-map.js";
export { ImmutableFloat64Int32HashMap } from "./hashmap/immutable_float64-int32-hash-map.js";
export { Float64Float32HashMap } from "./hashmap/float64-float32-hash-map.js";
export { ImmutableFloat64Float32HashMap } from "./hashmap/immutable_float64-float32-hash-map.js";
export { Float64Float64HashMap } from "./hashmap/float64-float64-hash-map.js";
export { ImmutableFloat64Float64HashMap } from "./hashmap/immutable_float64-float64-hash-map.js";
export { Float64BigInt64HashMap } from "./hashmap/float64-bigint64-hash-map.js";
export { ImmutableFloat64BigInt64HashMap } from "./hashmap/immutable_float64-bigint64-hash-map.js";
export { BigInt64Int8HashMap } from "./hashmap/bigint64-int8-hash-map.js";
export { ImmutableBigInt64Int8HashMap } from "./hashmap/immutable_bigint64-int8-hash-map.js";
export { BigInt64Int16HashMap } from "./hashmap/bigint64-int16-hash-map.js";
export { ImmutableBigInt64Int16HashMap } from "./hashmap/immutable_bigint64-int16-hash-map.js";
export { BigInt64Int32HashMap } from "./hashmap/bigint64-int32-hash-map.js";
export { ImmutableBigInt64Int32HashMap } from "./hashmap/immutable_bigint64-int32-hash-map.js";
export { BigInt64Float32HashMap } from "./hashmap/bigint64-float32-hash-map.js";
export { ImmutableBigInt64Float32HashMap } from "./hashmap/immutable_bigint64-float32-hash-map.js";
export { BigInt64Float64HashMap } from "./hashmap/bigint64-float64-hash-map.js";
export { ImmutableBigInt64Float64HashMap } from "./hashmap/immutable_bigint64-float64-hash-map.js";
export { BigInt64BigInt64HashMap } from "./hashmap/bigint64-bigint64-hash-map.js";
export { ImmutableBigInt64BigInt64HashMap } from "./hashmap/immutable_bigint64-bigint64-hash-map.js";
