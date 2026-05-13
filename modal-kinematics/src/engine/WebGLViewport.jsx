import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { jetColormap } from './colormap.js';
import Delaunator from 'delaunator';

export default function WebGLViewport({ 
    geometryData, 
    engine,
    playbackStateRef,
    simTimeRef,
    sliderRef,
    timeDisplayRef,
    exaggerationRef,
    selectedAxisRef,
    onNodeSelect,
    onNodeRightClick,
    onColorRangeChange,
    plotWindowRefs
}) {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const geometryRef = useRef(null);
    const restPositionsRef = useRef(null);
    
    // Raycasting & Selection state
    const selectedNodeRef = useRef(null);
    const highlightMeshRef = useRef(null);

    // Internal timing & rendering state
    const lastTimestampRef = useRef(0);
    const frameCountRef = useRef(0);
    const timeScale = 1.0;

    useEffect(() => {
        if (!mountRef.current || !geometryData) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        sceneRef.current = scene;

        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight || 500;

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
        camera.position.set(5, 5, 5);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);

        while (mountRef.current.firstChild) {
            mountRef.current.removeChild(mountRef.current.firstChild);
        }
        mountRef.current.appendChild(renderer.domElement);
        renderer.domElement.style.touchAction = 'none';

        const raycaster = new THREE.Raycaster();
        raycaster.params.Points.threshold = 0.1;
        const mouse = new THREE.Vector2();

        const highlightGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const highlightMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff88,
            transparent: true,
            opacity: 0.8
        });
        const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
        highlightMesh.visible = false;
        scene.add(highlightMesh);
        highlightMeshRef.current = highlightMesh;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        scene.add(directionalLight);
        
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);

        const gridHelper = new THREE.GridHelper(5, 10);
        gridHelper.position.y = -0.5;
        scene.add(gridHelper);
        
        const geometry = new THREE.BufferGeometry();
        geometryRef.current = geometry;
        
        const numNodes = geometryData.xCoords.length;
        const positions = new Float32Array(numNodes * 3);
        const colors = new Float32Array(numNodes * 3);

        for (let i = 0; i < numNodes; i++) {
            positions[i * 3] = geometryData.xCoords[i];
            positions[i * 3 + 1] = geometryData.yCoords[i];
            positions[i * 3 + 2] = geometryData.zCoords[i];
            colors[i * 3] = 0.8;
            colors[i * 3 + 1] = 0.8;
            colors[i * 3 + 2] = 0.8;
        }

        restPositionsRef.current = new Float32Array(positions);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < numNodes; i++) {
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            if (z < minZ) minZ = z;
            if (z > maxZ) maxZ = z;
        }

        const eps = 1e-6;
        const hasX = (maxX - minX) > eps;
        const hasY = (maxY - minY) > eps;
        const hasZ = (maxZ - minZ) > eps;
        const numDims = (hasX ? 1 : 0) + (hasY ? 1 : 0) + (hasZ ? 1 : 0);

        let topologyMaterial = null;
        let topologyObject = null;
        let undeformedTopologyMaterial = null;

        if (numDims === 1) {
            const primaryAxis = hasX ? 0 : (hasY ? 1 : 2);
            const indicesWithPositions = [];
            for (let i = 0; i < numNodes; i++) {
                indicesWithPositions.push({ index: i, val: positions[i * 3 + primaryAxis] });
            }
            indicesWithPositions.sort((a, b) => a.val - b.val);
            
            const lineIndices = [];
            for (let i = 0; i < numNodes - 1; i++) {
                lineIndices.push(indicesWithPositions[i].index, indicesWithPositions[i+1].index);
            }
            
            geometry.setIndex(lineIndices);
            geometry.computeVertexNormals();
            topologyMaterial = new LineMaterial({
                color: 0xffffff,
                linewidth: 5,
                vertexColors: true,
                resolution: new THREE.Vector2(width, height)
            });
            
            const lineGeom = new LineSegmentsGeometry().fromLineSegments(new THREE.LineSegments(geometry));
            topologyObject = new LineSegments2(lineGeom, topologyMaterial);
            scene.add(topologyObject);

            undeformedTopologyMaterial = new LineMaterial({
                color: 0xffffff,
                linewidth: 2,
                vertexColors: false,
                transparent: true,
                opacity: 0.3,
                resolution: new THREE.Vector2(width, height)
            });
            const undeformedObject = new LineSegments2(lineGeom, undeformedTopologyMaterial);
            scene.add(undeformedObject);
        } else if (numDims === 2) {
            const axes = [];
            if (hasX) axes.push(0);
            if (hasY) axes.push(1);
            if (hasZ) axes.push(2);
            
            const coords = [];
            for (let i = 0; i < numNodes; i++) {
                coords.push(positions[i * 3 + axes[0]], positions[i * 3 + axes[1]]);
            }
            
            const delaunay = new Delaunator(coords);
            geometry.setIndex(Array.from(delaunay.triangles));
            geometry.computeVertexNormals();
            
            topologyMaterial = new THREE.MeshStandardMaterial({
                vertexColors: true,
                side: THREE.DoubleSide,
                roughness: 0.5,
                metalness: 0.1
            });
            topologyObject = new THREE.Mesh(geometry, topologyMaterial);
            scene.add(topologyObject);

            const undeformedMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.2
            });
            const undeformedObject = new THREE.Mesh(geometry.clone(), undeformedMaterial);
            scene.add(undeformedObject);
        }

        const material = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            sizeAttenuation: true
        });

        const pointsMesh = new THREE.Points(geometry, material);
        scene.add(pointsMesh);

        const undeformedPointsMaterial = new THREE.PointsMaterial({
            color: 0x888888,
            size: 0.1,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.5
        });
        const undeformedPointsMesh = new THREE.Points(geometry.clone(), undeformedPointsMaterial);
        scene.add(undeformedPointsMesh);

        geometry.computeBoundingSphere();
        if (geometry.boundingSphere) {
            const center = geometry.boundingSphere.center;
            const radius = geometry.boundingSphere.radius;
            camera.position.set(center.x + radius * 1.5, center.y + radius * 1.5, center.z + radius * 1.5);
            camera.lookAt(center);
        }

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        
        if (geometry.boundingSphere) {
            controls.target.copy(geometry.boundingSphere.center);
        } else {
            controls.target.set(0, 0, 0);
        }
        controls.update();

        // Initial Deformation on Mount
        if (engine) {
            engine.evaluateModalState(0);
            const displacement = engine.getGlobalDisplacement();
            const posArray = geometry.attributes.position.array;
            const colorArray = geometry.attributes.color.array;
            const restPositions = restPositionsRef.current;
            const dofsPerNode = engine.totalDofs / engine.numNodes;
            const S = exaggerationRef?.current ?? 1.0;
            const axisStr = selectedAxisRef?.current ?? (numDims === 2 ? 'Normal' : (geometryData.shapeAxis?.toUpperCase() || 'Normal'));
            
            let minMag = Infinity;
            let maxMag = -Infinity;
            const magnitudes = new Float32Array(engine.numNodes);

            for (let i = 0; i < engine.numNodes; i++) {
                let mag = 0;
                if (dofsPerNode === 1) {
                    const d = displacement[i];
                    posArray[i * 3]     = restPositions[i * 3];
                    posArray[i * 3 + 1] = restPositions[i * 3 + 1];
                    posArray[i * 3 + 2] = restPositions[i * 3 + 2];
                    
                    if (axisStr === 'X') {
                        posArray[i * 3] += d * S;
                    } else if (axisStr === 'Y') {
                        posArray[i * 3 + 1] += d * S;
                    } else if (axisStr === 'Z') {
                        posArray[i * 3 + 2] += d * S;
                    } else {
                        const nx = geometry.attributes.normal ? geometry.attributes.normal.array[i * 3] : 0;
                        const ny = geometry.attributes.normal ? geometry.attributes.normal.array[i * 3 + 1] : 0;
                        const nz = geometry.attributes.normal ? geometry.attributes.normal.array[i * 3 + 2] : 0;
                        posArray[i * 3] += d * S * nx;
                        posArray[i * 3 + 1] += d * S * ny;
                        posArray[i * 3 + 2] += d * S * nz;
                    }
                    mag = Math.abs(d);
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
            geometry.attributes.position.needsUpdate = true;
            
            const range = maxMag - minMag;
            const invRange = range > 1e-10 ? 1.0 / range : 0;
            for (let i = 0; i < engine.numNodes; i++) {
                const normalized = (magnitudes[i] - minMag) * invRange;
                const [r, g, b] = jetColormap(normalized);
                colorArray[i * 3]     = r;
                colorArray[i * 3 + 1] = g;
                colorArray[i * 3 + 2] = b;
            }
            geometry.attributes.color.needsUpdate = true;
            
            if (topologyObject && topologyObject.isLineSegments2) {
                topologyObject.geometry.fromLineSegments(new THREE.LineSegments(geometry));
            }

            if (onColorRangeChange) onColorRangeChange({ min: minMag, max: maxMag });
        }
        
        const handleNodeClick = (event) => {
            if (event.button !== 0) return;
            
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(pointsMesh);
            
            if (intersects.length > 0) {
                const hit = intersects[0];
                const vertexIndex = hit.index; 
                const nodeId = geometryData.nodes ? geometryData.nodes[vertexIndex] : vertexIndex;
                const dofsPerNode = engine ? (engine.totalDofs / engine.numNodes) : 1;
                const dofIndex = dofsPerNode === 1 ? vertexIndex : vertexIndex * 3;
                
                const posArray = geometryRef.current.attributes.position.array;
                highlightMesh.position.set(
                    posArray[vertexIndex * 3],
                    posArray[vertexIndex * 3 + 1],
                    posArray[vertexIndex * 3 + 2]
                );
                highlightMesh.visible = true;
                
                const nodeInfo = { vertexIndex, nodeId, dofIndex };
                selectedNodeRef.current = nodeInfo;
                if (onNodeSelect) onNodeSelect(nodeInfo);
            } else {
                highlightMesh.visible = false;
                selectedNodeRef.current = null;
                if (onNodeSelect) onNodeSelect(null);
            }
        };

        const onContextMenu = (event) => {
            event.preventDefault();
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(pointsMesh);
            
            if (intersects.length > 0 && onNodeRightClick) {
                const hit = intersects[0];
                const vertexIndex = hit.index; 
                const nodeId = geometryData.nodes ? geometryData.nodes[vertexIndex] : vertexIndex;
                const dofsPerNode = engine ? (engine.totalDofs / engine.numNodes) : 1;
                const dofIndex = dofsPerNode === 1 ? vertexIndex : vertexIndex * 3;
                
                onNodeRightClick(
                    { vertexIndex, nodeId, dofIndex }, 
                    { x: event.clientX, y: event.clientY }
                );
            }
        };

        let pointerDownPos = { x: 0, y: 0 };
        const onPointerDown = (e) => {
            if (e.button === 0) {
                pointerDownPos = { x: e.clientX, y: e.clientY };
            }
        };
        const onPointerUp = (e) => {
            if (e.button === 0) {
                const dx = e.clientX - pointerDownPos.x;
                const dy = e.clientY - pointerDownPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 3) handleNodeClick(e);
            }
        };

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('contextmenu', onContextMenu);

        let animationFrameId;
        const animate = (timestamp) => {
            animationFrameId = requestAnimationFrame(animate);
            
            if (lastTimestampRef.current === 0) lastTimestampRef.current = timestamp;
            const dt = (timestamp - lastTimestampRef.current) / 1000;
            lastTimestampRef.current = timestamp;

            if (playbackStateRef?.current === 'playing' && engine && geometryRef.current && restPositionsRef.current) {
                if (simTimeRef) {
                    simTimeRef.current += dt * timeScale;
                }
                const currentSimTime = simTimeRef ? simTimeRef.current : 0;
                
                engine.evaluateModalState(currentSimTime);
                const displacement = engine.getGlobalDisplacement();
                
                const posArray = geometryRef.current.attributes.position.array;
                const colorArray = geometryRef.current.attributes.color.array;
                const restPositions = restPositionsRef.current;
                const dofsPerNode = engine.totalDofs / engine.numNodes;
                const S = exaggerationRef?.current ?? 1.0;
                
                let minMag = Infinity;
                let maxMag = -Infinity;
                const magnitudes = new Float32Array(engine.numNodes);

                const axisStr = selectedAxisRef?.current ?? 'Normal';

                for (let i = 0; i < engine.numNodes; i++) {
                    let mag = 0;
                    if (dofsPerNode === 1) {
                        const d = displacement[i];
                        posArray[i * 3]     = restPositions[i * 3];
                        posArray[i * 3 + 1] = restPositions[i * 3 + 1];
                        posArray[i * 3 + 2] = restPositions[i * 3 + 2];
                        
                        if (axisStr === 'X') {
                            posArray[i * 3] += d * S;
                        } else if (axisStr === 'Y') {
                            posArray[i * 3 + 1] += d * S;
                        } else if (axisStr === 'Z') {
                            posArray[i * 3 + 2] += d * S;
                        } else {
                            const nx = geometryRef.current.attributes.normal ? geometryRef.current.attributes.normal.array[i * 3] : 0;
                            const ny = geometryRef.current.attributes.normal ? geometryRef.current.attributes.normal.array[i * 3 + 1] : 0;
                            const nz = geometryRef.current.attributes.normal ? geometryRef.current.attributes.normal.array[i * 3 + 2] : 0;
                            posArray[i * 3] += d * S * nx;
                            posArray[i * 3 + 1] += d * S * ny;
                            posArray[i * 3 + 2] += d * S * nz;
                        }
                        mag = Math.abs(d);
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
                if (frameCountRef.current % 10 === 0 && onColorRangeChange) {
                    onColorRangeChange({ min: minMag, max: maxMag });
                }

                // Plot data feed per frame
                if (plotWindowRefs?.current) {
                    for (const [windowId, ref] of plotWindowRefs.current.entries()) {
                        if (ref.pushData) {
                            const kin = engine.getScopedKinematics(ref.dofIndex);
                            ref.pushData(currentSimTime, kin);
                        }
                    }
                }
                
                if (topologyObject && topologyObject.isLineSegments2) {
                    topologyObject.geometry.fromLineSegments(new THREE.LineSegments(geometryRef.current));
                }
                
                if (timeDisplayRef?.current) {
                    timeDisplayRef.current.textContent = `t = ${currentSimTime.toFixed(3)}s`;
                }
                if (sliderRef?.current) {
                    sliderRef.current.value = currentSimTime;
                }
            }

            controls.update();

            if (selectedNodeRef.current && highlightMesh.visible && geometryRef.current) {
                const idx = selectedNodeRef.current.vertexIndex;
                const posArray = geometryRef.current.attributes.position.array;
                highlightMesh.position.set(
                    posArray[idx * 3],
                    posArray[idx * 3 + 1],
                    posArray[idx * 3 + 2]
                );
            }

            renderer.render(scene, camera);
        };
        requestAnimationFrame(animate);

        const handleResize = () => {
            const newWidth = mountRef.current.clientWidth;
            const newHeight = mountRef.current.clientHeight;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight);
            if (topologyMaterial && topologyMaterial.isLineMaterial) {
                topologyMaterial.resolution.set(newWidth, newHeight);
            }
            if (undeformedTopologyMaterial && undeformedTopologyMaterial.isLineMaterial) {
                undeformedTopologyMaterial.resolution.set(newWidth, newHeight);
            }
        };
        const onClearNodeSelection = () => {
            highlightMesh.visible = false;
            selectedNodeRef.current = null;
            if (onNodeSelect) onNodeSelect(null);
        };

        const onResetDeformation = () => {
            if (geometryRef.current && restPositionsRef.current) {
                const posArray = geometryRef.current.attributes.position.array;
                posArray.set(restPositionsRef.current);
                geometryRef.current.attributes.position.needsUpdate = true;
                
                const colorArray = geometryRef.current.attributes.color.array;
                for (let i = 0; i < colorArray.length; i++) {
                    colorArray[i] = 0.8;
                }
                geometryRef.current.attributes.color.needsUpdate = true;
                if (onColorRangeChange) onColorRangeChange({ min: 0, max: 0 });
            }
        };

        window.addEventListener('clearNodeSelection', onClearNodeSelection);
        window.addEventListener('resetDeformation', onResetDeformation);
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('clearNodeSelection', onClearNodeSelection);
            window.removeEventListener('resetDeformation', onResetDeformation);
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
            renderer.domElement.removeEventListener('contextmenu', onContextMenu);
            cancelAnimationFrame(animationFrameId);
            controls.dispose();
            geometry.dispose();
            material.dispose();
            if (topologyMaterial) topologyMaterial.dispose();
            highlightGeometry.dispose();
            highlightMaterial.dispose();
            renderer.dispose();
            const mount = mountRef.current;
            if (mount) {
                while (mount.firstChild) {
                    mount.removeChild(mount.firstChild);
                }
            }
        };
    }, [geometryData, engine]); // Minimal dependencies to prevent re-mounting the canvas

    // Sync ref changes when they change externally, if necessary
    // E.g., if we want to handle programmatic stop, we check it inside the animation loop.

    return (
        <div 
            ref={mountRef} 
            style={{ position: 'absolute', inset: 0, outline: 'none' }} 
        />
    );
}