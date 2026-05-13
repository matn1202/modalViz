# FEAT-UI-005: WebGLViewport Refactoring

> **Owner Agent:** ⚙️ Code Engineer  
> **Supporting Agents:** None  
> **Rationale:** Pure code refactoring — stripping UI from WebGLViewport, lifting state, adding callback props. No visual/styling work involved.

## Objective
Transform `WebGLViewport.jsx` from a monolithic 827-line component (rendering + UI controls + plotting) into a focused Three.js rendering surface that delegates all UI to sibling components. This is a prerequisite for FEAT-UI-003 and FEAT-UI-004 to integrate cleanly.

## Specifications

### 1. Responsibilities Removed

The following code blocks must be **deleted** from `WebGLViewport.jsx`:

| Lines (approx.) | Block | Moved To |
|---|---|---|
| 623–730 | `.playback-controls` div (Play/Pause/Stop buttons, slider, time display, node badge) | `AnimationControls.jsx` + `Toolbar.jsx` |
| 732–813 | `.simulation-parameters` div (mode selector, axis selector, exaggeration slider, damping input, IC panel) | `Toolbar.jsx` |
| 816–824 | `<KinematicPlots>` conditional rendering | `PlotWindow.jsx` (multiple instances) |
| 618–622 | `<ColorBarLegend>` rendering | Moved to parent `ModalVizApp` viewport container |

### 2. State Removed from WebGLViewport

The following React state and handlers must be **lifted to `ModalVizApp`** or the respective new components:

- `selectedModeIndex`, `setSelectedModeIndex`, `handleModeChange` → Toolbar
- `dampingRatio`, `setDampingRatio`, `handleDampingChange` → Toolbar
- `exaggerationScale`, `setExaggerationScale`, `handleExaggerationChange`, `exaggerationRef` → Toolbar
- `icDisplacements`, `icVelocities`, `handleICChange`, `handleApplyIC` → Toolbar (IC panel)
- `selectedAxisUI`, `setSelectedAxisUI`, `selectedAxisRef`, `handleAxisChange` → Toolbar
- `plotData`, `setPlotData` → Removed (replaced by PlotWindow system)
- `timeBuf`, `dispBuf`, `velBuf`, `accBuf` (rolling buffers) → Moved to PlotWindow instances

### 3. State Retained in WebGLViewport

These remain as internal component state (not lifted):

- `mountRef`, `sceneRef`, `geometryRef`, `restPositionsRef` — Three.js internals
- `selectedNodeRef`, `highlightMeshRef`, `selectedNodeInfo`, `setSelectedNodeInfo` — node selection is still driven by the viewport
- `colorRange`, `setColorRange`, `frameCountRef` — contour rendering
- Playback state refs (`playbackStateRef`, `simTimeRef`, `lastTimestampRef`) — animation loop timing

### 4. New Prop Interface

```jsx
WebGLViewport({
  geometryData,       // parsed buffers
  engine,             // ModalKinematicsEngine instance

  // Playback (controlled by AnimationControls via parent)
  playbackStateRef,   // useRef('stopped' | 'playing' | 'paused')
  simTimeRef,         // useRef(number) — current simulation time
  sliderRef,          // useRef — bound to timeline slider in AnimationControls
  timeDisplayRef,     // useRef — bound to time display in AnimationControls

  // Simulation parameters (controlled by Toolbar via parent)
  exaggerationRef,    // useRef(number)
  selectedAxisRef,    // useRef('Normal'|'X'|'Y'|'Z')

  // Callbacks
  onNodeSelect,       // (nodeInfo | null) => void — left-click selection
  onNodeRightClick,   // (nodeInfo, screenPos) => void — right-click for context menu
  onColorRangeChange, // ({ min, max }) => void — for ColorBarLegend

  // Plot data feed (imperative, not state-driven)
  plotWindowRefs,     // Map<windowId, { pushData(t, kin) }> — per-frame kinematic push
})
```

### 5. Right-Click Handler Implementation

```
Viewport `contextmenu` event listener:
  1. event.preventDefault()  // suppress browser default menu
  2. Perform raycaster intersection (same as left-click)
  3. If hit: call onNodeRightClick({ vertexIndex, nodeId, dofIndex }, { x: event.clientX, y: event.clientY })
  4. If no hit: do nothing
```

### 6. Initial Deformation on Mount

After building the geometry and before the first render:
1. Call `engine.evaluateModalState(0)`
2. Get `displacement = engine.getGlobalDisplacement()`
3. Apply displacement to position buffer (same logic as animation loop)
4. Compute contour colors from magnitudes
5. Set `needsUpdate = true` on both position and color attributes
6. Call `onColorRangeChange({ min, max })` so the ColorBarLegend shows correct values

This ensures the user sees the modal deformation shape immediately, not the undeformed geometry.

### 7. Animation Loop Changes

The per-frame kinematic extraction (currently lines 434–451) changes from pushing to local buffers to:

```js
// Per-frame: push kinematics to all active PlotWindow instances
if (plotWindowRefs?.current) {
    for (const [windowId, ref] of plotWindowRefs.current.entries()) {
        if (ref.pushData) {
            const kin = engine.getScopedKinematics(ref.dofIndex);
            ref.pushData(simTimeRef.current, kin);
        }
    }
}
```

This keeps the animation loop at O(m × w) where m = modes, w = active windows — negligible overhead.

## Dependencies
- FEAT-UI-001 (Design System) — background color consistency.
- FEAT-UI-002 (App Shell) — `ModalVizApp` must exist to receive the lifted state.

## Acceptance Criteria
- [ ] `WebGLViewport.jsx` contains no HTML controls (no `<button>`, `<select>`, `<input>`, `<div>` with click handlers for UI).
- [ ] The component's JSX return is a single `<div ref={mountRef}>` with no children.
- [ ] The viewport renders the initial modal deformation shape (not undeformed geometry) on mount.
- [ ] Left-click highlights a node and calls `onNodeSelect`.
- [ ] Right-click on a node calls `onNodeRightClick` with screen coordinates.
- [ ] Browser context menu is suppressed on the canvas.
- [ ] Animation loop pushes kinematic data to `plotWindowRefs` per frame.
- [ ] All existing visual functionality (deformation, colormap, highlight tracking) is preserved.
- [ ] Component line count is reduced from ~827 to ~400-500.
