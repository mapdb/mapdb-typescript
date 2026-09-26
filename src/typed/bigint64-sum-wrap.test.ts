// Copyright (c) 2026 Jan Kotek.
// Licensed under the Eclipse Public License v1.0 and Eclipse Distribution License v1.0.
// See LICENSE-EPL-1.0.txt and LICENSE-EDL-1.0.txt.
// USE AT YOUR OWN RISK — THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND.

// Hand-written (not generated): the typed BigInt64 list/stack sum() wraps at
// i64 (audit fable-spec-allign 04-typescript F8; algorithms.md "only an
// i64-valued sum can overflow, and it wraps at i64").

import { describe, it, expect } from "vitest";
import { BigInt64ArrayList } from "./arraylist/bigint64-array-list.js";
import { ImmutableBigInt64ArrayList } from "./arraylist/immutable_bigint64-array-list.js";
import { BigInt64ArrayStack } from "./stack/bigint64-array-stack.js";
import { ImmutableBigInt64ArrayStack } from "./stack/immutable_bigint64-array-stack.js";

const MAX = 2n ** 63n - 1n;
const MIN = -(2n ** 63n);

describe("typed BigInt64 sum() wraps at i64 (F8)", () => {
  it("BigInt64ArrayList", () => {
    const l = new BigInt64ArrayList();
    l.add(MAX);
    l.add(1n);
    expect(l.sum()).toBe(MIN);
    l.add(-1n);
    expect(l.sum()).toBe(MAX);
  });

  it("ImmutableBigInt64ArrayList", () => {
    expect(ImmutableBigInt64ArrayList.of([MAX, 1n]).sum()).toBe(MIN);
    expect(ImmutableBigInt64ArrayList.of([MIN, -1n]).sum()).toBe(MAX);
  });

  it("BigInt64ArrayStack", () => {
    const s = new BigInt64ArrayStack();
    s.push(MAX);
    s.push(MAX);
    expect(s.sum()).toBe(-2n);
  });

  it("ImmutableBigInt64ArrayStack", () => {
    expect(ImmutableBigInt64ArrayStack.of([MAX, 1n]).sum()).toBe(MIN);
  });
});
