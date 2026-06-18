// Copyright (c) 2026 Jan Kotek.
// Derived from Eclipse Collections (Copyright (c) Goldman Sachs and others).
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

import { describe, it, expect } from "vitest";
import {
  buildRedBlack,
  hashCapacityFor,
  checkExpectedSize,
  PUMP_RED,
  PUMP_BLACK,
} from "./pump.js";

interface TNode {
  key: number;
  left: TNode | null;
  right: TNode | null;
  parent: TNode | null;
  color: boolean;
}

function makeTree(n: number): TNode | null {
  const items = Array.from({ length: n }, (_, i) => i);
  return buildRedBlack<TNode>(n, (i) => ({
    key: items[i],
    left: null,
    right: null,
    parent: null,
    color: PUMP_BLACK,
  }));
}

/** Returns the uniform black-height, or throws on any RB violation. */
function checkRb(node: TNode | null, parent: TNode | null): number {
  if (node === null) return 1; // null leaves are black
  expect(node.parent).toBe(parent);
  if (node.color === PUMP_RED) {
    // no red-red edge
    expect(node.left === null || node.left.color === PUMP_BLACK).toBe(true);
    expect(node.right === null || node.right.color === PUMP_BLACK).toBe(true);
  }
  const lh = checkRb(node.left, node);
  const rh = checkRb(node.right, node);
  expect(lh).toBe(rh); // equal black height
  return lh + (node.color === PUMP_BLACK ? 1 : 0);
}

function inorder(node: TNode | null, out: number[]): void {
  if (!node) return;
  inorder(node.left, out);
  out.push(node.key);
  inorder(node.right, out);
}

function height(node: TNode | null): number {
  if (!node) return 0;
  return 1 + Math.max(height(node.left), height(node.right));
}

describe("buildRedBlack", () => {
  it("n=0 is an empty tree", () => {
    expect(makeTree(0)).toBeNull();
  });

  it("singleton root is black", () => {
    const root = makeTree(1)!;
    expect(root.color).toBe(PUMP_BLACK);
    expect(root.parent).toBeNull();
  });

  it("root is always black and has null parent", () => {
    for (const n of [1, 2, 3, 7, 8, 100]) {
      const root = makeTree(n)!;
      expect(root.color).toBe(PUMP_BLACK);
      expect(root.parent).toBeNull();
    }
  });

  it("exhaustive RB validity + in-order + height bound for n=0..64 and 3*2^k", () => {
    const sizes = [...Array(65).keys(), 96, 192, 384, 768];
    for (const n of sizes) {
      const root = makeTree(n);
      checkRb(root, null);
      const out: number[] = [];
      inorder(root, out);
      expect(out).toEqual(Array.from({ length: n }, (_, i) => i));
      if (n > 0) {
        expect(height(root)).toBeLessThanOrEqual(2 * Math.log2(n + 1) + 1);
      }
    }
  });

  it("randomized RB validity", () => {
    let seed = 0x5eed;
    const nextSize = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % 1000;
    };
    for (let t = 0; t < 80; t++) {
      const n = nextSize();
      const root = makeTree(n);
      checkRb(root, null);
      const out: number[] = [];
      inorder(root, out);
      expect(out).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
});

describe("hashCapacityFor", () => {
  it("n=0 -> sentinel 16", () => {
    expect(hashCapacityFor(0)).toBe(16);
  });

  it("keeps n entries below the 0.75 resize threshold", () => {
    for (let n = 0; n <= 5000; n++) {
      const cap = hashCapacityFor(n);
      // power of two
      expect((cap & (cap - 1)) === 0).toBe(true);
      // loading all n keeps the table below the resize predicate for the nth
      // element: for i in 0..n-1, (i+1) < cap*0.75. Tightest at i=n-1.
      expect(n).toBeLessThan(cap * 0.75);
    }
  });

  it("matches the spec formula nextPow2(floor(4n/3)+1)", () => {
    const nextPow2 = (x: number) => {
      if (x <= 0) return 16;
      x--;
      x |= x >> 1;
      x |= x >> 2;
      x |= x >> 4;
      x |= x >> 8;
      x |= x >> 16;
      return x + 1;
    };
    for (const n of [1, 2, 3, 6, 12, 24, 48, 96, 100, 1000]) {
      expect(hashCapacityFor(n)).toBe(nextPow2(Math.floor((4 * n) / 3) + 1));
    }
  });
});

describe("checkExpectedSize", () => {
  it("accepts non-negative safe integers", () => {
    expect(() => checkExpectedSize(0)).not.toThrow();
    expect(() => checkExpectedSize(1000)).not.toThrow();
  });
  it("rejects negative, fractional, NaN, and oversized", () => {
    expect(() => checkExpectedSize(-1)).toThrow(RangeError);
    expect(() => checkExpectedSize(1.5)).toThrow(RangeError);
    expect(() => checkExpectedSize(NaN)).toThrow(RangeError);
    expect(() => checkExpectedSize(Number.MAX_SAFE_INTEGER + 2)).toThrow(
      RangeError,
    );
  });
});
