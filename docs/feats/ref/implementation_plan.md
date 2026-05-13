# UX/UI Overhaul — Production Layout

Replace the test harness scaffolding with a polished, immersive visualization workspace. The 3D viewport becomes the full-screen hero, with all controls floating as overlays.

## User Review Required

> [!IMPORTANT]
> **No state management library (Zustand/Redux) will be added in this phase.** The current React state + refs architecture is sufficient for the features described. State management can be introduced in a follow-up phase if cross-component flows become unwieldy.

> [!WARNING]
> **Breaking change to entry point.** `App.jsx` will no longer render `TestHarness2`. It will render a new `ModalVizApp` shell component that manages the landing ↔ workspace transition. `TestHarness2.jsx` will be preserved but unused.

## Proposed Changes

The work is organized into **6 components**, ordered by dependency.

---

### Component 1 — Design System & Global Styles

Establish a dark-themed, engineering-grade design system. All subsequent components will reference these tokens.

#### [MODIFY] [index.css](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/index.css)

Replace the Vite boilerplate CSS with a custom design system:
- Dark background palette (`#0d0f14` base, `#161922` surface, `#1e2230` elevated)
- Accent color: cyan `#00e5ff` (matches the mockup's engineering aesthetic)
- Google Font import: `Inter` (clean, modern, legible at small sizes)
- CSS custom properties for blur effects, border radii, transition timings
- Utility classes for glassmorphism panels (`.glass-panel`)
- Reset styles for `body`, `#root` to enable full-viewport layout

#### [MODIFY] [App.css](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/App.css)

Strip the Vite boilerplate entirely. Replace with component-specific styles:
- `.landing-page` — full-screen centered upload zone
- `.workspace` — full-viewport flex container
- `.toolbar` — compact top bar
- `.viewport-container` — fills remaining space
- `.animation-controls` — floating bottom-center pill
- `.context-menu` — right-click popup
- `.plot-window` — draggable glassmorphic chart container
- `.colorbar-legend` — fixed upper-left overlay

---

### Component 2 — App Shell & Routing

#### [MODIFY] [App.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/App.jsx)

Replace `TestHarness2` import with a new `ModalVizApp` component. This becomes the single source of truth for:
- `parsedData` (geometry buffers from ingestion)
- `engineInstance` (the `ModalKinematicsEngine`)
- Conditional rendering: show `LandingPage` when no data, `Workspace` when data exists

#### [NEW] [ModalVizApp.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/ModalVizApp.jsx)

Top-level layout controller:
```
┌─────────────────────────────────────────┐
│  IF no data loaded → <LandingPage />    │
│  IF data loaded   → <Workspace />       │
│    ├── <Toolbar />                      │
│    ├── <ViewportContainer>              │
│    │     ├── <WebGLViewport />          │
│    │     ├── <ColorBarLegend />  (UL)   │
│    │     ├── <PlotWindow /> × N  (drag) │
│    │     └── <AnimationControls /> (BC)  │
│    └── </ViewportContainer>             │
└─────────────────────────────────────────┘
```

Manages the engine initialization logic currently in `TestHarness2.jsx` (mode shape extraction, engine construction, IC setup).

---

### Component 3 — Landing Page (File Ingestion)

#### [NEW] [LandingPage.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/engine/LandingPage.jsx)

A full-screen, visually striking upload experience:

**Layout:**
- Centered card on a dark gradient background
- App branding at top (ModalViz logo/title with subtle glow)
- Drag-and-drop zone with dashed animated border and drop icon
- "or" divider
- File picker button (styled, not browser default)
- Accepted formats hint: `.csv`, `.txt`

**Behavior:**
- Drag events: `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`
- Highlight border on drag-over (cyan glow)
- On file accept → transition to column mapping step (reuse `DataIngestionWizard` mapping logic)
- The column mapping table is restyled to match the dark theme (currently it uses unstyled HTML `<table>` elements)

**Transitions:**
- File drop/select triggers a fade-in of the mapping table within the same card
- "Confirm & Visualize" button replaces the old "Confirm Mapping & Process" button
- On process complete → `onDataParsed` callback → parent switches to Workspace view

---

### Component 4 — Compact Top Toolbar

#### [NEW] [Toolbar.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/engine/Toolbar.jsx)

A slim (~44px height) glass-panel toolbar anchored to the top of the workspace:

**Contents (left to right):**
1. **App title** — "ModalViz" wordmark (small, left-aligned)
2. **File info** — Current filename, truncated with tooltip
3. **Re-upload button** — Icon button that returns to landing page (resets state)
4. **Mode selector** — Dropdown (moved from SimParams panel): "All Modes" / individual mode isolation
5. **Deformation Axis** — Dropdown (moved from SimParams panel): Normal / X / Y / Z (shown only for 1-DOF data)
6. **Exaggeration scale** — Compact slider with numeric display
7. **Damping ratio** — Small numeric input

**Removed from viewport:**
The `simulation-parameters` div block (lines 732–813 in current `WebGLViewport.jsx`) will be fully replaced by this toolbar + a collapsible "Advanced" panel for initial conditions.

---

### Component 5 — Floating Animation Controls

#### [NEW] [AnimationControls.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/engine/AnimationControls.jsx)

Floating pill-shaped control bar centered at the bottom of the viewport:

**Layout:**
- Glassmorphic background with rounded corners
- Horizontally: `⏹ Stop` | `▶ Play / ⏸ Pause` (toggle) | Timeline slider | `t = 0.000s` display
- Compact, semi-transparent, doesn't obstruct the 3D scene
- `pointerEvents: auto` so clicks register but underlying canvas remains interactive outside the pill

**Behavior:**
- Receives playback handler refs from parent (same `handlePlay`, `handlePause`, `handleStop` logic)
- Timeline slider scrub triggers single-frame evaluation (existing logic extracted)

---

### Component 6 — Right-Click Context Menu & Draggable Plot Windows

This is the core UX change: **left-click = highlight only**, **right-click = plot menu**.

#### [MODIFY] [WebGLViewport.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/engine/WebGLViewport.jsx)

Major refactoring of the viewport component:

**Removed from WebGLViewport:**
- All simulation parameter UI (moved to `Toolbar`)
- All playback control UI (moved to `AnimationControls`)
- `KinematicPlots` rendering (replaced by `PlotWindow` system)
- `ColorBarLegend` rendering (moved to parent, repositioned)

**Added to WebGLViewport:**
- Right-click handler (`onContextMenu` / `pointerup` with `button === 2`)
- Emits `onContextMenu(nodeInfo, screenPosition)` callback to parent
- Left-click only does highlight (no plot clearing/opening)
- The viewport becomes a pure rendering component receiving callbacks from parent

**Initial deformed state:**
- On mount, call `engine.evaluateModalState(0)` and apply the displacement at `t=0` to show the static modal deformation shape instead of the undeformed geometry
- Apply colormap to the initial deformed state

#### [NEW] [ContextMenu.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/engine/ContextMenu.jsx)

Floating context menu appearing at cursor position on right-click of a node:

**Items:**
1. 📈 Plot Position
2. 📈 Plot Velocity
3. 📈 Plot Acceleration

**Behavior:**
- Appears at `(event.clientX, event.clientY)` coordinates
- Clicking a menu item opens a new `PlotWindow` for that quantity
- If the quantity is already plotted for that node → adds/removes the trace (toggle)
- Menu auto-dismisses on item click, click-away, or `Escape`
- Does **not** appear if clicking empty space (no node under cursor)

#### [NEW] [PlotWindow.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/engine/PlotWindow.jsx)

Draggable, glassmorphic 2D chart panel overlaid on the canvas:

**Visual design:**
- `backdrop-filter: blur(12px)` with `rgba(22, 25, 34, 0.75)` background
- Cyan-tinted border (`1px solid rgba(0, 229, 255, 0.3)`)
- Title bar: `Node XX: Position/Velocity/Acceleration` (lists active traces)
- Close button (`×`) in the title bar
- Default size: ~380×280px, positioned near the right-click origin

**Dragging:**
- Title bar is the drag handle
- `onPointerDown` → track offset → `onPointerMove` → update `left/top` → `onPointerUp` → release
- Constrained within the viewport bounds

**Data flow:**
- Each `PlotWindow` instance receives:
  - `nodeId`, `dofIndex` — which node to track
  - `activeTraces` — array of `['position', 'velocity', 'acceleration']`
  - Access to engine kinematic data (via shared rolling buffers or per-window buffers)
- Each window maintains its own `RollingBuffer` instances for time/disp/vel/acc
- Plotly renders overlaid traces with the existing color scheme (cyan/orange/red)

**Multi-window management (in parent `ModalVizApp`):**
- State: `plotWindows: [{ id, nodeId, dofIndex, traces: ['position'], position: {x, y} }, ...]`
- Right-click menu creates a new entry or toggles a trace on an existing entry for the same node
- `Escape` key → clears all entries
- Close button → removes one entry

#### [MODIFY] [ColorBarLegend.jsx](file:///c:/Users/meles/OneDrive/Desktop/mati/Git/modalViz/modal-kinematics/src/engine/ColorBarLegend.jsx)

Reposition from `right: 16px` to `left: 16px, top: 16px`. Make it a compact vertical bar that doesn't stretch the full height. Approximate height: 200px. Add the label "Displacement Magnitude" rotated vertically alongside it.

---

## File Summary

| Action | File | Component |
|--------|------|-----------|
| MODIFY | `index.css` | Design system |
| MODIFY | `App.css` | Component styles |
| MODIFY | `App.jsx` | Shell routing |
| NEW | `ModalVizApp.jsx` | App shell |
| NEW | `LandingPage.jsx` | File upload |
| NEW | `Toolbar.jsx` | Top toolbar |
| NEW | `AnimationControls.jsx` | Playback controls |
| NEW | `ContextMenu.jsx` | Right-click menu |
| NEW | `PlotWindow.jsx` | Draggable 2D plots |
| MODIFY | `WebGLViewport.jsx` | Strip UI, add right-click, initial deformation |
| MODIFY | `ColorBarLegend.jsx` | Reposition to upper-left |
| PRESERVE | `TestHarness2.jsx` | Keep for reference, no longer rendered |

---

## Open Questions

> [!IMPORTANT]
> **Initial Conditions panel** — The current IC panel (per-DOF d₀/v₀ inputs + Apply button) is a power-user feature. Should it:
> - (A) Live in a collapsible "Advanced" drawer that slides out from the toolbar?
> - (B) Be accessible via a settings/gear icon in the toolbar?
> - (C) Be deferred to a later phase entirely?

> [!NOTE]
> **Google Fonts** — The plan uses `Inter` via CDN. Is that acceptable, or should we bundle the font locally to avoid external network dependencies?

---

## Verification Plan

### Automated Tests
- `npm run build` — Ensure production build compiles with zero errors
- Existing unit tests (`testColormap.js`, `testEngineExtensions.js`, `testRollingBuffer.js`) must continue to pass
- Browser test: navigate to `localhost:5173`, verify landing page renders

### Manual Verification
- Drop a CSV file → column mapping appears → process → workspace loads
- Verify initial state shows modal deformation (not undeformed geometry)
- Left-click a node → highlight only, no plot
- Right-click a node → context menu appears with 3 options
- Select "Plot Position" → draggable glassmorphic plot window appears
- Right-click same node → "Plot Velocity" → trace added to existing window
- Right-click a different node → new plot window opens
- Drag plot windows around the viewport
- Press Escape → all plot windows close
- Toolbar controls (mode, axis, damping, exaggeration) update the 3D scene in real-time
- Animation controls (play/pause/stop/scrub) work correctly
- Colorbar is in the upper-left corner
