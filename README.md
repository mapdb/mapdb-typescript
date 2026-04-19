# @mapdb/typescript

High-performance primitive-specialized and generic collections for TypeScript, inspired by [Eclipse Collections](https://eclipse.dev/collections/).

## Why?

JavaScript's `Map` and `Set` are general-purpose but lack the rich functional API that Eclipse Collections provides. This library gives you:

- **Primitive-specialized types** (`I32ArrayList`, `I32HashSet`, `I32I64HashMap`, etc.) optimized for numeric workloads
- **Generic object collections** (`ArrayList<T>`, `HashSet<T>`, `HashMap<K,V>`, etc.) with the full Eclipse Collections API
- **Lazy stream pipelines** with generators and collectors
- Full TypeScript type safety with strict interfaces

## Primitive Collections

| Type | Mutable | Immutable | Variants |
|------|---------|-----------|----------|
| **ArrayList** | `I32ArrayList` | `ImmutableI32ArrayList` | 8 types |
| **HashSet** | `I32HashSet` | `ImmutableI32HashSet` | 8 types |
| **HashBag** | `I32HashBag` | `ImmutableI32HashBag` | 8 types |
| **ArrayStack** | `I32ArrayStack` | `ImmutableI32ArrayStack` | 8 types |
| **HashMap** | `I32I64HashMap` | `ImmutableI32I64HashMap` | 64 pairs |
| **TreeSet** | `I32TreeSet` | — | 8 types |
| **TreeMap** | `I32I64TreeMap` | — | 64 pairs |
| **TreeBag** | `I32TreeBag` | — | 8 types |
| **Pair** | `I32I64Pair` | — | 64 pairs |
| **Interval** | `I32Interval` | — | range type |

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
import { I32ArrayList } from "@mapdb/typescript";
import { ArrayList, HashBag } from "@mapdb/typescript/object";

// Primitive ArrayList
const list = I32ArrayList.of([3, 1, 4, 1, 5]);
list.sort();
const big = list.select(v => v > 2); // [3, 4, 5]

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

- **223 source files**, **1,000 tests** passing
- All 8 primitive types + generic object types
- Zero runtime dependencies
- Requires Node.js 18+ / TypeScript 5.0+
