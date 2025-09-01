import { EventBus } from "../core/EventBus.js";
import { pickWeighted } from "../core/utils.js";

export class HoldAndSpin extends EventBus {
	constructor(config, rngFn) {
		super();
		this.cfg = config.holdAndSpin;
		this.gridCfg = config.grid;
		this.rng = rngFn;
		this.respinsRemaining = 0;
		this.lockedOrbs = [];
		this.lockedPositions = new Set(); // Track which grid positions are locked
		this.totalPositions = this.gridCfg.reels * this.gridCfg.rows;
	}

	trigger(initialGrid) {
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
					const creditValue = pickWeighted(this.rng, this.cfg.creditValues, this.cfg.creditWeights);
					this.lockedOrbs.push({ 
						type: "C", 
						amount: creditValue,
						reel: reel,
						row: row 
					});
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
					const creditValue = pickWeighted(this.rng, this.cfg.creditValues, this.cfg.creditWeights);
					this.lockedOrbs.push({ 
						type: "C", 
						amount: creditValue,
						reel: reel,
						row: row 
					});
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
		// Calculate final payout
		let totalWin = 0;
		for (let i = 0; i < this.lockedOrbs.length; i++) {
			totalWin += this.lockedOrbs[i].amount;
		}

		// Check for full grid bonus
		const isFull = this.lockedOrbs.length >= this.totalPositions;
		if (isFull && this.cfg.fullGridWinsGrand) {
			totalWin += 5000; // Fixed grand bonus
		}

		const result = {
			totalWin,
			orbCount: this.lockedOrbs.length,
			orbs: [...this.lockedOrbs],
			isFull,
			grandBonus: isFull && this.cfg.fullGridWinsGrand ? 5000 : 0
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