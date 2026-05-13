# FEAT-UI-002: App Shell & Landing Page

> **Owner Agent:** ⚙️ Code Engineer  
> **Supporting Agents:** 🎨 UI Agent (Landing Page styling, mapping table restyle, drag-and-drop visual feedback)  
> **Rationale:** Engineer owns the `ModalVizApp` state management, engine initialization logic, and conditional routing. UI Agent owns the visual polish of the LandingPage component.

## Objective
Implement the top-level routing and conditional rendering for ModalViz. Replace the `TestHarness2` entry point with a polished `ModalVizApp` shell and a full-screen file ingestion `LandingPage`.

## Specifications

### 1. App Shell (`ModalVizApp.jsx` & `App.jsx`)
*   **`App.jsx`** (`src/App.jsx`): Modify to render `<ModalVizApp />` instead of `<TestHarness2 />`. Keep `TestHarness2.jsx` in the codebase for reference but do not use it.
*   **`ModalVizApp.jsx`** (`src/ModalVizApp.jsx` — **not** in `src/engine/`):
    *   Acts as the top-level layout controller and state holder.
    *   Manages core state:
        *   `parsedData` — geometry buffers from ingestion
        *   `engineInstance` — the `ModalKinematicsEngine`
        *   `fileName` — the uploaded file name (passed to `Toolbar` for display)
        *   `plotWindows` — array of active plot window descriptors (used by FEAT-UI-004)
    *   **Conditional Rendering**:
        *   If `parsedData` is null/empty: Render `<LandingPage />`.
        *   If `parsedData` exists: Render the Workspace layout (Toolbar + ViewportContainer + WebGLViewport + Controls).
    *   **Engine Initialization Logic** (migrated from `TestHarness2.jsx` lines 11–62):
        *   Extract unique frequencies from `buffers.frequencies`.
        *   Build per-mode shape arrays from flat `buffers.modeShapes`.
        *   Construct `ModalKinematicsEngine(numNodes, dofsPerNode, uniqueFreqs, modeShapes, 0.05)`.
        *   Set default initial conditions (`d0[0..dofsPerNode-1] = 1.0`).
    *   **Reset handler**: `handleReset()` clears `parsedData`, `engineInstance`, `fileName`, and `plotWindows` — returning to LandingPage.

### 2. Landing Page (`LandingPage.jsx`)
*   **Layout & Visuals**:
    *   Full-screen component (`.landing-page`) with a dark gradient background.
    *   Centered card featuring the ModalViz app branding (logo/title with subtle glow).
    *   Drag-and-drop zone with a dashed animated border and drop icon.
    *   Styled file picker button (not browser default).
    *   Hints indicating accepted formats: `.csv`, `.txt`.
*   **Interaction & Behavior**:
    *   Implement drag events (`onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`).
    *   Visual feedback on drag-over (e.g., cyan glow border using `pulse-glow` keyframe from FEAT-UI-001).
    *   On file drop or selection, reuse the column mapping + processing logic from `DataIngestionWizard`.
    *   **Error handling**: Display parsing/validation errors inline within the card (styled red on dark bg), not as browser alerts.
*   **Transitions**:
    *   File drop triggers a fade-in (`fade-in` keyframe) of the column mapping table within the same card.
    *   Restyle the mapping table to match the dark theme (currently unstyled HTML `<table>`, `<select>`, `<button>` elements).
    *   "Confirm & Visualize" button triggers the `onDataParsed(buffers, fileName)` callback to parent `ModalVizApp`, switching the view to the Workspace.
    *   While processing, show a spinner or progress indicator (PapaParse runs in a web worker so the UI remains responsive).

## Dependencies
- FEAT-UI-001 (Design System) — uses `.glass-panel`, color variables, keyframe animations.

## Acceptance Criteria
- [ ] `App.jsx` renders `ModalVizApp`.
- [ ] `ModalVizApp` manages `parsedData`, `engineInstance`, `fileName`, and `plotWindows` state.
- [ ] `ModalVizApp` conditionally renders `LandingPage` vs Workspace.
- [ ] `LandingPage` provides a polished drag-and-drop zone with visual feedback.
- [ ] File picker button is custom-styled (not browser default `<input type="file">`).
- [ ] Column mapping table matches the dark theme.
- [ ] Parsing errors display inline (not as browser alerts).
- [ ] Processing shows a loading indicator.
- [ ] Successful file ingestion transitions the app to the Workspace view with the populated engine instance.
- [ ] "Re-upload" from Toolbar returns to LandingPage (reset handler works).
