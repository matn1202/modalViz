import React from 'react';

export default function AnimationControls({
    onPlay, onPause, onStop, onScrub,
    sliderRef, timeDisplayRef,
    isPlaying
}) {
    return (
        <div className="animation-controls glass-panel" style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 24px',
            gap: '20px',
            pointerEvents: 'auto',
            zIndex: 50
        }}>
            <button 
                onClick={isPlaying ? onPause : onPlay} 
                style={{ background: 'var(--hover-bg)', border: '1px solid rgba(0, 229, 255, 0.2)', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '18px', width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', transition: 'var(--transition-fast)' }}
                onMouseOver={(e) => { e.target.style.boxShadow = '0 0 12px rgba(0, 229, 255, 0.4)'; e.target.style.background = 'rgba(0, 229, 255, 0.15)'; }}
                onMouseOut={(e) => { e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--hover-bg)'; }}
                title={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? '⏸' : '▶'}
            </button>
            
            <button 
                onClick={onStop} 
                style={{ background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)', color: '#f85149', cursor: 'pointer', fontSize: '18px', width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', transition: 'var(--transition-fast)' }}
                onMouseOver={(e) => { e.target.style.boxShadow = '0 0 12px rgba(248, 81, 73, 0.4)'; e.target.style.background = 'rgba(248, 81, 73, 0.2)'; }}
                onMouseOut={(e) => { e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(248, 81, 73, 0.1)'; }}
                title="Stop"
            >
                ⏹
            </button>

            <input 
                ref={sliderRef}
                type="range"
                min="0"
                max="5"
                step="0.001"
                defaultValue="0"
                onChange={onScrub}
                style={{ width: '250px', cursor: 'pointer', accentColor: 'var(--accent-cyan)' }}
            />

            <span ref={timeDisplayRef} style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace', fontSize: '14px', width: '90px', textAlign: 'right', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                t = 0.000s
            </span>
        </div>
    );
}
