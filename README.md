# @mapdb/typescript

High-performance primitive-specialized and generic collections for TypeScript, inspired by [Eclipse Collections](https://eclipse.dev/collections/).

## Why?

JavaScript's `Map` and `Set` are general-purpose but lack the rich functional API that Eclipse Collections provides. This library gives you:

- **Primitive-specialized types** (`NumberArrayList`, `NumberHashSet`, `Int32ArrayList`, etc.) optimized for numeric workloads
- **Generic object collections** (`ArrayList<T>`, `HashSet<T>`, `HashMap<K,V>`, etc.) with the full Eclipse Collections API
- **Lazy stream pipelines** with generators and collectors
- Full TypeScript type safety with strict interfaces

## Primitive Collections

| Type | Mutable | Immutable | Variants |
|------|---------|-----------|----------|
| **ArrayList** | `NumberArrayList`, `Int32ArrayList` | `ImmutableNumberArrayList`, `ImmutableInt32ArrayList` | number/bigint + typed arrays |
| **HashSet** | `NumberHashSet`, `Int32HashSet` | `ImmutableNumberHashSet`, `ImmutableInt32HashSet` | number/bigint + typed arrays |
| **HashBag** | `NumberHashBag`, `Int32HashBag` | `ImmutableNumberHashBag`, `ImmutableInt32HashBag` | number/bigint + typed arrays |
| **ArrayStack** | `NumberArrayStack` | `ImmutableNumberArrayStack` | number/bigint + typed arrays |
| **HashMap** | `NumberNumberHashMap`, `Int32BigInt64HashMap` | `ImmutableNumberNumberHashMap`, `ImmutableInt32BigInt64HashMap` | number/bigint + typed arrays |
| **TreeSet** | `NumberTreeSet` | — | number/bigint |
| **TreeMap** | `NumberNumberTreeMap` | — | number/bigint |
| **Pair** | `NumberNumberPair` | — | number/bigint |
| **Interval** | `NumberInterval` | — | range type |

## Object Collections

Generic collections backed by native JS `Map` and `Set`:

| Type | Description |
|------|-------------|
| `ArrayList<T>` | Ordered list backed by `Array<T>` |
| `HashSet<T>` | Unordered set backed by native `Set<T>` |
| `HashMap<K, V>` | Key-value map backed by native `Map<K, V>` |
| `HashBag<T>` | Counting bag backed by `Map<T, number>` |
| `ArrayStack<T>` | LIFO stack backed by `Array<T>` |
| `HashBiMap<K, V>` | Bidirectional map with unique keys and values |

## Quick Start

```typescript
import { NumberArrayList, object } from "@mapdb/typescript";
import { ArrayList, HashBag } from "@mapdb/typescript/object";

// Primitive ArrayList
const list = NumberArrayList.of([3, 1, 4, 1, 5]);
list.sort();
const big = list.select(v => v > 2); // [3, 4, 5]

// Root namespace export for object collections
const ordered = object.LinkedHashSet.of("a", "b", "a");

// Generic ArrayList
const names = ArrayList.of(["Alice", "Bob", "Charlie"]);
const found = names.detect(n => n.startsWith("B")); // "Bob"

// Generic HashBag
const bag = new HashBag<string>();
bag.add("apple");
bag.addOccurrences("apple", 3);
bag.occurrencesOf("apple"); // 4
```

## Stream API

```typescript
import { range } from "@mapdb/typescript/stream";

const squares = range(1, 6).map(x => x * x).toArray();
// [1, 4, 9, 16, 25]
```

## Stats

- **209 source files**, **2,550 tests** passing
- All 8 primitive types + generic object types
- Zero runtime dependencies
- Requires Node.js 18+ / TypeScript 5.0+
