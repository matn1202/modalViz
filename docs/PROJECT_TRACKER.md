# ModalViz — Project Tracker
> **Last audited:** 2026-05-12  
> **Reference architecture:** `FEA_Modal_Kinematics_Architecture.md`  
> **Build status:** ✅ Compiles (Vite production build passes, 26 modules, 0 errors)

---

## Stack Snapshot

| Layer | Technology | Version | Installed |
|---|---|---|---|
| Framework | React | 19.2.5 | ✅ |
| Bundler | Vite | 8.0.10 | ✅ |
| 3D Engine | Three.js | 0.184.0 | ✅ |
| CSV Parser | PapaParse | 5.5.3 | ✅ |
| 2D Plotting | Plotly.js | — | ❌ Not installed |
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
| Plotly.js dependency | `package.json` | ❌ Not installed | Not in dependencies |
| `THREE.Raycaster` node picking | — | ❌ Not started | — |
| Node ID resolution from ray hit | — | ❌ Not started | — |
| Visual highlight of selected node | — | ❌ Not started | — |
| Displacement vs. Time plot | — | ❌ Not started | — |
| Velocity vs. Time plot | — | ❌ Not started | — |
| Acceleration vs. Time plot | — | ❌ Not started | — |
| Plotly streaming (`extendTraces`) | — | ❌ Not started | — |
| Rolling-window oscilloscope sync | — | ❌ Not started | — |

**Phase 4 verdict: ❌ NOT STARTED** — No work has begun. Plotly.js is not even installed.

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
| **Phase 2** | 3D Engine Construction | ⚠️ **~90%** (point cloud only, no mesh faces) |
| **Phase 3** | Animation, Contour, Transients | ✅ **Complete** |
| **Phase 4** | Raycasting & 2D Plots | ❌ **0%** |
| **UI/UX** | Production layout & styling | ❌ **0%** |
| **State Mgmt** | Redux / Zustand integration | ❌ **0%** |

### Next available work (ordered by dependency):
1. **Phase 2 gap** — Add mesh face connectivity (requires input format decision: are faces in the CSV, or auto-generated via Delaunay?)
2. **Phase 4** — Install Plotly.js + raycasting + 2D plot panels
3. **UI/UX** — Replace test harnesses with a polished production layout
4. **State Management** — Introduce Zustand/Redux for cross-component data flows
