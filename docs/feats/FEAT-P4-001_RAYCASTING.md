# 🎯 FEAT-P4-001: Raycasting & Node Selection

> **Phase:** 4 — Raycasting & Plotly.js Integration  
> **Priority:** 🔴 Critical (foundation for all Phase 4 work)  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-12  
> **Status:** ✅ Complete  
> **Depends on:** Phase 3 ✅  
> **Blocks:** FEAT-P4-002

---

## Objective

Implement interactive node selection in the 3D viewport via `THREE.Raycaster`. When the user clicks a node in the point cloud, the system must resolve the physical Node ID, visually highlight the selected node, and expose the selected DOF index to downstream consumers (Plotly charts in FEAT-P4-002).

---

## Architecture Reference

- **Section 9.1** — UI Integration for Nodal Selection
  - Selection Mechanism: `THREE.Raycaster` projects a ray from camera through click coordinate
  - ID Resolution: Raycaster returns vertex indices → map back to physical Node ID
  - Visual highlight: temporary colored sphere mesh at selected coordinate
- **Section 4.2** — Scoped extraction uses `dofIndex` from the selected node

---

## Current State

- The `WebGLViewport.jsx` render loop and point cloud geometry are fully functional (Phase 3 ✅).
- `engine.getScopedKinematics(dofIndex)` already exists and returns `{ position, velocity, acceleration }` at O(m) cost.
- No raycasting code exists anywhere in the codebase.
- No node selection state exists.
- No visual feedback for selection exists.

---

## Required Changes

### 1. Set Up the Raycaster and Mouse Vector

#### File: `modal-kinematics/src/engine/WebGLViewport.jsx` [MODIFY]

Add raycaster initialization inside the `useEffect`, alongside camera and controls:

```javascript
// Inside the useEffect, after controls initialization:
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.1; // Hit detection radius for point cloud
const mouse = new THREE.Vector2();
```

> **Important:** For point clouds (`THREE.Points`), the raycaster uses a distance threshold rather than face intersection. The `threshold` value should scale with the `PointsMaterial.size`. Start with `0.1` (matching the current point size).

---

### 2. Add a Selection Highlight Mesh

Create a small colored sphere that marks the currently selected node:

```javascript
// Highlight sphere for selected node
const highlightGeometry = new THREE.SphereGeometry(0.08, 16, 16);
const highlightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff88,  // Bright green — distinct from the Jet colormap
    transparent: true,
    opacity: 0.8
});
const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
highlightMesh.visible = false; // Hidden until a node is selected
scene.add(highlightMesh);
```

---

### 3. Implement the Click Handler

Add a `pointerdown` event listener on the renderer's canvas. Convert the click to normalized device coordinates (NDC), fire the ray, and find the nearest intersected point.

```javascript
const handleNodeClick = (event) => {
    // Only react to left clicks, and only when not dragging (orbit)
    if (event.button !== 0) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(pointsMesh);
    
    if (intersects.length > 0) {
        const hit = intersects[0];
        const vertexIndex = hit.index; // Index into the position buffer
        
        // Resolve the physical Node ID from the geometry data
        const nodeId = geometryData.nodes[vertexIndex];
        const dofIndex = vertexIndex; // For 1-DOF: vertex index = DOF index
        
        // Update highlight sphere position
        const posArray = geometryRef.current.attributes.position.array;
        highlightMesh.position.set(
            posArray[vertexIndex * 3],
            posArray[vertexIndex * 3 + 1],
            posArray[vertexIndex * 3 + 2]
        );
        highlightMesh.visible = true;
        
        // Store the selected node info
        selectedNodeRef.current = { vertexIndex, nodeId, dofIndex };
        setSelectedNodeInfo({ vertexIndex, nodeId, dofIndex });
    }
};
```

#### Distinguishing Click vs. Drag

OrbitControls uses `pointerdown` + `pointermove` + `pointerup` for orbiting. We must **not** treat a drag as a click. Use a distance threshold:

```javascript
let pointerDownPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Only treat as a click if mouse moved less than 3 pixels
    if (dist < 3) {
        handleNodeClick(e);
    }
});
```

---

### 4. Update Highlight Position During Animation

Inside the `animate()` loop, if a node is selected, update the highlight sphere's position to track the deformed node:

```javascript
// Inside animate(), after vertex position updates:
if (selectedNodeRef.current && highlightMesh.visible) {
    const idx = selectedNodeRef.current.vertexIndex;
    const posArray = geometryRef.current.attributes.position.array;
    highlightMesh.position.set(
        posArray[idx * 3],
        posArray[idx * 3 + 1],
        posArray[idx * 3 + 2]
    );
}
```

---

### 5. Expose Selected Node State

Add state and refs to communicate the selection to the parent/sibling components:

```javascript
// At the component level:
const selectedNodeRef = useRef(null);
const [selectedNodeInfo, setSelectedNodeInfo] = useState(null);
```

The `selectedNodeInfo` state will be used by FEAT-P4-002 (Plotly charts) to know which DOF to scope.

#### Deselection

Add a mechanism to clear the selection (e.g., clicking empty space, or a "Clear Selection" button):

```javascript
// In handleNodeClick, if no intersection:
if (intersects.length === 0) {
    highlightMesh.visible = false;
    selectedNodeRef.current = null;
    setSelectedNodeInfo(null);
}
```

---

### 6. Display Selected Node Info

Show a small info badge near the playback controls:

```jsx
{selectedNodeInfo && (
    <div style={{ padding: '4px 8px', fontSize: '12px', color: '#00ff88', fontFamily: 'monospace' }}>
        Selected: Node {selectedNodeInfo.nodeId} (DOF {selectedNodeInfo.dofIndex})
        <button onClick={handleClearSelection} style={{ marginLeft: '8px', fontSize: '11px' }}>✕</button>
    </div>
)}
```

---

### 7. Cleanup

Add to the cleanup function:

```javascript
return () => {
    // ... existing cleanup ...
    highlightGeometry.dispose();
    highlightMaterial.dispose();
};
```

---

## Files Affected

| File | Action | Summary |
|---|---|---|
| `modal-kinematics/src/engine/WebGLViewport.jsx` | **MODIFY** | Add raycaster, click handler (click vs. drag discrimination), highlight sphere, selected node state, info display, animation-synced highlight tracking |

---

## Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | **Clicking a node** highlights it with a green sphere | Load CSV → click a point → green sphere appears |
| 2 | **Node ID** is correctly resolved and displayed | Info badge shows correct Node ID from the CSV data |
| 3 | **Dragging** (orbit) does NOT trigger selection | Click-drag to rotate → no selection fires |
| 4 | **Clicking empty space** deselects the node | Click empty area → highlight disappears, info clears |
| 5 | **During animation**, the highlight sphere tracks the deformed position | Play → selected node's highlight moves with deformation |
| 6 | **OrbitControls still work** without interference from click handler | Rotate/pan/zoom unaffected |
| 7 | Clicking a **different node** replaces the previous selection | Click Node A → green sphere on A → click Node B → sphere moves to B |
| 8 | Build passes with zero errors | `npm run build` completes cleanly |

---

## Notes for Engineer

- **Click vs. drag detection** is critical. Without the pointer distance threshold, every orbit drag would trigger a spurious node selection. Use a 3px threshold.
- The `raycaster.params.Points.threshold` value must match the visual point size. If nodes overlap at certain zoom levels, adjust the threshold or use `intersects[0]` (nearest hit).
- Store the selected DOF index in a `useRef` so the animation loop can read it without re-renders. Use `useState` only for the display badge.
- `highlightMesh` must be added to the scene but NOT to the `Points` object — it's a separate `THREE.Mesh` that sits on top.
- For 3-DOF-per-node data, `dofIndex` calculation will need to account for the DOF mapping (vertex index × dofsPerNode + axis offset). Add a code comment at this adaptation point.
- Log your changes in `docs/logs/ENGINEER_LOG.md` per protocol.
