import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { jetColormap } from './colormap.js';
import ColorBarLegend from './ColorBarLegend.jsx';

export default function WebGLViewport({ geometryData, engine }) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const geometryRef = useRef(null);
    const restPositionsRef = useRef(null);
    
    // Playback state
    const playbackStateRef = useRef('stopped'); // 'stopped' | 'playing' | 'paused'
    const simTimeRef = useRef(0);
    const lastTimestampRef = useRef(0);
    const timeDisplayRef = useRef(null);
    const sliderRef = useRef(null);
    const timeScale = 1.0;

    // Simulation Parameters state
    const [selectedModeIndex, setSelectedModeIndex] = useState('all');
    const [dampingRatio, setDampingRatio] = useState(engine ? engine.zeta : 0.05);
    const [exaggerationScale, setExaggerationScale] = useState(1.0);
    const exaggerationRef = useRef(1.0);
    const [icDisplacements, setIcDisplacements] = useState([]);
    const [icVelocities, setIcVelocities] = useState([]);

    useEffect(() => {
        if (engine && icDisplacements.length === 0) {
            const d0 = new Array(engine.totalDofs).fill(0);
            d0[0] = 1.0; // match TestHarness default
            setIcDisplacements(d0);
            setIcVelocities(new Array(engine.totalDofs).fill(0));
            setDampingRatio(engine.zeta);
        }
    }, [engine, icDisplacements.length]);

    // Color mapping state
    const [colorRange, setColorRange] = useState({ min: 0, max: 0 });
    const frameCountRef = useRef(0);

    useEffect(() => {
        if (!mountRef.current || !geometryData) return;

        // 1. Initialize Scene, Camera, and Renderer [cite: 203]
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a); // Dark background for FEA contrast
        sceneRef.current = scene;

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight || 500; // Default height

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        camera.position.set(5, 5, 5); // Initial angled view

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Clear any leftover canvas from a previous StrictMode mount cycle
        while (mountRef.current.firstChild) {
            mountRef.current.removeChild(mountRef.current.firstChild);
        }

        mountRef.current.appendChild(renderer.domElement);

        // Ensure pointer events are not intercepted by the browser's touch/scroll handler.
        // OrbitControls requires raw pointer events without browser gesture interference.
        renderer.domElement.style.touchAction = 'none';

        // 2. Add Lighting Controls [cite: 203]
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        scene.add(directionalLight);
        
        // --- NEW: Add Spatial Helpers ---
        const axesHelper = new THREE.AxesHelper(2); // RGB lines for X, Y, Z axes
        scene.add(axesHelper);

        const gridHelper = new THREE.GridHelper(5, 10);
        gridHelper.position.y = -0.5; // Drop the grid slightly below our nodes
        scene.add(gridHelper);
        // --------------------------------
        
        // 3. Construct the THREE.BufferGeometry 
        const geometry = new THREE.BufferGeometry();
        geometryRef.current = geometry;
        
        // Weave the parsed typed arrays into a single Float32Array for WebGL
        const numNodes = geometryData.xCoords.length;
        const positions = new Float32Array(numNodes * 3);
        const colors = new Float32Array(numNodes * 3);

        for (let i = 0; i < numNodes; i++) {
            // Position mapping
            positions[i * 3] = geometryData.xCoords[i];
            positions[i * 3 + 1] = geometryData.yCoords[i];
            positions[i * 3 + 2] = geometryData.zCoords[i];

            // Initialize with a default neutral color (e.g., light grey)
            colors[i * 3] = 0.8;
            colors[i * 3 + 1] = 0.8;
            colors[i * 3 + 2] = 0.8;
        }

        restPositionsRef.current = new Float32Array(positions);

        // Assign the arrays to the geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        // 4. Create the Material with vertexColors enabled [cite: 148, 151]
        const material = new THREE.PointsMaterial({
            size: 0.1, // Adjust based on your model's scale
            vertexColors: true,
            sizeAttenuation: true
        });

        // 5. Build the mesh (Point Cloud) and add to scene
        const pointsMesh = new THREE.Points(geometry, material);
        scene.add(pointsMesh);

        // Center the camera on the mesh
        geometry.computeBoundingSphere();
        if (geometry.boundingSphere) {
            const center = geometry.boundingSphere.center;
            const radius = geometry.boundingSphere.radius;
            camera.position.set(center.x + radius * 1.5, center.y + radius * 1.5, center.z + radius * 1.5);
            camera.lookAt(center);
        }

        // 6. Initialize OrbitControls for smooth interaction
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        
        // Set the controls target to the center of our geometry
        if (geometry.boundingSphere) {
            controls.target.copy(geometry.boundingSphere.center);
        } else {
            controls.target.set(0, 0, 0);
        }

        // CRITICAL: Force the controls to update their internal math 
        // based on the new target BEFORE the first frame renders.
        controls.update();
        
        // 7. The render loop
        let animationFrameId;
        const animate = (timestamp) => {
            animationFrameId = requestAnimationFrame(animate);
            
            if (lastTimestampRef.current === 0) lastTimestampRef.current = timestamp;
            const dt = (timestamp - lastTimestampRef.current) / 1000;
            lastTimestampRef.current = timestamp;

            if (playbackStateRef.current === 'playing' && engine && geometryRef.current && restPositionsRef.current) {
                simTimeRef.current += dt * timeScale;
                
                engine.evaluateModalState(simTimeRef.current);
                const displacement = engine.getGlobalDisplacement();
                
                const posArray = geometryRef.current.attributes.position.array;
                const colorArray = geometryRef.current.attributes.color.array;
                const restPositions = restPositionsRef.current;
                const dofsPerNode = engine.totalDofs / engine.numNodes;
                const S = exaggerationRef.current;
                
                let minMag = Infinity;
                let maxMag = -Infinity;
                const magnitudes = new Float32Array(engine.numNodes);

                for (let i = 0; i < engine.numNodes; i++) {
                    let mag = 0;
                    if (dofsPerNode === 1) {
                        const dx = displacement[i];
                        posArray[i * 3]     = restPositions[i * 3]     + dx * S;
                        posArray[i * 3 + 1] = restPositions[i * 3 + 1]; 
                        posArray[i * 3 + 2] = restPositions[i * 3 + 2]; 
                        mag = Math.abs(dx);
                    } else if (dofsPerNode === 3) {
                        const dx = displacement[i * 3];
                        const dy = displacement[i * 3 + 1];
                        const dz = displacement[i * 3 + 2];
                        posArray[i * 3]     = restPositions[i * 3]     + dx * S;
                        posArray[i * 3 + 1] = restPositions[i * 3 + 1] + dy * S;
                        posArray[i * 3 + 2] = restPositions[i * 3 + 2] + dz * S;
                        mag = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    }
                    magnitudes[i] = mag;
                    if (mag < minMag) minMag = mag;
                    if (mag > maxMag) maxMag = mag;
                }
                geometryRef.current.attributes.position.needsUpdate = true;
                
                const range = maxMag - minMag;
                const invRange = range > 1e-10 ? 1.0 / range : 0;
                for (let i = 0; i < engine.numNodes; i++) {
                    const normalized = (magnitudes[i] - minMag) * invRange;
                    const [r, g, b] = jetColormap(normalized);
                    colorArray[i * 3]     = r;
                    colorArray[i * 3 + 1] = g;
                    colorArray[i * 3 + 2] = b;
                }
                geometryRef.current.attributes.color.needsUpdate = true;
                
                frameCountRef.current++;
                if (frameCountRef.current % 10 === 0) {
                    setColorRange({ min: minMag, max: maxMag });
                }
                
                if (timeDisplayRef.current) {
                    timeDisplayRef.current.textContent = `t = ${simTimeRef.current.toFixed(3)}s`;
                }
                if (sliderRef.current) {
                    sliderRef.current.value = simTimeRef.current;
                }
            }

            controls.update(); // Required for damping
            renderer.render(scene, camera);
        };
        requestAnimationFrame(animate);

        // 8. Handle Window Resize
        const handleResize = () => {
            const newWidth = mountRef.current.clientWidth;
            const newHeight = mountRef.current.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
        };
        window.addEventListener('resize', handleResize);

        // 9. Cleanup on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
            controls.dispose();
            geometry.dispose();
            material.dispose();
            renderer.dispose();
            // Safe DOM removal — check that the canvas is still a child of mount
            const mount = mountRef.current;
            if (mount) {
                while (mount.firstChild) {
                    mount.removeChild(mount.firstChild);
                }
            }
        };
    }, [geometryData, engine]);

    const handlePlay = () => {
        playbackStateRef.current = 'playing';
        lastTimestampRef.current = 0; // Reset delta tracking
    };

    const handlePause = () => {
        playbackStateRef.current = 'paused';
    };

    const handleStop = () => {
        playbackStateRef.current = 'stopped';
        simTimeRef.current = 0;
        
        if (timeDisplayRef.current) timeDisplayRef.current.textContent = `t = 0.000s`;
        if (sliderRef.current) sliderRef.current.value = 0;

        if (geometryRef.current && restPositionsRef.current) {
            const posArray = geometryRef.current.attributes.position.array;
            posArray.set(restPositionsRef.current);
            geometryRef.current.attributes.position.needsUpdate = true;
            
            const colorArray = geometryRef.current.attributes.color.array;
            for (let i = 0; i < colorArray.length; i++) {
                colorArray[i] = 0.8;
            }
            geometryRef.current.attributes.color.needsUpdate = true;
            setColorRange({ min: 0, max: 0 });
        }
    };

    const handleModeChange = (e) => {
        const val = e.target.value;
        setSelectedModeIndex(val);
        if (engine) {
            if (val === 'all') {
                engine.setActiveModes(null);
            } else {
                engine.setActiveModes([parseInt(val, 10)]);
            }
        }
    };

    const handleDampingChange = (val) => {
        setDampingRatio(val);
        if (engine) {
            engine.setDampingRatio(val);
            handleStop();
            simTimeRef.current = 0;
            handlePlay(); // restart transient
        }
    };

    const handleExaggerationChange = (val) => {
        setExaggerationScale(val);
        exaggerationRef.current = val;
    };

    const handleICChange = (type, index, val) => {
        if (type === 'd0') {
            const newArr = [...icDisplacements];
            newArr[index] = val;
            setIcDisplacements(newArr);
        } else {
            const newArr = [...icVelocities];
            newArr[index] = val;
            setIcVelocities(newArr);
        }
    };

    const handleApplyIC = () => {
        handlePause();
        if (engine) {
            const d0 = new Float32Array(icDisplacements.map(v => Number(v) || 0));
            const v0 = new Float32Array(icVelocities.map(v => Number(v) || 0));
            engine.setInitialConditions(d0, v0);
            simTimeRef.current = 0;
            if (timeDisplayRef.current) timeDisplayRef.current.textContent = `t = 0.000s`;
            if (sliderRef.current) sliderRef.current.value = 0;
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <div 
                ref={mountRef} 
                style={{ width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #444' }} 
            />
            {engine && (
                <ColorBarLegend 
                    min={colorRange.min} 
                    max={colorRange.max} 
                />
            )}
            <div className="playback-controls" style={{ display: 'flex', gap: '8px', padding: '8px', alignItems: 'center' }}>
                <button onClick={handlePlay}>▶ Play</button>
                <button onClick={handlePause}>⏸ Pause</button>
                <button onClick={handleStop}>⏹ Stop</button>
                <input
                    ref={sliderRef}
                    type="range"
                    min="0"
                    max="5"
                    step="0.001"
                    defaultValue="0"
                    onChange={(e) => {
                        const t = parseFloat(e.target.value);
                        simTimeRef.current = t;
                        if (timeDisplayRef.current) {
                            timeDisplayRef.current.textContent = `t = ${t.toFixed(3)}s`;
                        }
                        if (engine && geometryRef.current && restPositionsRef.current) {
                            engine.evaluateModalState(t);
                            const displacement = engine.getGlobalDisplacement();
                            const posArray = geometryRef.current.attributes.position.array;
                            const colorArray = geometryRef.current.attributes.color.array;
                            const restPositions = restPositionsRef.current;
                            const dofsPerNode = engine.totalDofs / engine.numNodes;
                            const S = exaggerationRef.current;
                            
                            let minMag = Infinity;
                            let maxMag = -Infinity;
                            const magnitudes = new Float32Array(engine.numNodes);
                            
                            for (let i = 0; i < engine.numNodes; i++) {
                                let mag = 0;
                                if (dofsPerNode === 1) {
                                    const dx = displacement[i];
                                    posArray[i * 3]     = restPositions[i * 3]     + dx * S;
                                    posArray[i * 3 + 1] = restPositions[i * 3 + 1]; 
                                    posArray[i * 3 + 2] = restPositions[i * 3 + 2]; 
                                    mag = Math.abs(dx);
                                } else if (dofsPerNode === 3) {
                                    const dx = displacement[i * 3];
                                    const dy = displacement[i * 3 + 1];
                                    const dz = displacement[i * 3 + 2];
                                    posArray[i * 3]     = restPositions[i * 3]     + dx * S;
                                    posArray[i * 3 + 1] = restPositions[i * 3 + 1] + dy * S;
                                    posArray[i * 3 + 2] = restPositions[i * 3 + 2] + dz * S;
                                    mag = Math.sqrt(dx*dx + dy*dy + dz*dz);
                                }
                                magnitudes[i] = mag;
                                if (mag < minMag) minMag = mag;
                                if (mag > maxMag) maxMag = mag;
                            }
                            geometryRef.current.attributes.position.needsUpdate = true;
                            
                            const range = maxMag - minMag;
                            const invRange = range > 1e-10 ? 1.0 / range : 0;
                            for (let i = 0; i < engine.numNodes; i++) {
                                const normalized = (magnitudes[i] - minMag) * invRange;
                                const [r, g, b] = jetColormap(normalized);
                                colorArray[i * 3]     = r;
                                colorArray[i * 3 + 1] = g;
                                colorArray[i * 3 + 2] = b;
                            }
                            geometryRef.current.attributes.color.needsUpdate = true;
                            setColorRange({ min: minMag, max: maxMag });
                        }
                    }}
                    style={{ flexGrow: 1 }}
                />
                <span ref={timeDisplayRef} style={{ width: '80px', fontFamily: 'monospace' }}>t = 0.000s</span>
            </div>

            {engine && (
                <div className="simulation-parameters" style={{ padding: '16px', borderTop: '1px solid #444', backgroundColor: '#1e1e1e', color: '#fff', fontSize: '14px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Simulation Parameters</h3>
                    
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            Mode:
                            <select value={selectedModeIndex} onChange={handleModeChange} style={{ padding: '4px' }}>
                                <option value="all">All Modes (Superposition)</option>
                                {engine.frequenciesHz && engine.frequenciesHz.map((freq, idx) => (
                                    <option key={idx} value={idx}>
                                        Mode {idx + 1} — {freq.toFixed(2)} Hz
                                    </option>
                                ))}
                            </select>
                        </label>
                        
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            Exaggeration Scale (S): {exaggerationScale.toFixed(1)}
                            <input
                                type="range"
                                min="0.1"
                                max="100"
                                step="0.1"
                                value={exaggerationScale}
                                onChange={(e) => handleExaggerationChange(parseFloat(e.target.value))}
                            />
                        </label>

                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            Damping Ratio (ζ):
                            <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.01"
                                value={dampingRatio}
                                onChange={(e) => handleDampingChange(parseFloat(e.target.value))}
                                style={{ padding: '4px', width: '80px' }}
                            />
                        </label>
                    </div>

                    <div>
                        <h4 style={{ margin: '0 0 8px 0' }}>Initial Conditions</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                            {icDisplacements.map((_, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ minWidth: '40px' }}>DOF {i}:</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="d₀"
                                        value={icDisplacements[i] ?? 0}
                                        onChange={(e) => handleICChange('d0', i, parseFloat(e.target.value))}
                                        style={{ width: '60px', padding: '4px' }}
                                    />
                                    <input
                                        type="number"
                                        step="0.1"
                                        placeholder="v₀"
                                        value={icVelocities[i] ?? 0}
                                        onChange={(e) => handleICChange('v0', i, parseFloat(e.target.value))}
                                        style={{ width: '60px', padding: '4px' }}
                                    />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleApplyIC} style={{ padding: '6px 12px' }}>Apply Initial Conditions</button>
                    </div>
                </div>
            )}
        </div>
    );
}