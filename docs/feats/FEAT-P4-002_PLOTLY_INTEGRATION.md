# 📊 FEAT-P4-002: Plotly.js Integration & 2D Kinematic Plots

> **Phase:** 4 — Raycasting & Plotly.js Integration  
> **Priority:** 🟡 High (core analytical visualization)  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-12  
> **Status:** 🟡 Pending  
> **Depends on:** FEAT-P4-001 (Raycasting & Node Selection)  
> **Blocks:** None

---

## Objective

Install Plotly.js, create a rolling-window data buffer utility, and build three synchronized 2D plots (Displacement vs. Time, Velocity vs. Time, Acceleration vs. Time) that stream live kinematic data for the selected node during animation playback. The plots must scroll like an oscilloscope, synchronized with the 3D animation.

---

## Architecture Reference

- **Section 7.3** — Plotly.js for scientific visualization with real-time streaming
- **Section 9.2** — Concurrent 2D Plotting of Kinematics
  - Three synchronized plots: Displacement, Velocity, Acceleration vs. Time
  - `requestAnimationFrame` loop evaluates `getScopedKinematics(dofIndex)` for the selected node only
  - Values appended to fixed-length rolling-window arrays
  - Streamed via `Plotly.extendTraces` or `Plotly.react` for oscilloscope scrolling
- **Section 4.2** — O(m) optimized scoping extraction (already implemented)

---

## Current State

- `Plotly.js` is **NOT installed** (`package.json` has no Plotly dependency).
- `engine.getScopedKinematics(dofIndex)` already returns `{ position, velocity, acceleration }` at O(m) cost.
- FEAT-P4-001 will provide `selectedNodeRef.current.dofIndex` — the DOF index to scope.
- The animation loop already calls `engine.evaluateModalState(t)` per frame — scoped kinematics can be extracted immediately after.
- No Plotly chart containers exist in the DOM.

---

## Required Changes

### 0. Install Plotly.js Dependency

```bash
npm install plotly.js-dist-min
```

> **Why `plotly.js-dist-min`?** The full `plotly.js` package is ~8MB. The minified distribution bundle (`plotly.js-dist-min`) is ~1MB and includes all chart types. For a scientific/engineering app, this is the recommended import.

---

### 1. Create the Rolling-Window Data Buffer Utility

#### File: `modal-kinematics/src/engine/RollingBuffer.js` [NEW]

Create a simple, reusable, fixed-length circular buffer for time-series data. This avoids unbounded memory growth during long simulations.

```javascript
/**
 * Fixed-length rolling-window buffer for time-series data.
 * When full, the oldest values are overwritten (FIFO).
 * 
 * @example
 * const buf = new RollingBuffer(100);
 * buf.push(0.5);
 * buf.toArray(); // [0.5]
 * // ... after 200 pushes, only the last 100 values remain
 */
export class RollingBuffer {
    /**
     * @param {number} capacity - Maximum number of values to retain.
     */
    constructor(capacity) {
        this.capacity = capacity;
        this.data = new Float64Array(capacity);
        this.head = 0;   // Next write position
        this.count = 0;  // Number of values stored (up to capacity)
    }

    /**
     * Append a value to the buffer. If full, overwrites the oldest value.
     * @param {number} value
     */
    push(value) {
        this.data[this.head] = value;
        this.head = (this.head + 1) % this.capacity;
        if (this.count < this.capacity) this.count++;
    }

    /**
     * Returns the buffered values as a standard Array, in chronological order
     * (oldest first). Required by Plotly — it does not accept Float64Array.
     * @returns {number[]}
     */
    toArray() {
        if (this.count < this.capacity) {
            return Array.from(this.data.subarray(0, this.count));
        }
        // Wrap: [head..capacity) + [0..head)
        const tail = Array.from(this.data.subarray(this.head, this.capacity));
        const front = Array.from(this.data.subarray(0, this.head));
        return tail.concat(front);
    }

    /**
     * Reset the buffer to empty.
     */
    clear() {
        this.head = 0;
        this.count = 0;
    }

    /**
     * @returns {number} Current number of stored values.
     */
    get length() {
        return this.count;
    }
}
```

**Design decision:** Using `Float64Array` internally for numerical precision (avoids Float32 truncation on small kinematic values), and converting to `Array` only when Plotly needs it. The circular buffer is O(1) push, O(n) read — optimal for the streaming use case.

---

### 2. Create the Kinematic Plots Component

#### File: `modal-kinematics/src/engine/KinematicPlots.jsx` [NEW]

Create a React component that renders three Plotly charts. This component receives the rolling buffer data and re-renders at a throttled rate.

```jsx
import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

/**
 * Three synchronized 2D plots for scoped node kinematics.
 * Renders: Displacement vs. Time, Velocity vs. Time, Acceleration vs. Time.
 * 
 * @param {Object} props
 * @param {number[]} props.timeData - Array of time values
 * @param {number[]} props.displacementData - Array of displacement values
 * @param {number[]} props.velocityData - Array of velocity values  
 * @param {number[]} props.accelerationData - Array of acceleration values
 * @param {number} props.nodeId - Selected node ID (for title)
 */
export default function KinematicPlots({ 
    timeData, displacementData, velocityData, accelerationData, nodeId 
}) {
    const dispRef = useRef(null);
    const velRef = useRef(null);
    const accRef = useRef(null);

    useEffect(() => {
        if (!dispRef.current || !velRef.current || !accRef.current) return;
        if (!timeData || timeData.length === 0) return;

        const commonLayout = {
            margin: { t: 30, b: 40, l: 60, r: 20 },
            paper_bgcolor: '#1a1a1a',
            plot_bgcolor: '#1a1a1a',
            font: { color: '#ccc', size: 11 },
            xaxis: { 
                title: 'Time (s)', 
                gridcolor: '#333',
                range: timeData.length > 1 
                    ? [timeData[0], timeData[timeData.length - 1]] 
                    : undefined
            },
            yaxis: { gridcolor: '#333' },
        };

        const config = { 
            displayModeBar: false, 
            responsive: true,
            staticPlot: false
        };

        // Displacement plot
        Plotly.react(dispRef.current, [{
            x: timeData,
            y: displacementData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#00ccff', width: 1.5 },
            name: 'u(t)'
        }], {
            ...commonLayout,
            title: `Node ${nodeId} — Displacement`,
            yaxis: { ...commonLayout.yaxis, title: 'u(t)' }
        }, config);

        // Velocity plot
        Plotly.react(velRef.current, [{
            x: timeData,
            y: velocityData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#ffaa00', width: 1.5 },
            name: 'v(t)'
        }], {
            ...commonLayout,
            title: `Node ${nodeId} — Velocity`,
            yaxis: { ...commonLayout.yaxis, title: 'v(t)' }
        }, config);

        // Acceleration plot
        Plotly.react(accRef.current, [{
            x: timeData,
            y: accelerationData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#ff4466', width: 1.5 },
            name: 'a(t)'
        }], {
            ...commonLayout,
            title: `Node ${nodeId} — Acceleration`,
            yaxis: { ...commonLayout.yaxis, title: 'a(t)' }
        }, config);

    }, [timeData, displacementData, velocityData, accelerationData, nodeId]);

    // Cleanup Plotly instances on unmount
    useEffect(() => {
        return () => {
            if (dispRef.current) Plotly.purge(dispRef.current);
            if (velRef.current) Plotly.purge(velRef.current);
            if (accRef.current) Plotly.purge(accRef.current);
        };
    }, []);

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '8px',
            padding: '8px',
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #444'
        }}>
            <div ref={dispRef} style={{ height: '220px' }} />
            <div ref={velRef} style={{ height: '220px' }} />
            <div ref={accRef} style={{ height: '220px' }} />
        </div>
    );
}
```

**Design decisions:**
- Uses `Plotly.react()` (not `Plotly.newPlot`) for efficient updates — it diffs the data and only re-renders what changed.
- Dark theme matching the viewport background (`#1a1a1a`).
- Three columns side by side for concurrent viewing.
- Distinct colors per curve: cyan (displacement), orange (velocity), red (acceleration).
- `displayModeBar: false` to keep the UI clean.

---

### 3. Wire the Data Pipeline in the Animation Loop

#### File: `modal-kinematics/src/engine/WebGLViewport.jsx` [MODIFY]

Inside the `animate()` function, after `engine.evaluateModalState()`, extract scoped kinematics for the selected node and push to the rolling buffers.

**New refs and state at component level:**

```javascript
import { RollingBuffer } from './RollingBuffer.js';
import KinematicPlots from './KinematicPlots.jsx';

// Rolling buffers for scoped kinematic data
const BUFFER_CAPACITY = 500; // ~8 seconds of data at 60fps
const timeBuf = useRef(new RollingBuffer(BUFFER_CAPACITY));
const dispBuf = useRef(new RollingBuffer(BUFFER_CAPACITY));
const velBuf = useRef(new RollingBuffer(BUFFER_CAPACITY));
const accBuf = useRef(new RollingBuffer(BUFFER_CAPACITY));

// Plotly data state (throttled updates)
const [plotData, setPlotData] = useState(null);
```

**Inside `animate()`, after the vertex/color update block:**

```javascript
// --- SCOPED KINEMATIC EXTRACTION (Phase 4) ---
if (selectedNodeRef.current && engine) {
    const dofIdx = selectedNodeRef.current.dofIndex;
    const kin = engine.getScopedKinematics(dofIdx);
    
    timeBuf.current.push(simTimeRef.current);
    dispBuf.current.push(kin.position);
    velBuf.current.push(kin.velocity);
    accBuf.current.push(kin.acceleration);
    
    // Throttle Plotly updates to every 6 frames (~10 Hz at 60fps)
    // Plotly is heavier than the colorbar legend — needs more aggressive throttling
    if (frameCountRef.current % 6 === 0) {
        setPlotData({
            time: timeBuf.current.toArray(),
            displacement: dispBuf.current.toArray(),
            velocity: velBuf.current.toArray(),
            acceleration: accBuf.current.toArray(),
        });
    }
}
```

> **Why 10 Hz update rate?** Plotly DOM operations are expensive. Updating at 60fps would cause severe jank. 10 Hz (every 6 frames) provides smooth-enough oscilloscope scrolling without degrading the 3D animation framerate.

---

### 4. Clear Buffers on Node Change / Stop

When the user selects a different node or stops the animation, clear the rolling buffers:

```javascript
// In handleNodeClick (after updating selectedNodeRef):
timeBuf.current.clear();
dispBuf.current.clear();
velBuf.current.clear();
accBuf.current.clear();
setPlotData(null);

// In handleStop:
timeBuf.current.clear();
dispBuf.current.clear();
velBuf.current.clear();
accBuf.current.clear();
setPlotData(null);
```

---

### 5. Render the Plots in the JSX

Add the `KinematicPlots` component below the simulation parameters panel:

```jsx
{selectedNodeInfo && plotData && (
    <KinematicPlots
        timeData={plotData.time}
        displacementData={plotData.displacement}
        velocityData={plotData.velocity}
        accelerationData={plotData.acceleration}
        nodeId={selectedNodeInfo.nodeId}
    />
)}
```

The plots should only render when:
1. A node is selected (FEAT-P4-001), AND
2. Plot data exists (animation has been running)

---

### 6. Handle the Timeline Scrub for Plots

When the user scrubs the timeline slider, also update the scoped kinematics and push to buffers:

```javascript
// Inside the slider onChange handler, after vertex updates:
if (selectedNodeRef.current && engine) {
    const kin = engine.getScopedKinematics(selectedNodeRef.current.dofIndex);
    timeBuf.current.push(t);
    dispBuf.current.push(kin.position);
    velBuf.current.push(kin.velocity);
    accBuf.current.push(kin.acceleration);
    setPlotData({
        time: timeBuf.current.toArray(),
        displacement: dispBuf.current.toArray(),
        velocity: velBuf.current.toArray(),
        acceleration: accBuf.current.toArray(),
    });
}
```

---

## Files Affected

| File | Action | Summary |
|---|---|---|
| `modal-kinematics/package.json` | **MODIFY** | Add `plotly.js-dist-min` dependency |
| `modal-kinematics/src/engine/RollingBuffer.js` | **NEW** | Fixed-capacity circular buffer for time-series data |
| `modal-kinematics/src/engine/KinematicPlots.jsx` | **NEW** | Three synchronized Plotly charts (disp, vel, acc) |
| `modal-kinematics/src/engine/WebGLViewport.jsx` | **MODIFY** | Import RollingBuffer + KinematicPlots, add data pipeline in animate loop, render plots in JSX |

---

## Unit Tests

### File: `modal-kinematics/src/test/testRollingBuffer.js` [NEW]

The `RollingBuffer` is a pure data structure with defined behavior (FIFO, circular wrapping, capacity enforcement). It **must** be tested.

```javascript
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
```

**How to run:** `node src/test/testRollingBuffer.js` from the `modal-kinematics/` directory.

> **This test file must pass before the Plotly integration is considered complete.**

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | **Plotly.js is installed** and importable | `npm ls plotly.js-dist-min` shows the package |
| 2 | **Three charts** appear below the viewport when a node is selected and animation plays | Select node → Play → three line charts render |
| 3 | **Displacement plot** shows `u(t)` for the selected node with correct oscillation shape | Values match `getScopedKinematics(dofIndex).position` |
| 4 | **Velocity plot** shows `v(t)` for the selected node | Values match `getScopedKinematics(dofIndex).velocity` |
| 5 | **Acceleration plot** shows `a(t)` for the selected node | Values match `getScopedKinematics(dofIndex).acceleration` |
| 6 | Plots **scroll like an oscilloscope** (rolling window) | After ~8 seconds, old data scrolls off the left edge |
| 7 | Plots are **synchronized** with the 3D animation | Pause → plots freeze. Play → plots resume. |
| 8 | **Selecting a different node** clears and restarts the plots | Click new node → old data gone, new data streams |
| 9 | **Stopping** the animation clears the plot data | Stop → plots disappear or show empty |
| 10 | **Scrubbing** the timeline adds data points to the plots | Drag slider → plot updates with each scrub position |
| 11 | Plotly updates do **not degrade 3D framerate** below 30fps | Animation remains smooth with plots active |
| 12 | **RollingBuffer** passes all unit tests | `node src/test/testRollingBuffer.js` → all pass |
| 13 | Build passes with zero errors | `npm run build` completes cleanly |

---

## Notes for Engineer

- **Install `plotly.js-dist-min`**, not the full `plotly.js`. The full package is ~8MB and will dramatically increase the bundle size.
- **Throttle aggressively.** Plotly DOM operations are orders of magnitude heavier than `needsUpdate = true` on a Three.js buffer. Update at ~10 Hz (every 6th frame), not 60 Hz.
- **Use `Plotly.react()`** for updates, not `Plotly.newPlot()`. `Plotly.react` diffs the data and avoids full redraws. `Plotly.newPlot` would tear down and rebuild the chart every time.
- **`Plotly.purge()`** must be called on unmount to avoid memory leaks. Plotly attaches event listeners and internal state to the DOM node.
- The `RollingBuffer` should use `Float64Array` internally (not `Float32Array`) to avoid precision loss on small kinematic values.
- The `toArray()` method must return a standard `Array` — Plotly does not accept typed arrays.
- The BUFFER_CAPACITY of 500 at 60fps gives ~8.3 seconds of rolling window. Adjust if needed.
- Log your changes in `docs/logs/ENGINEER_LOG.md` per protocol.
