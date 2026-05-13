/**
 * Core Mathematical Engine for Modal Kinematics
 * Evaluates modal superposition and analytical transient responses.
 */
export class ModalKinematicsEngine {
    /**
     * @param {number} numNodes - Total number of nodes in the mesh.
     * @param {number} dofsPerNode - Degrees of freedom per node (usually 3 for 3D spatial).
     * @param {Array} naturalFrequencies - Array of natural frequencies (Hz).
     * @param {Float32Array[]} modeShapes - Array of Float32Arrays, each representing a mass-normalized mode shape.
     * @param {number} globalDampingRatio - Modal damping ratio (zeta).
     */
    constructor(numNodes, dofsPerNode, naturalFrequencies, modeShapes, globalDampingRatio = 0.02) {
        this.numNodes = numNodes;
        this.totalDofs = numNodes * dofsPerNode;
        this.numModes = naturalFrequencies.length;
        
        // Modal properties
        this.frequenciesHz = naturalFrequencies;
        this.omegaN = new Float32Array(this.numModes); // Circular natural frequencies (rad/s)
        this.omegaD = new Float32Array(this.numModes); // Damped natural frequencies
        this.zeta = globalDampingRatio;
        this.modeShapes = modeShapes; // Array of Float32Arrays [numModes][totalDofs]
        this.activeModes = null; // null means all modes are active

        // State variables for time t
        this.q = new Float32Array(this.numModes); // Modal displacements
        this.qDot = new Float32Array(this.numModes); // Modal velocities
        this.qDDot = new Float32Array(this.numModes); // Modal accelerations

        // Initial Conditions (Modal Domain)
        this.q0 = new Float32Array(this.numModes);
        this.qDot0 = new Float32Array(this.numModes);

        // Pre-calculate angular frequencies
        for (let j = 0; j < this.numModes; j++) {
            this.omegaN[j] = 2 * Math.PI * this.frequenciesHz[j]; // [cite: 41]
            this.omegaD[j] = this.omegaN[j] * Math.sqrt(1 - this.zeta ** 2); // [cite: 71]
        }
    }

    /**
     * Sets the active modes to include in the superposition.
     * @param {number[]|null} modeIndices - Array of mode indices, or null for all.
     */
    setActiveModes(modeIndices) {
        this.activeModes = modeIndices;
    }

    /**
     * Updates the global damping ratio and recalculates damped frequencies.
     * @param {number} zeta - The new modal damping ratio.
     */
    setDampingRatio(zeta) {
        this.zeta = zeta;
        for (let j = 0; j < this.numModes; j++) {
            this.omegaD[j] = this.omegaN[j] * Math.sqrt(1 - zeta ** 2);
        }
    }

    /**
     * Maps physical initial conditions to the modal domain.
     * Assumes a unity mass matrix if global M is unavailable[cite: 62].
     * @param {Float32Array} d0 - Initial physical displacement vector.
     * @param {Float32Array} v0 - Initial physical velocity vector.
     */
    setInitialConditions(d0, v0) {
        for (let j = 0; j < this.numModes; j++) {
            let q_j0 = 0;
            let qDot_j0 = 0;
            // Projection operation: q_oj = r_j^T * M * d_o [cite: 60]
            for (let i = 0; i < this.totalDofs; i++) {
                q_j0 += this.modeShapes[j][i] * d0[i];
                qDot_j0 += this.modeShapes[j][i] * v0[i];
            }
            this.q0[j] = q_j0;
            this.qDot0[j] = qDot_j0;
        }
    }

    /**
     * Evaluates the analytical transient response for all modes at time t.
     * @param {number} t - Current simulation time (seconds).
     */
    evaluateModalState(t) {
        for (let j = 0; j < this.numModes; j++) {
            const wn = this.omegaN[j];
            const wd = this.omegaD[j];
            const z = this.zeta;
            const q0 = this.q0[j];
            const v0 = this.qDot0[j];

            const expTerm = Math.exp(-z * wn * t);
            const cosTerm = Math.cos(wd * t);
            const sinTerm = Math.sin(wd * t);

            // 1. Analytical Position [cite: 70]
            const posCoeff = (z * wn * q0 + v0) / wd;
            this.q[j] = expTerm * (q0 * cosTerm + posCoeff * sinTerm);

            // 2. Analytical Velocity [cite: 79]
            const velCoeff = wd * q0 + (z * wn * (z * wn * q0 + v0)) / wd;
            this.qDot[j] = expTerm * (v0 * cosTerm - velCoeff * sinTerm);

            // 3. Analytical Acceleration (derived algebraically) [cite: 81]
            this.qDDot[j] = -2 * z * wn * this.qDot[j] - (wn ** 2) * this.q[j];
        }
    }

    /**
     * Computes the full physical displacement vector via superposition[cite: 88].
     * @returns {Float32Array} Physical displacement vector u(t).
     */
    getGlobalDisplacement() {
        const u = new Float32Array(this.totalDofs);
        const modesToEvaluate = this.activeModes || Array.from({length: this.numModes}, (_, i) => i);
        for (let idx = 0; idx < modesToEvaluate.length; idx++) {
            const j = modesToEvaluate[idx];
            for (let i = 0; i < this.totalDofs; i++) {
                u[i] += this.modeShapes[j][i] * this.q[j];
            }
        }
        return u;
    }

    /**
     * Optimized O(m) scoping extraction for a specific spatial coordinate[cite: 106, 107].
     * @param {number} dofIndex - The specific degree of freedom index to scope.
     * @returns {Object} Kinematics { position, velocity, acceleration }
     */
    getScopedKinematics(dofIndex) {
        let u_p = 0, v_p = 0, a_p = 0;
        
        const modesToEvaluate = this.activeModes || Array.from({length: this.numModes}, (_, i) => i);
        // Targeted dot product strictly for the spatial coordinate [cite: 102]
        for (let idx = 0; idx < modesToEvaluate.length; idx++) {
            const j = modesToEvaluate[idx];
            const r_pj = this.modeShapes[j][dofIndex];
            u_p += r_pj * this.q[j];      // [cite: 103]
            v_p += r_pj * this.qDot[j];   // [cite: 104]
            a_p += r_pj * this.qDDot[j];  // [cite: 105]
        }
        
        return { position: u_p, velocity: v_p, acceleration: a_p };
    }
}