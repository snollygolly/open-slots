import { pickWeighted } from "../core/utils.js";

export class GameMath {
	constructor(config, rngFn) { this.config = config; this.rng = rngFn; }
	spinReels() {
		const { reelStrips, grid } = this.config;
		const out = [];
		for (let r = 0; r < grid.reels; r += 1) {
			const strip = reelStrips[r];
			const start = Math.floor(this.rng() * strip.length);
			const col = [];
			for (let y = 0; y < grid.rows; y += 1) {
				const idx = (start + y) % strip.length;
				col.push(strip[idx]);
			}
			out.push(col);
		}
		return out;
	}
	evaluateWays(matrix) {
		const { symbols, payTable, grid } = this.config;
		const W = symbols.WILD;
		const SC = symbols.SCATTER;
		const ORB = symbols.ORB;
		let win = 0;
		const detail = [];
		const countScatter = () => {
			let n = 0;
			for (let x = 0; x < grid.reels; x += 1) {
				for (let y = 0; y < grid.rows; y += 1) {
					if (matrix[x][y] === SC) { n += 1; }
				}
			}
			return n;
		};
		const orbCount = () => {
			let n = 0;
			for (let x = 0; x < grid.reels; x += 1) {
				for (let y = 0; y < grid.rows; y += 1) {
					if (matrix[x][y] === ORB) { n += 1; }
				}
			}
			return n;
		};
		const keys = Object.keys(payTable);
		for (let k = 0; k < keys.length; k += 1) {
			const sym = keys[k];
			let count = 0;
			let ways = 1;
			for (let x = 0; x < grid.reels; x += 1) {
				let hits = 0;
				for (let y = 0; y < grid.rows; y += 1) {
					const v = matrix[x][y];
					if (v === sym || v === W) { hits += 1; }
				}
				if (hits === 0) { break; }
				count += 1;
				ways *= hits;
			}
			if (count >= 3) {
				const award = payTable[sym][count] || 0;
				if (award > 0) { win += award; detail.push({ sym, count, award, ways }); }
			}
		}
		return { lineWin: win, waysDetail: detail, scatters: countScatter(), orbs: orbCount() };
	}
	playHoldAndSpin(startingOrbs, bet, contributeJackpot) {
		const { holdAndSpin, grid } = this.config;
		const totalPositions = grid.reels * grid.rows;
		
		// Initialize grid with starting orbs that have reasonable credit values
		const lockedOrbs = [];
		for (let i = 0; i < startingOrbs.length; i++) {
			const creditValue = pickWeighted(this.rng, holdAndSpin.creditValues, holdAndSpin.creditWeights);
			lockedOrbs.push({ type: "C", amount: creditValue });
		}
		
		let respins = holdAndSpin.respins;
		while (respins > 0 && lockedOrbs.length < totalPositions) {
			// Spin the reels to see if new orbs land
			const newGrid = this.spinReels();
			const newEvaluation = this.evaluateWays(newGrid);
			const newOrbs = newEvaluation.orbs;
			
			if (newOrbs > 0) {
				// New orbs found - add them to locked orbs and reset respins
				for (let i = 0; i < newOrbs; i++) {
					if (lockedOrbs.length >= totalPositions) break;
					const creditValue = pickWeighted(this.rng, holdAndSpin.creditValues, holdAndSpin.creditWeights);
					lockedOrbs.push({ type: "C", amount: creditValue });
				}
				respins = holdAndSpin.respins; // Reset to 3
			} else {
				// No new orbs - decrement respins
				respins--;
			}
		}
		
		// Calculate total win (just sum of credit values - no jackpot multiplication)
		let sum = 0;
		const jackpots = {};
		for (let i = 0; i < lockedOrbs.length; i++) {
			const orb = lockedOrbs[i];
			sum += orb.amount;
		}
		
		const full = lockedOrbs.length >= totalPositions;
		const grandHit = full && holdAndSpin.fullGridWinsGrand;
		if (grandHit) {
			// Add a reasonable grand jackpot bonus (not divided by denom)
			sum += 5000; // Fixed grand bonus
		}
		
		return { sumCredits: sum, items: lockedOrbs, full, grandHit, jackpots };
	}
}