// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

/**
 * `RoaringU32` — a sparse, compressed 32-bit integer set (a Roaring-style
 * bitmap). See `spec/features/roaring-u32.md`.
 *
 * The universe (`2^32` values) is split into `2^16` **chunks** keyed by the
 * high 16 bits of a value. Each non-empty chunk is stored as a **container**:
 * an ARRAY (sorted distinct `u16[]`) for cardinality `1..=4096`, or a BITMAP
 * (65536 bits) for cardinality `4097..=65536`. The container type is a **pure
 * function of the chunk's current cardinality** (history-independent), which
 * makes the serialized form canonical.
 *
 * Ordering is **UNSIGNED u32 ascending** throughout (iteration, `min`/`max`,
 * serialized chunk order). A JS `number` element is taken modulo `2^32` and
 * reinterpreted as an unsigned u32 (so `i32 -1` becomes `0xFFFFFFFF` and sorts
 * last). All internal value handling is unsigned via `>>> 0`.
 *
 * The BITMAP payload is stored as a `Uint32Array(2048)` of little-endian u32
 * lanes: lanes `2*w` / `2*w+1` are the low / high halves of serialized u64
 * word `w`, so bit `(w*64 + b)` lives at lane `2*w + (b >> 5)`, bit `b & 31`.
 * Writing the lanes in order reproduces the canonical u64-LE byte image exactly
 * without any 64-bit (BigInt) arithmetic.
 */

/** Cardinality at and below which a chunk is an ARRAY; above which BITMAP. */
const ARRAY_MAX = 4096;

/** A BITMAP container is `1024` u64 words == `2048` u32 lanes == `2^16` bits. */
const BITMAP_WORDS = 1024;
const BITMAP_LANES = BITMAP_WORDS * 2;

/** Serialized header magic: `0x32523055` (LE bytes `55 30 52 32`). */
const MAGIC = 0x32523055;
/** Serialized format version. */
const VERSION = 1;

const TAG_ARRAY = 0x01;
const TAG_BITMAP = 0x02;

/** Header byte length: MAGIC(4) + VERSION(2) + RESERVED(2) + CHUNK_COUNT(4). */
const HEADER_LEN = 12;

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

/**
 * A per-chunk container. The type is always canonical for the contained
 * cardinality (ARRAY for `1..=4096`, BITMAP for `4097..=65536`).
 *
 * - ARRAY: `array` holds sorted distinct low-16-bit keys (length == cardinality)
 *   and `words` is null.
 * - BITMAP: `words` is a `Uint32Array(2048)` lane image and `count` is the
 *   cached popcount; `array` is null.
 */
class Container {
  array: number[] | null;
  words: Uint32Array | null;
  count: number; // cardinality (== array.length for ARRAY, popcount for BITMAP)

  private constructor(
    array: number[] | null,
    words: Uint32Array | null,
    count: number,
  ) {
    this.array = array;
    this.words = words;
    this.count = count;
  }

  static array(lows: number[]): Container {
    return new Container(lows, null, lows.length);
  }

  static bitmapFromLows(lows: number[]): Container {
    const words = new Uint32Array(BITMAP_LANES);
    for (let i = 0; i < lows.length; i++) {
      const low = lows[i];
      const lane = (low >> 6) * 2 + ((low >> 5) & 1);
      words[lane] |= 1 << (low & 31);
    }
    return new Container(null, words, lows.length);
  }

  static bitmapFromWords(words: Uint32Array, count: number): Container {
    return new Container(null, words, count);
  }

  /** Canonical container for a sorted, distinct, non-empty low-key list. */
  static canonicalFromLows(lows: number[]): Container {
    return lows.length <= ARRAY_MAX
      ? Container.array(lows)
      : Container.bitmapFromLows(lows);
  }

  isBitmap(): boolean {
    return this.words !== null;
  }

  cardinality(): number {
    return this.count;
  }

  contains(low: number): boolean {
    if (this.array !== null) {
      return binarySearch(this.array, low) >= 0;
    }
    const lane = (low >> 6) * 2 + ((low >> 5) & 1);
    return (this.words![lane] & (1 << (low & 31))) !== 0;
  }

  /** Insert `low`; returns whether the container changed. */
  add(low: number): boolean {
    if (this.array !== null) {
      const idx = binarySearch(this.array, low);
      if (idx >= 0) return false;
      this.array.splice(-idx - 1, 0, low);
      this.count++;
      return true;
    }
    const lane = (low >> 6) * 2 + ((low >> 5) & 1);
    const bit = 1 << (low & 31);
    if ((this.words![lane] & bit) !== 0) return false;
    this.words![lane] |= bit;
    this.count++;
    return true;
  }

  /** Remove `low`; returns whether the container changed. */
  remove(low: number): boolean {
    if (this.array !== null) {
      const idx = binarySearch(this.array, low);
      if (idx < 0) return false;
      this.array.splice(idx, 1);
      this.count--;
      return true;
    }
    const lane = (low >> 6) * 2 + ((low >> 5) & 1);
    const bit = 1 << (low & 31);
    if ((this.words![lane] & bit) === 0) return false;
    this.words![lane] &= ~bit;
    this.count--;
    return true;
  }

  /** All present low keys in unsigned ascending order. */
  lows(): number[] {
    if (this.array !== null) return this.array.slice();
    const out: number[] = [];
    const words = this.words!;
    for (let lane = 0; lane < BITMAP_LANES; lane++) {
      let bits = words[lane] >>> 0;
      const base = (lane >> 1) * 64 + (lane & 1) * 32;
      while (bits !== 0) {
        const b = 31 - Math.clz32(bits & -bits);
        out.push(base + b);
        bits &= bits - 1;
      }
    }
    return out;
  }

  minLow(): number {
    if (this.array !== null) return this.array[0];
    const words = this.words!;
    for (let lane = 0; lane < BITMAP_LANES; lane++) {
      const bits = words[lane] >>> 0;
      if (bits !== 0) {
        const base = (lane >> 1) * 64 + (lane & 1) * 32;
        return base + (31 - Math.clz32(bits & -bits));
      }
    }
    throw new Error("non-empty bitmap has a set bit");
  }

  maxLow(): number {
    if (this.array !== null) return this.array[this.array.length - 1];
    const words = this.words!;
    for (let lane = BITMAP_LANES - 1; lane >= 0; lane--) {
      const bits = words[lane] >>> 0;
      if (bits !== 0) {
        const base = (lane >> 1) * 64 + (lane & 1) * 32;
        return base + (31 - Math.clz32(bits));
      }
    }
    throw new Error("non-empty bitmap has a set bit");
  }
}

/** Standard binary search: returns index if found, else `-(insertionPoint)-1`. */
function binarySearch(a: number[], target: number): number {
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = a[mid];
    if (v < target) lo = mid + 1;
    else if (v > target) hi = mid - 1;
    else return mid;
  }
  return -(lo + 1);
}

// ---------------------------------------------------------------------------
// Sorted low-key set algebra (operates on plain ascending u16 lists)
// ---------------------------------------------------------------------------

function sortedUnion(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) out.push(a[i++]);
    else if (a[i] > b[j]) out.push(b[j++]);
    else {
      out.push(a[i++]);
      j++;
    }
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

function sortedIntersect(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) i++;
    else if (a[i] > b[j]) j++;
    else {
      out.push(a[i++]);
      j++;
    }
  }
  return out;
}

function sortedAndNot(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) out.push(a[i++]);
    else if (a[i] > b[j]) j++;
    else {
      i++;
      j++;
    }
  }
  while (i < a.length) out.push(a[i++]);
  return out;
}

function sortedXor(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] < b[j]) out.push(a[i++]);
    else if (a[i] > b[j]) out.push(b[j++]);
    else {
      i++;
      j++;
    }
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}

// ---------------------------------------------------------------------------
// RoaringU32
// ---------------------------------------------------------------------------

interface Chunk {
  high: number; // u16
  container: Container;
}

const SPLIT_HIGH = (v: number): number => (v >>> 16) & 0xffff;
const SPLIT_LOW = (v: number): number => v & 0xffff;
const JOIN = (high: number, low: number): number =>
  (((high << 16) >>> 0) | low) >>> 0;

export class RoaringU32 {
  /** Non-empty chunks in unsigned high-key ascending order (strictly). */
  private chunks: Chunk[] = [];

  /** An empty set. */
  constructor() {}

  /** Build a set from an iterable of values (each taken as u32). */
  static fromValues(values: Iterable<number>): RoaringU32 {
    const s = new RoaringU32();
    for (const v of values) s.add(v);
    return s;
  }

  /**
   * Locate the chunk index for `high`. Returns the index if present, else
   * `-(insertionPoint)-1` preserving ascending order.
   */
  private find(high: number): number {
    let lo = 0;
    let hi = this.chunks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const h = this.chunks[mid].high;
      if (h < high) lo = mid + 1;
      else if (h > high) hi = mid - 1;
      else return mid;
    }
    return -(lo + 1);
  }

  /** Insert `value` (taken as u32). Returns whether the set changed. */
  add(value: number): boolean {
    const v = value >>> 0;
    const high = SPLIT_HIGH(v);
    const low = SPLIT_LOW(v);
    const idx = this.find(high);
    if (idx >= 0) {
      const chunk = this.chunks[idx];
      const changed = chunk.container.add(low);
      if (
        changed &&
        !chunk.container.isBitmap() &&
        chunk.container.cardinality() > ARRAY_MAX
      ) {
        // ARRAY -> BITMAP up-conversion at cardinality 4097.
        chunk.container = Container.bitmapFromLows(chunk.container.lows());
      }
      return changed;
    }
    this.chunks.splice(-idx - 1, 0, {
      high,
      container: Container.array([low]),
    });
    return true;
  }

  /** Remove `value` (taken as u32). Returns whether the set changed. */
  remove(value: number): boolean {
    const v = value >>> 0;
    const high = SPLIT_HIGH(v);
    const low = SPLIT_LOW(v);
    const idx = this.find(high);
    if (idx < 0) return false;
    const chunk = this.chunks[idx];
    if (!chunk.container.remove(low)) return false;
    const card = chunk.container.cardinality();
    if (card === 0) {
      // Empty-chunk normalization: drop the chunk entirely.
      this.chunks.splice(idx, 1);
    } else if (card <= ARRAY_MAX && chunk.container.isBitmap()) {
      // BITMAP -> ARRAY down-conversion at cardinality 4096.
      chunk.container = Container.array(chunk.container.lows());
    }
    return true;
  }

  /** Whether `value` (taken as u32) is present. */
  contains(value: number): boolean {
    const v = value >>> 0;
    const idx = this.find(SPLIT_HIGH(v));
    return idx >= 0 && this.chunks[idx].container.contains(SPLIT_LOW(v));
  }

  /** Logical cardinality (exact up to `2^32`, within f64's safe range). */
  cardinality(): number {
    let total = 0;
    for (const c of this.chunks) total += c.container.cardinality();
    return total;
  }

  /** Whether the set is empty. */
  isEmpty(): boolean {
    return this.chunks.length === 0;
  }

  /** Remove all values (canonical empty set). */
  clear(): void {
    this.chunks = [];
  }

  /** Number of non-empty chunks (the serialized `CHUNK_COUNT`). */
  chunkCount(): number {
    return this.chunks.length;
  }

  /** Unsigned minimum present value (u32), or `undefined` if empty. */
  min(): number | undefined {
    if (this.chunks.length === 0) return undefined;
    const c = this.chunks[0];
    return JOIN(c.high, c.container.minLow());
  }

  /** Unsigned maximum present value (u32), or `undefined` if empty. */
  max(): number | undefined {
    if (this.chunks.length === 0) return undefined;
    const c = this.chunks[this.chunks.length - 1];
    return JOIN(c.high, c.container.maxLow());
  }

  /** All values (as u32) in unsigned u32 ascending order. */
  toSortedArray(): number[] {
    const out: number[] = [];
    for (const c of this.chunks) {
      const lows = c.container.lows();
      for (let i = 0; i < lows.length; i++) {
        out.push(JOIN(c.high, lows[i]));
      }
    }
    return out;
  }

  /** Iterate values (as u32) in unsigned u32 ascending order. */
  *[Symbol.iterator](): IterableIterator<number> {
    for (const c of this.chunks) {
      const lows = c.container.lows();
      for (let i = 0; i < lows.length; i++) {
        yield JOIN(c.high, lows[i]);
      }
    }
  }

  /** Per-chunk container-type tags in chunk order (`"array"` / `"bitmap"`). */
  containerTypes(): string[] {
    return this.chunks.map((c) =>
      c.container.isBitmap() ? "bitmap" : "array",
    );
  }

  // ---- Set algebra (container-granularity, scalar) ---------------------

  /**
   * Generic chunk-merge driver. `merge` combines two same-high containers into
   * a low-key list; `keepA`/`keepB` decide whether an only-in-A / only-in-B
   * chunk contributes a rebuilt (canonical) copy. The result is a new
   * independent set with empty chunks dropped.
   */
  private combine(
    other: RoaringU32,
    keepA: boolean,
    keepB: boolean,
    merge: (a: Container, b: Container) => number[],
  ): RoaringU32 {
    const out = new RoaringU32();
    const chunks = out.chunks;
    const A = this.chunks;
    const B = other.chunks;
    let i = 0;
    let j = 0;
    while (i < A.length && j < B.length) {
      const ha = A[i].high;
      const hb = B[j].high;
      if (ha < hb) {
        if (keepA) {
          chunks.push({
            high: ha,
            container: Container.canonicalFromLows(A[i].container.lows()),
          });
        }
        i++;
      } else if (ha > hb) {
        if (keepB) {
          chunks.push({
            high: hb,
            container: Container.canonicalFromLows(B[j].container.lows()),
          });
        }
        j++;
      } else {
        const lows = merge(A[i].container, B[j].container);
        if (lows.length > 0) {
          chunks.push({
            high: ha,
            container: Container.canonicalFromLows(lows),
          });
        }
        i++;
        j++;
      }
    }
    if (keepA) {
      for (; i < A.length; i++) {
        chunks.push({
          high: A[i].high,
          container: Container.canonicalFromLows(A[i].container.lows()),
        });
      }
    }
    if (keepB) {
      for (; j < B.length; j++) {
        chunks.push({
          high: B[j].high,
          container: Container.canonicalFromLows(B[j].container.lows()),
        });
      }
    }
    return out;
  }

  /** Union (`v ∈ A` or `v ∈ B`). */
  or(other: RoaringU32): RoaringU32 {
    return this.combine(other, true, true, (a, b) =>
      sortedUnion(a.lows(), b.lows()),
    );
  }

  /** Intersection (`v ∈ A` and `v ∈ B`). */
  and(other: RoaringU32): RoaringU32 {
    return this.combine(other, false, false, (a, b) =>
      sortedIntersect(a.lows(), b.lows()),
    );
  }

  /** Difference (`v ∈ A` and `v ∉ B`; asymmetric `A \ B`). */
  andNot(other: RoaringU32): RoaringU32 {
    return this.combine(other, true, false, (a, b) =>
      sortedAndNot(a.lows(), b.lows()),
    );
  }

  /** Symmetric difference (exactly one of `A`, `B`). */
  xor(other: RoaringU32): RoaringU32 {
    return this.combine(other, true, true, (a, b) =>
      sortedXor(a.lows(), b.lows()),
    );
  }

  // ---- Serialization (little-endian, canonical) ------------------------

  /** Serialize to the canonical little-endian v1 byte image. */
  serialize(): Uint8Array {
    // Compute total length.
    let len = HEADER_LEN;
    for (const c of this.chunks) {
      // high(2) + tag(1) + pad(1) + card-1(2)
      len += 6;
      len += c.container.isBitmap()
        ? BITMAP_WORDS * 8
        : c.container.cardinality() * 2;
    }
    const out = new Uint8Array(len);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, MAGIC, true);
    dv.setUint16(4, VERSION, true);
    dv.setUint16(6, 0, true); // RESERVED
    dv.setUint32(8, this.chunks.length, true);
    let off = HEADER_LEN;
    for (const c of this.chunks) {
      dv.setUint16(off, c.high, true);
      off += 2;
      const card = c.container.cardinality();
      if (c.container.isBitmap()) {
        out[off++] = TAG_BITMAP;
        out[off++] = 0; // PAD
        dv.setUint16(off, (card - 1) & 0xffff, true);
        off += 2;
        const words = c.container.words!;
        for (let lane = 0; lane < BITMAP_LANES; lane++) {
          dv.setUint32(off, words[lane], true);
          off += 4;
        }
      } else {
        out[off++] = TAG_ARRAY;
        out[off++] = 0; // PAD
        dv.setUint16(off, (card - 1) & 0xffff, true);
        off += 2;
        const arr = c.container.array!;
        for (let k = 0; k < arr.length; k++) {
          dv.setUint16(off, arr[k], true);
          off += 2;
        }
      }
    }
    return out;
  }

  /**
   * Deserialize a canonical v1 byte image. Throws on any non-canonical /
   * corrupt / foreign image (see the spec reader-MUST-reject rules).
   */
  static deserialize(bytes: Uint8Array): RoaringU32 {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 0;
    const need = (n: number): void => {
      if (pos + n > bytes.length) {
        throw new Error(
          `truncated: need ${n} bytes at offset ${pos}, have ${bytes.length - pos}`,
        );
      }
    };
    const u8 = (): number => {
      need(1);
      return dv.getUint8(pos++);
    };
    const u16 = (): number => {
      need(2);
      const v = dv.getUint16(pos, true);
      pos += 2;
      return v;
    };
    const u32 = (): number => {
      need(4);
      const v = dv.getUint32(pos, true);
      pos += 4;
      return v >>> 0;
    };

    const magic = u32();
    if (magic !== MAGIC) {
      throw new Error(`bad MAGIC: 0x${magic.toString(16).padStart(8, "0")}`);
    }
    const version = u16();
    if (version !== VERSION) {
      throw new Error(`unsupported VERSION: ${version}`);
    }
    const reserved = u16();
    if (reserved !== 0) {
      throw new Error(`non-zero RESERVED: ${reserved}`);
    }
    const chunkCount = u32();
    if (chunkCount > 65536) {
      throw new Error(`CHUNK_COUNT > 65536: ${chunkCount}`);
    }

    const result = new RoaringU32();
    let prevHigh = -1;
    for (let n = 0; n < chunkCount; n++) {
      const high = u16();
      if (high <= prevHigh) {
        throw new Error(
          `non-ascending or duplicate high key: ${high} after ${prevHigh}`,
        );
      }
      prevHigh = high;
      const tag = u8();
      const pad = u8();
      if (pad !== 0) {
        throw new Error(`non-zero PAD: ${pad}`);
      }
      const card = u16() + 1; // CARDINALITY_MINUS_1 + 1
      if (tag === TAG_ARRAY) {
        if (card > ARRAY_MAX) {
          throw new Error(
            `non-canonical ARRAY cardinality ${card} (> ${ARRAY_MAX})`,
          );
        }
        const lows: number[] = new Array(card);
        let prev = -1;
        for (let k = 0; k < card; k++) {
          const low = u16();
          if (low <= prev) {
            throw new Error(
              `non-ascending or duplicate ARRAY low key: ${low} after ${prev}`,
            );
          }
          prev = low;
          lows[k] = low;
        }
        result.chunks.push({ high, container: Container.array(lows) });
      } else if (tag === TAG_BITMAP) {
        if (card <= ARRAY_MAX) {
          throw new Error(
            `non-canonical BITMAP cardinality ${card} (<= ${ARRAY_MAX})`,
          );
        }
        const words = new Uint32Array(BITMAP_LANES);
        let popcount = 0;
        for (let lane = 0; lane < BITMAP_LANES; lane++) {
          const w = u32();
          popcount += popcount32(w);
          words[lane] = w;
        }
        if (popcount !== card) {
          throw new Error(
            `BITMAP popcount ${popcount} != stored cardinality ${card}`,
          );
        }
        result.chunks.push({
          high,
          container: Container.bitmapFromWords(words, card),
        });
      } else {
        throw new Error(
          `unknown CONTAINER_TYPE tag: 0x${tag.toString(16).padStart(2, "0")}`,
        );
      }
    }
    if (pos !== bytes.length) {
      throw new Error(
        `${bytes.length - pos} trailing bytes after chunk records`,
      );
    }
    return result;
  }
}

/** Population count of a 32-bit word. */
function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return (Math.imul(x, 0x01010101) >>> 24) & 0xff;
}
