# 🛠️ Feature / Fix: Restore Orbit Controls in 3D Viewport

> **ID:** FIX-001  
> **Priority:** 🔴 Critical (Phase 2 blocker)  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-12  
> **Status:** ✅ Complete (verified 2026-05-12)

---

## Problem Statement

The 3D visualizer in `WebGLViewport.jsx` **cannot orbit** when the user clicks and drags the mouse. The camera is locked in place despite `OrbitControls` being initialized. This is a **critical Phase 2 regression** — without working orbit controls, the viewport is non-interactive and blocks all downstream work (Phase 3 animation, Phase 4 raycasting).

---

## Root Cause Analysis

After auditing the codebase, the issue stems from **React 19's `StrictMode` double-mounting behavior** combined with the `useEffect` cleanup logic in `WebGLViewport.jsx`.

### What happens:

1. **`main.jsx`** wraps the app in `<StrictMode>` (line 7).
2. React 19 StrictMode **mounts → unmounts → remounts** every component during development to surface side-effect bugs.
3. On the **first mount**, `WebGLViewport`'s `useEffect` runs correctly:
   - Creates renderer, appends `renderer.domElement` (Canvas A) to `mountRef.current`.
   - Creates `OrbitControls` bound to Canvas A.
4. On the **StrictMode unmount**, the cleanup function runs:
   - Calls `controls.dispose()` — removes all event listeners from Canvas A.
   - Calls `mountRef.current.removeChild(renderer.domElement)` — removes Canvas A from the DOM.
   - Calls `renderer.dispose()` — destroys the WebGL context.
5. On the **second mount** (the one that persists), `useEffect` runs again:
   - Creates a **new** renderer with a **new** `renderer.domElement` (Canvas B).
   - Appends Canvas B to `mountRef.current`.
   - Creates **new** `OrbitControls` bound to Canvas B.
   - ✅ This should work... **BUT**:

### The actual bug — stale `mountRef` in the cleanup closure:

The cleanup function from the **second mount** captures `mountRef.current` at closure time. When the component eventually unmounts for real, the cleanup tries to `removeChild` but the conditional guard `if (mountRef.current && renderer.domElement)` may reference a stale DOM node depending on React's reconciliation timing. More critically:

**The `OrbitControls` constructor on the second mount receives `renderer.domElement` correctly, but the controls' internal `domElement` event listeners (`pointerdown`, `pointermove`, `pointerup`, `wheel`) may conflict with the CSS `pointer-events` or `touch-action` properties on parent containers.**

### Contributing factor — CSS `touch-action`:

Three.js `OrbitControls` requires that the canvas element (or its container) does **not** have `touch-action: none` implicitly set by a parent. The Vite boilerplate `index.css` does not set `touch-action`, but the inline `overflow: hidden` on the mount div (line 140 of `WebGLViewport.jsx`) can interfere with pointer event propagation in some browsers.

### Most likely cause — missing `touch-action` on the canvas:

Three.js OrbitControls v0.184.0 relies on `PointerEvents`. If the browser's default `touch-action` on the canvas is not set to `none`, the browser may interpret drag gestures as scroll/pan intentions and suppress the `pointermove` events that OrbitControls needs.

---

## Required Changes

### File: `modal-kinematics/src/engine/WebGLViewport.jsx`

#### Change 1: Set `touch-action: none` on the renderer's canvas

After line 26 (`mountRef.current.appendChild(renderer.domElement)`), add:

```javascript
// Ensure pointer events are not intercepted by the browser's touch/scroll handler.
// OrbitControls requires raw pointer events without browser gesture interference.
renderer.domElement.style.touchAction = 'none';
```

#### Change 2: Guard against StrictMode double-mount DOM orphans

Replace the current mount logic (lines 10–26) pattern to prevent duplicate canvases:

```javascript
// Clear any leftover canvas from a previous StrictMode mount cycle
while (mountRef.current.firstChild) {
    mountRef.current.removeChild(mountRef.current.firstChild);
}
```

Add this **before** `mountRef.current.appendChild(renderer.domElement)` (before line 26).

#### Change 3: Harden the cleanup function

Replace the cleanup block (lines 124–134) to safely handle the dispose sequence:

```javascript
return () => {
    window.removeEventListener('resize', handleResize);
    cancelAnimationFrame(animationFrameId);
    controls.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    // Safe DOM removal — check that the canvas is still a child of mount
    const mount = mountRef.current;
    if (mount) {
        while (mount.firstChild) {
            mount.removeChild(mount.firstChild);
        }
    }
};
```

This avoids the stale-reference problem by always cleaning all children rather than searching for a specific `domElement` reference.

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | **Left-click drag** orbits the camera around the geometry | Load CSV → drag on viewport → camera rotates |
| 2 | **Right-click drag** pans the camera | Right-click + drag moves the view laterally |
| 3 | **Scroll wheel** zooms in/out | Scroll up → zoom in, scroll down → zoom out |
| 4 | **Damping** produces smooth deceleration after releasing | Release drag → camera drifts to a stop |
| 5 | **No duplicate canvases** appear in the DOM after mount | Inspect the mount div — only one `<canvas>` child |
| 6 | **Window resize** still works correctly | Resize browser → viewport adjusts without breaking controls |
| 7 | **Build passes** with zero errors | `npm run build` completes cleanly |

---

## Files Affected

| File | Action |
|---|---|
| `modal-kinematics/src/engine/WebGLViewport.jsx` | MODIFY — 3 targeted changes |

## Dependencies

- None. This is a self-contained fix within a single file.
- No new packages required.

---

## Notes for Engineer

- **Do NOT remove `StrictMode`** from `main.jsx`. The fix must work *with* StrictMode enabled — it surfaces real bugs and we want it active for Phases 3–4.
- After applying the fix, manually test with the existing `MockData.csv` / `MockNodes.txt` test data.
- Log your changes in `docs/logs/ENGINEER_LOG.md` per protocol.
