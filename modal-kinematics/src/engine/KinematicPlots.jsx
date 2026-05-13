import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

/**
 * Three synchronized 2D plots for scoped node kinematics.
 * Renders: Displacement vs. Time, Velocity vs. Time, Acceleration vs. Time.
 * 
 * @param {Object} props
 * @param {number[]} props.timeData - Array of time values
 * @param {number[]} props.displacementData - Array of displacement values
 * @param {number[]} props.velocityData - Array of velocity values  
 * @param {number[]} props.accelerationData - Array of acceleration values
 * @param {number} props.nodeId - Selected node ID (for title)
 */
export default function KinematicPlots({ 
    timeData, displacementData, velocityData, accelerationData, nodeId 
}) {
    const dispRef = useRef(null);
    const velRef = useRef(null);
    const accRef = useRef(null);

    useEffect(() => {
        if (!dispRef.current || !velRef.current || !accRef.current) return;
        if (!timeData || timeData.length === 0) return;

        const commonLayout = {
            margin: { t: 30, b: 40, l: 60, r: 20 },
            paper_bgcolor: '#1a1a1a',
            plot_bgcolor: '#1a1a1a',
            font: { color: '#ccc', size: 11 },
            xaxis: { 
                title: 'Time (s)', 
                gridcolor: '#333',
                range: timeData.length > 1 
                    ? [timeData[0], timeData[timeData.length - 1]] 
                    : undefined
            },
            yaxis: { gridcolor: '#333' },
        };

        const config = { 
            displayModeBar: false, 
            responsive: true,
            staticPlot: false
        };

        // Displacement plot
        Plotly.react(dispRef.current, [{
            x: timeData,
            y: displacementData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#00ccff', width: 1.5 },
            name: 'u(t)'
        }], {
            ...commonLayout,
            title: `Node ${nodeId} — Displacement`,
            yaxis: { ...commonLayout.yaxis, title: 'u(t)' }
        }, config);

        // Velocity plot
        Plotly.react(velRef.current, [{
            x: timeData,
            y: velocityData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#ffaa00', width: 1.5 },
            name: 'v(t)'
        }], {
            ...commonLayout,
            title: `Node ${nodeId} — Velocity`,
            yaxis: { ...commonLayout.yaxis, title: 'v(t)' }
        }, config);

        // Acceleration plot
        Plotly.react(accRef.current, [{
            x: timeData,
            y: accelerationData,
            type: 'scatter',
            mode: 'lines',
            line: { color: '#ff4466', width: 1.5 },
            name: 'a(t)'
        }], {
            ...commonLayout,
            title: `Node ${nodeId} — Acceleration`,
            yaxis: { ...commonLayout.yaxis, title: 'a(t)' }
        }, config);

    }, [timeData, displacementData, velocityData, accelerationData, nodeId]);

    // Cleanup Plotly instances on unmount
    useEffect(() => {
        return () => {
            if (dispRef.current) Plotly.purge(dispRef.current);
            if (velRef.current) Plotly.purge(velRef.current);
            if (accRef.current) Plotly.purge(accRef.current);
        };
    }, []);

    return (
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '8px',
            padding: '8px',
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #444'
        }}>
            <div ref={dispRef} style={{ height: '220px' }} />
            <div ref={velRef} style={{ height: '220px' }} />
            <div ref={accRef} style={{ height: '220px' }} />
        </div>
    );
}
