import { BaseFeature } from "../engine/FeatureContracts.js";
import { Events } from "../core/events.js";
import { pickWeighted } from "../core/utils.js";

export class HoldAndSpin extends BaseFeature {
	constructor(config, dependencies = {}) {
		super(config.holdAndSpin, "HoldAndSpin");
		this.cfg = config.holdAndSpin;
		this.gridCfg = config.grid;
		this.rng = dependencies.rngFn || (() => Math.random());
		this.claimJackpot = dependencies.claimJackpotFn || (() => 0);
		this.respinsRemaining = 0;
		this.lockedOrbs = [];
		this.lockedPositions = new Set();
		this.totalPositions = this.gridCfg.reels * this.gridCfg.rows;
	}

	/** Spend a respin immediately when a respin starts. */
	spendRespin() {
		if (!this.isActive()) return this.respinsRemaining;
		this.respinsRemaining = Math.max(0, this.respinsRemaining - 1);
		this.emit("tick", { respins: this.respinsRemaining, orbs: this.lockedOrbs.length });
		return this.respinsRemaining;
	}

	trigger(triggerData) {
		const initialGrid = triggerData.grid || triggerData;
		const startingItems = triggerData.orbItems || triggerData.startingItems;
		
		// Start hold and spin with the initial orbs from the grid
		this.respinsRemaining = this.cfg.respins;
		this.active = true;
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

	processRespin(respinGrid, orbItems = []) {
		if (!this.isActive()) return 0;

		// Count new orbs that weren't previously locked
		let newOrbCount = 0;
		for (let reel = 0; reel < this.gridCfg.reels; reel++) {
			for (let row = 0; row < this.gridCfg.rows; row++) {
				const positionKey = `${reel},${row}`;
				if (respinGrid[reel][row] === "ORB" && !this.lockedPositions.has(positionKey)) {
					// This is a new orb - lock it
					this.lockedPositions.add(positionKey);
					// Use precomputed orb item for consistency with reel visuals, fallback to RNG if missing
					let chosen = null;
					if (Array.isArray(orbItems) && orbItems.length) {
						chosen = orbItems.find((it) => it && it.x === reel && it.y === row) || null;
					}
					if (chosen && chosen.type === "JP") {
						this.lockedOrbs.push({ type: "JP", id: chosen.id, reel, row });
					} else if (chosen && chosen.type === "C") {
						this.lockedOrbs.push({ type: "C", amount: chosen.amount, reel, row });
					} else {
						// Fallback to original RNG assignment
						if (this.rng() < (this.cfg.jackpotChancesPerOrb || 0)) {
							const ids = Object.keys(this.cfg.jackpotWeights || {});
							const weights = ids.map((k) => this.cfg.jackpotWeights[k]);
							const id = pickWeighted(this.rng, ids, weights);
							this.lockedOrbs.push({ type: "JP", id, reel, row });
						} else {
							const creditValue = pickWeighted(this.rng, this.cfg.creditValues, this.cfg.creditWeights);
							this.lockedOrbs.push({ type: "C", amount: creditValue, reel, row });
						}
					}
					newOrbCount++;
				}
			}
		}

		if (newOrbCount > 0) {
			// New orbs found - reset respins
			this.respinsRemaining = this.cfg.respins; // Reset to max on hit
			this.emit("orbsAdded", { newOrbs: newOrbCount, totalOrbs: this.lockedOrbs.length, respins: this.respinsRemaining });
		} else {
			// No new orbs - we already spent the respin at spin start
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

		// Mark feature inactive but keep locked orbs until engine clears them after payout
		this.active = false;
		this.respinsRemaining = 0;

		this.emit("complete", result);
		return result;
	}

	reset() {
		// Clear all state so future spins don't show stale labels
		this.active = false;
		this.respinsRemaining = 0;
		this.lockedOrbs = [];
		this.lockedPositions.clear();
		super.reset();
	}

	checkTrigger(spinResult) {
		const triggerCount = this.cfg.triggerCount || 6;
		const orbCount = spinResult.evaln?.orbs || 0;
		
		return {
			triggered: orbCount >= triggerCount,
			data: { orbCount, triggerCount, orbItems: spinResult.evaln?.orbItems }
		};
	}

	isActive() {
		return this.active === true;
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

	process(spinResult) {
		if (!this.isActive()) {
			return { completed: true, totalWin: 0, continueSpin: false, data: {} };
		}

		const result = this.processRespin(spinResult.grid, spinResult.evaln?.orbItems || []);
		
		if (result) {
			// Feature completed
			this.active = false;
			return {
				completed: true,
				totalWin: result.totalWin,
				continueSpin: false,
				data: result
			};
		} else {
			// Continue respinning
			return {
				completed: false,
				totalWin: 0,
				continueSpin: true,
				data: {
					respinsRemaining: this.respinsRemaining,
					orbCount: this.lockedOrbs.length
				}
			};
		}
	}

	validateConfig() {
		return (
			typeof this.cfg.respins === "number" &&
			typeof this.cfg.triggerCount === "number" &&
			Array.isArray(this.cfg.creditValues) &&
			Array.isArray(this.cfg.creditWeights) &&
			this.cfg.respins > 0 &&
			this.cfg.triggerCount > 0 &&
			this.cfg.creditValues.length === this.cfg.creditWeights.length
		);
	}
}
