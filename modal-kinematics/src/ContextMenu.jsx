import React, { useEffect, useRef } from 'react';

export default function ContextMenu({ x, y, nodeInfo, onAction, onClose }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        const timeout = setTimeout(() => {
            document.addEventListener('pointerdown', handleClickOutside);
        }, 10);
        
        document.addEventListener('keydown', handleEscape);
        
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('pointerdown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    return (
        <div 
            ref={menuRef}
            className="context-menu glass-panel"
            style={{
                position: 'fixed',
                top: `${y}px`,
                left: `${x}px`,
                zIndex: 1000,
                padding: '8px 0',
                minWidth: '180px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                animation: 'fade-in var(--transition-fast)'
            }}
        >
            <div style={{ padding: '4px 16px', fontSize: '12px', color: 'var(--accent-cyan)', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', fontWeight: '600' }}>
                Node {nodeInfo.nodeId}
            </div>
            
            <button 
                onClick={() => onAction('position')} 
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', transition: 'var(--transition-fast)' }} 
                onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
                <span style={{ color: '#00ccff', marginRight: '8px' }}>📈</span> Plot Position
            </button>
            <button 
                onClick={() => onAction('velocity')} 
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', transition: 'var(--transition-fast)' }} 
                onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
                <span style={{ color: '#ffaa00', marginRight: '8px' }}>📈</span> Plot Velocity
            </button>
            <button 
                onClick={() => onAction('acceleration')} 
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', transition: 'var(--transition-fast)' }} 
                onMouseOver={(e) => e.target.style.background = 'var(--hover-bg)'}
                onMouseOut={(e) => e.target.style.background = 'transparent'}
            >
                <span style={{ color: '#ff4466', marginRight: '8px' }}>📈</span> Plot Acceleration
            </button>
        </div>
    );
}
