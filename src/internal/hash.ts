// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * Folds the high 32 bits of a 64-bit integer key into the low 32 bits
 * (`(key ^ (key >> 32)) & 0xffffffff`), matching the i64 hash spread used by
 * the Go and Zig ports. Returns an unsigned JS number in the range
 * `0 .. 2^32 - 1` that callers then mix and mask into a bucket index.
 */
export function bigintHashSeed(key: bigint): number {
  return Number((key ^ (key >> 32n)) & 0xffffffffn);
}
