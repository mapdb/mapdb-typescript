// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { RoaringU32 } from "./roaring-u32.js";

const hex = (u: Uint8Array): string =>
  "0x" + [...u].map((b) => b.toString(16).padStart(2, "0")).join("");

function build(values: number[]): RoaringU32 {
  return RoaringU32.fromValues(values.map((v) => v >>> 0));
}

describe("RoaringU32", () => {
  it("empty set", () => {
    const s = new RoaringU32();
    expect(s.isEmpty()).toBe(true);
    expect(s.cardinality()).toBe(0);
    expect(s.chunkCount()).toBe(0);
    expect(s.min()).toBeUndefined();
    expect(s.max()).toBeUndefined();
    expect(s.toSortedArray()).toEqual([]);
    expect(hex(s.serialize())).toBe("0x553052320100000000000000");
  });

  it("single element", () => {
    const s = build([42]);
    expect(s.cardinality()).toBe(1);
    expect(s.chunkCount()).toBe(1);
    expect(s.containerTypes()).toEqual(["array"]);
    expect(s.min()).toBe(42);
    expect(s.max()).toBe(42);
    const bytes = s.serialize();
    expect(bytes.length).toBe(12 + 6 + 2);
    expect([...bytes.slice(12)]).toEqual([
      0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x2a, 0x00,
    ]);
  });

  it("basic distinct chunks oracle", () => {
    const s = build([1, 70000, 140000, 200000]);
    expect(s.cardinality()).toBe(4);
    expect(s.chunkCount()).toBe(4);
    expect(s.containerTypes()).toEqual(["array", "array", "array", "array"]);
    expect(s.toSortedArray()).toEqual([1, 70000, 140000, 200000]);
    expect(hex(s.serialize())).toBe(
      "0x55305232010000000400000000000100000001000100010000007011020001000000e022030001000000400d",
    );
  });

  it("idempotent add / remove", () => {
    const s = build([5]);
    expect(s.add(5)).toBe(false);
    expect(s.add(6)).toBe(true);
    expect(s.remove(6)).toBe(true);
    expect(s.remove(6)).toBe(false);
    expect(s.remove(99)).toBe(false);
  });

  it("unsigned order with signed extremes", () => {
    const vals = [
      0x80000000, // i32 MIN
      0xffffffff, // i32 -1
      0,
      0x7fffffff, // i32 MAX
    ];
    const s = build(vals);
    // unsigned ascending, emitted as i32 reinterpret
    expect(s.toSortedArray().map((v) => v | 0)).toEqual([
      0, 2147483647, -2147483648, -1,
    ]);
    expect(s.min()! >>> 0).toBe(0);
    expect(s.max()! >>> 0).toBe(0xffffffff);
    // chunk highs unsigned ascending
    const bytes = s.serialize();
    const highs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const off = 12 + i * 8;
      highs.push(bytes[off] | (bytes[off + 1] << 8));
    }
    expect(highs).toEqual([0x0000, 0x7fff, 0x8000, 0xffff]);
  });

  it("threshold: 4096 is ARRAY, 4097 is first BITMAP", () => {
    const s = new RoaringU32();
    for (let v = 0; v < 4096; v++) s.add(v);
    expect(s.cardinality()).toBe(4096);
    expect(s.containerTypes()).toEqual(["array"]);
    s.add(4096);
    expect(s.cardinality()).toBe(4097);
    expect(s.containerTypes()).toEqual(["bitmap"]);
  });

  it("ARRAY -> BITMAP -> ARRAY yields identical bytes (history-independent)", () => {
    const grown = new RoaringU32();
    for (let v = 0; v <= 4096; v++) grown.add(v);
    expect(grown.containerTypes()).toEqual(["bitmap"]);
    grown.remove(4096);
    expect(grown.containerTypes()).toEqual(["array"]);

    const never = new RoaringU32();
    for (let v = 0; v < 4096; v++) never.add(v);
    expect(hex(grown.serialize())).toBe(hex(never.serialize()));
  });

  it("container type is a pure function of cardinality", () => {
    const a = new RoaringU32();
    for (let v = 0; v < 5000; v++) a.add(v);
    for (let v = 4096; v < 5000; v++) a.remove(v);
    const b = new RoaringU32();
    for (let v = 4095; v >= 0; v--) b.add(v);
    expect(a.containerTypes()).toEqual(["array"]);
    expect(hex(a.serialize())).toBe(hex(b.serialize()));
  });

  it("full chunk (65536) -> BITMAP, CARDINALITY_MINUS_1 == 0xFFFF, round-trips", () => {
    const s = new RoaringU32();
    for (let v = 0; v <= 65535; v++) s.add(v);
    expect(s.cardinality()).toBe(65536);
    expect(s.containerTypes()).toEqual(["bitmap"]);
    const bytes = s.serialize();
    expect([...bytes.slice(16, 18)]).toEqual([0xff, 0xff]);
    expect(bytes.length).toBe(12 + 6 + 8192);
    const back = RoaringU32.deserialize(bytes);
    expect(hex(back.serialize())).toBe(hex(bytes));
    expect(back.toSortedArray().length).toBe(65536);
  });

  it("bitmap word/bit order round-trips a sparse-in-dense pattern", () => {
    const s = new RoaringU32();
    for (let v = 0; v <= 4096; v++) s.add(v); // force BITMAP
    s.add(5000);
    s.add(9000);
    s.add(65535);
    expect(s.containerTypes()).toEqual(["bitmap"]);
    expect(s.contains(5000)).toBe(true);
    expect(s.contains(65535)).toBe(true);
    expect(s.contains(5001)).toBe(false);
    const back = RoaringU32.deserialize(s.serialize());
    expect(back.toSortedArray()).toEqual(s.toSortedArray());
    expect(hex(back.serialize())).toBe(hex(s.serialize()));
  });

  it("bitmap bit-boundary low keys (31/32/63/64/65535) survive round-trip", () => {
    // Pin the lane/bit math across the within-word (bit 31), word (bit 63), and
    // u64-word boundaries, plus the top low key. Force a BITMAP first so the
    // probes land in the bitmap container.
    const s = new RoaringU32();
    for (let v = 0; v <= 4096; v++) s.add(v);
    const probes = [31, 32, 63, 64, 65535];
    for (const p of probes) s.add(p);
    expect(s.containerTypes()).toEqual(["bitmap"]);
    for (const p of probes) expect(s.contains(p)).toBe(true);
    expect(s.contains(65534)).toBe(false);
    expect(s.max()).toBe(65535);
    const back = RoaringU32.deserialize(s.serialize());
    expect(back.toSortedArray()).toEqual(s.toSortedArray());
    expect(hex(back.serialize())).toBe(hex(s.serialize()));
  });

  it("rejects non-ascending / duplicate chunk-high keys", () => {
    const parts: number[] = [];
    const push16 = (v: number): void => parts.push(v & 0xff, (v >> 8) & 0xff);
    const push32 = (v: number): void =>
      parts.push(
        v & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >>> 24) & 0xff,
      );
    push32(0x32523055); // MAGIC
    push16(1); // VERSION
    push16(0); // RESERVED
    push32(2); // CHUNK_COUNT = 2
    // chunk 0: high 5, single-element ARRAY
    push16(5);
    parts.push(0x01, 0x00);
    push16(0); // card 1
    push16(0);
    // chunk 1: high 5 again (duplicate, not strictly ascending)
    push16(5);
    parts.push(0x01, 0x00);
    push16(0);
    push16(1);
    expect(() => RoaringU32.deserialize(new Uint8Array(parts))).toThrow();
  });

  it("drops empty chunks", () => {
    const s = build([100000, 5]);
    expect(s.chunkCount()).toBe(2);
    s.remove(100000);
    expect(s.chunkCount()).toBe(1);
    expect(hex(s.serialize())).toBe(hex(build([5]).serialize()));
  });

  it("set algebra: union/intersect/andNot/xor, operands unchanged", () => {
    const a = build([1, 2, 3, 70000]);
    const b = build([2, 3, 4, 140000]);
    expect(a.or(b).toSortedArray()).toEqual([1, 2, 3, 4, 70000, 140000]);
    expect(a.and(b).toSortedArray()).toEqual([2, 3]);
    expect(a.andNot(b).toSortedArray()).toEqual([1, 70000]);
    expect(a.xor(b).toSortedArray()).toEqual([1, 4, 70000, 140000]);
    expect(a.toSortedArray()).toEqual([1, 2, 3, 70000]); // unchanged
  });

  it("XOR of two near-identical BITMAPs normalizes to ARRAY", () => {
    const a = new RoaringU32();
    const b = new RoaringU32();
    for (let v = 0; v < 5000; v++) {
      a.add(v);
      b.add(v);
    }
    for (let v = 5000; v < 5030; v++) a.add(v);
    expect(a.containerTypes()).toEqual(["bitmap"]);
    const x = a.xor(b);
    expect(x.cardinality()).toBe(30);
    expect(x.containerTypes()).toEqual(["array"]);
  });

  it("OR of two ARRAYs whose union exceeds 4096 normalizes to BITMAP", () => {
    const a = build(Array.from({ length: 3000 }, (_, i) => i));
    const b = build(Array.from({ length: 4000 }, (_, i) => 2000 + i));
    expect(a.containerTypes()).toEqual(["array"]);
    const u = a.or(b);
    expect(u.cardinality()).toBe(6000);
    expect(u.containerTypes()).toEqual(["bitmap"]);
  });

  it("andNot fully covering a chunk drops it", () => {
    const a = build([1, 2, 70000, 70001]);
    const other = build([70000, 70001]);
    const d = a.andNot(other);
    expect(d.chunkCount()).toBe(1);
    expect(d.toSortedArray()).toEqual([1, 2]);
    expect(hex(d.serialize())).toBe(hex(build([1, 2]).serialize()));
  });

  it("set-algebra results are independent copies of operands", () => {
    const a = build([1, 2, 3]);
    const b = build([3, 4, 5]);
    const u = a.or(b);
    u.add(999);
    expect(a.contains(999)).toBe(false);
    expect(b.contains(999)).toBe(false);
  });

  it("serialize -> deserialize round-trip over a pseudo-random set", () => {
    const s = new RoaringU32();
    let x = 0x12345678 >>> 0;
    for (let n = 0; n < 20000; n++) {
      // xorshift32
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      s.add(x);
    }
    const bytes = s.serialize();
    const back = RoaringU32.deserialize(bytes);
    expect(back.toSortedArray()).toEqual(s.toSortedArray());
    expect(hex(back.serialize())).toBe(hex(bytes));
  });

  it("add_range / remove_range via helper loops", () => {
    const s = new RoaringU32();
    for (let v = 0; v <= 4095; v++) s.add(v);
    expect(s.cardinality()).toBe(4096);
    for (let v = 100; v <= 200; v++) s.remove(v);
    expect(s.cardinality()).toBe(4096 - 101);
  });

  // ---- deserialize rejections ----

  const validBytes = (): Uint8Array => build([1, 70000]).serialize();

  it("rejects bad MAGIC", () => {
    const b = validBytes();
    b[0] = 0x00;
    expect(() => RoaringU32.deserialize(b)).toThrow();
  });

  it("rejects bad VERSION", () => {
    const b = validBytes();
    b[4] = 0x02;
    expect(() => RoaringU32.deserialize(b)).toThrow();
  });

  it("rejects non-zero RESERVED", () => {
    const b = validBytes();
    b[6] = 0x01;
    expect(() => RoaringU32.deserialize(b)).toThrow();
  });

  it("rejects non-zero PAD", () => {
    const b = validBytes();
    b[15] = 0x01; // first chunk PAD at 12+2+1
    expect(() => RoaringU32.deserialize(b)).toThrow();
  });

  it("rejects unknown container tag", () => {
    const b = validBytes();
    b[14] = 0x03; // first chunk tag at 12+2
    expect(() => RoaringU32.deserialize(b)).toThrow();
  });

  it("rejects trailing bytes", () => {
    const b = validBytes();
    const c = new Uint8Array(b.length + 1);
    c.set(b);
    expect(() => RoaringU32.deserialize(c)).toThrow();
  });

  it("rejects truncated input", () => {
    const b = validBytes();
    expect(() => RoaringU32.deserialize(b.slice(0, b.length - 1))).toThrow();
    expect(() => RoaringU32.deserialize(b.slice(0, 5))).toThrow();
  });

  it("rejects CHUNK_COUNT > 65536", () => {
    const b = validBytes();
    new DataView(b.buffer, b.byteOffset).setUint32(8, 70000, true);
    expect(() => RoaringU32.deserialize(b)).toThrow();
  });

  it("rejects non-canonical ARRAY cardinality (4097)", () => {
    const parts: number[] = [];
    const push16 = (v: number): void => parts.push(v & 0xff, (v >> 8) & 0xff);
    const push32 = (v: number): void =>
      parts.push(
        v & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >>> 24) & 0xff,
      );
    push32(0x32523055); // MAGIC
    push16(1); // VERSION
    push16(0); // RESERVED
    push32(1); // CHUNK_COUNT
    push16(0); // high
    parts.push(0x01, 0x00); // ARRAY tag + pad
    push16(4096); // card-1 = 4096 -> card 4097 (> ARRAY_MAX)
    for (let low = 0; low < 4097; low++) push16(low);
    expect(() => RoaringU32.deserialize(new Uint8Array(parts))).toThrow();
  });

  it("rejects non-canonical BITMAP cardinality (1)", () => {
    const parts: number[] = [];
    const push16 = (v: number): void => parts.push(v & 0xff, (v >> 8) & 0xff);
    const push32 = (v: number): void =>
      parts.push(
        v & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >>> 24) & 0xff,
      );
    push32(0x32523055);
    push16(1);
    push16(0);
    push32(1);
    push16(0);
    parts.push(0x02, 0x00); // BITMAP tag + pad
    push16(0); // card 1 (<= ARRAY_MAX)
    // 1024 u64 words, with word 0 = bit 0 set
    push32(1);
    push32(0);
    for (let w = 1; w < 1024; w++) {
      push32(0);
      push32(0);
    }
    expect(() => RoaringU32.deserialize(new Uint8Array(parts))).toThrow();
  });

  it("rejects non-ascending ARRAY low keys", () => {
    const parts: number[] = [];
    const push16 = (v: number): void => parts.push(v & 0xff, (v >> 8) & 0xff);
    const push32 = (v: number): void =>
      parts.push(
        v & 0xff,
        (v >> 8) & 0xff,
        (v >> 16) & 0xff,
        (v >>> 24) & 0xff,
      );
    push32(0x32523055);
    push16(1);
    push16(0);
    push32(1);
    push16(0);
    parts.push(0x01, 0x00);
    push16(1); // card 2
    push16(5);
    push16(5); // duplicate -> non-ascending
    expect(() => RoaringU32.deserialize(new Uint8Array(parts))).toThrow();
  });

  it("rejects BITMAP popcount mismatch", () => {
    // Build a valid bitmap, then corrupt one word so popcount != stored card.
    const s = new RoaringU32();
    for (let v = 0; v <= 4096; v++) s.add(v);
    const b = s.serialize();
    // first bitmap word lane is at offset 12 + 6 = 18; flip a high bit there.
    b[18] ^= 0x01;
    expect(() => RoaringU32.deserialize(b)).toThrow();
  });
});
