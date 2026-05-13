import { jetColormap } from '../engine/colormap.js';

let passed = 0;
let failed = 0;

function assertApprox(label, actual, expected, tolerance = 0.01) {
    const ok = actual.every((v, i) => Math.abs(v - expected[i]) < tolerance);
    if (ok) {
        console.log(`✅ ${label}`);
        passed++;
    } else {
        console.error(`❌ ${label} — expected [${expected}], got [${actual.map(v => v.toFixed(3))}]`);
        failed++;
    }
}

// --- Boundary values ---
assertApprox('t=0.0 → deep blue',   jetColormap(0.0),  [0, 0, 0.5]);
assertApprox('t=0.5 → green',       jetColormap(0.5),  [0.5, 1, 0.5]);
assertApprox('t=1.0 → dark red',    jetColormap(1.0),  [0.5, 0, 0]);

// --- Branch transitions (at each 0.125 boundary) ---
assertApprox('t=0.125 → blue',      jetColormap(0.125), [0, 0, 1]);
assertApprox('t=0.375 → cyan',      jetColormap(0.375), [0, 1, 1]);
assertApprox('t=0.625 → yellow',    jetColormap(0.625), [1, 1, 0]);
assertApprox('t=0.875 → red',       jetColormap(0.875), [1, 0, 0]);

// --- Mid-branch values ---
assertApprox('t=0.25 → cyan-ish',   jetColormap(0.25),  [0, 0.5, 1]);
assertApprox('t=0.75 → orange-ish', jetColormap(0.75),  [1, 0.5, 0]);

// --- Clamping (out-of-range inputs) ---
assertApprox('t=-0.5 → clamps to t=0', jetColormap(-0.5), jetColormap(0));
assertApprox('t=1.5  → clamps to t=1', jetColormap(1.5),  jetColormap(1));

// --- Output range [0,1] for all channels ---
const rangeTest = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
let rangeOk = true;
for (const t of rangeTest) {
    const [r, g, b] = jetColormap(t);
    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
        console.error(`❌ Range violation at t=${t}: [${r}, ${g}, ${b}]`);
        rangeOk = false;
        failed++;
    }
}
if (rangeOk) { console.log('✅ All outputs in [0,1] range'); passed++; }

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Colormap tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
