# FEAT-UI-004: Context Menu & Plot Windows

> **Owner Agent:** ⚙️ Code Engineer  
> **Supporting Agents:** 🎨 UI Agent (ContextMenu and PlotWindow glassmorphic styling, drag handle design)  
> **Rationale:** Engineer owns the right-click handler, Plotly integration, imperative data feed, multi-window state, and dragging logic. UI Agent owns the visual polish (blur, borders, close button, color scheme).

## Objective
Implement an immersive, windowed plotting system. Change the interaction paradigm so that left-clicks only highlight nodes, while right-clicks spawn a context menu to generate draggable, floating 2D plot windows for nodal kinematics.

## Specifications

### 1. Viewport Interaction Update (`WebGLViewport.jsx`)
*   **Right-Click Handler**: Implement `onContextMenu` or pointer events checking for `button === 2`. **Must call `event.preventDefault()`** on the DOM `contextmenu` event to suppress the browser's default context menu.
*   **Left-Click Behavior**: Modify to *only* highlight the selected node (green sphere). It should no longer clear or open plots directly. Clicking empty space still deselects.
*   **Event Emission**: Emit an `onNodeRightClick(nodeInfo, screenPosition)` callback to the parent `ModalVizApp` when a node is right-clicked. `screenPosition` is `{ x: event.clientX, y: event.clientY }`.
*   **Initial State**: On mount, call `engine.evaluateModalState(0)` and apply the static modal deformation shape instead of showing the undeformed geometry. Apply the colormap immediately.
*   **Stripped Responsibilities**: Remove all playback controls, simulation parameter UI, `KinematicPlots` rendering, and `ColorBarLegend` rendering. The viewport becomes a pure Three.js rendering surface with highlight + right-click callbacks.
*   **Legacy Cleanup**: `KinematicPlots.jsx` is no longer imported or used by any component after this change. It should be preserved in the codebase for reference but not rendered.

### 2. Context Menu (`ContextMenu.jsx`)
*   **Appearance**: Floating menu appearing at `(event.clientX, event.clientY)` coordinates.
*   **Items**:
    1.  📈 Plot Position
    2.  📈 Plot Velocity
    3.  📈 Plot Acceleration
*   **Behavior**:
    *   Appears only if a node is under the cursor on right-click.
    *   Clicking an item opens a new `PlotWindow` for that quantity.
    *   If the quantity is already plotted for the node, toggle it (add/remove trace).
    *   Auto-dismisses on item click, clicking away, or pressing `Escape`.

### 3. Draggable Plot Window (`PlotWindow.jsx`)
*   **Visual Design**: Glassmorphic 2D chart panel overlaid on the canvas (`backdrop-filter: blur(12px)`, `rgba(22, 25, 34, 0.75)` bg, cyan tinted border).
*   **Layout**: Title bar acting as a drag handle (e.g., "Node XX: Position/Velocity"), close button (`×`), and a ~380×280px chart area.
*   **Dragging Logic**: Track offsets on `onPointerDown`, update position on `onPointerMove`, release on `onPointerUp`. Constrain dragging within the viewport bounds.
*   **Plotting via Plotly**:
    *   Receives `nodeId`, `dofIndex`, and `activeTraces` (array of 'position', 'velocity', 'acceleration').
    *   Maintains its own `RollingBuffer` instances (time + one per trace type).
    *   Renders overlaid traces with the established color scheme (Cyan `#00ccff` = Position, Orange `#ffaa00` = Velocity, Red `#ff4466` = Acceleration).
    *   Uses `Plotly.react()` for efficient incremental updates (not `Plotly.newPlot()`).
    *   Calls `Plotly.purge()` on unmount to prevent memory leaks.
*   **Data Feed Mechanism**:
    *   The `WebGLViewport` animation loop calls `engine.getScopedKinematics(dofIndex)` per frame per active window. Results are pushed into each `PlotWindow`'s buffers via **imperative refs** (not React state) to avoid triggering reconciliation at 60fps.
    *   `ModalVizApp` provides a `plotWindowRefs` map: `Map<windowId, { pushData(t, kin) }>`. Each `PlotWindow` registers itself on mount.
    *   Plotly updates are throttled to ~10 Hz (every 6th frame) matching the existing pattern.
*   **Buffer Lifecycle**:
    *   Buffers clear on Stop/Reset.
    *   Buffers clear if the engine instance changes (new file loaded).

### 4. Multi-Window Management (`ModalVizApp.jsx`)
*   **State Management**: Maintain an array of active plot windows:
    ```js
    plotWindows: [
      { id: 'pw-1', nodeId: 5, dofIndex: 5, traces: ['position', 'velocity'], position: { x: 400, y: 100 } },
      ...
    ]
    ```
*   **Window ID Generation**: Use a simple counter or `crypto.randomUUID()` for unique IDs.
*   **Context Menu Logic**:
    *   If right-clicking a node that already has a `PlotWindow`: add/toggle the selected trace on that existing window.
    *   If right-clicking a node with no window: create a new `PlotWindow` at `{ x: event.clientX, y: event.clientY }`.
*   **Keybindings**: Global `keydown` listener for `Escape` → sets `plotWindows` to `[]` (clears all). Listener must be registered/unregistered with `useEffect`.
*   **Performance**: Pass rolling kinematic data via imperative refs (see PlotWindow data feed mechanism above), not React state.

### 5. ColorBar Legend Re-positioning (`ColorBarLegend.jsx`)
*   **Styling**: Move from `right: 16px` to `left: 16px, top: 16px`.
*   **Layout**: Make it a compact vertical bar (~200px height) rather than stretching the full height. Add a rotated "Displacement Magnitude" label.

## Dependencies
- FEAT-UI-001 (Design System) — uses `.glass-panel-accent`, color variables, `fade-in` keyframe.
- FEAT-UI-002 (App Shell) — `ModalVizApp` manages `plotWindows` state.
- FEAT-UI-003 (Workspace Controls) — Toolbar/AnimationControls must be extracted first to unblock WebGLViewport refactor.

## Acceptance Criteria
- [ ] Browser default context menu is suppressed on the 3D canvas.
- [ ] Left-click highlights node without opening plots.
- [ ] Right-click on a node opens the `ContextMenu` at the cursor location.
- [ ] Right-click on empty space does nothing (no menu).
- [ ] Selecting context menu items spawns or updates a `PlotWindow`.
- [ ] `PlotWindow` components are draggable via their title bar and can be closed individually.
- [ ] Multiple `PlotWindow` instances can exist concurrently for different nodes.
- [ ] `PlotWindow` traces update at ~10 Hz during animation without performance degradation.
- [ ] `Escape` key closes all plot windows simultaneously.
- [ ] Viewport renders initial deformation at `t=0` on load (not undeformed geometry).
- [ ] Color bar is positioned in the top-left corner with ~200px height.
- [ ] `KinematicPlots.jsx` is no longer rendered (preserved for reference).
- [ ] `Plotly.purge()` is called on PlotWindow unmount.
