import React from 'react';
import { jetColormap } from './colormap.js';

/**
 * Color bar legend overlay for the 3D viewport.
 * Displays a vertical Jet colormap gradient with live min/max displacement values.
 */
export default function ColorBarLegend({ min, max, label = 'Displacement Magnitude' }) {
    // Generate CSS gradient stops from the Jet colormap
    const stops = [];
    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
        const t = i / numStops;
        const [r, g, b] = jetColormap(t);
        const pct = (1 - t) * 100; // Invert: red on top, blue on bottom
        stops.push(`rgb(${Math.round(r*255)}, ${Math.round(g*255)}, ${Math.round(b*255)}) ${pct}%`);
    }
    const gradient = `linear-gradient(to bottom, ${stops.join(', ')})`;
    
    return (
        <div className="colorbar-legend" style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            bottom: '16px',
            width: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none', // Don't block orbit controls
            zIndex: 10,
        }}>
            {/* Label */}
            <span style={{ 
                fontSize: '10px', color: '#ccc', marginBottom: '4px',
                writingMode: 'vertical-rl', textOrientation: 'mixed',
                transform: 'rotate(180deg)'
            }}>
                {label}
            </span>
            
            {/* Max value */}
            <span style={{ fontSize: '10px', color: '#fff', marginBottom: '2px' }}>
                {max?.toFixed(4) ?? '—'}
            </span>
            
            {/* Gradient bar */}
            <div style={{
                flex: 1,
                width: '16px',
                background: gradient,
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.2)',
            }} />
            
            {/* Min value */}
            <span style={{ fontSize: '10px', color: '#fff', marginTop: '2px' }}>
                {min?.toFixed(4) ?? '—'}
            </span>
        </div>
    );
}
