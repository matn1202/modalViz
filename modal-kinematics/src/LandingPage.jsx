import React, { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';

const MAPPING_ROLES = [
    "Node ID", 
    "X-Coordinate", 
    "Y-Coordinate", 
    "Z-Coordinate", 
    "Frequency", 
    "Shape UX",
    "Shape UY",
    "Shape UZ"
];

export default function LandingPage({ onDataParsed }) {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [columnMappings, setColumnMappings] = useState({});
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const fileInputRef = useRef(null);

    const processFile = (uploadedFile) => {
        if (!uploadedFile) return;
        setFile(uploadedFile);
        setError(null);

        Papa.parse(uploadedFile, {
            preview: 5,
            skipEmptyLines: true,
            complete: (results) => {
                setPreviewData(results.data);
            },
            error: (err) => setError(`Preview Error: ${err.message}`)
        });
    };

    const handleFileUpload = (event) => {
        processFile(event.target.files[0]);
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handleMappingChange = (columnIndex, mappedRole) => {
        setColumnMappings(prev => ({
            ...prev,
            [columnIndex]: mappedRole
        }));
    };

    const handleProcessData = useCallback(() => {
        const assignedRoles = Object.values(columnMappings);
        const requiredCore = ["Node ID", "X-Coordinate", "Y-Coordinate", "Z-Coordinate", "Frequency"];
        const missingCore = requiredCore.filter(role => !assignedRoles.includes(role));
        
        const hasShape = assignedRoles.includes("Shape UX") || assignedRoles.includes("Shape UY") || assignedRoles.includes("Shape UZ");

        if (missingCore.length > 0 || !hasShape) {
            const errorMsg = missingCore.length > 0 
                ? `Missing required columns: ${missingCore.join(', ')}` 
                : `Must map at least one shape column (Shape UX, Shape UY, or Shape UZ)`;
            setError(errorMsg);
            return;
        }

        setIsParsing(true);
        setError(null);

        const indexMap = Object.entries(columnMappings).reduce((acc, [idx, role]) => {
            acc[role] = parseInt(idx, 10);
            return acc;
        }, {});

        Papa.parse(file, {
            worker: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                processRawDataToBuffers(results.data, indexMap);
            },
            error: (err) => {
                setError(`Parsing Error: ${err.message}`);
                setIsParsing(false);
            }
        });
    }, [file, columnMappings]);

    const processRawDataToBuffers = (rawData, indexMap) => {
        try {
            const numericData = rawData.slice(1);
            const numRows = numericData.length;
            
            const hasUX = "Shape UX" in indexMap;
            const hasUY = "Shape UY" in indexMap;
            const hasUZ = "Shape UZ" in indexMap;
            const numShapesMapped = (hasUX ? 1 : 0) + (hasUY ? 1 : 0) + (hasUZ ? 1 : 0);
            const dofsPerNode = numShapesMapped > 1 ? 3 : 1;

            const nodes = new Int32Array(numRows);
            const xCoords = new Float32Array(numRows);
            const yCoords = new Float32Array(numRows);
            const zCoords = new Float32Array(numRows);
            const frequencies = new Float32Array(numRows);
            const modeShapes = new Float32Array(numRows * dofsPerNode);

            for (let i = 0; i < numRows; i++) {
                const row = numericData[i];
                nodes[i] = row[indexMap["Node ID"]];
                xCoords[i] = row[indexMap["X-Coordinate"]];
                yCoords[i] = row[indexMap["Y-Coordinate"]];
                zCoords[i] = row[indexMap["Z-Coordinate"]];
                frequencies[i] = row[indexMap["Frequency"]];
                
                if (dofsPerNode === 1) {
                    if (hasUX) modeShapes[i] = row[indexMap["Shape UX"]];
                    else if (hasUY) modeShapes[i] = row[indexMap["Shape UY"]];
                    else if (hasUZ) modeShapes[i] = row[indexMap["Shape UZ"]];
                } else {
                    modeShapes[i * 3] = hasUX ? row[indexMap["Shape UX"]] : 0.0;
                    modeShapes[i * 3 + 1] = hasUY ? row[indexMap["Shape UY"]] : 0.0;
                    modeShapes[i * 3 + 2] = hasUZ ? row[indexMap["Shape UZ"]] : 0.0;
                }
            }

            let shapeAxis = 'x';
            if (dofsPerNode === 1) {
                if (hasUX) shapeAxis = 'x';
                else if (hasUY) shapeAxis = 'y';
                else if (hasUZ) shapeAxis = 'z';
            }

            setIsParsing(false);
            onDataParsed({ nodes, xCoords, yCoords, zCoords, frequencies, modeShapes, dofsPerNode, shapeAxis }, file.name);

        } catch (err) {
            setError(`Buffer Allocation Error: ${err.message}`);
            setIsParsing(false);
        }
    };

    return (
        <div className="landing-page">
            <div className="glass-panel" style={{ padding: '40px', maxWidth: '800px', width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
                <h1 style={{ marginBottom: '10px', textShadow: '0 0 16px rgba(0, 229, 255, 0.5)', color: 'var(--text-primary)' }}>ModalViz</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Upload your structural modal kinematics data</p>

                {!previewData.length ? (
                    <div 
                        className={`drag-drop-zone ${isDragging ? 'pulse-glow' : ''}`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        style={{
                            border: `2px dashed ${isDragging ? 'var(--accent-cyan)' : 'var(--text-secondary)'}`,
                            borderRadius: 'var(--radius-lg)',
                            padding: '40px 20px',
                            cursor: 'pointer',
                            transition: 'all var(--transition-normal)',
                            backgroundColor: isDragging ? 'var(--hover-bg)' : 'transparent',
                            animation: isDragging ? 'pulse-glow 1.5s infinite' : 'none'
                        }}
                        onClick={() => fileInputRef.current.click()}
                    >
                        <input 
                            type="file" 
                            accept=".csv, .txt" 
                            onChange={handleFileUpload} 
                            ref={fileInputRef}
                            style={{ display: 'none' }} 
                        />
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>📂</div>
                        <h3 style={{ color: 'var(--text-primary)', margin: '0 0 10px 0' }}>Drag & Drop File Here</h3>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>or click to browse (.csv, .txt)</p>
                    </div>
                ) : (
                    <div className="mapping-table-container" style={{ animation: 'fade-in var(--transition-normal)', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Map Columns for: <span style={{ color: 'var(--accent-cyan)' }}>{file.name}</span></h3>
                            <button onClick={() => { setPreviewData([]); setFile(null); }} style={{ background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}>Change File</button>
                        </div>
                        
                        <div style={{ overflowX: 'auto', marginBottom: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-elevated)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg-surface)' }}>
                                <thead>
                                    <tr>
                                        {previewData[0].map((_, colIndex) => (
                                            <th key={`header-${colIndex}`} style={{ padding: '12px', background: 'var(--bg-elevated)', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                                <select 
                                                    onChange={(e) => handleMappingChange(colIndex, e.target.value)}
                                                    defaultValue=""
                                                    style={{ width: '100%', padding: '8px', background: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--bg-elevated)', borderRadius: 'var(--radius-sm)', outline: 'none' }}
                                                >
                                                    <option value="" disabled>Select Role...</option>
                                                    {MAPPING_ROLES.map(role => (
                                                        <option key={role} value={role}>{role}</option>
                                                    ))}
                                                </select>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, rowIndex) => (
                                        <tr key={`row-${rowIndex}`}>
                                            {row.map((cell, colIndex) => (
                                                <td key={`cell-${rowIndex}-${colIndex}`} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.02)', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: 'monospace' }}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {error && <div className="error-banner" style={{ background: 'rgba(248, 81, 73, 0.1)', color: '#f85149', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', border: '1px solid rgba(248, 81, 73, 0.3)' }}>{error}</div>}

                        <button 
                            onClick={handleProcessData} 
                            disabled={isParsing || Object.keys(columnMappings).length === 0}
                            style={{ 
                                width: '100%', 
                                padding: '14px', 
                                background: (isParsing || Object.keys(columnMappings).length === 0) ? 'var(--bg-elevated)' : 'var(--accent-cyan)', 
                                color: (isParsing || Object.keys(columnMappings).length === 0) ? 'var(--text-secondary)' : '#000', 
                                border: 'none', 
                                borderRadius: 'var(--radius-md)', 
                                fontSize: '16px', 
                                fontWeight: '600',
                                cursor: (isParsing || Object.keys(columnMappings).length === 0) ? 'not-allowed' : 'pointer',
                                transition: 'all var(--transition-fast)'
                            }}
                        >
                            {isParsing ? '⏳ Processing Data...' : 'Confirm & Visualize'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
