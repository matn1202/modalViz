# FEAT-UI-003: Workspace Toolbar & Controls

> **Owner Agent:** ⚙️ Code Engineer  
> **Supporting Agents:** 🎨 UI Agent (Toolbar and AnimationControls styling, glassmorphic design, hover states)  
> **Rationale:** Engineer owns the component JSX, prop wiring, and engine integration. UI Agent owns the visual design (`.glass-panel` application, icon choices, layout spacing).

## Objective
Extract UI controls out of the 3D viewport canvas. Implement a compact top toolbar for simulation parameters and a floating pill for animation playback controls, utilizing the new design system.

## Specifications

### 1. Compact Top Toolbar (`Toolbar.jsx`)
*   **Layout**: A slim (~44px height) glass-panel (`.glass-panel`) toolbar anchored to the top of the workspace.
*   **Contents (Left to Right)**:
    1.  **App Title**: "ModalViz" wordmark (small, left-aligned).
    2.  **File Info**: Display the current filename, truncated with a tooltip if long.
    3.  **Re-upload Button**: Icon button that resets state and returns the user to the `LandingPage`.
    4.  **Mode Selector**: Dropdown menu for "All Modes" or individual mode isolation (moved from the old SimParams panel).
    5.  **Deformation Axis**: Dropdown for Normal / X / Y / Z (shown only for 1-DOF data, moved from old SimParams panel).
    6.  **Exaggeration Scale**: Compact slider with a numeric display for the S factor.
    7.  **Damping Ratio**: Small numeric input for adjusting ζ.
*   **Selected Node Badge**: Migrate the green monospace "Selected: Node XX (DOF YY)" badge from WebGLViewport's playback controls area into the right side of the toolbar. Show/hide based on `selectedNodeInfo` state. Include the clear (✕) button.
*   **Initial Conditions**: Accessible via a gear/settings icon button at the right end of the toolbar. Opens a dropdown panel (not a separate page) with per-DOF d₀/v₀ inputs and "Apply" button. Uses `.glass-panel` styling.
*   **Integration**: Wire these controls to the `ModalVizApp` state to update the engine and viewport rendering reactively.
*   **Prop Interface**:
    ```
    Toolbar({
      fileName, engine, dofsPerNode,
      selectedModeIndex, onModeChange,
      selectedAxis, onAxisChange,
      exaggerationScale, onExaggerationChange,
      dampingRatio, onDampingChange,
      selectedNodeInfo, onClearSelection,
      onReset  // returns to LandingPage
    })
    ```
*   **Cleanup**: Remove the old `simulation-parameters` div block from `WebGLViewport.jsx` (lines 732–813 in the legacy file).

### 2. Floating Animation Controls (`AnimationControls.jsx`)
*   **Layout**: A floating, pill-shaped control bar (`.animation-controls`) centered at the bottom of the viewport.
*   **Visual Design**: Glassmorphic background with rounded corners, semi-transparent to minimize obstruction of the 3D scene.
*   **Contents**:
    *   `⏹ Stop` button.
    *   `▶ Play / ⏸ Pause` toggle button.
    *   Timeline slider for scrubbing.
    *   `t = 0.000s` time display.
*   **Interaction**:
    *   `pointerEvents: auto` on the pill to register clicks, while allowing the underlying canvas to remain interactive outside the pill bounds.
    *   Receives playback handler refs/functions from the parent (`handlePlay`, `handlePause`, `handleStop`).
    *   Scrubbing the timeline slider triggers a single-frame evaluation in the engine.
*   **Prop Interface**:
    ```
    AnimationControls({
      onPlay, onPause, onStop, onScrub,
      sliderRef, timeDisplayRef,
      isPlaying  // for toggling Play/Pause icon
    })
    ```

## Dependencies
- FEAT-UI-001 (Design System) — uses `.glass-panel`, color variables.
- FEAT-UI-002 (App Shell) — `ModalVizApp` provides state and callbacks.

## Acceptance Criteria
- [ ] `Toolbar` renders at the top with all specified controls, styled via `.glass-panel`.
- [ ] `Toolbar` controls (mode, axis, exaggeration, damping) correctly update the 3D visualization.
- [ ] Selected node info badge displays in the toolbar when a node is selected.
- [ ] Initial Conditions panel is accessible via gear icon and functions correctly.
- [ ] `AnimationControls` renders as a floating pill at the bottom center.
- [ ] Play/Pause button toggles its icon correctly.
- [ ] Play, pause, stop, and scrub functions work correctly and update the time display.
- [ ] Old UI elements (simulation-parameters div, playback-controls div) are removed from `WebGLViewport.jsx`.
