export const mulberry32 = (seed) => {
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
