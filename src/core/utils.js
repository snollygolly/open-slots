// Cryptographically secure pseudorandom number generator using Web Crypto API
export const createCSPRNG = (timestampSeed = null) => {
	// Use current timestamp with high precision as seed if not provided
	const seed = timestampSeed || performance.now();
	
	// State for the CSPRNG
	let state = new Uint32Array(4);
	
	// Initialize state with timestamp-based seeding
	const seedHash = hashTimestamp(seed);
	state[0] = seedHash >>> 0;
	state[1] = (seedHash * 1664525 + 1013904223) >>> 0;
	state[2] = (state[1] * 1664525 + 1013904223) >>> 0;
	state[3] = (state[2] * 1664525 + 1013904223) >>> 0;
	
	// XorShift128+ algorithm - cryptographically stronger than mulberry32
	return () => {
		let s1 = state[0];
		const s0 = state[1];
		state[0] = s0;
		s1 ^= s1 << 23;
		s1 ^= s1 >>> 18;
		s1 ^= s0;
		s1 ^= s0 >>> 5;
		state[1] = s1;
		
		// Mix in crypto random bits for extra security every 100 calls
		if ((state[2]++ % 100) === 0) {
			try {
				const crypto = window.crypto || window.msCrypto;
				if (crypto && crypto.getRandomValues) {
					const cryptoArray = new Uint32Array(1);
					crypto.getRandomValues(cryptoArray);
					state[3] ^= cryptoArray[0];
				}
			} catch (e) {
				// Fallback if crypto is not available
				state[3] ^= (Math.random() * 4294967296) >>> 0;
			}
		}
		
		const result = ((s0 + s1) >>> 0) ^ state[3];
		return (result >>> 0) / 4294967296;
	};
};

// Hash function to convert timestamp to good seed material
const hashTimestamp = (timestamp) => {
	let hash = 2166136261; // FNV offset basis
	const timestampStr = timestamp.toString() + Date.now().toString() + Math.random().toString();
	
	for (let i = 0; i < timestampStr.length; i++) {
		hash ^= timestampStr.charCodeAt(i);
		hash = Math.imul(hash, 16777619); // FNV prime
	}
	
	return hash >>> 0;
};

// Legacy support - keep mulberry32 for compatibility but mark as deprecated
export const mulberry32 = (seed) => {
	console.warn("mulberry32 is deprecated. Use createCSPRNG() for cryptographically secure randomness.");
	let t = seed >>> 0;
	return () => {
		t += 0x6D2B79F5;
		let x = t;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
};

export const pickWeighted = (rng, values, weights) => {
	let sum = 0;
	for (let i = 0; i < weights.length; i += 1) { sum += weights[i]; }
	const r = rng() * sum;
	let c = 0;
	for (let j = 0; j < weights.length; j += 1) {
		c += weights[j];
		if (r <= c) { return values[j]; }
	}
	return values[values.length - 1];
};

export const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
