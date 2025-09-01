import { pickWeighted } from "../core/utils.js";

export class GameMath {
	constructor(config, rngFn) { this.config = config; this.rng = rngFn; }
	spinReels() {
		const { reels, grid } = this.config;
		const out = [];
		for (let r = 0; r < grid.reels; r += 1) {
			const strip = reels[r];
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
		const { symbols, paytable, grid } = this.config;
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
		const orbItems = [];
		const orbCount = () => {
			let n = 0;
			for (let x = 0; x < grid.reels; x += 1) {
				for (let y = 0; y < grid.rows; y += 1) {
					if (matrix[x][y] === ORB) {
						n += 1;
						// Assign a value or jackpot label to this orb for UI + H&S start
						const hs = this.config.holdAndSpin;
						// Decide if this orb shows a jackpot label (never GRAND here)
						let item = null;
						if (this.rng() < (hs.jackpotChancesPerOrb || 0)) {
							const ids = Object.keys(hs.jackpotWeights || {});
							const weights = ids.map((k) => hs.jackpotWeights[k]);
							const id = pickWeighted(this.rng, ids, weights);
							item = { x, y, type: "JP", id };
						} else {
							const amt = pickWeighted(this.rng, hs.creditValues, hs.creditWeights);
							item = { x, y, type: "C", amount: amt };
						}
						orbItems.push(item);
					}
				}
			}
			return n;
		};
		const keys = Object.keys(paytable);
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
				const award = paytable[sym][count] || 0;
				if (award > 0) { win += award; detail.push({ sym, count, award, ways }); }
			}
		}
		return { lineWin: win, waysDetail: detail, scatters: countScatter(), orbs: orbCount(), orbItems };
	}
	playHoldAndSpin(startingOrbs, bet, contributeJackpot) {
		const { holdAndSpin, grid } = this.config;
		const totalPositions = grid.reels * grid.rows;
		
		// Initialize grid with values from startingOrbs (credits or jackpots)
		const lockedOrbs = [];
		for (let i = 0; i < startingOrbs.length; i += 1) {
			const o = startingOrbs[i];
			if (o.type === "JP") { lockedOrbs.push({ type: "JP", id: o.id }); }
			else { lockedOrbs.push({ type: "C", amount: o.amount }); }
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
					// Chance for a jackpot, otherwise a credit orb
					if (this.rng() < (holdAndSpin.jackpotChancesPerOrb || 0)) {
						const ids = Object.keys(holdAndSpin.jackpotWeights || {});
						const weights = ids.map((k) => holdAndSpin.jackpotWeights[k]);
						const id = pickWeighted(this.rng, ids, weights);
						lockedOrbs.push({ type: "JP", id });
					} else {
						const creditValue = pickWeighted(this.rng, holdAndSpin.creditValues, holdAndSpin.creditWeights);
						lockedOrbs.push({ type: "C", amount: creditValue });
					}
				}
				respins = holdAndSpin.respins; // Reset to 3
			} else {
				// No new orbs - decrement respins
				respins--;
			}
		}
		
		// Calculate total win: sum credits; add jackpots via callback; handle GRAND only on full grid
		let sum = 0;
		const jackpots = {};
		for (let i = 0; i < lockedOrbs.length; i += 1) {
			const orb = lockedOrbs[i];
			if (orb.type === "C") { sum += orb.amount; }
			if (orb.type === "JP") {
				jackpots[orb.id] = (jackpots[orb.id] || 0) + 1;
				sum += typeof contributeJackpot === "function" ? contributeJackpot(orb.id) : 0;
			}
		}
		
		const full = lockedOrbs.length >= totalPositions;
		const grandHit = full && holdAndSpin.fullGridWinsGrand;
		if (grandHit && typeof contributeJackpot === "function") {
			// GRAND only by full grid — do not place on orbs
			sum += contributeJackpot("GRAND");
		}
		
		return { sumCredits: sum, items: lockedOrbs, full, grandHit, jackpots };
	}
}
