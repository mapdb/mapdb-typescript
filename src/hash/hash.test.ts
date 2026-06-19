// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import {
  type U64,
  SALT2,
  hash32,
  hash64,
  mul64,
  shr64,
  xor64,
  hash32I32,
  hash64I32,
  hash32Bytes,
  hash64Bytes,
  encodeI32Word32,
  encodeI32Word64,
  encodeBytesWord32,
  encodeBytesWord64,
  positions,
  positionsFromHashes,
  hllSplit,
} from "./hash.js";

// ---------------------------------------------------------------------------
// BigInt reference implementations (the cross-check oracle). These are exact
// (BigInt is arbitrary-precision) and DELIBERATELY independent of the lane
// scheme — they prove the lane mul64/shr64 carry handling.
// ---------------------------------------------------------------------------

const MASK64 = (1n << 64n) - 1n;
const FMIX64_C1 = 0xff51afd7ed558ccdn;
const FMIX64_C2 = 0xc4ceb9fe1a85ec53n;

function hash64BigInt(inputWord: bigint, seed: bigint): bigint {
  let h = (inputWord ^ seed) & MASK64;
  h = (h ^ (h >> 33n)) & MASK64;
  h = (h * FMIX64_C1) & MASK64;
  h = (h ^ (h >> 33n)) & MASK64;
  h = (h * FMIX64_C2) & MASK64;
  h = (h ^ (h >> 33n)) & MASK64;
  return h;
}

function u64ToBigInt(x: U64): bigint {
  return (BigInt(x.hi >>> 0) << 32n) | BigInt(x.lo >>> 0);
}

function bigIntToU64(x: bigint): U64 {
  return {
    hi: Number((x >> 32n) & 0xffffffffn) >>> 0,
    lo: Number(x & 0xffffffffn) >>> 0,
  };
}

// ---------------------------------------------------------------------------
// Test-vector tables (authoritative, mirrored from
// spec/features/hash-pipeline.md §"Test vectors" / the Rust reference).
// ---------------------------------------------------------------------------

const HASH32_WORDS = [
  0x00000000, 0x00000001, 0xffffffff, 0x80000000, 0x7fffffff, 0x04030201,
];
const HASH32_SEEDS: U64[] = [
  { hi: 0x00000000, lo: 0x00000000 },
  { hi: 0x00000000, lo: 0x00000001 },
  { hi: 0x00000000, lo: 0xffffffff },
  { hi: 0xffffffff, lo: 0x00000000 },
];
// row-major: word outer, seed inner.
const HASH32_EXPECTED = [
  [0x00000000, 0x514e28b7, 0x81f16f39, 0x81f16f39],
  [0x514e28b7, 0x00000000, 0x7995c304, 0x7995c304],
  [0x81f16f39, 0x7995c304, 0x00000000, 0x00000000],
  [0x6d3c65a0, 0x8b7f7a6a, 0xf9cc0ea8, 0xf9cc0ea8],
  [0xf9cc0ea8, 0x551b50f6, 0x6d3c65a0, 0x6d3c65a0],
  [0xd839eaff, 0x54ec0422, 0xaf02bbbc, 0xaf02bbbc],
];

const HASH64_WORDS: U64[] = [
  { hi: 0x00000000, lo: 0x00000000 },
  { hi: 0x00000000, lo: 0x00000001 },
  { hi: 0x00000000, lo: 0xffffffff },
  { hi: 0x00000000, lo: 0x80000000 },
  { hi: 0xffffffff, lo: 0xffffffff },
  { hi: 0x08070605, lo: 0x04030201 },
];
const HASH64_SEEDS = HASH32_SEEDS;
// Full 64-bit results as 16-hex-digit strings, row-major (word outer, seed inner).
const HASH64_EXPECTED = [
  [
    "0000000000000000",
    "b456bcfc34c2cb2c",
    "cc71ecda2aa8bcc6",
    "c9213cd20c528300",
  ],
  [
    "b456bcfc34c2cb2c",
    "0000000000000000",
    "0789620c2ee64a3e",
    "2640647a5ca0376b",
  ],
  [
    "cc71ecda2aa8bcc6",
    "0789620c2ee64a3e",
    "0000000000000000",
    "64b5720b4b825f21",
  ],
  [
    "e3beca1f9a7e4886",
    "81b875318ee00b8e",
    "8a662c1a93a26b91",
    "c4ca27146b0a922f",
  ],
  [
    "64b5720b4b825f21",
    "3a8593886c55a02b",
    "c9213cd20c528300",
    "cc71ecda2aa8bcc6",
  ],
  [
    "9b57670c60240a13",
    "da66ed8bc89ffb5f",
    "be7f6184429515e7",
    "916bf52bf4cf0681",
  ],
];

function u64Hex(x: U64): string {
  return (
    (x.hi >>> 0).toString(16).padStart(8, "0") +
    (x.lo >>> 0).toString(16).padStart(8, "0")
  );
}

// ---------------------------------------------------------------------------
// hash32 — full 24-row table
// ---------------------------------------------------------------------------

describe("hash32 vectors", () => {
  it("matches all 24 rows", () => {
    for (let wi = 0; wi < HASH32_WORDS.length; wi++) {
      for (let si = 0; si < HASH32_SEEDS.length; si++) {
        const got = hash32(HASH32_WORDS[wi], HASH32_SEEDS[si]) >>> 0;
        expect(
          got,
          `hash32(0x${HASH32_WORDS[wi].toString(16)}, seed[${si}])`,
        ).toBe(HASH32_EXPECTED[wi][si] >>> 0);
      }
    }
  });

  it("seed high/low-word columns are identical (fold to seed32=0xffffffff)", () => {
    for (const w of HASH32_WORDS) {
      expect(hash32(w, { hi: 0x00000000, lo: 0xffffffff })).toBe(
        hash32(w, { hi: 0xffffffff, lo: 0x00000000 }),
      );
    }
  });

  it("sanity-check pins", () => {
    expect(hash32(1, { hi: 0, lo: 0 }) >>> 0).toBe(0x514e28b7);
    expect(hash32(0x80000000, { hi: 0, lo: 0 }) >>> 0).toBe(0x6d3c65a0);
    expect(hash32(0, { hi: 0, lo: 0 }) >>> 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// hash64 — full 24-row table + lane split
// ---------------------------------------------------------------------------

describe("hash64 vectors", () => {
  it("matches all 24 rows (full + hi/lo lanes)", () => {
    for (let wi = 0; wi < HASH64_WORDS.length; wi++) {
      for (let si = 0; si < HASH64_SEEDS.length; si++) {
        const got = hash64(HASH64_WORDS[wi], HASH64_SEEDS[si]);
        const want = HASH64_EXPECTED[wi][si];
        expect(u64Hex(got), `hash64 word[${wi}] seed[${si}]`).toBe(want);
        // lane split pins
        expect((got.hi >>> 0).toString(16).padStart(8, "0")).toBe(
          want.slice(0, 8),
        );
        expect((got.lo >>> 0).toString(16).padStart(8, "0")).toBe(
          want.slice(8, 16),
        );
      }
    }
  });

  it("sanity-check pins", () => {
    expect(u64Hex(hash64({ hi: 0, lo: 1 }, { hi: 0, lo: 0 }))).toBe(
      "b456bcfc34c2cb2c",
    );
    expect(u64Hex(hash64({ hi: 0, lo: 0 }, { hi: 0, lo: 0 }))).toBe(
      "0000000000000000",
    );
    // all-ones logical >> 33 probe
    expect(
      u64Hex(hash64({ hi: 0xffffffff, lo: 0xffffffff }, { hi: 0, lo: 0 })),
    ).toBe("64b5720b4b825f21");
  });
});

// ---------------------------------------------------------------------------
// THE CRITICAL CHECK: lane mul64/shr64 vs BigInt over vectors + random pairs.
// This is what proves the mul64 carry (Math.floor vs >>>16) and shr64 at s>=32.
// ---------------------------------------------------------------------------

describe("lane vs BigInt cross-check (proves mul64 carry, shr64)", () => {
  it("agrees over all spec vectors", () => {
    for (const w of HASH64_WORDS) {
      for (const s of HASH64_SEEDS) {
        const lane = hash64(w, s);
        const ref = bigIntToU64(hash64BigInt(u64ToBigInt(w), u64ToBigInt(s)));
        expect(u64Hex(lane), `lane vs bigint word/seed`).toBe(u64Hex(ref));
      }
    }
  });

  it("agrees over a large battery of random (word, seed) pairs", () => {
    // Deterministic LCG so failures reproduce.
    let state = 0x12345678 >>> 0;
    const rand32 = (): number => {
      // Numerical Recipes LCG, take high bits.
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    const randU64 = (): U64 => ({ hi: rand32(), lo: rand32() });
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const w = randU64();
      const s = randU64();
      const lane = hash64(w, s);
      const ref = bigIntToU64(hash64BigInt(u64ToBigInt(w), u64ToBigInt(s)));
      if (lane.hi !== ref.hi || lane.lo !== ref.lo) {
        throw new Error(
          `mismatch at i=${i}: w=${u64Hex(w)} s=${u64Hex(s)} lane=${u64Hex(lane)} ref=${u64Hex(ref)}`,
        );
      }
    }
    expect(true).toBe(true);
  });

  it("mul64 alone agrees with BigInt mod 2^64 over random pairs", () => {
    let state = 0xdeadbeef >>> 0;
    const rand32 = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    const randU64 = (): U64 => ({ hi: rand32(), lo: rand32() });
    for (let i = 0; i < 100000; i++) {
      const a = randU64();
      const b = randU64();
      const lane = mul64(a, b);
      const ref = bigIntToU64((u64ToBigInt(a) * u64ToBigInt(b)) & MASK64);
      if (lane.hi !== ref.hi || lane.lo !== ref.lo) {
        throw new Error(
          `mul64 mismatch at i=${i}: a=${u64Hex(a)} b=${u64Hex(b)} lane=${u64Hex(lane)} ref=${u64Hex(ref)}`,
        );
      }
    }
    // Carry-stress: products where a column sum exceeds 2^32 (>>>16 would drop it).
    const stress = mul64(
      { hi: 0xffffffff, lo: 0xffffffff },
      { hi: 0xffffffff, lo: 0xffffffff },
    );
    expect(u64Hex(stress)).toBe(
      u64Hex(bigIntToU64((MASK64 * MASK64) & MASK64)),
    );
    expect(true).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lane primitive direct pins
// ---------------------------------------------------------------------------

describe("lane primitives", () => {
  it("shr64 at s=33 yields hi=0, lo=oldHi>>>1", () => {
    const x: U64 = { hi: 0xffffffff, lo: 0xffffffff };
    const r = shr64(x, 33);
    expect(r.hi).toBe(0);
    expect(r.lo).toBe(0x7fffffff);
  });

  it("shr64 general cases match BigInt", () => {
    const x: U64 = { hi: 0x89abcdef, lo: 0x01234567 };
    const bx = u64ToBigInt(x);
    for (let s = 0; s < 64; s++) {
      expect(u64Hex(shr64(x, s)), `shr64 s=${s}`).toBe(
        u64Hex(bigIntToU64(bx >> BigInt(s))),
      );
    }
  });

  it("xor64 is lane-wise and renormalized", () => {
    const r = xor64({ hi: 0xffffffff, lo: 0x0 }, { hi: 0x1, lo: 0xffffffff });
    expect(r.hi).toBe(0xfffffffe);
    expect(r.lo).toBe(0xffffffff);
  });
});

// ---------------------------------------------------------------------------
// Encoder pins
// ---------------------------------------------------------------------------

describe("encoders", () => {
  it("i32 reinterpret (not sign-extend) for hash32", () => {
    expect(encodeI32Word32(-1) >>> 0).toBe(0xffffffff);
    expect(encodeI32Word32(-2147483648) >>> 0).toBe(0x80000000);
    expect(encodeI32Word32(2147483647) >>> 0).toBe(0x7fffffff);
    expect(hash32I32(-1, { hi: 0, lo: 0 })).toBe(
      hash32(0xffffffff, { hi: 0, lo: 0 }),
    );
  });

  it("i32 zero-extend (not sign-extend) for hash64", () => {
    expect(u64Hex(encodeI32Word64(-1))).toBe("00000000ffffffff");
    expect(u64Hex(encodeI32Word64(-2147483648))).toBe("0000000080000000");
    // The sign-extend trap made observable: zero-extended != all-ones.
    expect(u64Hex(hash64I32(-1, { hi: 0, lo: 0 }))).not.toBe(
      u64Hex(hash64({ hi: 0xffffffff, lo: 0xffffffff }, { hi: 0, lo: 0 })),
    );
    expect(u64Hex(hash64I32(-1, { hi: 0, lo: 0 }))).toBe("cc71ecda2aa8bcc6");
  });

  it("bytes LE fold + length XOR (32)", () => {
    // [01 02 03 04] -> lane 0x04030201, XOR len 4 -> 0x04030205.
    expect(encodeBytesWord32(new Uint8Array([1, 2, 3, 4])) >>> 0).toBe(
      (0x04030201 ^ 4) >>> 0,
    );
    expect(hash32Bytes(new Uint8Array([1, 2, 3, 4]), { hi: 0, lo: 0 })).toBe(
      hash32((0x04030201 ^ 4) >>> 0, { hi: 0, lo: 0 }),
    );
    // scenario reference value
    expect(
      (hash32Bytes(new Uint8Array([1, 2, 3, 4]), { hi: 0, lo: 0 }) >>> 0)
        .toString(16)
        .padStart(8, "0"),
    ).toBe("318f91ff");
  });

  it("bytes LE fold + length XOR (64)", () => {
    const b = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    // lane 0x0807060504030201 XOR len 8 -> 0x0807060504030209.
    expect(u64Hex(encodeBytesWord64(b))).toBe("0807060504030209");
    expect(u64Hex(hash64Bytes(b, { hi: 0, lo: 0 }))).toBe(
      u64Hex(hash64({ hi: 0x08070605, lo: 0x04030209 }, { hi: 0, lo: 0 })),
    );
    // scenario reference value
    expect(u64Hex(hash64Bytes(b, { hi: 0, lo: 0 }))).toBe("a1dfdbe3d274f81c");
  });

  it("tail goes to LOW bytes; [0x00] != [0x00,0x00]", () => {
    // [01] folds to lane 0x00000001 (low byte), XOR len 1.
    expect(encodeBytesWord32(new Uint8Array([1])) >>> 0).toBe(
      (0x00000001 ^ 1) >>> 0,
    );
    const h3 = hash32Bytes(new Uint8Array([1, 2, 3]), { hi: 0, lo: 0 });
    const h2 = hash32Bytes(new Uint8Array([1, 2]), { hi: 0, lo: 0 });
    const h4 = hash32Bytes(new Uint8Array([1, 2, 3, 0]), { hi: 0, lo: 0 });
    expect(h3).not.toBe(h2);
    expect(h3).not.toBe(h4);
    // length-XOR distinguishes equal-byte tails.
    expect(hash32Bytes(new Uint8Array([0]), { hi: 0, lo: 0 })).not.toBe(
      hash32Bytes(new Uint8Array([0, 0]), { hi: 0, lo: 0 }),
    );
    // scenario reference values
    const hex = (h: number): string => (h >>> 0).toString(16).padStart(8, "0");
    expect(hex(h3)).toBe("bb675c79");
    expect(hex(h2)).toBe("a79ac21a");
    expect(hex(h4)).toBe("0849ef57");
  });

  it("64-byte fold tail handling at lengths 1/2/3/5/7", () => {
    for (const len of [1, 2, 3, 5, 7]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = i + 1;
      // cross-check the encoder against a BigInt LE fold + length XOR.
      let ref = 0n;
      const full = len - (len % 8);
      for (let i = 0; i < full; i += 8) {
        let lane = 0n;
        for (let j = 0; j < 8; j++)
          lane |= BigInt(bytes[i + j]) << BigInt(8 * j);
        ref ^= lane;
      }
      let tail = 0n;
      for (let j = 0; j < len - full; j++)
        tail |= BigInt(bytes[full + j]) << BigInt(8 * j);
      ref ^= tail;
      ref ^= BigInt(len);
      expect(u64Hex(encodeBytesWord64(bytes)), `len=${len}`).toBe(
        u64Hex(bigIntToU64(ref & MASK64)),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// seed-fold identity
// ---------------------------------------------------------------------------

describe("seed fold", () => {
  it("two seeds folding to same seed32 produce identical hash32", () => {
    expect(hash32(0x12345678, { hi: 0x00000000, lo: 0xffffffff })).toBe(
      hash32(0x12345678, { hi: 0xffffffff, lo: 0x00000000 }),
    );
  });
  it("high word genuinely participates", () => {
    expect(hash32(0x12345678, { hi: 0x00000001, lo: 0 })).not.toBe(
      hash32(0x12345678, { hi: 0, lo: 0 }),
    );
  });
  it("seed-zero is ordinary (word^seed first); word1^seed1 == 0 -> fmix64(0)=0", () => {
    expect(u64Hex(hash64({ hi: 0, lo: 1 }, { hi: 0, lo: 1 }))).toBe(
      "0000000000000000",
    );
  });
});

// ---------------------------------------------------------------------------
// positions_from_hashes — the 5 oracle rows + public positions()
// ---------------------------------------------------------------------------

describe("positions", () => {
  it("matches the 5 positions_from_hashes oracle rows", () => {
    expect(positionsFromHashes(0x00000000, 0x00000001, 16, 4)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(positionsFromHashes(0x0000000a, 0x00000003, 16, 4)).toEqual([
      10, 13, 0, 3,
    ]);
    expect(positionsFromHashes(0xffffffff, 0x00000001, 16, 3)).toEqual([
      15, 0, 1,
    ]);
    // i*h2 multiply wrap: i=2, 2*0x80000000 = 0x100000000 -> 0.
    expect(positionsFromHashes(0x80000000, 0x80000000, 7, 3)).toEqual([
      2, 0, 2,
    ]);
    // addition wrap + unsigned mod with high bit set.
    expect(positionsFromHashes(0xfffffffd, 0x00000002, 1000, 5)).toEqual([
      293, 295, 1, 3, 5,
    ]);
  });

  it("public positions uses internal seeds 0 and SALT2 over the i32 LE bytes", () => {
    // value -1 -> LE bytes ff ff ff ff
    const bytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
    const h1 = hash32Bytes(bytes, { hi: 0, lo: 0 });
    const h2 = hash32Bytes(bytes, SALT2);
    expect(positions(bytes, 1000, 5)).toEqual(
      positionsFromHashes(h1, h2, 1000, 5),
    );
    // scenario positions_wrap_highbit reference
    expect(positions(bytes, 1000, 5)).toEqual([542, 370, 494, 322, 150]);
  });

  it("power-of-two m equals % m (mask must agree with modulo)", () => {
    const bytes = new Uint8Array([42, 0, 0, 0]); // i32 42 LE
    const h1 = hash32Bytes(bytes, { hi: 0, lo: 0 });
    const h2 = hash32Bytes(bytes, SALT2);
    const ps = positions(bytes, 64, 7);
    for (let i = 0; i < ps.length; i++) {
      const combined = (((h1 >>> 0) + Math.imul(i, h2)) >>> 0) >>> 0;
      expect(ps[i]).toBe(combined & 63);
      expect(ps[i]).toBe(combined % 64);
    }
    // scenario positions_pow2_m reference
    expect(positions(bytes, 64, 7)).toEqual([25, 28, 31, 34, 37, 40, 43]);
  });

  it("positions_basic reference (value 7, m=16, k=4)", () => {
    expect(positions(new Uint8Array([7, 0, 0, 0]), 16, 4)).toEqual([
      7, 0, 9, 2,
    ]);
  });
});

describe("hash input-domain validation (cross-language i32/u32 contract)", () => {
  it("positionsFromHashes / positions reject m == 0 (typed ports trap on % 0)", () => {
    // Witness: previously returned [NaN] instead of trapping like the typed ports.
    expect(() => positionsFromHashes(1, 1, 0, 1)).toThrow(RangeError);
    expect(() => positions(new Uint8Array([1]), 0, 4)).toThrow(RangeError);
  });

  it("positionsFromHashes rejects non-u32 m / k", () => {
    expect(() => positionsFromHashes(1, 1, -1, 1)).toThrow(RangeError);
    expect(() => positionsFromHashes(1, 1, 1.5, 1)).toThrow(RangeError);
    expect(() => positionsFromHashes(1, 1, 16, -1)).toThrow(RangeError);
    expect(() => positionsFromHashes(1, 1, 16, 2.5)).toThrow(RangeError);
    expect(() => positionsFromHashes(1, 1, 4294967296, 1)).toThrow(RangeError); // 2^32
  });

  it("k == 0 is valid and yields no positions", () => {
    expect(positionsFromHashes(1, 1, 16, 0)).toEqual([]);
  });

  it("hllSplit validates 4 <= p <= 18 (witness: p=0 returned [0,33])", () => {
    expect(() => hllSplit(new Uint8Array([]), 0)).toThrow(RangeError);
    expect(() => hllSplit(new Uint8Array([1]), 3)).toThrow(RangeError);
    expect(() => hllSplit(new Uint8Array([1]), 19)).toThrow(RangeError);
    expect(() => hllSplit(new Uint8Array([1]), 4.5)).toThrow(RangeError);
    // boundary p values are accepted and return a valid [idx, rho] pair
    const [idx4, rho4] = hllSplit(new Uint8Array([1, 2, 3, 4]), 4);
    expect(Number.isInteger(idx4)).toBe(true);
    expect(rho4).toBeGreaterThanOrEqual(1);
    expect(() => hllSplit(new Uint8Array([1, 2, 3, 4]), 18)).not.toThrow();
  });
});
