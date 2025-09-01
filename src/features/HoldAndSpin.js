import { EventBus } from "../core/EventBus.js";
import { pickWeighted } from "../core/utils.js";

export class HoldAndSpin extends EventBus {
	constructor(config, rngFn, claimJackpotFn) {
		super();
		this.cfg = config.holdAndSpin;
		this.gridCfg = config.grid;
		this.rng = rngFn;
		this.claimJackpot = claimJackpotFn; // function(id) -> credits
		this.respinsRemaining = 0;
		this.lockedOrbs = [];
		this.lockedPositions = new Set(); // Track which grid positions are locked
		this.totalPositions = this.gridCfg.reels * this.gridCfg.rows;
	}

	trigger(initialGrid, startingItems) {
		// Start hold and spin with the initial orbs from the grid
		this.respinsRemaining = this.cfg.respins;
		this.lockedOrbs = [];
		this.lockedPositions.clear();
		
		// Find all orb positions in the initial grid and lock them
		for (let reel = 0; reel < this.gridCfg.reels; reel++) {
			for (let row = 0; row < this.gridCfg.rows; row++) {
				if (initialGrid[reel][row] === "ORB") {
					const positionKey = `${reel},${row}`;
					this.lockedPositions.add(positionKey);
					// If caller provided starting items, use them; else pick a credit value
					let item = null;
					if (Array.isArray(startingItems)) {
						item = startingItems.find((o) => o.x === reel && o.y === row) || null;
					}
					if (item && item.type === "JP") {
						this.lockedOrbs.push({ type: "JP", id: item.id, reel, row });
					} else {
						const creditValue = item && item.type === "C" ? item.amount : pickWeighted(this.rng, this.cfg.creditValues, this.cfg.creditWeights);
						this.lockedOrbs.push({ type: "C", amount: creditValue, reel, row });
					}
				}
			}
		}
		
		this.emit("start", { orbs: this.lockedOrbs.length, respins: this.respinsRemaining });
		return this.respinsRemaining;
	}

	processRespin(respinGrid) {
		if (!this.isActive()) return 0;

		// Count new orbs that weren't previously locked
		let newOrbCount = 0;
		for (let reel = 0; reel < this.gridCfg.reels; reel++) {
			for (let row = 0; row < this.gridCfg.rows; row++) {
				const positionKey = `${reel},${row}`;
				if (respinGrid[reel][row] === "ORB" && !this.lockedPositions.has(positionKey)) {
					// This is a new orb - lock it
					this.lockedPositions.add(positionKey);
					// Chance for jackpot (not GRAND), else credit value
					if (this.rng() < (this.cfg.jackpotChancesPerOrb || 0)) {
						const ids = Object.keys(this.cfg.jackpotWeights || {});
						const weights = ids.map((k) => this.cfg.jackpotWeights[k]);
						const id = pickWeighted(this.rng, ids, weights);
						this.lockedOrbs.push({ type: "JP", id, reel, row });
					} else {
						const creditValue = pickWeighted(this.rng, this.cfg.creditValues, this.cfg.creditWeights);
						this.lockedOrbs.push({ type: "C", amount: creditValue, reel, row });
					}
					newOrbCount++;
				}
			}
		}

		if (newOrbCount > 0) {
			// New orbs found - reset respins
			this.respinsRemaining = this.cfg.respins; // Reset to 3
			this.emit("orbsAdded", { newOrbs: newOrbCount, totalOrbs: this.lockedOrbs.length, respins: this.respinsRemaining });
		} else {
			// No new orbs - decrement respins
			this.respinsRemaining--;
			this.emit("noOrbs", { respins: this.respinsRemaining });
		}

		// Check if feature should end
		if (this.respinsRemaining <= 0 || this.lockedOrbs.length >= this.totalPositions) {
			const result = this.complete();
			return result;
		}

		return null; // Continue with more respins
	}

	complete() {
		// Calculate final payout: sum credits + claim jackpots via callback
		let totalWin = 0;
		for (let i = 0; i < this.lockedOrbs.length; i++) {
			const o = this.lockedOrbs[i];
			if (o.type === "C") { totalWin += o.amount; }
			else if (o.type === "JP" && typeof this.claimJackpot === "function") { totalWin += this.claimJackpot(o.id); }
		}

		// Check for full grid bonus
		const isFull = this.lockedOrbs.length >= this.totalPositions;
		if (isFull && this.cfg.fullGridWinsGrand && typeof this.claimJackpot === "function") { totalWin += this.claimJackpot("GRAND"); }

		const result = {
			totalWin,
			orbCount: this.lockedOrbs.length,
			orbs: [...this.lockedOrbs],
			isFull,
			grandBonus: isFull && this.cfg.fullGridWinsGrand ? 1 : 0
		};

		// Reset state
		this.respinsRemaining = 0;
		this.lockedOrbs = [];

		this.emit("complete", result);
		return result;
	}

	isActive() {
		return this.respinsRemaining > 0;
	}

	getRemainingRespins() {
		return this.respinsRemaining;
	}

	getLockedOrbs() {
		return [...this.lockedOrbs];
	}

	getOrbCount() {
		return this.lockedOrbs.length;
	}

	getLockedPositions() {
		return this.lockedPositions;
	}

	applyLockedOrbsToGrid(grid) {
		// Apply locked orbs to the provided grid
		const modifiedGrid = grid.map(reel => [...reel]); // Deep copy
		
		for (const orb of this.lockedOrbs) {
			if (orb.reel !== undefined && orb.row !== undefined) {
				modifiedGrid[orb.reel][orb.row] = "ORB";
			}
		}
		
		return modifiedGrid;
	}
}
