# ↕️ FEAT-P5-003: Selectable Displacement Axis

> **Phase:** 5 — Generalization & Topology  
> **Priority:** 🟡 High  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-13  
> **Status:** 🟡 Pending  
> **Depends on:** FEAT-P5-002

---

## Objective

For 1-DOF scalar datasets (where `dofsPerNode === 1`), the system currently forces the displacement to occur physically along the X-axis. This feature adds a UI control to allow the user to define what direction the 1-DOF data represents (X, Y, Z, or Surface Normal), supporting both out-of-plane bending and axial deformations.

---

## Required Changes

### 1. UI Control

In `WebGLViewport.jsx`, add a dropdown in the Simulation Parameters panel (visible only if `dofsPerNode === 1`):

**"Deformation Axis:"**
- `Normal` (Default for 2D topology)
- `X-Axis`
- `Y-Axis`
- `Z-Axis`

### 2. Compute Surface Normals

If "Normal" is selected (or is the default), the engine needs to know the normal vector for each vertex.
- `THREE.BufferGeometry.computeVertexNormals()` can automatically calculate this **if and only if** the face indices are present (which is handled by FEAT-P5-002).
- For 1D topology (beams), "Normal" might be undefined or default to a perpendicular axis. (In 1D, users will typically select X, Y, or Z for axial or transverse deformation).

### 3. Update the Animation Loop

Modify the vertex update block in `animate()`:

```javascript
if (dofsPerNode === 1) {
    const dx = displacement[i];
    const S = exaggerationRef.current;
    
    if (selectedAxis === 'X') {
        posArray[i * 3]     = restPositions[i * 3] + dx * S;
        // Y, Z rest
    } else if (selectedAxis === 'Y') {
        // X rest
        posArray[i * 3 + 1] = restPositions[i * 3 + 1] + dx * S;
        // Z rest
    } else if (selectedAxis === 'Z') {
        // X, Y rest
        posArray[i * 3 + 2] = restPositions[i * 3 + 2] + dx * S;
    } else if (selectedAxis === 'Normal') {
        const nx = normalsArray[i * 3];
        const ny = normalsArray[i * 3 + 1];
        const nz = normalsArray[i * 3 + 2];
        
        posArray[i * 3]     = restPositions[i * 3]     + dx * S * nx;
        posArray[i * 3 + 1] = restPositions[i * 3 + 1] + dx * S * ny;
        posArray[i * 3 + 2] = restPositions[i * 3 + 2] + dx * S * nz;
    }
}
```

---

## Acceptance Criteria

1. UI dropdown appears only for 1-DOF datasets.
2. Selecting `Y-Axis` causes the plate or beam to deform vertically.
3. Selecting `Normal` causes a 2D plate to deform perpendicular to its face (using computed vertex normals).
4. Changing the axis updates the animation in real-time without requiring a page reload.
