# 🧩 FEAT-P5-001: Multi-DOF Column Mapping

> **Phase:** 5 — Generalization & Topology  
> **Priority:** 🟡 High  
> **Issued by:** Director  
> **Assigned to:** Code Engineer  
> **Date:** 2026-05-13  
> **Status:** 🟡 Pending  
> **Blocks:** None

---

## Objective

Refactor the `DataIngestionWizard` to allow users to map up to three Modal Shape columns (`Shape UX`, `Shape UY`, `Shape UZ`) instead of a single `Modal Shape Value`. This enables the engine to simulate complex 3D frame structures, rather than being restricted to 1-DOF scalar fields.

---

## Required Changes

### 1. Update Required Mappings

In `DataIngestionWizard.jsx`, update the mapping roles. We still need Node ID and XYZ coordinates, but the Modal Shape roles become optional up to 3. The user must provide *at least one* shape column.

```javascript
const MAPPING_ROLES = [
    "Node ID", 
    "X-Coordinate", 
    "Y-Coordinate", 
    "Z-Coordinate", 
    "Frequency", 
    "Shape UX",
    "Shape UY",
    "Shape UZ"
];
```

### 2. Validation Logic

The wizard must validate that:
1. `Node ID`, `X-Coordinate`, `Y-Coordinate`, `Z-Coordinate`, and `Frequency` are mapped.
2. **At least one** of `Shape UX`, `Shape UY`, or `Shape UZ` is mapped.

### 3. Buffer Allocation

If only one shape column is mapped (e.g., `Shape UZ`), the engine initializes as 1-DOF:
`modeShapes = new Float32Array(numRows)`

If multiple shape columns are mapped (or specifically all 3), the engine initializes as 3-DOF. The wizard must interleave the values:
`modeShapes = new Float32Array(numRows * 3)`
Where `modeShapes[i*3] = UX`, `modeShapes[i*3+1] = UY`, `modeShapes[i*3+2] = UZ` (filling unmapped axes with `0.0`).

### 4. Pass dofsPerNode to Parent

Update the `onDataParsed` callback payload to explicitly include `dofsPerNode` (1 or 3) so `TestHarness2` and `ModalKinematicsEngine` know how to initialize.

---

## Acceptance Criteria

1. User can upload a CSV with X, Y, and Z modal shape values and map them independently.
2. Wizard validates correctly (fails if no shape column is mapped).
3. `dofsPerNode` is correctly calculated and passed to the math engine.
4. If 3 shape columns are mapped, the 3D viewport renders spatial deformation along all 3 axes simultaneously.
