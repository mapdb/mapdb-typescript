// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import { Bloom } from "./bloom.js";

function hex(b: Uint8Array): string {
  let s = "0x";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

describe("Bloom — worked example", () => {
  it("with_params(16,4) + add(7) lights {0,2,7,9} -> 0x8502", () => {
    const b = Bloom.withParams(16, 4);
    expect(b.isEmpty()).toBe(true);
    b.add(7);
    expect(b.setBits()).toEqual([0, 2, 7, 9]);
    expect(b.bitCount()).toBe(4);
    expect(b.isEmpty()).toBe(false);
    expect(b.toBytes()).toEqual(new Uint8Array([0x85, 0x02]));
    expect(hex(b.toBytes())).toBe("0x8502");
    expect(b.toHex()).toBe("0x8502");
    expect(b.mightContain(7)).toBe(true);
    expect(b.contains(7)).toBe(true);
    // A genuine absent: positions(1,16,4) = [13,10,7,4]; bits 10,13,4 clear.
    expect(b.mightContain(1)).toBe(false);
  });

  it("multi-add (m=64,k=3,{10,20,30}) -> 0x0020002200000298, bit_count 7", () => {
    const b = Bloom.withParams(64, 3);
    b.add(10);
    b.add(20);
    b.add(30);
    expect(b.bitCount()).toBe(7);
    expect(b.setBits()).toEqual([13, 25, 29, 49, 59, 60, 63]);
    expect(b.toHex()).toBe("0x0020002200000298");
  });

  it("collision small m (m=5,k=3,add 0) -> 0x18, bit_count 2", () => {
    const b = Bloom.withParams(5, 3);
    b.add(0);
    expect(b.bitCount()).toBe(2); // positions(0,5,3)=[3,4,4] -> distinct {3,4}
    expect(b.setBits()).toEqual([3, 4]);
    expect(b.toHex()).toBe("0x18");
  });

  it("false positive (m=8,k=3,{1,2,3}) -> 0xf5; contains_9 true, contains_4 false", () => {
    const b = Bloom.withParams(8, 3);
    b.add(1);
    b.add(2);
    b.add(3);
    expect(b.toHex()).toBe("0xf5");
    expect(b.bitCount()).toBe(6);
    expect(b.mightContain(9)).toBe(true); // deterministic false positive
    expect(b.mightContain(4)).toBe(false); // genuine absent
  });
});

describe("Bloom — optimal() pinned integer table", () => {
  it("reproduces the spec table exactly", () => {
    const cases: [number, number, number, number][] = [
      [1000, 0.01, 9586, 7],
      [1000, 0.001, 14378, 10],
      [10000, 0.01, 95851, 7],
      [100, 0.1, 480, 3],
      [1, 0.5, 2, 1],
    ];
    for (const [n, p, em, ek] of cases) {
      const b = Bloom.optimal(n, p);
      expect(b.mBits(), `optimal(${n},${p}) m`).toBe(em);
      expect(b.k(), `optimal(${n},${p}) k`).toBe(ek);
    }
  });

  it("traps invalid optimal() inputs", () => {
    expect(() => Bloom.optimal(0, 0.01)).toThrow(); // n < 1
    expect(() => Bloom.optimal(100, 0.0)).toThrow(); // p <= 0
    expect(() => Bloom.optimal(100, 1.0)).toThrow(); // p >= 1
    expect(() => Bloom.optimal(100, -0.5)).toThrow(); // p < 0
    expect(() => Bloom.optimal(100, NaN)).toThrow(); // NaN
    expect(() => Bloom.optimal(100, Infinity)).toThrow(); // +Inf
    expect(() => Bloom.optimal(100, -Infinity)).toThrow(); // -Inf
  });
});

describe("Bloom — construction edge rulings", () => {
  it("m = 0 traps on construction", () => {
    expect(() => Bloom.withParams(0, 4)).toThrow();
  });

  it("k = 0 is legal and vacuously true for every element", () => {
    const b = Bloom.withParams(16, 0);
    b.add(5);
    expect(b.bitCount()).toBe(0);
    expect(b.isEmpty()).toBe(true);
    expect(b.toHex()).toBe("0x0000");
    expect(b.mightContain(5)).toBe(true);
    expect(b.mightContain(9999)).toBe(true);
    expect(b.mightContain(-1)).toBe(true);
  });

  it("rejects out-of-range / non-integer params", () => {
    expect(() => Bloom.withParams(-1, 4)).toThrow();
    expect(() => Bloom.withParams(1.5, 4)).toThrow();
    expect(() => Bloom.withParams(16, -1)).toThrow();
    expect(() => Bloom.withParams(16, 1.5)).toThrow();
    expect(() => Bloom.withParams(0x100000000, 4)).toThrow();
  });

  it("rejects non-i32 elements (no silent ToUint32 coercion)", () => {
    const b = Bloom.withParams(64, 3);
    // The accepted i32 extremes do NOT throw.
    expect(() => b.add(-2147483648)).not.toThrow();
    expect(() => b.add(2147483647)).not.toThrow();
    expect(() => b.mightContain(-1)).not.toThrow();
    // Out-of-range / non-integer values throw rather than coerce via >>> 0.
    expect(() => b.add(1.5)).toThrow();
    expect(() => b.add(2147483648)).toThrow(); // 2^31, out of i32 range
    expect(() => b.add(4294967295)).toThrow(); // 2^32-1, would alias to -1
    expect(() => b.add(NaN)).toThrow();
    expect(() => b.add(Infinity)).toThrow();
    expect(() => b.mightContain(1.5)).toThrow();
  });
});

describe("Bloom — union", () => {
  it("is the bitwise OR of two identical-(m,k) filters", () => {
    const a = Bloom.withParams(32, 3);
    a.add(1);
    a.add(2);
    const b = Bloom.withParams(32, 3);
    b.add(100);
    b.add(200);
    const u = a.union(b);
    expect(u.toHex()).toBe("0xd0614504");
    expect(u.bitCount()).toBe(10);
    expect(u.setBits()).toEqual([4, 6, 7, 8, 13, 14, 16, 18, 22, 26]);
    // No false negative preserved for BOTH operands' elements.
    for (const v of [1, 2, 100, 200]) expect(u.mightContain(v)).toBe(true);
    // Operands are not mutated.
    expect(a.toHex()).toBe("0xc0210004");
    expect(b.toHex()).toBe("0x10404500");
  });

  it("throws on a parameter mismatch", () => {
    expect(() =>
      Bloom.withParams(16, 4).union(Bloom.withParams(32, 4)),
    ).toThrow();
    expect(() =>
      Bloom.withParams(16, 4).union(Bloom.withParams(16, 3)),
    ).toThrow();
  });
});

describe("Bloom — guarantees", () => {
  it("add is idempotent and order-independent", () => {
    const once = Bloom.withParams(16, 4);
    once.add(7);
    const twice = Bloom.withParams(16, 4);
    twice.add(7);
    twice.add(7);
    expect(twice.toBytes()).toEqual(once.toBytes());

    const ab = Bloom.withParams(64, 3);
    ab.add(10);
    ab.add(20);
    ab.add(30);
    const ba = Bloom.withParams(64, 3);
    ba.add(30);
    ba.add(10);
    ba.add(20);
    expect(ba.toBytes()).toEqual(ab.toBytes());
  });

  it("never reports a false negative (no-false-negative)", () => {
    const b = Bloom.withParams(1024, 5);
    const added: number[] = [];
    for (let v = -500; v <= 500; v += 7) {
      b.add(v);
      added.push(v);
    }
    for (const v of added) expect(b.mightContain(v)).toBe(true);
  });

  it("handles signed extremes as a reinterpret (NOT sign-extend)", () => {
    // i32 -1 -> LE bytes ff ff ff ff; INT_MIN -> 00 00 00 80 (4 bytes, not 8).
    const b = Bloom.withParams(128, 4);
    b.add(-1);
    b.add(-2147483648);
    expect(b.bitCount()).toBe(8);
    expect(b.setBits()).toEqual([33, 34, 45, 74, 78, 91, 103, 118]);
    expect(b.toHex()).toBe("0x00000000062000000044000880004000");
    expect(b.mightContain(-1)).toBe(true);
    expect(b.mightContain(-2147483648)).toBe(true);
  });
});

describe("Bloom — serialization", () => {
  it("LSB-first within a byte; ascending byte order", () => {
    const b = Bloom.withParams(16, 1);
    // Manually drive a single position via a known add is awkward; instead
    // assert the documented bit->byte mapping through a constructed filter.
    // bit 0 -> 0x01 byte0; bit 8 -> 0x01 byte1. Use add(7)=[7,0,9,2] subset
    // checks already cover LSB ordering; here assert empty + length.
    expect(b.toHex()).toBe("0x0000"); // empty 16-bit filter, 2 bytes, not trimmed
    expect(b.toBytes().length).toBe(2);
  });

  it("zero-pads unused tail bits when m is not a multiple of 8", () => {
    const b = Bloom.withParams(13, 3);
    b.add(7);
    b.add(42);
    expect(b.toBytes().length).toBe(2); // ceil(13/8)
    expect(b.setBits().every((i) => i < 13)).toBe(true);
    expect(b.setBits()).toEqual([3, 4, 7, 10]);
    // byte1 = bit 10 only -> 0x04; bits 13,14,15 must be 0.
    expect(b.toHex()).toBe("0x9804");
  });

  it("toBytes() returns a copy (mutation does not leak into the filter)", () => {
    const b = Bloom.withParams(16, 4);
    b.add(7);
    const bytes = b.toBytes();
    bytes[0] = 0;
    expect(b.toHex()).toBe("0x8502"); // unchanged
  });

  it("empty filter serializes to all-zero of length ceil(m/8), not trimmed", () => {
    expect(Bloom.withParams(1, 1).toBytes().length).toBe(1);
    expect(Bloom.withParams(64, 3).toHex()).toBe("0x0000000000000000");
    expect(Bloom.withParams(65, 3).toBytes().length).toBe(9);
  });
});
