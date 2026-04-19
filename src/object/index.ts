// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

export { ArrayList } from "./arraylist";
export { HashSet } from "./hashset";
export { HashMap } from "./hashmap";
export { HashBag } from "./hashbag";
export type { OccurrencePair } from "./hashbag";
export { ArrayStack } from "./arraystack";
export { HashBiMap } from "./hashbimap";
export { LinkedHashMap } from "./linkedhashmap";
export { LinkedHashSet } from "./linkedhashset";
export type { HashingStrategy, Comparator } from "./strategy";
export {
  stringHashingStrategy,
  caseInsensitiveHashingStrategy,
  byFieldHashingStrategy,
  naturalComparator,
  reverseComparator,
  comparatorByField,
  thenComparing,
  reversed,
  comparatorByFieldWith,
} from "./strategy";
export { HashSetWithStrategy } from "./strategy-hashset";
export { HashMapWithStrategy } from "./strategy-hashmap";
export { TreeMap } from "./treemap";
export { TreeSet } from "./treeset";
