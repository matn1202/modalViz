/**
 * Fixed-length rolling-window buffer for time-series data.
 * When full, the oldest values are overwritten (FIFO).
 * 
 * @example
 * const buf = new RollingBuffer(100);
 * buf.push(0.5);
 * buf.toArray(); // [0.5]
 * // ... after 200 pushes, only the last 100 values remain
 */
export class RollingBuffer {
    /**
     * @param {number} capacity - Maximum number of values to retain.
     */
    constructor(capacity) {
        this.capacity = capacity;
        this.data = new Float64Array(capacity);
        this.head = 0;   // Next write position
        this.count = 0;  // Number of values stored (up to capacity)
    }

    /**
     * Append a value to the buffer. If full, overwrites the oldest value.
     * @param {number} value
     */
    push(value) {
        this.data[this.head] = value;
        this.head = (this.head + 1) % this.capacity;
        if (this.count < this.capacity) this.count++;
    }

    /**
     * Returns the buffered values as a standard Array, in chronological order
     * (oldest first). Required by Plotly — it does not accept Float64Array.
     * @returns {number[]}
     */
    toArray() {
        if (this.count < this.capacity) {
            return Array.from(this.data.subarray(0, this.count));
        }
        // Wrap: [head..capacity) + [0..head)
        const tail = Array.from(this.data.subarray(this.head, this.capacity));
        const front = Array.from(this.data.subarray(0, this.head));
        return tail.concat(front);
    }

    /**
     * Reset the buffer to empty.
     */
    clear() {
        this.head = 0;
        this.count = 0;
    }

    /**
     * @returns {number} Current number of stored values.
     */
    get length() {
        return this.count;
    }
}
