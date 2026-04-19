// Benchmark and stress test for TypeScript collections.
// Run: cd mapdb-typescript && npx ts-node ../benchmarks/bench_ts.ts
// Or:  cd mapdb-typescript && npx tsx ../benchmarks/bench_ts.ts

import { NumberNumberHashMap } from "./src/hashmap/number-number-hash-map";
import { NumberHashSet } from "./src/hashset/number-hash-set";
import { NumberArrayList } from "./src/arraylist/number-array-list";
import { NumberHashBag } from "./src/bag/number-hash-bag";
import { NumberArrayDeque } from "./src/deque/number-array-deque";
import { NumberPriorityQueue } from "./src/priority_queue/number-priority-queue";
import { BitSet } from "./src/bitset/bit-set";

const N = 100_000;
const WARM = 3;

function main() {
    console.log("=== TypeScript Benchmark ===");
    console.log(`N=${N}\n`);

    benchHashMapInsert();
    benchHashMapGet();
    benchHashMapDelete();
    benchHashMapIterate();
    benchHashSetInsert();
    benchHashSetContains();
    benchArrayListAdd();
    benchBagAdd();
    benchArrayDequeInsert();
    benchArrayDequeGet();
    benchArrayDequeDelete();
    benchPriorityQueueInsert();
    benchPriorityQueueGet();
    benchPriorityQueueDelete();
    benchBitSetInsert();
    benchBitSetGet();
    benchBitSetDelete();

    console.log("\n=== Stress Tests ===");
    stressCollisionKeys();
    stressDeleteHeavy();
    stressResizeCycles();
    stressFloatEdgeCases();
    stressEdgeKeys();
}

function benchHashMapInsert() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const m = new NumberNumberHashMap();
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) m.put(i, i * 10);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`HashMap.put         ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchHashMapGet() {
    const m = new NumberNumberHashMap();
    for (let i = 0; i < N; i++) m.put(i, i * 10);
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) m.get(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`HashMap.get         ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchHashMapDelete() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const m = new NumberNumberHashMap();
        for (let i = 0; i < N; i++) m.put(i, i * 10);
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) m.remove(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`HashMap.remove      ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchHashMapIterate() {
    const m = new NumberNumberHashMap();
    for (let i = 0; i < N; i++) m.put(i, i * 10);
    let best = Infinity;
    let sum = 0;
    for (let w = 0; w < WARM; w++) {
        sum = 0;
        const start = process.hrtime.bigint();
        m.forEach((k, v) => { sum += v; });
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`HashMap.forEach     ${N} entries  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/entry) sum=${sum}`);
}

function benchHashSetInsert() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const s = new NumberHashSet();
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) s.add(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`HashSet.add         ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchHashSetContains() {
    const s = new NumberHashSet();
    for (let i = 0; i < N; i++) s.add(i);
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) s.contains(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`HashSet.contains    ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchArrayListAdd() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const a = new NumberArrayList();
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) a.add(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`ArrayList.add       ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchBagAdd() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const b = new NumberHashBag();
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) b.add(i % 1000);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`Bag.add             ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchArrayDequeInsert() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const d = new NumberArrayDeque();
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) d.addLast(i);
        const d2 = Number(process.hrtime.bigint() - start);
        if (d2 < best) best = d2;
    }
    console.log(`ArrayDeque.addLast  ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchArrayDequeGet() {
    const d = new NumberArrayDeque();
    for (let i = 0; i < N; i++) d.addLast(i);
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) { d.peekFirst(); d.peekLast(); }
        const d2 = Number(process.hrtime.bigint() - start);
        if (d2 < best) best = d2;
    }
    console.log(`ArrayDeque.peek     ${N * 2} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / (N * 2))} ns/op)`);
}

function benchArrayDequeDelete() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const d = new NumberArrayDeque();
        for (let i = 0; i < N; i++) d.addLast(i);
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) d.removeFirst();
        const d2 = Number(process.hrtime.bigint() - start);
        if (d2 < best) best = d2;
    }
    console.log(`ArrayDeque.remove   ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchPriorityQueueInsert() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const q = new NumberPriorityQueue();
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) q.push(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`PriorityQueue.push  ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchPriorityQueueGet() {
    const q = new NumberPriorityQueue();
    for (let i = 0; i < N; i++) q.push(i);
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) q.peek();
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`PriorityQueue.peek  ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchPriorityQueueDelete() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const q = new NumberPriorityQueue();
        for (let i = 0; i < N; i++) q.push(i);
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) q.pop();
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`PriorityQueue.pop   ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchBitSetInsert() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const b = new BitSet();
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) b.set(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`BitSet.set          ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchBitSetGet() {
    const b = new BitSet();
    for (let i = 0; i < N; i++) b.set(i);
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) b.get(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`BitSet.get          ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

function benchBitSetDelete() {
    let best = Infinity;
    for (let w = 0; w < WARM; w++) {
        const b = new BitSet();
        for (let i = 0; i < N; i++) b.set(i);
        const start = process.hrtime.bigint();
        for (let i = 0; i < N; i++) b.clearBit(i);
        const d = Number(process.hrtime.bigint() - start);
        if (d < best) best = d;
    }
    console.log(`BitSet.clearBit     ${N} ops  ${(best / 1e6).toFixed(3)}ms  (${Math.round(best / N)} ns/op)`);
}

// --- Stress Tests ---

function stressCollisionKeys() {
    const m = new NumberNumberHashMap();
    const start = process.hrtime.bigint();
    for (let i = 0; i < 10000; i++) m.put(i * 16, i);
    const d = Number(process.hrtime.bigint() - start);
    let ok = true;
    for (let i = 0; i < 10000; i++) {
        if (m.get(i * 16) === undefined) { ok = false; break; }
    }
    console.log(`STRESS collision_keys   10000 ops  ${(d / 1e6).toFixed(3)}ms  all_found=${ok}`);
}

function stressDeleteHeavy() {
    const m = new NumberNumberHashMap();
    for (let i = 0; i < 50000; i++) m.put(i, i);
    const start = process.hrtime.bigint();
    for (let i = 0; i < 50000; i += 2) m.remove(i);
    for (let i = 50000; i < 75000; i++) m.put(i, i);
    for (let i = 0; i < 75000; i++) m.remove(i);
    const d = Number(process.hrtime.bigint() - start);
    console.log(`STRESS delete_heavy    125000 ops  ${(d / 1e6).toFixed(3)}ms  size=${m.size()} (expect 0)`);
}

function stressResizeCycles() {
    const m = new NumberNumberHashMap();
    const start = process.hrtime.bigint();
    for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 10000; i++) m.put(i, i);
        m.clear();
    }
    const d = Number(process.hrtime.bigint() - start);
    console.log(`STRESS resize_cycles   100000 ops  ${(d / 1e6).toFixed(3)}ms  size=${m.size()} (expect 0)`);
}

function stressFloatEdgeCases() {
    const m = new NumberNumberHashMap();
    m.put(1.0, 10.0);
    m.put(-0.0, 20.0);
    m.put(Infinity, 30.0);
    m.put(NaN, 40.0);
    m.put(NaN, 50.0); // NaN overwrite?
    const nanVal = m.get(NaN);
    const negZero = m.get(-0.0);
    const infVal = m.get(Infinity);
    console.log(`STRESS float_keys      NaN=${nanVal} -0.0=${negZero} Inf=${infVal} size=${m.size()}`);
}

function stressEdgeKeys() {
    const m = new NumberNumberHashMap();
    m.put(0, 100);
    m.put(-1, 200);
    m.put(Number.MAX_SAFE_INTEGER, 300);
    m.put(Number.MIN_SAFE_INTEGER, 400);
    const ok = m.size() === 4
        && m.get(0) !== undefined
        && m.get(Number.MAX_SAFE_INTEGER) !== undefined
        && m.get(Number.MIN_SAFE_INTEGER) !== undefined;
    console.log(`STRESS edge_keys       boundary values  ok=${ok}`);
}

main();
