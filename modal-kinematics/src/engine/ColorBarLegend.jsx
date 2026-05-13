import React from 'react';

export default function ColorBarLegend({ min, max }) {
    return (
        <div className="colorbar-legend glass-panel" style={{
            position: 'absolute',
            left: '16px',
            top: '16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: '12px',
            padding: '12px',
            height: '200px',
            pointerEvents: 'none',
            zIndex: 40
        }}>
            <div style={{
                writingMode: 'vertical-lr',
                transform: 'rotate(180deg)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                textAlign: 'center',
                letterSpacing: '1px',
                fontWeight: '500'
            }}>
                Displacement Magnitude
            </div>
            <div style={{
                width: '20px',
                background: 'linear-gradient(to top, #0000aa, #00aaff, #55ff55, #ffff00, #ff0000, #aa0000)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'inset 0 0 4px rgba(0,0,0,0.5)'
            }} />
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '2px 0'
            }}>
                <span>{max.toExponential(2)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{((max + min) / 2).toExponential(2)}</span>
                <span>{min.toExponential(2)}</span>
            </div>
        </div>
    );
}
