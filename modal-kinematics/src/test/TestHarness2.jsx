import React, { useState } from 'react';
import DataIngestionWizard from '../engine/DataIngestionWizard.jsx';
import { ModalKinematicsEngine } from '../engine/ModalKinematicsEngine.js';
import WebGLViewport from '../engine/WebGLViewport.jsx'; // <-- Import the new component

export default function TestHarness2() {
    const [parsedData, setParsedData] = useState(null); // State to hold the buffers for the 3D viewer
    const [logs, setLogs] = useState([]);
    const [engineInstance, setEngineInstance] = useState(null);

    const handleDataParsed = (buffers) => {
        // Save the buffers so the WebGLViewport can render them
        setParsedData(buffers);

        // ... [Keep the exact same math engine testing logic from the previous step here] ...
        const uniqueFreqs = [...new Set(buffers.frequencies)];
        const numModes = uniqueFreqs.length;
        const numNodes = new Set(buffers.nodes).size;
        
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

        const engine = new ModalKinematicsEngine(numNodes, buffers.dofsPerNode, uniqueFreqs, modeShapes, 0.05);
        const d0 = new Float32Array(engine.totalDofs);
        for (let k = 0; k < buffers.dofsPerNode; k++) d0[k] = 1.0;
        const v0 = new Float32Array(engine.totalDofs);
        engine.setInitialConditions(d0, v0);

        setEngineInstance(engine);

        const testLogs = [];
        const dt = 0.01;
        for (let step = 0; step <= 5; step++) {
            const t = step * dt;
            engine.evaluateModalState(t);
            const node0Kinematics = engine.getScopedKinematics(0);
            
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
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>Visualization Pipeline</h1>
            
            <DataIngestionWizard onDataParsed={handleDataParsed} />

            {/* Render the 3D Viewport if data exists */}
            {parsedData && engineInstance && (
                <div style={{ marginTop: '30px' }}>
                    <h2>Undeformed Structural Mesh</h2>
                    <WebGLViewport geometryData={parsedData} engine={engineInstance} />
                </div>
            )}

            {logs.length > 0 && (
                <div style={{ marginTop: '30px' }}>
                    <h3>Transient Math Engine Output (Node 0 Scoped)</h3>
                    {/* ... [Keep the table rendering code from the previous step] ... */}
                </div>
            )}
        </div>
    );
}