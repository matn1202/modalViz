import React, { useState } from 'react';
import DataIngestionWizard from '../engine/DataIngestionWizard.jsx';
// Note: Ensure ModalKinematicsEngine is exported from its file so we can import it here
import { ModalKinematicsEngine } from '../engine/ModalKinematicsEngine.js'; 

export default function TestHarness() {
    const [logs, setLogs] = useState([]);

    const handleDataParsed = (buffers) => {
        console.log("Success! Buffers received from Web Worker:", buffers);
        
        // 1. Extract the unique frequencies from the buffer to determine modes
        const uniqueFreqs = [...new Set(buffers.frequencies)]; 
        const numModes = uniqueFreqs.length;
        const numNodes = new Set(buffers.nodes).size;
        
        // 2. Reconstruct the mode shapes array for the Engine
        // Note: For this simple test, we map the flat CSV back into the engine's expected format.
        // In Phase 2, this logic will be slightly more robust based on DOF limits.
        const modeShapes = [];
        for(let j = 0; j < numModes; j++) {
            const shapeArray = new Float32Array(numNodes * buffers.dofsPerNode); 
            let shapeIdx = 0;
            for(let i = 0; i < buffers.frequencies.length; i++) {
                if(buffers.frequencies[i] === uniqueFreqs[j]) {
                    if (buffers.dofsPerNode === 1) {
                        shapeArray[shapeIdx] = buffers.modeShapes[i];
                        shapeIdx++;
                    } else {
                        shapeArray[shapeIdx] = buffers.modeShapes[i * 3];
                        shapeArray[shapeIdx + 1] = buffers.modeShapes[i * 3 + 1];
                        shapeArray[shapeIdx + 2] = buffers.modeShapes[i * 3 + 2];
                        shapeIdx += 3;
                    }
                }
            }
            modeShapes.push(shapeArray);
        }

        // 3. Initialize the Engine
        const engine = new ModalKinematicsEngine(numNodes, buffers.dofsPerNode, uniqueFreqs, modeShapes, 0.05);
        
        // 4. Apply Initial Conditions (Pull Node 0 by 1.0 unit on all its DOFs)
        const d0 = new Float32Array(engine.totalDofs);
        for (let k = 0; k < buffers.dofsPerNode; k++) d0[k] = 1.0;
        const v0 = new Float32Array(engine.totalDofs);
        engine.setInitialConditions(d0, v0);

        // 5. Run a brief simulation loop and log results
        const testLogs = [];
        const dt = 0.01;
        for (let step = 0; step <= 5; step++) {
            const t = step * dt;
            engine.evaluateModalState(t);
            const node0Kinematics = engine.getScopedKinematics(0); // Scope Node 0
            
            testLogs.push({
                time: t.toFixed(2),
                position: node0Kinematics.position.toFixed(4),
                velocity: node0Kinematics.velocity.toFixed(4),
                acceleration: node0Kinematics.acceleration.toFixed(4)
            });
        }
        setLogs(testLogs);
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>Pipeline Validation Test</h1>
            
            {/* The component from Phase 1 */}
            <DataIngestionWizard onDataParsed={handleDataParsed} />

            {/* Test Results Output */}
            {logs.length > 0 && (
                <div style={{ marginTop: '30px' }}>
                    <h3>Transient Math Engine Output (Node 0 Scoped)</h3>
                    <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead style={{ backgroundColor: '#f0f0f0' }}>
                            <tr>
                                <th>Time (s)</th>
                                <th>Position</th>
                                <th>Velocity</th>
                                <th>Acceleration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, idx) => (
                                <tr key={idx}>
                                    <td>{log.time}</td>
                                    <td>{log.position}</td>
                                    <td>{log.velocity}</td>
                                    <td>{log.acceleration}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}