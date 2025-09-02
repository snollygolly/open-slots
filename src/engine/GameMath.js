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
 
}
