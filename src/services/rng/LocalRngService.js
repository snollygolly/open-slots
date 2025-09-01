import { createCSPRNG } from "../../core/utils.js";

export class LocalRngService {
	constructor(seed = null) { 
		this.currentSeed = seed;
		this.initializeRNG(seed);
	}
	
	initializeRNG(seed) {
		// If no seed provided, use current timestamp for unpredictable results
		const actualSeed = seed || performance.now();
		this.currentSeed = actualSeed;
		this.rng = createCSPRNG(actualSeed);
		console.log(`[LocalRngService] Initialized CSPRNG with seed: ${actualSeed}`);
	}
	
	random() { 
		return this.rng(); 
	}
	
	int(max) { 
		return Math.floor(this.random() * max); 
	}
	
	/**
	 * Set a specific seed for deterministic testing/debugging
	 * @param {number} seed - The seed value to use
	 */
	setSeed(seed) {
		if (typeof seed !== "number") {
			throw new Error("Seed must be a number");
		}
		this.initializeRNG(seed);
	}
	
	/**
	 * Get the current seed value
	 * @returns {number} Current seed
	 */
	getSeed() {
		return this.currentSeed;
	}
	
	/**
	 * Method to reseed with new timestamp for extra randomness
	 */
	reseed() {
		this.initializeRNG(null); // Will use timestamp
	}
	
	/**
	 * Generate a random float between min and max
	 * @param {number} min - Minimum value
	 * @param {number} max - Maximum value
	 * @returns {number} Random float
	 */
	float(min = 0, max = 1) {
		return min + (this.random() * (max - min));
	}
	
	/**
	 * Generate a random integer between min (inclusive) and max (exclusive)
	 * @param {number} min - Minimum value (inclusive)
	 * @param {number} max - Maximum value (exclusive)
	 * @returns {number} Random integer
	 */
	range(min, max) {
		return min + Math.floor(this.random() * (max - min));
	}
	
	/**
	 * Generate a random boolean with optional probability
	 * @param {number} probability - Probability of true (0-1)
	 * @returns {boolean} Random boolean
	 */
	bool(probability = 0.5) {
		return this.random() < probability;
	}
}
