// --- TEST EXAMPLE SETUP ---
import { ModalKinematicsEngine } from "../engine/ModalKinematicsEngine.js";
// 1. Mock Data Initialization
const numNodes = 2;
const dofsPerNode = 1; // 1D problem for simplicity
const totalDofs = numNodes * dofsPerNode;

// Suppose we have two modes at 10 Hz and 25 Hz
const frequencies = [10.0, 25.0]; 

// Mass-normalized eigenvectors (Mode Shapes) [cite: 41]
const mode1 = new Float32Array([0.5, 0.5]);   // In-phase motion
const mode2 = new Float32Array([0.5, -0.5]);  // Out-of-phase motion
const modeShapes = [mode1, mode2];

// Initialize the engine with 5% damping
const engine = new ModalKinematicsEngine(numNodes, dofsPerNode, frequencies, modeShapes, 0.05);

// 2. Define Physical Initial Conditions
// Let's pull Node 0 to a displacement of 1.0, leave Node 1 at 0.0
const d0 = new Float32Array([1.0, 0.0]); 
const v0 = new Float32Array([0.0, 0.0]); // Released from rest

// Map physical ICs to modal ICs [cite: 58, 60]
engine.setInitialConditions(d0, v0);

// 3. Simulate and Scope Data over a small time window
console.log("Simulating transient response for Node 0 (DOF 0)...");

const dt = 0.01; // 10ms steps
for (let step = 0; step <= 5; step++) {
    const t = step * dt;
    
    // Evaluate math functions internally [cite: 64]
    engine.evaluateModalState(t);
    
    // Extract O(m) scoped data for just the first node (DOF index 0) [cite: 97, 106]
    const node0Kinematics = engine.getScopedKinematics(0);
    
    console.log(`t = ${t.toFixed(2)}s | Pos: ${node0Kinematics.position.toFixed(4)} | Vel: ${node0Kinematics.velocity.toFixed(4)} | Acc: ${node0Kinematics.acceleration.toFixed(4)}`);
}