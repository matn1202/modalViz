# FEAT-UI-001: Design System & Global Styles

> **Owner Agent:** 🎨 UI Agent  
> **Supporting Agents:** None  
> **Rationale:** Pure CSS/design token work — falls entirely within the UI Agent's domain.

## Objective
Establish a dark-themed, engineering-grade design system for ModalViz. Replace the Vite boilerplate CSS with custom styles, tokens, and utility classes that all subsequent UI components will reference.

## Specifications

### 1. `index.css` Modifications
Replace the current Vite boilerplate in `modal-kinematics/src/index.css` with:
*   **Color Palette**:
    *   Background base: `#0d0f14`
    *   Surface: `#161922`
    *   Elevated: `#1e2230`
    *   Accent: Cyan `#00e5ff` (matches the engineering aesthetic)
*   **Typography**:
    *   Import Google Font: `Inter` (via CDN or locally). Use it as the default sans-serif font for legibility at small sizes.
*   **CSS Custom Properties (Variables)**:
    *   Define variables for the color palette, blur effects (`--blur-md: 12px`), border radii (`--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 16px`), and transition timings (`--transition-fast: 150ms`, `--transition-normal: 250ms`).
    *   Include `--scene-bg: #1a1a1a` — the Three.js scene background color, so it can be referenced by CSS overlays that need visual continuity.
    *   Include interactive state variables: `--hover-bg: rgba(0, 229, 255, 0.08)`, `--focus-ring: rgba(0, 229, 255, 0.5)`.
*   **Utility Classes**:
    *   `.glass-panel`: Implements glassmorphism using `backdrop-filter: blur(var(--blur-md))` and semi-transparent dark backgrounds (e.g., `rgba(22, 25, 34, 0.75)`), plus a subtle border (`1px solid rgba(255, 255, 255, 0.08)`).
    *   `.glass-panel-accent`: Variant with a cyan-tinted border (`1px solid rgba(0, 229, 255, 0.3)`) for plot windows.
*   **Scrollbar Styling**:
    *   Dark-themed scrollbars for consistency (`scrollbar-width: thin`, custom `::-webkit-scrollbar` styles matching the surface palette).
*   **Keyframe Animations**:
    *   `@keyframes dash-march`: Animated dashed border for drag-and-drop zone.
    *   `@keyframes fade-in`: Opacity 0→1 transition for content reveals (mapping table, workspace).
    *   `@keyframes pulse-glow`: Subtle cyan pulse for the drag-over state.
*   **Reset Styles**:
    *   Reset `margin` and `padding` for `body` and `#root`.
    *   Ensure `#root` spans `100vw` and `100vh`, with `overflow: hidden` to enable a full-viewport app layout.

### 2. `App.css` Modifications
Strip the Vite boilerplate and replace with structural component-specific styles:
*   `.landing-page`: Full-screen flex container, centered content.
*   `.workspace`: Full-viewport flex container (typically `flex-direction: column`).
*   `.toolbar`: Compact top bar (`height: ~44px`).
*   `.viewport-container`: Flex-grow container that fills the remaining space below the toolbar, `position: relative`.
*   `.animation-controls`: Floating bottom-center pill (`position: absolute`, `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)`).
*   `.context-menu`: Absolute positioned right-click popup, z-index elevated.
*   `.plot-window`: Absolute positioned draggable glassmorphic chart container, z-index elevated.
*   `.colorbar-legend`: Fixed overlay, repositioned to `top: 16px`, `left: 16px`.

## Dependencies
- None (foundational — all other FEAT-UI tickets depend on this).

## Acceptance Criteria
- [ ] `index.css` contains the new color palette, variables, `.glass-panel`, and `.glass-panel-accent` utilities.
- [ ] Google Font `Inter` is imported and set as the default font.
- [ ] Keyframe animations (`dash-march`, `fade-in`, `pulse-glow`) are defined.
- [ ] Scrollbar styling matches the dark theme.
- [ ] `App.css` contains only the new structural classes and no Vite boilerplate.
- [ ] The app renders full-viewport without scrolling or white margins.
- [ ] All CSS custom properties are documented with comments in the file.
