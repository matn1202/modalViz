# 🎯 FEAT-P3-001: Animation Controller & Playback Loop

> **Phase:** 3 — Animation Loop, Contour Rendering & Transient Dynamics  
> **Priority:** 🔴 Critical (foundation for all Phase 3 work)  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-12  
> **Status:** ✅ Complete (verified 2026-05-12)  
> **Depends on:** Phase 2 ✅ (FIX-001 resolved)  
> **Blocks:** FEAT-P3-002, FEAT-P3-003, FEAT-P3-004

---

## Objective

Wire the existing `ModalKinematicsEngine` to the `WebGLViewport`'s `requestAnimationFrame` render loop so that nodes deform in real time. Build the playback state machine (Play/Pause/Stop/Reset) and time management system. This is the **core infrastructure** that all other Phase 3 features depend on.

---

## Architecture Reference

- **Section 8.1** — Playback Mechanism (per `requestAnimationFrame` frame)
- **Section 6** — MVC: Controller uses `requestAnimationFrame` as central nervous system
- **Section 3.2** — Transient modal displacement formula: `q_j(t) = e^(-ζωn·t) [q0·cos(ωd·t) + ((ζωn·q0 + v0)/ωd)·sin(ωd·t)]`

---

## Current State Analysis

### What exists:
- `WebGLViewport.jsx` has a render loop (`requestAnimationFrame`) but it **only updates orbit controls** — no engine wiring.
- `ModalKinematicsEngine.js` has all required methods: `evaluateModalState(t)`, `getGlobalDisplacement()`, `setInitialConditions(d0, v0)`.
- `TestHarness2.jsx` creates the engine inline, runs a fixed loop of 5 time steps, and discards the engine. The engine is **never passed to the viewport**.

### What's missing:
1. No simulation time `t` variable incremented per frame.
2. No engine instance accessible from the render loop.
3. No vertex position updates per frame (`position.needsUpdate = true`).
4. No playback state machine (Play/Pause/Stop).
5. No UI controls for playback.
6. No mechanism to pass the engine + mode shape data into the viewport.

---

## Required Changes

### 1. Refactor Data Flow: Engine Must Reach the Viewport

**Problem:** Currently `TestHarness2.jsx` creates the `ModalKinematicsEngine` inside `handleDataParsed`, logs output, and discards it. The `WebGLViewport` only receives raw geometry (`xCoords`, `yCoords`, `zCoords`) — it has no knowledge of the engine, mode shapes, or frequencies.

**Solution:** Restructure the data pipeline so that the parent component:
1. Receives parsed buffers from `DataIngestionWizard`.
2. Extracts unique frequencies and constructs mode shape arrays (this logic already exists in TestHarness2 lines 15–30).
3. Instantiates the `ModalKinematicsEngine`.
4. Passes **both** the geometry data **and** the engine instance to `WebGLViewport`.

#### File: `modal-kinematics/src/test/TestHarness2.jsx` (or future App-level component)

Modify the component to:

```jsx
// After parsing buffers, construct the engine and pass it down
const engine = new ModalKinematicsEngine(numNodes, dofsPerNode, uniqueFreqs, modeShapes, dampingRatio);

// Set default initial conditions (unit displacement on first DOF)
const d0 = new Float32Array(engine.totalDofs);
d0[0] = 1.0;
const v0 = new Float32Array(engine.totalDofs);
engine.setInitialConditions(d0, v0);

// Pass to viewport
<WebGLViewport geometryData={parsedData} engine={engine} />
```

#### File: `modal-kinematics/src/engine/WebGLViewport.jsx`

Update the component signature to accept the engine:

```jsx
export default function WebGLViewport({ geometryData, engine }) {
```

---

### 2. Implement the Animation Time System

Inside the `WebGLViewport.jsx` render loop, add simulation time management.

**Key variables to add (before the `animate()` function):**

```javascript
// Animation state
let simulationTime = 0;
let isPlaying = false;
let lastTimestamp = 0;
const timeScale = 1.0; // Simulation speed multiplier

// Store the undeformed (rest) positions for reference
const restPositions = new Float32Array(positions); // Clone of original positions
```

**Modify the `animate()` function:**

```javascript
const animate = (timestamp) => {
    animationFrameId = requestAnimationFrame(animate);
    
    // Calculate delta time in seconds
    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const dt = (timestamp - lastTimestamp) / 1000; // ms → seconds
    lastTimestamp = timestamp;
    
    if (isPlaying && engine) {
        // Advance simulation time
        simulationTime += dt * timeScale;
        
        // Evaluate the math engine at current time
        engine.evaluateModalState(simulationTime);
        
        // Get the full displacement vector u(t)
        const displacement = engine.getGlobalDisplacement();
        
        // Update vertex positions: X_deformed = X_rest + u(t) * S
        const posArray = geometry.attributes.position.array;
        const S = exaggerationScale; // Will come from FEAT-P3-003
        
        for (let i = 0; i < numNodes; i++) {
            // For 1-DOF-per-node data (current mock data):
            // Apply displacement along the modal shape direction
            posArray[i * 3]     = restPositions[i * 3]     + displacement[i] * S;
            posArray[i * 3 + 1] = restPositions[i * 3 + 1]; // unchanged for 1D
            posArray[i * 3 + 2] = restPositions[i * 3 + 2]; // unchanged for 1D
        }
        
        // Signal GPU to upload the modified buffer
        geometry.attributes.position.needsUpdate = true;
    }
    
    controls.update();
    renderer.render(scene, camera);
};

// Start with timestamp-aware rAF
requestAnimationFrame(animate);
```

> **Engineering note:** The architecture specifies `dofsPerNode` which may be 1 (scalar modal shape) or 3 (X/Y/Z per node). The current mock data uses `dofsPerNode = 1`. The implementation must handle both cases. Use the engine's `dofsPerNode` property to branch the displacement mapping logic.

---

### 3. Build the Playback State Machine

Expose playback controls via React state and callback props or internal refs. The state machine has these transitions:

```
STOPPED ──[Play]──► PLAYING
PLAYING ──[Pause]──► PAUSED
PAUSED  ──[Play]──► PLAYING
PLAYING ──[Stop]──► STOPPED  (resets t = 0)
PAUSED  ──[Stop]──► STOPPED  (resets t = 0)
```

**Implementation approach — use `useRef` for animation-loop-accessible state:**

```javascript
const playbackState = useRef('stopped'); // 'stopped' | 'playing' | 'paused'
const simTimeRef = useRef(0);
```

> **Why refs, not state?** The `animate()` function runs inside `requestAnimationFrame` — it captures closure variables at creation time. React state updates (`useState`) would require re-renders and effect re-runs to propagate. `useRef` gives a mutable container that the render loop can read on every frame without triggering re-renders.

---

### 4. Implement Playback UI Controls

Add a minimal control bar **below** the viewport canvas. This will be visually polished later by the UI Agent.

```jsx
return (
    <div>
        <div ref={mountRef} style={{ ... }} />
        <div className="playback-controls" style={{ display: 'flex', gap: '8px', padding: '8px' }}>
            <button onClick={handlePlay} disabled={playbackState === 'playing'}>▶ Play</button>
            <button onClick={handlePause} disabled={playbackState !== 'playing'}>⏸ Pause</button>
            <button onClick={handleStop}>⏹ Stop</button>
            <span>t = {displayTime.toFixed(3)}s</span>
        </div>
    </div>
);
```

**Button handlers** (communicate with the render loop via refs):

```javascript
const handlePlay = () => {
    playbackStateRef.current = 'playing';
    lastTimestampRef.current = 0; // Reset delta tracking to avoid time jump
};

const handlePause = () => {
    playbackStateRef.current = 'paused';
};

const handleStop = () => {
    playbackStateRef.current = 'stopped';
    simTimeRef.current = 0;
    
    // Reset vertex positions to undeformed state
    const posArray = geometryRef.current.attributes.position.array;
    posArray.set(restPositionsRef.current);
    geometryRef.current.attributes.position.needsUpdate = true;
};
```

---

### 5. Timeline Scrub Slider

Add an `<input type="range">` slider that allows the user to jump to any point in the simulation timeline.

```jsx
<input
    type="range"
    min="0"
    max="5"       // Default 5-second window; adjustable later
    step="0.001"
    value={displayTime}
    onChange={(e) => {
        const t = parseFloat(e.target.value);
        simTimeRef.current = t;
        // Evaluate and render a single frame at this time
        engine.evaluateModalState(t);
        // Update vertex positions...
    }}
/>
```

---

## Exaggeration Scale (Temporary Default)

Until FEAT-P3-003 (Simulation Parameters UI) is implemented, hardcode a default exaggeration scale:

```javascript
const exaggerationScale = 1.0; // Default; will be connected to slider in FEAT-P3-003
```

The displacement formula per the architecture (Section 8.1):

```
X_deformed = X_undeformed + (φ_j · q_j(t) · S)
```

---

## Files Affected

| File | Action | Summary |
|---|---|---|
| `modal-kinematics/src/engine/WebGLViewport.jsx` | **MODIFY** | Add engine prop, animation time system, vertex update loop, playback state machine, playback UI controls, timeline scrub slider |
| `modal-kinematics/src/test/TestHarness2.jsx` | **MODIFY** | Restructure to instantiate engine and pass it to WebGLViewport as a prop |

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | Clicking **Play** starts real-time vertex deformation | Load CSV → Play → nodes visibly oscillate |
| 2 | Clicking **Pause** freezes the animation at current `t` | Pause → geometry holds still at current deformed state |
| 3 | Clicking **Stop** resets geometry to undeformed state and `t = 0` | Stop → nodes snap back to original positions |
| 4 | The **scrub slider** jumps to any time `t` and shows the correct deformed state | Drag slider → geometry updates to match `evaluateModalState(t)` |
| 5 | The displayed time `t` updates in real-time during playback | Time counter ticks smoothly at ~60 FPS |
| 6 | **Orbit controls still work** during animation playback | Drag to rotate while animation plays |
| 7 | Animation uses **delta time** (frame-rate-independent) | Works correctly at both 30 FPS and 60 FPS |
| 8 | Build passes with zero errors | `npm run build` completes cleanly |

---

## Notes for Engineer

- Use `useRef` for all animation-loop-accessible mutable state (`simTime`, `playbackState`, `restPositions`, `geometry`, etc.). Do NOT use `useState` for values read inside `requestAnimationFrame`.
- The `lastTimestamp` should be reset to `0` when transitioning from paused/stopped → playing, to avoid a large delta-time spike.
- The `exaggerationScale` will default to `1.0` for now. FEAT-P3-003 will add the slider.
- The current mock data is 1-DOF-per-node. Make sure the displacement mapping logic is flexible for future 3-DOF-per-node data.
- Log your changes in `docs/logs/ENGINEER_LOG.md` per protocol.
