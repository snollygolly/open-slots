import { mulberry32, pickWeighted } from "./util.js";

export class GameMath {
	constructor(config, seed) {
		this.config = config;
		this.rng = mulberry32(seed);
	}

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
			for (let x = 0; x < grid.reels; x += 1) {
				let hits = 0;
				for (let y = 0; y < grid.rows; y += 1) {
					const v = matrix[x][y];
					if (v === sym || v === W) { hits += 1; }
				}
				if (hits === 0) { break; }
				count += 1;
			}
			if (count >= 3) {
				const award = payTable[sym][count] || 0;
				if (award > 0) {
					win += award;
					detail.push({ sym, count, award });
				}
			}
		}

		return { lineWin: win, waysDetail: detail, scatters: countScatter(), orbs: orbCount() };
	}

	playHoldAndSpin(startingOrbs, bet, contributeJackpot) {
		const { holdAndSpin, progressives } = this.config;
		const placed = [];
		for (let i = 0; i < startingOrbs.length; i += 1) {
			placed.push(startingOrbs[i]);
		}
		let respins = holdAndSpin.respins;

		while (respins > 0 && placed.length < (this.config.grid.reels * this.config.grid.rows)) {
			let hit = false;
			const attempts = Math.floor(1 + this.rng() * 3);
			for (let a = 0; a < attempts; a += 1) {
				const rollJp = this.rng() < holdAndSpin.jackpotChancesPerOrb;
				if (rollJp) {
					const ids = Object.keys(holdAndSpin.jackpotWeights);
					const weights = ids.map((id) => holdAndSpin.jackpotWeights[id]);
					const jp = pickWeighted(this.rng, ids, weights);
					placed.push({ type: "JP", id: jp, amount: contributeJackpot(jp) });
					hit = true;
				} else {
					const v = pickWeighted(this.rng, holdAndSpin.creditValues, holdAndSpin.creditWeights);
					placed.push({ type: "C", amount: v });
					hit = true;
				}
				if (placed.length >= (this.config.grid.reels * this.config.grid.rows)) { break; }
			}
			respins = hit ? holdAndSpin.respins : (respins - 1);
		}

		let sum = 0;
		const jackpots = {};
		for (let i = 0; i < placed.length; i += 1) {
			const p = placed[i];
			if (p.type === "C") { sum += p.amount; }
			if (p.type === "JP") {
				sum += Math.round(p.amount / this.config.denom);
				jackpots[p.id] = (jackpots[p.id] || 0) + 1;
			}
		}

		const full = placed.length >= (this.config.grid.reels * this.config.grid.rows);
		const grandHit = full && this.config.holdAndSpin.fullGridWinsGrand;
		if (grandHit) {
			sum += Math.round(progressives.meta.GRAND.seed / this.config.denom);
		}

		return { sumCredits: sum, items: placed, full, grandHit, jackpots };
	}
}
