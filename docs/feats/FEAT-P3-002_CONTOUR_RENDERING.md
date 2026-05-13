# 🎨 FEAT-P3-002: Jet Colormap & Dynamic Contour Rendering

> **Phase:** 3 — Animation Loop, Contour Rendering & Transient Dynamics  
> **Priority:** 🟡 High (core visual feedback)  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-12  
> **Status:** ✅ Complete (verified 2026-05-12 — 12/12 unit tests pass)  
> **Depends on:** FEAT-P3-001 (Animation Controller & Playback Loop)  
> **Blocks:** None (FEAT-P3-003 and FEAT-P3-004 are parallel-safe after P3-001)

---

## Objective

Implement real-time dynamic contour color mapping on the 3D point cloud (and future mesh). At every animation frame, compute the displacement magnitude per node, map it to a Jet/Rainbow colormap, update the GPU color buffer, and overlay a color bar legend showing the live min/max range.

---

## Architecture Reference

- **Section 4.1** — Deformation magnitude: `M_i(t) = sqrt(u_xi² + u_yi² + u_zi²)`
- **Section 8.1, Step 4** — Displacement magnitude mapped to RGB via Jet/Rainbow colormap
- **Section 8.1, Step 5** — `geometry.attributes.color.needsUpdate = true`
- **Section 8.1, Step 6** — Color bar legend with live min/max values

---

## Current State

- Colors are initialized to static grey (`0.8, 0.8, 0.8`) in `WebGLViewport.jsx` (lines 69–71).
- The `color` BufferAttribute exists and `vertexColors: true` is set on the material.
- `geometry.attributes.color.needsUpdate = true` is **never called** — no dynamic color updates exist.
- No colormap function exists anywhere in the codebase.

---

## Required Changes

### 1. Create the Jet Colormap Utility

#### File: `modal-kinematics/src/engine/colormap.js` [NEW]

Create a standalone, pure utility function that maps a normalized scalar `[0, 1]` to an RGB triplet using the classic Jet colormap (blue → cyan → green → yellow → red).

```javascript
/**
 * Jet Colormap — maps a scalar t ∈ [0, 1] to [R, G, B] ∈ [0, 1].
 * Interpolation: blue → cyan → green → yellow → red
 * 
 * @param {number} t - Normalized value in [0, 1]. Values outside are clamped.
 * @returns {[number, number, number]} RGB triplet, each channel in [0, 1].
 */
export function jetColormap(t) {
    // Clamp input
    t = Math.max(0, Math.min(1, t));
    
    let r, g, b;
    
    if (t < 0.125) {
        r = 0;
        g = 0;
        b = 0.5 + t * 4; // 0.5 → 1.0
    } else if (t < 0.375) {
        r = 0;
        g = (t - 0.125) * 4; // 0 → 1
        b = 1;
    } else if (t < 0.625) {
        r = (t - 0.375) * 4; // 0 → 1
        g = 1;
        b = 1 - (t - 0.375) * 4; // 1 → 0
    } else if (t < 0.875) {
        r = 1;
        g = 1 - (t - 0.625) * 4; // 1 → 0
        b = 0;
    } else {
        r = 1 - (t - 0.875) * 4; // 1 → 0.5
        g = 0;
        b = 0;
    }
    
    return [r, g, b];
}
```

**Design decision:** This is a pure function with zero dependencies — fast, testable, and reusable. The Jet colormap was chosen per the architecture doc's specification (Section 4.1: "Jet/Turbo: blue = zero displacement → red = maximum displacement").

---

### 2. Integrate Contour Updates into the Animation Loop

#### File: `modal-kinematics/src/engine/WebGLViewport.jsx` [MODIFY]

Inside the `animate()` function (added in FEAT-P3-001), after computing the displacement vector, add color mapping:

```javascript
import { jetColormap } from './colormap.js';

// Inside the animate() function, after computing displacement:

if (isPlaying && engine) {
    // ... [existing displacement code from FEAT-P3-001] ...
    
    // --- CONTOUR RENDERING ---
    const colorArray = geometry.attributes.color.array;
    
    // 1. Compute displacement magnitude per node
    let minMag = Infinity;
    let maxMag = -Infinity;
    
    // Temporary array for magnitudes (avoid redundant computation)
    const magnitudes = new Float32Array(numNodes);
    
    for (let i = 0; i < numNodes; i++) {
        // For 1-DOF: magnitude is |u_i|
        // For 3-DOF: magnitude = sqrt(ux² + uy² + uz²) per architecture Section 4.1
        const mag = Math.abs(displacement[i]); // Simplified for 1-DOF
        magnitudes[i] = mag;
        if (mag < minMag) minMag = mag;
        if (mag > maxMag) maxMag = mag;
    }
    
    // 2. Normalize and map to colormap
    const range = maxMag - minMag;
    const invRange = range > 1e-10 ? 1.0 / range : 0; // Guard against division by zero
    
    for (let i = 0; i < numNodes; i++) {
        const normalized = (magnitudes[i] - minMag) * invRange;
        const [r, g, b] = jetColormap(normalized);
        colorArray[i * 3]     = r;
        colorArray[i * 3 + 1] = g;
        colorArray[i * 3 + 2] = b;
    }
    
    // 3. Signal GPU to upload modified color buffer
    geometry.attributes.color.needsUpdate = true;
    
    // 4. Store current min/max for the color bar legend
    colorRangeRef.current = { min: minMag, max: maxMag };
}
```

---

### 3. Build the Color Bar Legend Overlay

#### File: `modal-kinematics/src/engine/ColorBarLegend.jsx` [NEW]

Create a React component that renders a vertical gradient bar with min/max labels, overlaid on top of the viewport.

```jsx
import React from 'react';
import { jetColormap } from './colormap.js';

/**
 * Color bar legend overlay for the 3D viewport.
 * Displays a vertical Jet colormap gradient with live min/max displacement values.
 */
export default function ColorBarLegend({ min, max, label = 'Displacement Magnitude' }) {
    // Generate CSS gradient stops from the Jet colormap
    const stops = [];
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
        const t = i / numStops;
        const [r, g, b] = jetColormap(t);
        const pct = (1 - t) * 100; // Invert: red on top, blue on bottom
        stops.push(`rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)}) ${pct}%`);
    }
    const gradient = `linear-gradient(to bottom, ${stops.join(', ')})`;
    
    return (
        <div className="colorbar-legend" style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            bottom: '16px',
            width: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none', // Don't block orbit controls
        }}>
            {/* Label */}
            <span style={{ 
                fontSize: '10px', color: '#ccc', marginBottom: '4px',
                writingMode: 'vertical-rl', textOrientation: 'mixed',
                transform: 'rotate(180deg)'
            }}>
                {label}
            </span>
            
            {/* Max value */}
            <span style={{ fontSize: '10px', color: '#fff', marginBottom: '2px' }}>
                {max?.toFixed(4) ?? '—'}
            </span>
            
            {/* Gradient bar */}
            <div style={{
                flex: 1,
                width: '16px',
                background: gradient,
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.2)',
            }} />
            
            {/* Min value */}
            <span style={{ fontSize: '10px', color: '#fff', marginTop: '2px' }}>
                {min?.toFixed(4) ?? '—'}
            </span>
        </div>
    );
}
```

#### Integration in `WebGLViewport.jsx`:

Wrap the mount div and color bar in a positioned container:

```jsx
return (
    <div style={{ position: 'relative' }}>
        <div ref={mountRef} style={{ width: '100%', height: '600px', ... }} />
        {engine && (
            <ColorBarLegend 
                min={colorRange.min} 
                max={colorRange.max} 
            />
        )}
        {/* Playback controls from FEAT-P3-001 */}
    </div>
);
```

Use a `useState` to expose `colorRange` to the React render cycle, updated periodically (e.g., every 10 frames) via a counter inside the animation loop to avoid per-frame React re-renders:

```javascript
// Inside animate():
frameCountRef.current++;
if (frameCountRef.current % 10 === 0) {
    setColorRange({ min: minMag, max: maxMag }); // Trigger re-render for legend
}
```

---

### 4. Handle the Stopped State (Reset Colors)

When the user clicks **Stop** (FEAT-P3-001), reset colors back to neutral grey:

```javascript
const handleStop = () => {
    // ... existing position reset ...
    
    // Reset colors to neutral grey
    const colorArray = geometryRef.current.attributes.color.array;
    for (let i = 0; i < colorArray.length; i++) {
        colorArray[i] = 0.8;
    }
    geometryRef.current.attributes.color.needsUpdate = true;
    setColorRange({ min: 0, max: 0 });
};
```

---

## Files Affected

| File | Action | Summary |
|---|---|---|
| `modal-kinematics/src/engine/colormap.js` | **NEW** | Pure Jet colormap function: `jetColormap(t) → [r, g, b]` |
| `modal-kinematics/src/engine/ColorBarLegend.jsx` | **NEW** | React overlay component with gradient bar + live min/max labels |
| `modal-kinematics/src/engine/WebGLViewport.jsx` | **MODIFY** | Import colormap, compute magnitudes, update color buffer per frame, render color bar legend |

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | During playback, node colors **dynamically change** per frame | Load CSV → Play → colors shift from blue ↔ red |
| 2 | Colors map to **displacement magnitude** (blue = min, red = max) | Nodes with highest deformation appear red |
| 3 | **Color bar legend** is visible overlaid on the viewport | Visual: vertical gradient bar with numbers on right side |
| 4 | Color bar legend shows **live min/max** values that update during animation | Values change as the simulation progresses |
| 5 | **Stopping** resets colors to neutral grey | Stop → all nodes grey, color bar shows `0.0000` |
| 6 | Color bar legend does **not block** orbit controls (mouse passes through) | Can click/drag through the legend area |
| 7 | `jetColormap(0)` returns blue, `jetColormap(1)` returns red | Unit test or manual console check |
| 8 | Build passes with zero errors | `npm run build` completes cleanly |

---

## Unit Tests

### File: `modal-kinematics/src/test/testColormap.js` [NEW]

The `jetColormap` function is a pure function with 5 piecewise branches and boundary edge cases. It **must** be tested before integration. Follow the existing `testEx1.js` console-based pattern.

```javascript
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
```

**How to run:** `node --experimental-modules src/test/testColormap.js` from the `modal-kinematics/` directory.

> **This test file must pass before the contour rendering integration is considered complete.**

---

## Notes for Engineer

- The `jetColormap` function must be **pure** and have **zero dependencies**. It will be reused in Phase 4 for Plotly integration.
- Use `pointerEvents: 'none'` on the color bar legend container so it doesn't interfere with orbit controls.
- Throttle the React state update for the color bar (every ~10 frames) — setting state on every `requestAnimationFrame` would cause excessive re-renders.
- For the 3-DOF case (future data), magnitude calculation becomes `sqrt(ux² + uy² + uz²)`. Add a code comment noting this adaptation point.
- Log your changes in `docs/logs/ENGINEER_LOG.md` per protocol.
