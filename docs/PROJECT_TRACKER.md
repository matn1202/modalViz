# ModalViz — Project Tracker
> **Last audited:** 2026-05-13  
> **Reference architecture:** `FEA_Modal_Kinematics_Architecture.md`  
> **Build status:** ✅ Compiles (Vite production build passes, 29 modules, 0 errors)

---

## Stack Snapshot

| Layer | Technology | Version | Installed |
|---|---|---|---|
| Framework | React | 19.2.5 | ✅ |
| Bundler | Vite | 8.0.10 | ✅ |
| 3D Engine | Three.js | 0.184.0 | ✅ |
| CSV Parser | PapaParse | 5.5.3 | ✅ |
| 2D Plotting | Plotly.js (dist-min) | 3.5.1 | ✅ |
| State Mgmt | Redux / Zustand | — | ❌ Not installed |

---

## Architecture Phases — Status Matrix

### Phase 1: Data Ingestion & Math Engine
**Architecture goal:** Client-side CSV loading, column mapping, typed-array buffers, core modal kinematics math.

| Feature | File | Status | Notes |
|---|---|---|---|
| File upload (HTML5 File API) | `DataIngestionWizard.jsx` | ✅ Done | Accepts `.csv` and `.txt` |
| PapaParse preview (first 5 rows) | `DataIngestionWizard.jsx` | ✅ Done | Non-worker preview for mapping UI |
| Column-to-role dropdown mapping | `DataIngestionWizard.jsx` | ✅ Done | All 6 required roles: Node ID, X/Y/Z, Frequency, Modal Shape Value |
| Validation (all roles assigned) | `DataIngestionWizard.jsx` | ✅ Done | Blocks processing if roles are missing |
| Full parse with Web Worker | `DataIngestionWizard.jsx` | ✅ Done | `worker: true` flag on PapaParse |
| Typed Array buffer allocation | `DataIngestionWizard.jsx` | ✅ Done | `Int32Array` (nodes), `Float32Array` (coords, freqs, shapes) |
| Header row skip | `DataIngestionWizard.jsx` | ✅ Done | `rawData.slice(1)` drops header |
| `ModalKinematicsEngine` class | `ModalKinematicsEngine.js` | ✅ Done | Constructor, ωn, ωd pre-calc |
| `setInitialConditions()` | `ModalKinematicsEngine.js` | ✅ Done | Modal projection with M=I fallback |
| `evaluateModalState(t)` | `ModalKinematicsEngine.js` | ✅ Done | Analytical transient: q, q̇, q̈ |
| `getGlobalDisplacement()` | `ModalKinematicsEngine.js` | ✅ Done | Full modal superposition u(t) |
| `getScopedKinematics(dofIndex)` | `ModalKinematicsEngine.js` | ✅ Done | O(m) targeted dot product extraction |
| `setActiveModes(modeIndices)` | `ModalKinematicsEngine.js` | ✅ Done | Mode isolation/full superposition toggle (Phase 3 addition) |
| `setDampingRatio(zeta)` | `ModalKinematicsEngine.js` | ✅ Done | Dynamic ωd recalculation (Phase 3 addition) |
| Mock test data | `test/MockData.csv`, `MockNodes.txt` | ✅ Present | 2-node, 2-mode 1D problem |
| Pipeline test harness (v1) | `test/TestHarness.jsx` | ✅ Done | Ingestion → Engine → Table output |
| Standalone engine test script | `test/testEx1.js` | ✅ Present | Console-based validation |
| Colormap unit tests | `test/testColormap.js` | ✅ Done | 12 assertions, all passing |
| Engine extension tests | `test/testEngineExtensions.js` | ✅ Done | 7 assertions, all passing |

**Phase 1 verdict: ✅ COMPLETE** — All core ingestion and math features are implemented and testable.

---

### Phase 2: 3D Engine Construction (Three.js)
**Architecture goal:** WebGL viewport, static geometry, orbit controls, buffer geometry with color attribute.

| Feature | File | Status | Notes |
|---|---|---|---|
| Scene, Camera, Renderer init | `WebGLViewport.jsx` | ✅ Done | Dark bg (0x1a1a1a), perspective cam, antialiased |
| Ambient + Directional lighting | `WebGLViewport.jsx` | ✅ Done | 0.6 ambient, 0.8 directional |
| Axes helper (RGB) | `WebGLViewport.jsx` | ✅ Done | Size 2 |
| Grid helper | `WebGLViewport.jsx` | ✅ Done | 5×10 grid, offset -0.5 |
| `BufferGeometry` from typed arrays | `WebGLViewport.jsx` | ✅ Done | Position + color attributes |
| `PointsMaterial` with `vertexColors` | `WebGLViewport.jsx` | ✅ Done | Point cloud rendering (size 0.1) |
| Camera auto-centering (bounding sphere) | `WebGLViewport.jsx` | ✅ Done | Positions cam at 1.5× radius |
| `OrbitControls` (rotate/pan/zoom) | `WebGLViewport.jsx` | ✅ Done | Damping enabled (0.05), FIX-001 resolved |
| Render loop (`requestAnimationFrame`) | `WebGLViewport.jsx` | ✅ Done | Updates controls + renders each frame |
| Window resize handler | `WebGLViewport.jsx` | ✅ Done | Responsive aspect ratio |
| Cleanup on unmount | `WebGLViewport.jsx` | ✅ Done | Disposes geometry, material, renderer, controls; StrictMode-safe |
| Full pipeline test (Ingestion → 3D) | `test/TestHarness2.jsx` | ✅ Done | Currently the **active** App entry point |
| Mesh rendering (faces/triangles) | — | ❌ Not started | Only point cloud exists; no `THREE.Mesh` with face connectivity |

**Phase 2 verdict: ⚠️ MOSTLY COMPLETE** — Static point cloud renders with full controls. Missing: triangle mesh (face connectivity / Delaunay). Current geometry only supports scatter-like point visualization, not solid structural meshes.

---

### Phase 3: Animation Loop, Contour Rendering & Transient Dynamics
**Architecture goal:** Real-time deformation animation, dynamic contour color mapping, playback controls, initial condition UI.

| Feature | File | Status | Notes |
|---|---|---|---|
| Play/Pause/Stop controls | `WebGLViewport.jsx` | ✅ Done | Playback state machine via `useRef` |
| Scrub/timeline slider | `WebGLViewport.jsx` | ✅ Done | Range input 0–5s, evaluates single frame on scrub |
| Animation loop (time-driven deformation) | `WebGLViewport.jsx` | ✅ Done | Delta-time based, frame-rate-independent |
| In-place vertex position updates | `WebGLViewport.jsx` | ✅ Done | `position.needsUpdate = true` per frame; handles 1-DOF and 3-DOF |
| Jet/Rainbow colormap function | `colormap.js` | ✅ Done | Pure function, 5 branches, 12 unit tests passing |
| Dynamic contour color updates | `WebGLViewport.jsx` | ✅ Done | `color.needsUpdate = true` per frame; magnitude-normalized |
| Color bar legend overlay | `ColorBarLegend.jsx` | ✅ Done | Jet gradient, live min/max, `pointerEvents: none` |
| Exaggeration scale slider (S factor) | `WebGLViewport.jsx` | ✅ Done | Range 0.1–100, wired via `useRef` for 60fps |
| Initial condition input UI (d₀, v₀) | `WebGLViewport.jsx` | ✅ Done | Per-DOF inputs with Apply button |
| Modal projection from IC inputs | `WebGLViewport.jsx` | ✅ Done | Calls `engine.setInitialConditions()`, resets t=0 |
| Damping ratio input | `WebGLViewport.jsx` | ✅ Done | Number input, auto-restarts transient on change |
| Frequency/mode selector dropdown | `WebGLViewport.jsx` | ✅ Done | All Modes (superposition) or single mode isolation |

**Phase 3 verdict: ✅ COMPLETE** — All animation, contour, and transient dynamics features are implemented and functional.

---

### Phase 4: Raycasting & Plotly.js Integration
**Architecture goal:** Node click selection via raycasting, concurrent 2D kinematic plots (displacement, velocity, acceleration).

| Feature | File | Status | Notes |
|---|---|---|---|
| Plotly.js dependency | `package.json` | ✅ Done | `plotly.js-dist-min@^3.5.1` installed |
| `THREE.Raycaster` node picking | `WebGLViewport.jsx` | ✅ Done | Point cloud threshold 0.1, NDC conversion |
| Click vs. drag discrimination | `WebGLViewport.jsx` | ✅ Done | 3px pointer distance threshold |
| Node ID resolution from ray hit | `WebGLViewport.jsx` | ✅ Done | Maps vertex index → physical Node ID |
| Visual highlight of selected node | `WebGLViewport.jsx` | ✅ Done | Green sphere (0x00ff88), opacity 0.8, tracks deformed position |
| Deselection (click empty / clear button) | `WebGLViewport.jsx` | ✅ Done | Clicking empty space or ✕ button clears selection |
| Selected node info badge | `WebGLViewport.jsx` | ✅ Done | Monospace badge with Node ID + DOF index |
| `RollingBuffer` utility | `RollingBuffer.js` | ✅ Done | Float64Array circular buffer, capacity 500, 15 unit tests passing |
| Scoped kinematic extraction in animate loop | `WebGLViewport.jsx` | ✅ Done | `getScopedKinematics(dofIndex)` per frame |
| Plotly update throttling (~10 Hz) | `WebGLViewport.jsx` | ✅ Done | Every 6th frame via `frameCountRef` |
| Displacement vs. Time plot | `KinematicPlots.jsx` | ✅ Done | Cyan line, dark theme, `Plotly.react()` |
| Velocity vs. Time plot | `KinematicPlots.jsx` | ✅ Done | Orange line, dark theme |
| Acceleration vs. Time plot | `KinematicPlots.jsx` | ✅ Done | Red line, dark theme |
| Rolling-window oscilloscope sync | `WebGLViewport.jsx` | ✅ Done | 500-sample window via `RollingBuffer`, clears on stop/node change |
| Timeline scrub → plot update | `WebGLViewport.jsx` | ✅ Done | Scrub handler pushes scoped kinematics to buffers |
| Plotly cleanup on unmount | `KinematicPlots.jsx` | ✅ Done | `Plotly.purge()` in useEffect cleanup |
| RollingBuffer unit tests | `testRollingBuffer.js` | ✅ Done | 15 assertions, all passing |

**Phase 4 verdict: ✅ COMPLETE** — All raycasting, node selection, and 2D plotting features are implemented and functional.

---

### Phase 5: Generalization & Topology
**Architecture goal:** Handle 1D/2D/3D datasets gracefully with correct topological rendering (lines/faces) and arbitrary degrees of freedom.

| Feature | File | Status | Notes |
|---|---|---|---|
| Multi-DOF CSV Mapping | `DataIngestionWizard.jsx` | ✅ Done | Map up to 3 modal shape columns (FEAT-P5-001) |
| Multi-DOF Engine Init | `TestHarness2.jsx` | ✅ Done | Initialize engine with 1 or 3 dofsPerNode (FEAT-P5-001) |
| Dimensionality Heuristic | `WebGLViewport.jsx` | ✅ Done | Detect 1D (beam) vs 2D (plate) via variance (FEAT-P5-002) |
| 1D Auto-Topology (Lines) | `WebGLViewport.jsx` | ✅ Done | Generate `THREE.LineSegments` for 1D datasets (FEAT-P5-002) |
| 2D Auto-Topology (Faces) | `WebGLViewport.jsx` | ✅ Done | Generate `THREE.Mesh` via Delaunay triangulation (FEAT-P5-002) |
| Selectable Displ. Axis | `WebGLViewport.jsx` | ✅ Done | UI to select X, Y, Z, or Normal for 1-DOF data (FEAT-P5-003) |
| Normal-based deformation | `WebGLViewport.jsx` | ✅ Done | Displace nodes along surface normal (FEAT-P5-003) |

**Phase 5 verdict: ✅ COMPLETE** — Generalization features, selectable axis, and auto-topology are fully implemented.

---

## UI/UX Overhaul — Production Layout
**Architecture goal:** Replace the test harness with a polished, immersive visualization workspace. The 3D viewport becomes the full-screen hero, with all controls floating as overlays.

| Feature | File(s) | Owner | Status | Notes |
|---|---|---|---|---|
| Design System & Global Styles | `index.css`, `App.css` | 🎨 UI Agent | ✅ Done | FEAT-UI-001 |
| App Shell & Routing | `App.jsx`, `ModalVizApp.jsx` | ⚙️ Engineer | ✅ Done | FEAT-UI-002 |
| Landing Page (File Ingestion) | `LandingPage.jsx` | ⚙️ Engineer + 🎨 UI | ✅ Done | FEAT-UI-002 |
| WebGLViewport Refactoring | `WebGLViewport.jsx` | ⚙️ Engineer | ❌ Not started | FEAT-UI-005 |
| Workspace Toolbar & Controls | `Toolbar.jsx`, `AnimationControls.jsx` | ⚙️ Engineer + 🎨 UI | ✅ Done | FEAT-UI-003 |
| Context Menu & Plot Windows | `ContextMenu.jsx`, `PlotWindow.jsx` | ⚙️ Engineer + 🎨 UI | ✅ Done | FEAT-UI-004 |
| ColorBar Repositioning | `ColorBarLegend.jsx` | ⚙️ Engineer | ✅ Done | FEAT-UI-004 |
| Playback Controls Overlay | `index.css`, `AnimationControls.jsx` | 🎨 UI Agent | ✅ Done | FEAT-UI-006 |

---

## Application Wiring & UI Status

| Concern | Status | Notes |
|---|---|---|
| App entry point | ✅ Working | `App.jsx` renders `TestHarness2` |
| CSS / Styling | ⚠️ Placeholder | `App.css` and `index.css` are Vite boilerplate with dark/light theme variables; no custom FEA UI styling |
| MVC separation | ⚠️ Partial | Engine (Model) is cleanly separated. No formal Controller layer. Views are tightly coupled to test harnesses |
| State management (Redux/Zustand) | ❌ Not started | Architecture mandates a predictable state container; none installed |
| Production UI layout | ❌ Not started | Only test harnesses exist; no polished layout or navigation |

---

## Non-Core Files

| File | Purpose | Notes |
|---|---|---|
| `read_pdf.cjs` | PDF text extraction utility | Node.js script using `pdf-parse`; unrelated to the web app |
| `parsed_pdf.txt` | Output from PDF reader | Likely the source text of the architecture doc |
| Root `package.json` | Parent workspace | Contains `pdf-parse`, `papaparse`, `react`, `react-papaparse`; acts as a scratchpad workspace |

---

## Summary Dashboard

| Phase | Description | Progress |
|---|---|---|
| **Phase 1** | Data Ingestion & Math Engine | ✅ **Complete** |
| **Phase 2** | 3D Engine Construction | ✅ **Complete** (topology gap closed by Phase 5) |
| **Phase 3** | Animation, Contour, Transients | ✅ **Complete** |
| **Phase 4** | Raycasting & 2D Plots | ✅ **Complete** |
| **Phase 5** | Generalization & Topology | ✅ **Complete** |
| **UI/UX** | Production layout & styling | 🟡 **Planned** (5 feature files ready) |
| **State Mgmt** | Redux / Zustand integration | ❌ **Deferred** (not needed for current scope) |

### Implementation Order (UI/UX Phase):
1. **FEAT-UI-001** — Design System & Global Styles (🎨 UI Agent)
2. **FEAT-UI-002** — App Shell & Landing Page (⚙️ Engineer + 🎨 UI Agent)
3. **FEAT-UI-005** — WebGLViewport Refactoring (⚙️ Engineer)
4. **FEAT-UI-003** — Workspace Toolbar & Controls (⚙️ Engineer + 🎨 UI Agent)
5. **FEAT-UI-004** — Context Menu & Plot Windows (⚙️ Engineer + 🎨 UI Agent)
6. **FEAT-UI-006** — Playback Controls Overlay Positioning (🎨 UI Agent)
