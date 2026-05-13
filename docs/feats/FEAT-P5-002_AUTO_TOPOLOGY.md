# 🕸️ FEAT-P5-002: Auto-Topology Generation

> **Phase:** 5 — Generalization & Topology  
> **Priority:** 🔴 Critical  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-13  
> **Status:** ✅ Complete  
> **Blocks:** FEAT-P5-003

---

## Objective

Analyze the ingested nodal coordinates to automatically determine the spatial dimensionality of the dataset (1D line vs. 2D plane). Based on this analysis, automatically generate the appropriate WebGL connectivity elements (`THREE.LineSegments` or `THREE.Mesh`) instead of just a point cloud.

---

## Dimensionality Analysis Heuristic

When data is loaded into `WebGLViewport.jsx`:
1. Calculate the bounding box and variance of the node coordinates in X, Y, and Z.
2. If variance is near-zero in two axes, the data is **1D (e.g., a Beam)**.
3. If variance is near-zero in one axis, the data is **2D (e.g., a Plate/Shell)**.
4. If variance is significant in all three, the data is **3D (Solid/Frame)**.

---

## Required Changes

### 1. 1D Topology (Beams / Axial Members)

If the data is 1D:
- Sort the nodes based on the primary axis of variance.
- Generate an index array that connects adjacent nodes (0-1, 1-2, 2-3, etc.).
- Render using `THREE.LineSegments` alongside the `THREE.Points`.
- Ensure the material uses `vertexColors: true` so the lines inherit the colormap contouring.

### 2. 2D Topology (Plates / Shells)

If the data is 2D:
- Install a fast Delaunay triangulation library: `npm install delaunator`.
- Project the coordinates onto the 2D plane of variance (e.g., if X is constant, pass Y and Z to Delaunator).
- Run Delaunator to get triangle indices.
- Map the 2D indices back to the 3D vertex indices.
- Render using `THREE.Mesh` with `THREE.MeshStandardMaterial` (`vertexColors: true`, `side: THREE.DoubleSide`).

### 3. Mesh Cleanup

In the `useEffect` cleanup function, ensure the new line and mesh materials/geometries are properly disposed.

---

## Acceptance Criteria

1. **Beam Test:** Loading nodes perfectly aligned on a single axis automatically draws visible lines connecting them.
2. **Plate Test:** Loading the `PlateModel_10x10_4modes.csv` automatically draws a solid surface with triangle faces (no gaps, continuous color contouring).
3. The point cloud (spheres/dots) remains visible but the lines/faces act as the primary visual body.
4. `delaunator` is added to `package.json`.
