import React, { useState } from 'react';

export default function Toolbar({
    fileName,
    engine,
    dofsPerNode,
    selectedModeIndex, onModeChange,
    selectedAxis, onAxisChange,
    exaggerationScale, onExaggerationChange,
    dampingRatio, onDampingChange,
    selectedNodeInfo, onClearSelection,
    onReset,
    onApplyIC
}) {
    const [icOpen, setIcOpen] = useState(false);
    const [icDisp, setIcDisp] = useState([]);
    const [icVel, setIcVel] = useState([]);

    const handleToggleIC = () => {
        if (!icOpen && engine) {
            setIcDisp(new Array(engine.totalDofs).fill(0).map((_, i) => (i < dofsPerNode ? 1.0 : 0.0)));
            setIcVel(new Array(engine.totalDofs).fill(0));
        }
        setIcOpen(!icOpen);
    };

    const handleDispChange = (idx, val) => {
        const newArr = [...icDisp];
        newArr[idx] = parseFloat(val) || 0;
        setIcDisp(newArr);
    };

    const handleVelChange = (idx, val) => {
        const newArr = [...icVel];
        newArr[idx] = parseFloat(val) || 0;
        setIcVel(newArr);
    };

    const applyInitialConditions = () => {
        onApplyIC(new Float32Array(icDisp), new Float32Array(icVel));
        setIcOpen(false);
    };

    return (
        <div className="toolbar glass-panel" style={{ 
            display: 'flex', alignItems: 'center', height: '44px', padding: '0 16px', 
            gap: '16px',
            position: 'relative',
            zIndex: 100,
            borderRadius: 0,
            borderLeft: 'none', borderRight: 'none', borderTop: 'none'
        }}>
            <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '0.5px', textShadow: '0 0 8px rgba(0, 229, 255, 0.4)' }}>
                ModalViz
            </div>
            
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px', fontSize: '13px', color: 'var(--accent-cyan)' }} title={fileName}>
                📄 {fileName}
            </div>

            <button 
                onClick={onReset} 
                style={{ background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 10px', fontSize: '12px', transition: 'var(--transition-fast)' }}
                onMouseOver={(e) => { e.target.style.color = 'var(--text-primary)'; e.target.style.borderColor = 'var(--text-primary)'; e.target.style.background = 'var(--hover-bg)'; }}
                onMouseOut={(e) => { e.target.style.color = 'var(--text-secondary)'; e.target.style.borderColor = 'var(--text-secondary)'; e.target.style.background = 'transparent'; }}
            >
                ↻ Re-upload
            </button>

            <div style={{ flex: 1 }} /> {/* Spacer */}

            {dofsPerNode === 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Axis:</span>
                    <select value={selectedAxis} onChange={(e) => onAxisChange(e.target.value)} style={{ padding: '4px 8px', background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none' }}>
                        <option value="Normal">Normal</option>
                        <option value="X">X-Axis</option>
                        <option value="Y">Y-Axis</option>
                        <option value="Z">Z-Axis</option>
                    </select>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Mode:</span>
                <select value={selectedModeIndex} onChange={(e) => onModeChange(e.target.value)} style={{ padding: '4px 8px', background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none' }}>
                    <option value="all">All Modes</option>
                    {engine?.frequenciesHz && engine.frequenciesHz.map((freq, idx) => (
                        <option key={idx} value={idx}>Mode {idx + 1} ({freq.toFixed(2)} Hz)</option>
                    ))}
                </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Scale: <span style={{ color: 'var(--text-primary)' }}>{exaggerationScale.toFixed(1)}</span></span>
                <input 
                    type="range" min="0.1" max="100" step="0.1" 
                    value={exaggerationScale} 
                    onChange={(e) => onExaggerationChange(parseFloat(e.target.value))} 
                    style={{ width: '80px', accentColor: 'var(--accent-cyan)' }}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ζ:</span>
                <input 
                    type="number" min="0" max="1" step="0.01" 
                    value={dampingRatio} 
                    onChange={(e) => onDampingChange(parseFloat(e.target.value))}
                    style={{ width: '50px', padding: '4px', background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--bg-elevated)', borderRadius: 'var(--radius-sm)', fontSize: '12px', outline: 'none' }}
                />
            </div>

            {selectedNodeInfo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>
                    Node {selectedNodeInfo.nodeId} (DOF {selectedNodeInfo.dofIndex})
                    <button onClick={onClearSelection} style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '0 4px', fontSize: '14px', lineHeight: '1' }}>✕</button>
                </div>
            )}

            <div style={{ position: 'relative' }}>
                <button 
                    onClick={handleToggleIC} 
                    style={{ background: icOpen ? 'var(--hover-bg)' : 'transparent', border: '1px solid transparent', color: icOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)' }} 
                    title="Initial Conditions"
                    onMouseOver={(e) => { e.target.style.color = 'var(--accent-cyan)'; }}
                    onMouseOut={(e) => { if (!icOpen) e.target.style.color = 'var(--text-secondary)'; }}
                >
                    ⚙
                </button>
                
                {icOpen && (
                    <div className="glass-panel" style={{ position: 'absolute', top: '36px', right: '0', padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', zIndex: 100, width: '260px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                        <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>Initial Conditions</h4>
                        <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
                            {icDisp.map((_, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <span style={{ width: '40px' }}>DOF {i}</span>
                                    <input type="number" step="0.1" value={icDisp[i]} onChange={(e) => handleDispChange(i, e.target.value)} style={{ width: '70px', padding: '4px 6px', background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', outline: 'none' }} placeholder="d₀" />
                                    <input type="number" step="0.1" value={icVel[i]} onChange={(e) => handleVelChange(i, e.target.value)} style={{ width: '70px', padding: '4px 6px', background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-sm)', outline: 'none' }} placeholder="v₀" />
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={applyInitialConditions} 
                            style={{ width: '100%', padding: '8px', background: 'var(--accent-cyan)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'var(--transition-fast)' }}
                            onMouseOver={(e) => e.target.style.filter = 'brightness(1.1)'}
                            onMouseOut={(e) => e.target.style.filter = 'brightness(1)'}
                        >
                            Apply
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
