/**
 * Generate test data for a simply-supported rectangular plate.
 * 
 * Physics: The plate lies in the YZ plane (X = 0). Out-of-plane bending
 * displacement is in the X direction, which is the direction the 1-DOF
 * animation code applies displacement to. This means the 3D viewport
 * will correctly show the plate flexing out-of-plane.
 * 
 * Mode shapes follow the analytical solution for a simply-supported plate:
 *   φ_mn(y, z) = sin(m·π·y / a) · sin(n·π·z / b)
 * 
 * where (m, n) are the half-wave numbers in each direction.
 * 
 * Output format matches the DataIngestionWizard expectations:
 *   NodeID, X, Y, Z, Frequency, ModalShapeValue
 * 
 * Usage: node src/test/generatePlateData.js
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Plate geometry ──────────────────────────────────────
const NY = 10;         // nodes along Y-axis
const NZ = 10;         // nodes along Z-axis
const a  = 1.0;        // plate width  (Y direction)
const b  = 1.0;        // plate height (Z direction)
const NUM_NODES = NY * NZ;

// ── Mode definitions: [m, n, frequency_Hz] ─────────────
// Frequencies approximate a thin steel plate (E=200 GPa, ν=0.3, ρ=7800, h=2mm, 1m×1m)
// f_mn ∝ (m²/a² + n²/b²)  for a simply-supported plate
const modes = [
    { m: 1, n: 1, freq: 12.4  },   // Mode 1: fundamental bowl shape
    { m: 2, n: 1, freq: 31.0  },   // Mode 2: one nodal line along Y
    { m: 1, n: 2, freq: 31.0  },   // Mode 3: one nodal line along Z (degenerate pair)
    { m: 2, n: 2, freq: 49.6  },   // Mode 4: saddle / checkerboard
];

// To avoid engine grouping issues with identical frequencies,
// perturb the degenerate pair slightly
modes[2].freq = 31.5;

// ── Generate CSV ────────────────────────────────────────
const rows = ['NodeID,X,Y,Z,Frequency,ModalShapeValue'];

for (const { m, n, freq } of modes) {
    let nodeId = 1;
    for (let iz = 0; iz < NZ; iz++) {
        for (let iy = 0; iy < NY; iy++) {
            const y = (iy / (NY - 1)) * a;
            const z = (iz / (NZ - 1)) * b;
            const x = 0.0; // plate lies in YZ plane

            // Analytical mode shape for simply-supported plate
            const phi = Math.sin(m * Math.PI * y / a)
                      * Math.sin(n * Math.PI * z / b);

            rows.push(
                `${nodeId},${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)},${freq.toFixed(2)},${phi.toFixed(6)}`
            );
            nodeId++;
        }
    }
}

const outputPath = join(__dirname, 'PlateModel_10x10_4modes.csv');
writeFileSync(outputPath, rows.join('\n'), 'utf-8');

console.log(`✅ Generated: PlateModel_10x10_4modes.csv`);
console.log(`   Nodes:  ${NUM_NODES} (${NY}×${NZ} grid)`);
console.log(`   Modes:  ${modes.length}`);
console.log(`   Rows:   ${rows.length - 1} data rows + 1 header`);
console.log(`   Modes:`);
modes.forEach((mode, i) => {
    console.log(`     Mode ${i + 1}: (m=${mode.m}, n=${mode.n}) at ${mode.freq} Hz`);
});
