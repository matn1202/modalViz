import React, { useState, useCallback } from 'react';
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

export default function DataIngestionWizard({ onDataParsed }) {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [columnMappings, setColumnMappings] = useState({});
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState(null);

    // 1. File Selection & Preview Generation
    const handleFileUpload = (event) => {
        const uploadedFile = event.target.files[0];
        if (!uploadedFile) return;
        
        setFile(uploadedFile);
        setError(null);

        // Preview the first 5 rows to allow user mapping [cite: 121]
        Papa.parse(uploadedFile, {
            preview: 5,
            skipEmptyLines: true,
            complete: (results) => {
                setPreviewData(results.data);
            },
            error: (err) => setError(`Preview Error: ${err.message}`)
        });
    };

    // 2. Handle Dropdown Column Assignment [cite: 122]
    const handleMappingChange = (columnIndex, mappedRole) => {
        setColumnMappings(prev => ({
            ...prev,
            [columnIndex]: mappedRole
        }));
    };

    // 3. Validation & Full Parsing [cite: 124, 125]
    const handleProcessData = useCallback(() => {
        // Validate that all required mappings are assigned [cite: 124]
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

        // Reverse mapping for O(1) lookup during parsing: { "Node ID": 0, "X-Coordinate": 2, ... }
        const indexMap = Object.entries(columnMappings).reduce((acc, [idx, role]) => {
            acc[role] = parseInt(idx, 10);
            return acc;
        }, {});

        // Execute full parse using Web Workers [cite: 129]
        Papa.parse(file, {
            worker: true, // Offloads to a background thread [cite: 129]
            dynamicTyping: true, // Automatically converts numerical strings to numbers
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

// 4. Memory Layout Optimization
const processRawDataToBuffers = (rawData, indexMap) => {
    try {
        // SLICE FIX: Drop the first row (headers) to ensure only numeric values enter the math engine
        const numericData = rawData.slice(1);
        const numRows = numericData.length;
        
        // Allocate contiguous memory blocks
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

        // Determine which spatial axis the 1-DOF shape data represents
        // so downstream components displace nodes along the correct axis
        let shapeAxis = 'x'; // default
        if (dofsPerNode === 1) {
            if (hasUX) shapeAxis = 'x';
            else if (hasUY) shapeAxis = 'y';
            else if (hasUZ) shapeAxis = 'z';
        }

        setIsParsing(false);
        // Pass the optimized buffers up to the Controller/State Manager
        onDataParsed({ nodes, xCoords, yCoords, zCoords, frequencies, modeShapes, dofsPerNode, shapeAxis });

    } catch (err) {
        setError(`Buffer Allocation Error: ${err.message}`);
        setIsParsing(false);
    }
};

    return (
        <div className="ingestion-wizard">
            <h2>Data Ingestion & Mapping</h2>
            <input type="file" accept=".csv, .txt" onChange={handleFileUpload} disabled={isParsing} />

            {error && <div className="error-banner" style={{color: 'red'}}>{error}</div>}

            {previewData.length > 0 && (
                <div className="mapping-table-container">
                    <h3>Map Columns</h3>
                    <table border="1" cellPadding="8">
                        <thead>
                            <tr>
                                {previewData[0].map((_, colIndex) => (
                                    <th key={`header-${colIndex}`}>
                                        <select 
                                            onChange={(e) => handleMappingChange(colIndex, e.target.value)}
                                            defaultValue=""
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
                                        <td key={`cell-${rowIndex}-${colIndex}`}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button 
                        onClick={handleProcessData} 
                        disabled={isParsing || Object.keys(columnMappings).length === 0}
                        style={{ marginTop: '15px', padding: '10px 20px' }}
                    >
                        {isParsing ? 'Processing Data...' : 'Confirm Mapping & Process'}
                    </button>
                </div>
            )}
        </div>
    );
}