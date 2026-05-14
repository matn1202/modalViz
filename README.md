# ModalViz

**ModalViz** is a Finite Element Modal Kinematics Visualization System built with React, Three.js, and Plotly.js. It provides a production-grade, interactive workspace for engineers and researchers to visualize structural modes, transient dynamics, and kinematics data natively in the browser.

## Features

- **Data Ingestion & Math Engine:**
  - Client-side CSV loading and parsing utilizing Web Workers (`PapaParse`) for high performance.
  - Interactive UI for mapping CSV columns (Node ID, Coordinates, Frequencies, Modal Shapes).
  - Robust analytical math engine for calculating transient dynamics, evaluating modal states ($q, \dot{q}, \ddot{q}$), and executing full modal superposition.

- **3D Visualization & Topology:**
  - High-performance `Three.js` WebGL viewport with responsive orbital controls.
  - Automated topology generation: Gracefully handles 1D (beams, rendered as lines) and 2D/3D (plates/structures, rendered as meshes via Delaunay triangulation).
  - Dynamic, real-time deformation animation with adjustable exaggeration scales.

- **Dynamic Contour Rendering:**
  - Real-time color mapping using custom Jet/Rainbow colormaps, reflecting nodal magnitude displacements.
  - Floating Color Bar legend for quick magnitude referencing.

- **Simulation & Playback Controls:**
  - Interactive playback timeline (Play, Pause, Scrub) driven by a decoupled animation loop.
  - Real-time tunability of simulation parameters: Modal subset isolation, damping ratio ($\zeta$), and initial conditions ($d_0, v_0$).

- **Interactive Node Selection & Kinematics Plotting:**
  - Precision node picking in the 3D scene using `THREE.Raycaster`.
  - Concurrent 2D plotting via `Plotly.js` displaying high-frequency Displacement, Velocity, and Acceleration time-histories for selected nodes.
  - Rolling window oscilloscope-style plots synced perfectly with 3D viewport playback.

## Technology Stack

- **Framework:** React 19 / Vite
- **3D Engine:** Three.js
- **2D Plotting:** Plotly.js
- **Data Parsing:** PapaParse
- **Styling:** Vanilla CSS (Glassmorphic, tokenized design system)

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd modal-kinematics
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. **Upload Data:** Upon launch, use the Landing Page to upload your structural node data and modal shapes (CSV or TXT).
2. **Map Columns:** Define the data mapping (e.g., assigning columns to X/Y/Z, Modal Shape values).
3. **Visualize:** Interact with the 3D representation. Use the bottom overlay to play/pause the animation.
4. **Inspect:** Right-click or interact with nodes in the viewport to open contextual menus and 2D kinematic plot windows.

## Project Structure

- `src/engine/`: Core math classes and data ingestion pipeline (`ModalKinematicsEngine.js`).
- `src/components/`: Reusable React UI components (`WebGLViewport.jsx`, `KinematicPlots.jsx`, etc.).
- `src/styles/`: Global CSS and tokenized design system (`index.css`, `App.css`).
- `docs/`: Extensive project tracking, architecture definitions, and cross-agent logs.

## License

This project is licensed under the MIT License.
