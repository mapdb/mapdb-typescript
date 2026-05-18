// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

export { ArrayList } from "./arraylist.js";
export { HashSet } from "./hashset.js";
export { HashMap } from "./hashmap.js";
export { HashBag } from "./hashbag.js";
export type { OccurrencePair } from "./hashbag.js";
export { ArrayStack } from "./arraystack.js";
export { HashBiMap } from "./hashbimap.js";
export { LinkedHashMap } from "./linkedhashmap.js";
export { LinkedHashSet } from "./linkedhashset.js";
export type { HashingStrategy, Comparator } from "./strategy.js";
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
} from "./strategy.js";
export { HashSetWithStrategy } from "./strategy-hashset.js";
export { HashMapWithStrategy } from "./strategy-hashmap.js";
export { TreeMap } from "./treemap.js";
export { TreeSet } from "./treeset.js";
