// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import {
  HyperLogLog,
  HllError,
  MIN_PRECISION,
  MAX_PRECISION,
} from "./hyper-log-log.js";
import { type U64, hash64, encodeI32Word64 } from "../hash/hash.js";

// ---- Independent oracle (re-derives (idx, rho) without the implementation) --

function clz32(x: number): number {
  return Math.clz32(x >>> 0);
}
function clz64(x: U64): number {
  return x.hi === 0 ? 32 + clz32(x.lo) : clz32(x.hi);
}
function shl64(h: U64, s: number): U64 {
  if (s === 0) return { hi: h.hi >>> 0, lo: h.lo >>> 0 };
  if (s < 32) {
    return {
      hi: ((h.hi << s) | (h.lo >>> (32 - s))) >>> 0,
      lo: (h.lo << s) >>> 0,
    };
  }
  return { hi: (h.lo << (s - 32)) >>> 0, lo: 0 };
}

/** Recompute the expected (idx, rho) for an i32 item, independent of the impl. */
function expectedSplit(item: number, p: number): [number, number] {
  const x = hash64(encodeI32Word64(item | 0), { hi: 0, lo: 0 });
  const idx = (x.hi >>> (32 - p)) >>> 0;
  const w = shl64(x, p);
  const guardLo = (1 << (p - 1)) >>> 0;
  const wGuarded: U64 = { hi: w.hi, lo: (w.lo | guardLo) >>> 0 };
  return [idx, clz64(wGuarded) + 1];
}

function toHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

const rhoCeiling = (p: number): number => 64 - p + 1;

// ---- Construction & p-range ------------------------------------------------

describe("HyperLogLog construction", () => {
  it("allocates m registers, all zero", () => {
    for (let p = MIN_PRECISION; p <= MAX_PRECISION; p++) {
      const h = HyperLogLog.withPrecision(p);
      expect(h.registerCount()).toBe(1 << p);
      expect(h.registers().every((r) => r === 0)).toBe(true);
      expect(h.nonzeroRegisters()).toBe(0);
      expect(h.maxRegister()).toBe(0);
      expect(h.precision()).toBe(p);
    }
  });

  it("p out of range throws (never clamps)", () => {
    for (const p of [3, 19, 0, 255, -1, 4.5]) {
      expect(() => HyperLogLog.withPrecision(p)).toThrow(HllError);
    }
  });
});

// ---- rho / clz64 / guard-bit exactness -------------------------------------

describe("rho / clz64 lane correctness", () => {
  it("clz64 picks the high lane when hi != 0, else low lane", () => {
    // hi != 0: run is clz32(hi).
    expect(clz64({ hi: 0x80000000, lo: 0 })).toBe(0);
    expect(clz64({ hi: 1, lo: 0 })).toBe(31);
    // hi == 0: run is 32 + clz32(lo).
    expect(clz64({ hi: 0, lo: 0x80000000 })).toBe(32);
    expect(clz64({ hi: 0, lo: 1 })).toBe(63);
    // all-zero => 64 (the guard bit makes this unreachable in split()).
    expect(clz64({ hi: 0, lo: 0 })).toBe(64);
  });

  it("all-zero-remainder gives the per-p max rho via the guard bit", () => {
    // add(0): hash64(0,0) = (0,0). The remaining 64-p bits are all zero, so the
    // guard bit at p-1 pins rho = 64-p+1 at idx 0.
    for (const p of [4, 7, 14, 18]) {
      const h = HyperLogLog.withPrecision(p);
      h.add(0);
      const [idx, rho] = expectedSplit(0, p);
      expect(idx).toBe(0);
      expect(rho).toBe(rhoCeiling(p));
      expect(h.registers()[0]).toBe(rhoCeiling(p));
      expect(h.maxRegister()).toBe(rhoCeiling(p));
    }
  });

  it("idx = hi >>> (32 - p): top p bits all-ones at boundary", () => {
    // Craft a hash whose top p bits are all 1: cannot do directly through add,
    // so verify the extraction formula against an all-ones hi lane.
    for (const p of [4, 10, 18]) {
      const idx = (0xffffffff >>> (32 - p)) >>> 0;
      expect(idx).toBe((1 << p) - 1);
    }
  });

  it("rho stays within [1, 64-p+1] across many items", () => {
    for (const p of [4, 8, 14, 18]) {
      for (let item = 0; item < 1000; item++) {
        const [idx, rho] = expectedSplit(item, p);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(1 << p);
        expect(rho).toBeGreaterThanOrEqual(1);
        expect(rho).toBeLessThanOrEqual(rhoCeiling(p));
      }
    }
  });
});

// ---- register max-update & determinism -------------------------------------

describe("add / register max", () => {
  it("add sets the expected register to rho", () => {
    const p = 14;
    const h = HyperLogLog.withPrecision(p);
    const [idx, rho] = expectedSplit(42, p);
    h.add(42);
    expect(h.registers()[idx]).toBe(rho);
    expect(h.nonzeroRegisters()).toBe(1);
    expect(h.maxRegister()).toBe(rho);
  });

  it("add is max-not-overwrite and idempotent", () => {
    const a = HyperLogLog.withPrecision(4);
    a.add(7);
    const b = HyperLogLog.withPrecision(4);
    b.add(7);
    b.add(7);
    b.add(7);
    expect([...b.registers()]).toEqual([...a.registers()]);
  });

  it("add order-independent", () => {
    const ab = HyperLogLog.withPrecision(6);
    ab.add(11);
    ab.add(99999);
    const ba = HyperLogLog.withPrecision(6);
    ba.add(99999);
    ba.add(11);
    expect([...ab.registers()]).toEqual([...ba.registers()]);
  });

  it("add(-1) uses zero-extend, not sign-extend", () => {
    const p = 4;
    const h = HyperLogLog.withPrecision(p);
    h.add(-1);
    // zero-extend: 0x00000000_ffffffff
    const xz = hash64({ hi: 0, lo: 0xffffffff }, { hi: 0, lo: 0 });
    const zi = (xz.hi >>> (32 - p)) >>> 0;
    const wz = shl64(xz, p);
    const zr = clz64({ hi: wz.hi, lo: (wz.lo | (1 << (p - 1))) >>> 0 }) + 1;
    expect(h.registers()[zi]).toBe(zr);
    // sign-extend would be 0xffffffff_ffffffff and route differently.
    const xs = hash64({ hi: 0xffffffff, lo: 0xffffffff }, { hi: 0, lo: 0 });
    const si = (xs.hi >>> (32 - p)) >>> 0;
    const ws = shl64(xs, p);
    const sr = clz64({ hi: ws.hi, lo: (ws.lo | (1 << (p - 1))) >>> 0 }) + 1;
    expect(zi !== si || zr !== sr).toBe(true);
  });
});

// ---- merge -----------------------------------------------------------------

describe("merge", () => {
  it("is element-wise max", () => {
    const p = 4;
    const a = HyperLogLog.withPrecision(p);
    for (const v of [1, 2, 3]) a.add(v);
    const b = HyperLogLog.withPrecision(p);
    for (const v of [3, 4, 5]) b.add(v);
    const expected = a.registers();
    const bregs = b.registers();
    for (let i = 0; i < expected.length; i++) {
      expected[i] = Math.max(expected[i], bregs[i]);
    }
    a.merge(b);
    expect([...a.registers()]).toEqual([...expected]);
  });

  it("commutative and idempotent", () => {
    const p = 5;
    const build = (items: number[]): HyperLogLog => {
      const h = HyperLogLog.withPrecision(p);
      for (const v of items) h.add(v);
      return h;
    };
    const ab = build([10, 20, 30]);
    ab.merge(build([30, 40, 50]));
    const ba = build([30, 40, 50]);
    ba.merge(build([10, 20, 30]));
    expect([...ab.registers()]).toEqual([...ba.registers()]);

    const a = build([10, 20, 30]);
    const aa = build([10, 20, 30]);
    aa.merge(build([10, 20, 30]));
    expect([...aa.registers()]).toEqual([...a.registers()]);
  });

  it("throws on p-mismatch", () => {
    const a = HyperLogLog.withPrecision(4);
    const b = HyperLogLog.withPrecision(5);
    expect(() => a.merge(b)).toThrow(HllError);
  });
});

// ---- serialization round-trip + rejections ---------------------------------

describe("serialization", () => {
  it("round-trips and has the right header", () => {
    const h = HyperLogLog.withPrecision(4);
    h.add(1);
    h.add(7);
    h.add(-1);
    const bytes = h.toBytes();
    expect(bytes.length).toBe(5 + 16);
    expect([...bytes.slice(0, 4)]).toEqual([0x48, 0x4c, 0x4c, 0x31]);
    expect(bytes[4]).toBe(4);
    const back = HyperLogLog.fromBytes(bytes);
    expect([...back.registers()]).toEqual([...h.registers()]);
  });

  it("empty p4 anchor hex", () => {
    const h = HyperLogLog.withPrecision(4);
    expect(toHex(h.toBytes())).toBe(
      "484c4c310400000000000000000000000000000000",
    );
  });

  it("rejects bad magic", () => {
    const bytes = HyperLogLog.withPrecision(4).toBytes();
    bytes[0] = 0x00;
    expect(() => HyperLogLog.fromBytes(bytes)).toThrow(HllError);
  });

  it("rejects too short", () => {
    expect(() =>
      HyperLogLog.fromBytes(Uint8Array.of(0x48, 0x4c, 0x4c)),
    ).toThrow(HllError);
  });

  it("rejects bad p", () => {
    const bytes = HyperLogLog.withPrecision(4).toBytes();
    bytes[4] = 3;
    expect(() => HyperLogLog.fromBytes(bytes)).toThrow(HllError);
    bytes[4] = 19;
    expect(() => HyperLogLog.fromBytes(bytes)).toThrow(HllError);
  });

  it("rejects length mismatch", () => {
    const bytes = HyperLogLog.withPrecision(4).toBytes();
    const tooLong = new Uint8Array(bytes.length + 1);
    tooLong.set(bytes);
    expect(() => HyperLogLog.fromBytes(tooLong)).toThrow(HllError);
    const tooShort = bytes.slice(0, bytes.length - 1);
    expect(() => HyperLogLog.fromBytes(tooShort)).toThrow(HllError);
  });

  it("rejects register above the per-p ceiling, accepts the ceiling", () => {
    // p=4: ceiling 61.
    const b4 = HyperLogLog.withPrecision(4).toBytes();
    b4[5] = 62;
    expect(() => HyperLogLog.fromBytes(b4)).toThrow(HllError);
    b4[5] = 61;
    expect(() => HyperLogLog.fromBytes(b4)).not.toThrow();
    // p=18: ceiling 47.
    const b18 = HyperLogLog.withPrecision(18).toBytes();
    b18[5] = 48;
    expect(() => HyperLogLog.fromBytes(b18)).toThrow(HllError);
    b18[5] = 47;
    expect(() => HyperLogLog.fromBytes(b18)).not.toThrow();
  });
});

// ---- estimate(): native-only, tolerance-bounded ----------------------------

describe("estimate (quarantined float, native-only)", () => {
  it("fresh HLL estimates exactly 0", () => {
    for (const p of [4, 7, 14]) {
      expect(HyperLogLog.withPrecision(p).estimate()).toBe(0);
    }
  });

  it("within 5% on a known cardinality at p=14", () => {
    const p = 14;
    const n = 10000;
    const h = HyperLogLog.withPrecision(p);
    for (let i = 0; i < n; i++) {
      h.add(Math.imul(i, 2654435761) | 0);
    }
    const est = h.estimate();
    expect(Math.abs(est - n) / n).toBeLessThan(0.05);
  });

  it("within 5% on a small cardinality (linear counting)", () => {
    const p = 14;
    const n = 300;
    const h = HyperLogLog.withPrecision(p);
    for (let i = 0; i < n; i++) {
      h.add(Math.imul(i, 2654435761) | 0);
    }
    const est = h.estimate();
    expect(Math.abs(est - n) / n).toBeLessThan(0.05);
  });

  // Drive a high-register state via fromBytes so raw E exceeds (1/30)*2^64;
  // estimate() must be finite. ceiling-1 lands E in the large-range band but
  // below 2^64 (the log correction fires). ceiling (fully saturated, every
  // register at the per-p max — an add-unreachable state constructible via
  // fromBytes) reaches/exceeds 2^64; the log-argument guard skips the
  // correction and returns the raw (large, finite) E. Without the guard,
  // Math.log(1 - E/2^64) = Math.log(<= 0) = NaN.
  it.each([
    ["ceiling-1", (p: number) => rhoCeiling(p) - 1],
    ["ceiling (fully saturated)", (p: number) => rhoCeiling(p)],
  ])("large-range correction is finite (registers at %s)", (_label, r) => {
    const p = 4;
    const value = r(p);
    const bytes = HyperLogLog.withPrecision(p).toBytes();
    for (let i = 5; i < bytes.length; i++) bytes[i] = value;
    const est = HyperLogLog.fromBytes(bytes).estimate();
    expect(Number.isFinite(est)).toBe(true);
  });

  it("add rejects non-i32 inputs", () => {
    const h = HyperLogLog.withPrecision(4);
    for (const bad of [2147483648, -2147483649, 1.5, NaN, Infinity, -Infinity]) {
      expect(() => h.add(bad)).toThrow(HllError);
    }
    // i32 boundaries are accepted.
    expect(() => h.add(2147483647)).not.toThrow();
    expect(() => h.add(-2147483648)).not.toThrow();
  });
});

// ---- cross-language oracle: scenario register_hex values -------------------

describe("scenario register_hex oracle cross-check", () => {
  it("hll_single_add_p4: add(1) at p4", () => {
    const h = HyperLogLog.withPrecision(4);
    h.add(1);
    expect("0x" + toHex(h.toBytes())).toBe(
      "0x484c4c310400000000000000000000000200000000",
    );
    expect(h.nonzeroRegisters()).toBe(1);
    expect(h.maxRegister()).toBe(2);
    expect(h.registers()[11]).toBe(2);
  });

  it("hll_high_rho_p4: add(0) -> rho 61 at idx 0", () => {
    const h = HyperLogLog.withPrecision(4);
    h.add(0);
    expect("0x" + toHex(h.toBytes())).toBe(
      "0x484c4c31043d000000000000000000000000000000",
    );
    expect(h.maxRegister()).toBe(61);
    expect(h.registers()[0]).toBe(61);
  });

  it("hll_merge_p4: merge of [1,2,3] and [3,4,5]", () => {
    const a = HyperLogLog.withPrecision(4);
    for (const v of [1, 2, 3]) a.add(v);
    const b = HyperLogLog.withPrecision(4);
    for (const v of [3, 4, 5]) b.add(v);
    a.merge(b);
    expect("0x" + toHex(a.toBytes())).toBe(
      "0x484c4c310401000001020000000000000200020000",
    );
    expect(a.nonzeroRegisters()).toBe(5);
    expect(a.maxRegister()).toBe(2);
  });

  it("hll_interop_roundtrip: from_bytes echoes register_hex", () => {
    const hex = "484c4c310401000001000000000000000200000000";
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
    }
    const h = HyperLogLog.fromBytes(bytes);
    expect("0x" + toHex(h.toBytes())).toBe("0x" + hex);
    expect(h.nonzeroRegisters()).toBe(3);
    expect(h.maxRegister()).toBe(2);
  });
});
