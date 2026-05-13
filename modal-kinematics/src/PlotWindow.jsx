import React, { useEffect, useRef, useState, forwardRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import { RollingBuffer } from './engine/RollingBuffer.js';

const PlotWindow = forwardRef(({ 
    id, nodeId, dofIndex, traces, initialPosition, onClose, plotWindowRefs 
}, ref) => {
    const plotContainerRef = useRef(null);
    const windowRef = useRef(null);
    
    // Position state
    const [pos, setPos] = useState(initialPosition || { x: 100, y: 100 });
    
    // Drag state refs
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // Buffers
    const BUFFER_CAPACITY = 500;
    const timeBufRef = useRef(new RollingBuffer(BUFFER_CAPACITY));
    const posBufRef = useRef(new RollingBuffer(BUFFER_CAPACITY));
    const velBufRef = useRef(new RollingBuffer(BUFFER_CAPACITY));
    const accBufRef = useRef(new RollingBuffer(BUFFER_CAPACITY));
    
    const frameCounterRef = useRef(0);
    
    // Imperative API for WebGLViewport data feed
    useEffect(() => {
        const pushData = (t, kin) => {
            timeBufRef.current.push(t);
            posBufRef.current.push(kin.position);
            velBufRef.current.push(kin.velocity);
            accBufRef.current.push(kin.acceleration);
            
            frameCounterRef.current++;
            if (frameCounterRef.current % 6 === 0) {
                updatePlot();
            }
        };

        if (plotWindowRefs) {
            plotWindowRefs.current.set(id, { dofIndex, pushData });
        }
        
        return () => {
            if (plotWindowRefs) plotWindowRefs.current.delete(id);
        };
    }, [id, dofIndex, plotWindowRefs]);

    const updatePlot = () => {
        if (!plotContainerRef.current) return;
        
        const data = [];
        const timeArr = timeBufRef.current.toArray();
        
        if (traces.includes('position')) {
            data.push({
                x: timeArr,
                y: posBufRef.current.toArray(),
                mode: 'lines',
                name: 'Position',
                line: { color: '#00ccff', width: 2 }
            });
        }
        if (traces.includes('velocity')) {
            data.push({
                x: timeArr,
                y: velBufRef.current.toArray(),
                mode: 'lines',
                name: 'Velocity',
                line: { color: '#ffaa00', width: 2 }
            });
        }
        if (traces.includes('acceleration')) {
            data.push({
                x: timeArr,
                y: accBufRef.current.toArray(),
                mode: 'lines',
                name: 'Acceleration',
                line: { color: '#ff4466', width: 2 }
            });
        }
        
        const layout = {
            margin: { l: 40, r: 20, t: 20, b: 30 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#aaa', family: 'Inter, sans-serif' },
            xaxis: { 
                title: 'Time (s)', 
                gridcolor: 'rgba(255,255,255,0.1)',
                zerolinecolor: 'rgba(255,255,255,0.2)'
            },
            yaxis: { 
                gridcolor: 'rgba(255,255,255,0.1)',
                zerolinecolor: 'rgba(255,255,255,0.2)'
            },
            legend: {
                orientation: 'h',
                y: 1.1,
                x: 0,
                font: { color: '#fff' }
            }
        };

        const config = { responsive: true, displayModeBar: false };
        Plotly.react(plotContainerRef.current, data, layout, config);
    };

    useEffect(() => {
        updatePlot();
        return () => {
            if (plotContainerRef.current) Plotly.purge(plotContainerRef.current);
        };
    }, [traces]);

    // Drag handlers
    const onPointerDown = (e) => {
        if (!e.target.closest('.title-bar')) return;
        
        e.target.setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        
        const rect = windowRef.current.getBoundingClientRect();
        dragOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const onPointerMove = (e) => {
        if (!isDraggingRef.current) return;
        
        setPos({
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y
        });
    };

    const onPointerUp = (e) => {
        if (isDraggingRef.current) {
            e.target.releasePointerCapture(e.pointerId);
            isDraggingRef.current = false;
        }
    };

    return (
        <div 
            ref={windowRef}
            className="plot-window glass-panel-accent"
            style={{
                position: 'fixed',
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: '400px',
                height: '320px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 40,
                overflow: 'hidden'
            }}
        >
            <div 
                className="title-bar"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 16px',
                    background: 'var(--bg-elevated)',
                    borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
                    cursor: 'grab',
                    userSelect: 'none'
                }}
            >
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' }}>
                    Node {nodeId} Kinematics
                </div>
                <button 
                    onClick={onClose}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0 4px', fontSize: '18px', transition: 'var(--transition-fast)' }}
                    onMouseOver={(e) => e.target.style.color = 'var(--accent-red, #f85149)'}
                    onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}
                >
                    ×
                </button>
            </div>
            
            <div style={{ flex: 1, position: 'relative' }}>
                <div ref={plotContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>
        </div>
    );
});

export default PlotWindow;
