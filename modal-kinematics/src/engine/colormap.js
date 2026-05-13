/**
 * Jet Colormap — maps a scalar t ∈ [0, 1] to [R, G, B] ∈ [0, 1].
 * Interpolation: blue → cyan → green → yellow → red
 * 
 * @param {number} t - Normalized value in [0, 1]. Values outside are clamped.
 * @returns {[number, number, number]} RGB triplet, each channel in [0, 1].
 */
export function jetColormap(t) {
    // Clamp input
    t = Math.max(0, Math.min(1, t));
    
    let r, g, b;
    
    if (t < 0.125) {
        r = 0;
        g = 0;
        b = 0.5 + t * 4; // 0.5 → 1.0
    } else if (t < 0.375) {
        r = 0;
        g = (t - 0.125) * 4; // 0 → 1
        b = 1;
    } else if (t < 0.625) {
        r = (t - 0.375) * 4; // 0 → 1
        g = 1;
        b = 1 - (t - 0.375) * 4; // 1 → 0
    } else if (t < 0.875) {
        r = 1;
        g = 1 - (t - 0.625) * 4; // 1 → 0
        b = 0;
    } else {
        r = 1 - (t - 0.875) * 4; // 1 → 0.5
        g = 0;
        b = 0;
    }
    
    return [r, g, b];
}
