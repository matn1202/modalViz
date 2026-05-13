import { ModalKinematicsEngine } from '../engine/ModalKinematicsEngine.js';

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

function assertApprox(label, actual, expected, tol = 1e-4) {
    const ok = Math.abs(actual - expected) < tol;
    if (ok) {
        console.log(`✅ ${label}`);
        passed++;
    } else {
        console.error(`❌ ${label} — expected ${expected}, got ${actual}`);
        failed++;
    }
}

// --- Setup: 2-node, 2-mode, 1-DOF system (same as testEx1.js) ---
const mode1 = new Float32Array([0.5, 0.5]);
const mode2 = new Float32Array([0.5, -0.5]);
const freqs = [10.0, 25.0];

// ============================================================
// TEST GROUP 1: setActiveModes()
// ============================================================
console.log('\n--- setActiveModes() Tests ---');

// Test 1.1: Default behavior (no setActiveModes called) = all modes
{
    const eng = new ModalKinematicsEngine(2, 1, freqs, [mode1, mode2], 0.05);
    eng.setInitialConditions(new Float32Array([1, 0]), new Float32Array([0, 0]));
    eng.evaluateModalState(0.01);
    const uAll = eng.getGlobalDisplacement();
    const sumAll = uAll[0] + uAll[1]; // Both modes contribute

    // Now explicitly set all modes active — result should be identical
    eng.setActiveModes(null); // null = all modes
    eng.evaluateModalState(0.01);
    const uNull = eng.getGlobalDisplacement();
    assertApprox('1.1: null activeModes = all modes', uNull[0], uAll[0]);
}

// Test 1.2: Single mode isolation
{
    const eng = new ModalKinematicsEngine(2, 1, freqs, [mode1, mode2], 0.05);
    eng.setInitialConditions(new Float32Array([1, 0]), new Float32Array([0, 0]));
    
    // Mode 1 only (in-phase: both nodes move same direction)
    eng.setActiveModes([0]);
    eng.evaluateModalState(0.01);
    const u1 = eng.getGlobalDisplacement();
    assertApprox('1.2a: Mode 1 only → Node 0 == Node 1', u1[0], u1[1]);

    // Mode 2 only (out-of-phase: nodes move opposite)
    eng.setActiveModes([1]);
    eng.evaluateModalState(0.01);
    const u2 = eng.getGlobalDisplacement();
    assertApprox('1.2b: Mode 2 only → Node 0 == -Node 1', u2[0], -u2[1]);
}

// Test 1.3: Superposition of selected modes = sum of individual modes
{
    const eng = new ModalKinematicsEngine(2, 1, freqs, [mode1, mode2], 0.05);
    eng.setInitialConditions(new Float32Array([1, 0]), new Float32Array([0, 0]));
    
    eng.setActiveModes([0]);
    eng.evaluateModalState(0.02);
    const u_m1 = eng.getGlobalDisplacement()[0];

    eng.setActiveModes([1]);
    eng.evaluateModalState(0.02);
    const u_m2 = eng.getGlobalDisplacement()[0];

    eng.setActiveModes(null); // All modes
    eng.evaluateModalState(0.02);
    const u_all = eng.getGlobalDisplacement()[0];

    assertApprox('1.3: u_all ≈ u_mode1 + u_mode2', u_all, u_m1 + u_m2);
}

// ============================================================
// TEST GROUP 2: setDampingRatio()
// ============================================================
console.log('\n--- setDampingRatio() Tests ---');

// Test 2.1: Higher damping → faster decay → smaller amplitude at same t
{
    const eng_low  = new ModalKinematicsEngine(2, 1, freqs, [mode1, mode2], 0.01);
    const eng_high = new ModalKinematicsEngine(2, 1, freqs, [mode1, mode2], 0.01);
    
    const d0 = new Float32Array([1, 0]);
    const v0 = new Float32Array([0, 0]);
    eng_low.setInitialConditions(d0, v0);
    eng_high.setInitialConditions(d0, v0);
    
    eng_high.setDampingRatio(0.5); // Much higher damping
    
    const t = 0.1;
    eng_low.evaluateModalState(t);
    eng_high.evaluateModalState(t);
    
    const amp_low  = Math.abs(eng_low.getGlobalDisplacement()[0]);
    const amp_high = Math.abs(eng_high.getGlobalDisplacement()[0]);
    
    assert('2.1: Higher ζ → smaller amplitude', amp_high < amp_low);
}

// Test 2.2: setDampingRatio recalculates omegaD correctly
{
    const eng = new ModalKinematicsEngine(2, 1, freqs, [mode1, mode2], 0.05);
    const wn0 = eng.omegaN[0];
    
    eng.setDampingRatio(0.1);
    const expectedWd = wn0 * Math.sqrt(1 - 0.1 ** 2);
    assertApprox('2.2: ωd recalculated after setDampingRatio', eng.omegaD[0], expectedWd);
}

// Test 2.3: setDampingRatio(0) → undamped (ωd = ωn)
{
    const eng = new ModalKinematicsEngine(2, 1, freqs, [mode1, mode2], 0.05);
    eng.setDampingRatio(0);
    assertApprox('2.3: ζ=0 → ωd == ωn', eng.omegaD[0], eng.omegaN[0]);
}

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Engine extension tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
