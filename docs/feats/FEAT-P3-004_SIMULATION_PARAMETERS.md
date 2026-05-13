# ⚙️ FEAT-P3-003: Simulation Parameters Panel

> **Phase:** 3 — Animation Loop, Contour Rendering & Transient Dynamics  
> **Priority:** 🟡 High (user-facing controls for simulation tuning)  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-12  
> **Status:** ✅ Complete (verified 2026-05-12 — 7/7 unit tests pass)  
> **Depends on:** FEAT-P3-001 (Animation Controller & Playback Loop)  
> **Blocks:** None

---

## Objective

Build the simulation parameters UI panel that gives the user control over all tunable variables: **frequency/mode selection**, **exaggeration scale**, **damping ratio**, and **initial conditions** (d₀, v₀). Wire each input to the `ModalKinematicsEngine` instance so changes take effect immediately in the animation.

---

## Architecture Reference

- **Section 8.1, Step 4** — Exaggeration scale `S` in `X_deformed = X_undeformed + φ_j · q_j(t) · S`
- **Section 8.2** — Initial condition input fields for d₀ and v₀, modal projection wiring
- **Section 3.1** — Mapping physical IC to modal domain: `q_0j = r_j^T · M · d_0`
- **Section 8.1, Steps 1–3** — User selects natural frequency → loads corresponding eigenvector

---

## Current State

- `ModalKinematicsEngine` accepts `globalDampingRatio` in its constructor (currently hardcoded to `0.05` in TestHarness2).
- `engine.setInitialConditions(d0, v0)` exists and works. Currently called with `d0 = [1.0, 0.0]`, `v0 = [0.0, 0.0]` in TestHarness2.
- No UI exists for any simulation parameter. Everything is hardcoded.
- The exaggeration scale `S` will be introduced in FEAT-P3-001 as a constant — this feature connects it to a slider.

---

## Required Changes

### 1. Frequency / Mode Selector Dropdown

#### Purpose
After CSV parsing, the data contains multiple modes (rows with different `Frequency` values). The user must be able to select which mode drives the animation, or run all modes superposed.

#### Implementation

Add a `<select>` dropdown populated from the unique frequencies extracted during parsing:

```jsx
<select value={selectedModeIndex} onChange={handleModeChange}>
    <option value="all">All Modes (Superposition)</option>
    {uniqueFreqs.map((freq, idx) => (
        <option key={idx} value={idx}>
            Mode {idx + 1} — {freq.toFixed(2)} Hz
        </option>
    ))}
</select>
```

**Engine wiring:**
- When "All Modes" is selected: engine runs full superposition (current default behavior).
- When a single mode is selected: the animation loop should only use that mode's contribution. This requires either:
  - **(A)** Adding a `setActiveMode(modeIndex)` method to the engine, or
  - **(B)** Creating a filtered single-mode engine instance.

**Director recommendation:** Option **(A)** — add a lightweight `activeModes` bitmask/array to the engine. The Engineer should add:

```javascript
// In ModalKinematicsEngine.js
setActiveModes(modeIndices) {
    this.activeModes = modeIndices; // Array of active mode indices, or null for all
}
```

Then in `getGlobalDisplacement()` and `evaluateModalState()`, iterate only over `activeModes` if set, otherwise iterate all modes.

---

### 2. Exaggeration Scale Slider

#### Purpose
Controls the `S` factor in the deformation formula. Allows users to visually amplify tiny displacements or scale down large ones.

```jsx
<label>
    Exaggeration Scale (S): {exaggerationScale.toFixed(1)}
    <input
        type="range"
        min="0.1"
        max="100"
        step="0.1"
        value={exaggerationScale}
        onChange={(e) => setExaggerationScale(parseFloat(e.target.value))}
    />
</label>
```

**Engine wiring:** This value is read inside the animation loop's vertex update section (FEAT-P3-001):

```javascript
posArray[i * 3] = restPositions[i * 3] + displacement[i] * S;
```

Pass the value via a `useRef` so the animation loop reads it without re-renders:

```javascript
exaggerationRef.current = exaggerationScale; // Set in the onChange handler
// In animate(): const S = exaggerationRef.current;
```

---

### 3. Damping Ratio Input

#### Purpose
Controls ζ (zeta) — the exponential decay rate of the transient response. Architecture defines this in Section 3.2.

```jsx
<label>
    Damping Ratio (ζ): 
    <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        value={dampingRatio}
        onChange={(e) => handleDampingChange(parseFloat(e.target.value))}
    />
</label>
```

**Engine wiring:** Changing ζ requires re-computing `omegaD` for all modes. Add a setter to the engine:

```javascript
// In ModalKinematicsEngine.js
setDampingRatio(zeta) {
    this.zeta = zeta;
    for (let j = 0; j < this.numModes; j++) {
        this.omegaD[j] = this.omegaN[j] * Math.sqrt(1 - zeta ** 2);
    }
}
```

**Important:** After changing ζ, the animation should automatically restart (reset `t = 0`) since the analytical solution depends on ζ from `t = 0`.

---

### 4. Initial Conditions Inputs (d₀, v₀)

#### Purpose
Allows the user to define the initial physical displacement and velocity vectors. Per Section 8.2, applying new ICs pauses the animation, re-projects to modal domain, and restarts with the transient envelope.

#### Implementation

For simplicity and usability, provide per-node scalar inputs (since the current data is 1-DOF-per-node). Present it as a compact form:

```jsx
<div>
    <h4>Initial Conditions</h4>
    <p>Set initial displacement (d₀) and velocity (v₀) per DOF:</p>
    {Array.from({ length: engine.totalDofs }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
            <span>DOF {i}:</span>
            <input
                type="number"
                step="0.1"
                placeholder="d₀"
                value={icDisplacements[i] ?? 0}
                onChange={(e) => handleICChange('d0', i, parseFloat(e.target.value))}
            />
            <input
                type="number"
                step="0.1"
                placeholder="v₀"
                value={icVelocities[i] ?? 0}
                onChange={(e) => handleICChange('v0', i, parseFloat(e.target.value))}
            />
        </div>
    ))}
    <button onClick={handleApplyIC}>Apply Initial Conditions</button>
</div>
```

**Apply handler:**

```javascript
const handleApplyIC = () => {
    // 1. Pause the animation
    playbackStateRef.current = 'paused';
    
    // 2. Build typed arrays from UI state
    const d0 = new Float32Array(icDisplacements);
    const v0 = new Float32Array(icVelocities);
    
    // 3. Project into modal domain
    engine.setInitialConditions(d0, v0);
    
    // 4. Reset simulation time
    simTimeRef.current = 0;
    
    // 5. User clicks Play to see the new transient response
};
```

---

### 5. Panel Layout & Placement

Place the simulation parameters in a **side panel** to the right of the viewport, or in a collapsible section below the playback controls. The exact styling will be handled by the UI Agent later — the Engineer should focus on functional layout.

Suggested structure:

```
┌──────────────────────────────────────────────────┐
│  3D Viewport (WebGLViewport)            [legend] │
├──────────────────────────────────────────────────┤
│  ▶ Play  ⏸ Pause  ⏹ Stop   [═══════●═══] t=1.2s│
├──────────────────────────────────────────────────┤
│  Mode: [All Modes ▼]                             │
│  Scale: [═══●═════] 5.0                          │
│  Damping: [0.05]                                 │
│  Initial Conditions:                             │
│    DOF 0: d₀=[1.0] v₀=[0.0]                     │
│    DOF 1: d₀=[0.0] v₀=[0.0]                     │
│    [Apply IC]                                    │
└──────────────────────────────────────────────────┘
```

---

## Files Affected

| File | Action | Summary |
|---|---|---|
| `modal-kinematics/src/engine/ModalKinematicsEngine.js` | **MODIFY** | Add `setActiveModes()` and `setDampingRatio()` methods |
| `modal-kinematics/src/engine/WebGLViewport.jsx` | **MODIFY** | Add parameter panel UI, wire all inputs to engine via refs, connect exaggeration scale to vertex loop |
| `modal-kinematics/src/test/TestHarness2.jsx` | **MODIFY** | Pass `uniqueFreqs` to viewport for mode selector population |

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | **Mode dropdown** lists all unique frequencies from the CSV | Load CSV → dropdown shows "Mode 1 — 10.00 Hz", "Mode 2 — 25.00 Hz" |
| 2 | Selecting a **single mode** animates only that mode's shape | Select Mode 1 → only Mode 1 shape oscillates |
| 3 | Selecting **"All Modes"** superimposes all modes | Select All → both modes contribute to deformation |
| 4 | **Exaggeration slider** scales the deformation amplitude | Move slider → deformation visually amplifies/shrinks |
| 5 | **Damping input** changes the decay rate | Set ζ = 0.5 → oscillation decays much faster than ζ = 0.01 |
| 6 | **IC inputs** accept per-DOF values for d₀ and v₀ | Enter values → click Apply → animation uses new ICs |
| 7 | Applying ICs **pauses the animation** and resets `t = 0` | Click Apply → animation pauses at undeformed state |
| 8 | After applying ICs, clicking Play shows the **transient decay envelope** | Play → nodes oscillate with exponential decay |
| 9 | Build passes with zero errors | `npm run build` completes cleanly |

## Unit Tests

### File: `modal-kinematics/src/test/testEngineExtensions.js` [NEW]

The new engine methods (`setActiveModes`, `setDampingRatio`) modify core math behavior. A bug here silently corrupts all simulation output. Follow the existing `testEx1.js` console-based pattern.

```javascript
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
```

**How to run:** `node --experimental-modules src/test/testEngineExtensions.js` from the `modal-kinematics/` directory.

> **These tests must pass before the simulation parameters feature is considered complete.**

---

## Notes for Engineer

- **Engine modifications** (`setActiveModes`, `setDampingRatio`) must remain backward-compatible — existing code that doesn't call these methods should continue to work identically (all modes active, original damping).
- The exaggeration scale should use a `useRef` to avoid re-triggering the `useEffect` that sets up the Three.js scene.
- For the IC inputs, use `useState` since these are DOM-driven form values. Only push them into the engine when the user clicks "Apply."
- The mode selector may need to pass down through props or be co-located with the viewport. Use your judgment on component boundaries — escalate to the Architect if it feels like it needs a larger restructure.
- Log your changes in `docs/logs/ENGINEER_LOG.md` per protocol.
