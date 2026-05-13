import React, { useState, useRef, useEffect } from 'react';
import LandingPage from './LandingPage.jsx';
import WebGLViewport from './engine/WebGLViewport.jsx';
import { ModalKinematicsEngine } from './engine/ModalKinematicsEngine.js';
import ColorBarLegend from './engine/ColorBarLegend.jsx';
import Toolbar from './Toolbar.jsx';
import AnimationControls from './AnimationControls.jsx';
import ContextMenu from './ContextMenu.jsx';
import PlotWindow from './PlotWindow.jsx';

export default function ModalVizApp() {
    const [parsedData, setParsedData] = useState(null);
    const [engineInstance, setEngineInstance] = useState(null);
    const [fileName, setFileName] = useState('');

    // Plot Windows and Context Menu State
    const [plotWindows, setPlotWindows] = useState([]);
    const [contextMenuState, setContextMenuState] = useState(null);

    // Lifted Viewport State
    const playbackStateRef = useRef('stopped');
    const simTimeRef = useRef(0);
    const sliderRef = useRef(null);
    const timeDisplayRef = useRef(null);
    const exaggerationRef = useRef(1.0);
    const selectedAxisRef = useRef('Normal');
    const plotWindowRefs = useRef(new Map());

    const [colorRange, setColorRange] = useState({ min: 0, max: 0 });
    const [selectedNode, setSelectedNode] = useState(null);

    // Toolbar states
    const [selectedModeIndex, setSelectedModeIndex] = useState('all');
    const [selectedAxis, setSelectedAxis] = useState('Normal');
    const [exaggerationScale, setExaggerationScale] = useState(1.0);
    const [dampingRatio, setDampingRatio] = useState(0.05);

    // Playback state for UI
    const [isPlaying, setIsPlaying] = useState(false);

    // Global Escape Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setPlotWindows([]);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- Playback Handlers ---
    const handlePlay = () => {
        playbackStateRef.current = 'playing';
        setIsPlaying(true);
    };

    const handlePause = () => {
        playbackStateRef.current = 'paused';
        setIsPlaying(false);
    };

    const handleStop = () => {
        playbackStateRef.current = 'stopped';
        setIsPlaying(false);
        simTimeRef.current = 0;
        if (timeDisplayRef.current) timeDisplayRef.current.textContent = `t = 0.000s`;
        if (sliderRef.current) sliderRef.current.value = 0;
        
        window.dispatchEvent(new CustomEvent('resetDeformation'));
    };

    const handleScrub = (e) => {
        const t = parseFloat(e.target.value);
        simTimeRef.current = t;
        if (timeDisplayRef.current) {
            timeDisplayRef.current.textContent = `t = ${t.toFixed(3)}s`;
        }
        playbackStateRef.current = 'playing';
        requestAnimationFrame(() => {
            if (!isPlaying) playbackStateRef.current = 'paused';
        });
    };

    // --- Toolbar Handlers ---
    const handleModeChange = (val) => {
        setSelectedModeIndex(val);
        if (engineInstance) {
            if (val === 'all') engineInstance.setActiveModes(null);
            else engineInstance.setActiveModes([parseInt(val, 10)]);
        }
    };

    const handleAxisChange = (val) => {
        setSelectedAxis(val);
        selectedAxisRef.current = val;
    };

    const handleExaggerationChange = (val) => {
        setExaggerationScale(val);
        exaggerationRef.current = val;
    };

    const handleDampingChange = (val) => {
        setDampingRatio(val);
        if (engineInstance) {
            engineInstance.setDampingRatio(val);
            handleStop();
            handlePlay();
        }
    };

    const handleApplyIC = (d0, v0) => {
        handlePause();
        if (engineInstance) {
            engineInstance.setInitialConditions(d0, v0);
            simTimeRef.current = 0;
            if (timeDisplayRef.current) timeDisplayRef.current.textContent = `t = 0.000s`;
            if (sliderRef.current) sliderRef.current.value = 0;
            window.dispatchEvent(new CustomEvent('resetDeformation'));
        }
    };

    const handleColorRangeChange = (range) => setColorRange(range);
    const handleNodeSelect = (nodeInfo) => setSelectedNode(nodeInfo);
    
    const handleClearSelection = () => {
        setSelectedNode(null);
        window.dispatchEvent(new CustomEvent('clearNodeSelection'));
    };

    const handleNodeRightClick = (nodeInfo, screenPos) => {
        setContextMenuState({ x: screenPos.x, y: screenPos.y, nodeInfo });
    };

    const handleContextMenuAction = (traceType) => {
        if (!contextMenuState) return;
        const { nodeInfo, x, y } = contextMenuState;
        
        setPlotWindows(prev => {
            const existingIdx = prev.findIndex(pw => pw.nodeId === nodeInfo.nodeId);
            if (existingIdx !== -1) {
                const existing = prev[existingIdx];
                const newTraces = existing.traces.includes(traceType)
                    ? existing.traces.filter(t => t !== traceType)
                    : [...existing.traces, traceType];
                
                if (newTraces.length === 0) {
                    return prev.filter((_, i) => i !== existingIdx);
                }
                
                const updated = [...prev];
                updated[existingIdx] = { ...existing, traces: newTraces };
                return updated;
            } else {
                return [...prev, {
                    id: crypto.randomUUID(),
                    nodeId: nodeInfo.nodeId,
                    dofIndex: nodeInfo.dofIndex,
                    traces: [traceType],
                    position: { x: x + 10, y: y + 10 }
                }];
            }
        });
        
        setContextMenuState(null);
    };

    const handleDataParsed = (buffers, uploadedFileName) => {
        setParsedData(buffers);
        setFileName(uploadedFileName);

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
        
        const initialAxis = buffers.shapeAxis ? buffers.shapeAxis.toUpperCase() : 'Normal';
        setSelectedAxis(initialAxis);
        selectedAxisRef.current = initialAxis;
        setDampingRatio(0.05);
        setExaggerationScale(1.0);
        exaggerationRef.current = 1.0;
        setSelectedModeIndex('all');
    };

    const handleReset = () => {
        setParsedData(null);
        setEngineInstance(null);
        setFileName('');
        setPlotWindows([]);
        setSelectedNode(null);
        setColorRange({ min: 0, max: 0 });
        setContextMenuState(null);
        handleStop();
    };

    if (!parsedData || !engineInstance) {
        return <LandingPage onDataParsed={handleDataParsed} />;
    }

    return (
        <div className="workspace-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0d0d0d', color: '#fff' }}>
            <Toolbar 
                fileName={fileName}
                engine={engineInstance}
                dofsPerNode={parsedData.dofsPerNode}
                selectedModeIndex={selectedModeIndex}
                onModeChange={handleModeChange}
                selectedAxis={selectedAxis}
                onAxisChange={handleAxisChange}
                exaggerationScale={exaggerationScale}
                onExaggerationChange={handleExaggerationChange}
                dampingRatio={dampingRatio}
                onDampingChange={handleDampingChange}
                selectedNodeInfo={selectedNode}
                onClearSelection={handleClearSelection}
                onReset={handleReset}
                onApplyIC={handleApplyIC}
            />
            
            <div className="viewport-container" style={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                <WebGLViewport 
                    geometryData={parsedData} 
                    engine={engineInstance}
                    playbackStateRef={playbackStateRef}
                    simTimeRef={simTimeRef}
                    sliderRef={sliderRef}
                    timeDisplayRef={timeDisplayRef}
                    exaggerationRef={exaggerationRef}
                    selectedAxisRef={selectedAxisRef}
                    onNodeSelect={handleNodeSelect}
                    onNodeRightClick={handleNodeRightClick}
                    onColorRangeChange={handleColorRangeChange}
                    plotWindowRefs={plotWindowRefs}
                />
                
                {engineInstance && (
                    <ColorBarLegend 
                        min={colorRange.min} 
                        max={colorRange.max} 
                    />
                )}

                {contextMenuState && (
                    <ContextMenu 
                        x={contextMenuState.x}
                        y={contextMenuState.y}
                        nodeInfo={contextMenuState.nodeInfo}
                        onAction={handleContextMenuAction}
                        onClose={() => setContextMenuState(null)}
                    />
                )}

                {plotWindows.map(pw => (
                    <PlotWindow 
                        key={pw.id}
                        id={pw.id}
                        nodeId={pw.nodeId}
                        dofIndex={pw.dofIndex}
                        traces={pw.traces}
                        initialPosition={pw.position}
                        plotWindowRefs={plotWindowRefs}
                        onClose={() => setPlotWindows(prev => prev.filter(w => w.id !== pw.id))}
                    />
                ))}
                
                <AnimationControls 
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onStop={handleStop}
                    onScrub={handleScrub}
                    sliderRef={sliderRef}
                    timeDisplayRef={timeDisplayRef}
                    isPlaying={isPlaying}
                />
            </div>
        </div>
    );
}
