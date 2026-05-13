# ⏯️ FEAT-UI-006: Playback Controls Overlay Positioning

> **Phase:** UI/UX Overhaul  
> **Priority:** 🔴 Critical  
> **Issued by:** Director  
> **Assigned to:** 🎨 UI Agent  
> **Date:** 2026-05-13  
> **Status:** 🟡 Pending  
> **Depends on:** FEAT-UI-003

---

## Objective

The Code Engineer successfully implemented the logic for `AnimationControls.jsx` (Play, Pause, Stop, Scrub), but the component currently sits in the normal document flow. To achieve the "immersive visualization workspace" architecture, these controls must float as an overlay at the bottom-center of the 3D viewport.

---

## Required Changes

### 1. CSS Styling (`index.css` or `App.css`)

Add the `.animation-controls` class to properly position the component over the 3D canvas.

```css
.animation-controls {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    z-index: 100;
}
```

*(Ensure the `.glass-panel` class handles the background blurring and borders correctly.)*

### 2. Component Refinement (`AnimationControls.jsx` - optional)

Verify that the inline styles in `AnimationControls.jsx` do not conflict with the new CSS class. The component should look like a sleek, rounded pill containing the Play/Pause button, Stop button, scrubber, and time display.

---

## Acceptance Criteria

1. The playback controls render as a floating overlay exactly at the bottom-center of the screen.
2. The controls do not obstruct the 3D model and remain visible over the WebGL canvas.
3. The component uses the design system tokens (`var(--radius-lg)`, etc.) for its pill shape.
