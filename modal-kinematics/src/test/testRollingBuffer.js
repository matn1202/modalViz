import { RollingBuffer } from '../engine/RollingBuffer.js';

let passed = 0;
let failed = 0;

function assert(label, condition) {
    if (condition) {
        console.log(`✅ ${label}`);
        passed++;
    } else {
        console.error(`❌ ${label}`);
        failed++;
    }
}

function assertArrayEq(label, actual, expected) {
    const ok = actual.length === expected.length && 
               actual.every((v, i) => Math.abs(v - expected[i]) < 1e-10);
    if (ok) {
        console.log(`✅ ${label}`);
        passed++;
    } else {
        console.error(`❌ ${label} — expected [${expected}], got [${actual}]`);
        failed++;
    }
}

// --- Test 1: Basic push and read ---
{
    const buf = new RollingBuffer(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    assertArrayEq('1.1: Basic push', buf.toArray(), [1, 2, 3]);
    assert('1.2: Length tracks count', buf.length === 3);
}

// --- Test 2: Capacity enforcement (circular wrap) ---
{
    const buf = new RollingBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // Overwrites 1
    buf.push(5); // Overwrites 2
    assertArrayEq('2.1: Circular wrap', buf.toArray(), [3, 4, 5]);
    assert('2.2: Length capped at capacity', buf.length === 3);
}

// --- Test 3: toArray returns chronological order after wrap ---
{
    const buf = new RollingBuffer(4);
    for (let i = 1; i <= 7; i++) buf.push(i);
    assertArrayEq('3.1: Chronological order after multiple wraps', buf.toArray(), [4, 5, 6, 7]);
}

// --- Test 4: Clear resets buffer ---
{
    const buf = new RollingBuffer(5);
    buf.push(1);
    buf.push(2);
    buf.clear();
    assert('4.1: Clear resets length to 0', buf.length === 0);
    assertArrayEq('4.2: Clear resets data', buf.toArray(), []);
}

// --- Test 5: Empty buffer ---
{
    const buf = new RollingBuffer(10);
    assertArrayEq('5.1: Empty buffer returns []', buf.toArray(), []);
    assert('5.2: Empty length is 0', buf.length === 0);
}

// --- Test 6: Single-element buffer ---
{
    const buf = new RollingBuffer(1);
    buf.push(42);
    assertArrayEq('6.1: Capacity 1 holds last value', buf.toArray(), [42]);
    buf.push(99);
    assertArrayEq('6.2: Capacity 1 overwrites', buf.toArray(), [99]);
    assert('6.3: Capacity 1 length stays 1', buf.length === 1);
}

// --- Test 7: Large buffer stress test ---
{
    const buf = new RollingBuffer(100);
    for (let i = 0; i < 1000; i++) buf.push(i);
    const arr = buf.toArray();
    assert('7.1: Stress test length', arr.length === 100);
    assertArrayEq('7.2: Stress test last values', arr.slice(-3), [997, 998, 999]);
    assertArrayEq('7.3: Stress test first values', arr.slice(0, 3), [900, 901, 902]);
}

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`RollingBuffer tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
