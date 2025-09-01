import { createCSPRNG } from "../../core/utils.js";

export class LocalRngService {
	constructor(seed = null) { 
		// If no seed provided, use current timestamp for unpredictable results
		const timestampSeed = seed || performance.now();
		this.rng = createCSPRNG(timestampSeed);
		console.log(`[LocalRngService] Initialized CSPRNG with timestamp seed: ${timestampSeed}`);
	}
	
	random() { return this.rng(); }
	int(max) { return Math.floor(this.random() * max); }
	
	// Method to reseed with new timestamp for extra randomness
	reseed() {
		const newSeed = performance.now();
		this.rng = createCSPRNG(newSeed);
		console.log(`[LocalRngService] Reseeded CSPRNG with new timestamp: ${newSeed}`);
	}
}
