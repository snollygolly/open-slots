import { EventBus } from "../core/EventBus.js";
import { GameMath } from "./GameMath.js";
import { FreeGames } from "../features/FreeGames.js";
import { HoldAndSpin } from "../features/HoldAndSpin.js";

export class GameEngine extends EventBus {
	constructor(config, rngService, walletService) {
		super();
		this.config = config;
		this.rngService = rngService;
		this.wallet = walletService;
		this.credits = typeof walletService.getCredits === "function" ? walletService.getCredits() : 0;
		this.progressives = typeof walletService.pg === "object" ? walletService.pg : walletService.progressives;
		this.lastWin = 0;
		this.spinning = false;
		this.free = new FreeGames(config);
			this.holdSpin = new HoldAndSpin(config, () => this.rngService.random(), (id) => this.wallet.takeJackpot(id));
		this.math = new GameMath(config, () => this.rngService.random());
		this.bet = config.bet;
		this.emit("balance", null);
		this.emit("progressives", null);
		this.emit("status", "Ready");
	}
	async spinOnce() {
		if (this.spinning) { return null; }
		this.spinning = true;
		this.emit("spinStart");
		try {
			// Determine wager (no charge during hold and spin respins or free games)
			const wager = (this.free.isActive() || this.holdSpin.isActive()) ? 0 : this.bet;
			if (wager > 0) {
				this.credits = this.wallet.deductCredits(wager);
				this.wallet.contributeToMeters(this.bet);
				this.emit("balance", null);
				this.emit("progressives", null);
			}

			let grid = this.math.spinReels();
			let evaln = this.math.evaluateWays(grid);
			let totalWin = 0;
			let feature = null;
			let hold = null;
			const fgCfg = this.config.freeGames;
			const hsCfg = this.config.holdAndSpin;

			// Handle hold and spin state
			if (this.holdSpin.isActive()) {
				// We're in a hold and spin - apply locked orbs to the new grid first
				grid = this.holdSpin.applyLockedOrbsToGrid(grid);
				// Re-evaluate with locked orbs in place
				evaln = this.math.evaluateWays(grid);
				
				// Process the respin
				const holdResult = this.holdSpin.processRespin(grid);
				if (holdResult) {
					// Hold and spin completed
					totalWin = holdResult.totalWin;
					hold = holdResult;
					feature = "HOLD_AND_SPIN_END";
				} else {
					// Continue with more respins
					const newOrbsThisSpin = this.holdSpin.getOrbCount() - (hold?.orbCount || this.holdSpin.getOrbCount());
					feature = "HOLD_AND_SPIN_RESPIN";
					hold = {
						respinsRemaining: this.holdSpin.getRemainingRespins(),
						orbCount: this.holdSpin.getOrbCount(),
						newOrbs: Math.max(0, newOrbsThisSpin)
					};
				}
				} else if (evaln.orbs >= hsCfg.triggerCount && !this.free.isActive()) {
					// Start new hold and spin
					this.holdSpin.trigger(grid, evaln.orbItems);
				feature = "HOLD_AND_SPIN_START";
				hold = {
					respinsRemaining: this.holdSpin.getRemainingRespins(),
					orbCount: this.holdSpin.getOrbCount(),
					triggeredBy: evaln.orbs
				};
				this.emit("featureStart", feature);
			} else if (evaln.scatters >= fgCfg.triggerScatters && !this.holdSpin.isActive()) {
				// Start free games (not during hold and spin)
				this.free.trigger();
				feature = "FREE_GAMES_TRIGGER";
				this.emit("featureStart", feature);
			} else {
				// Regular spin
				totalWin += evaln.lineWin;
			}

			// Apply free games multiplier (but not during hold and spin)
			if (this.free.isActive() && !this.holdSpin.isActive()) {
				let bonusBoost = 0;
				if (Math.random() < fgCfg.extraWildChance) { bonusBoost = Math.floor(10 + Math.random() * 40); }
				const boost = Math.round((evaln.lineWin + bonusBoost) * fgCfg.multiplier);
				totalWin += boost;
				this.free.consume();
				feature = feature || "FREE_GAMES";
			}

			this.lastWin = totalWin;
			const result = { 
				grid, 
				evaln, 
				totalWin, 
				feature, 
				hold, 
				freeGames: this.free.remaining,
				holdAndSpin: this.holdSpin.isActive() ? {
					active: true,
					respinsRemaining: this.holdSpin.getRemainingRespins(),
					orbCount: this.holdSpin.getOrbCount()
				} : null,
				wager 
			};
			this.emit("spinEnd", result);
			return result;
		} finally {
			this.spinning = false;
		}
	}
	
		simulateSpinOnly() {
			const grid = this.math.spinReels();
			const evaln = this.math.evaluateWays(grid);
			let totalWin = 0;
			let feature = null;
			let hold = null;
			const fgCfg = this.config.freeGames;
			const hsCfg = this.config.holdAndSpin;
			if (evaln.orbs >= hsCfg.triggerCount) {
				// Mirror runtime Hold&Spin logic with a temporary instance (does not mutate real state)
				const creditForJackpot = (id) => {
					const bal = this.wallet?.pg?.balances?.[id];
					const denom = this.config?.denom || 1;
					return typeof bal === 'number' ? Math.round(bal / denom) : 0;
				};
				const simHS = new HoldAndSpin(this.config, () => this.rngService.random(), creditForJackpot);
				simHS.trigger(grid, evaln.orbItems);
            let result = null;
            while (!result) {
                let next = this.math.spinReels();
                next = simHS.applyLockedOrbsToGrid(next);
                result = simHS.processRespin(next);
            }
            totalWin += result.totalWin;
            // Build jackpots hit map (including GRAND on full grid)
            const jackpots = {};
            if (Array.isArray(result.orbs)) {
                for (let i = 0; i < result.orbs.length; i += 1) {
                    const o = result.orbs[i];
                    if (o && o.type === 'JP' && o.id) {
                        jackpots[o.id] = (jackpots[o.id] || 0) + 1;
                    }
                }
            }
            if (result.isFull && this.config.holdAndSpin.fullGridWinsGrand) {
                jackpots.GRAND = (jackpots.GRAND || 0) + 1;
            }
            hold = { totalWin: result.totalWin, orbCount: result.orbCount, isFull: result.isFull, jackpots };
            feature = "HOLD_AND_SPIN";
			} else if (evaln.scatters >= fgCfg.triggerScatters) {
				feature = "FREE_GAMES_TRIGGER";
			} else {
				totalWin += evaln.lineWin;
			}
			const wager = this.bet;
			return { grid, evaln, totalWin, feature, hold, wager };
		}

	async buyFeature(featureType) {
		if (this.spinning) { return null; }
		this.spinning = true;
		this.emit("spinStart");
		try {
			// Force a specific feature result without charging bet
			let grid = this.math.spinReels();
			let evaln = this.math.evaluateWays(grid);
			let totalWin = 0;
			let feature = null;
			let hold = null;

			if (featureType === "HOLD_AND_SPIN") {
				// Force the grid to have at least 6 orbs visibly
				const triggerCount = this.config.holdAndSpin.triggerCount;
				const currentOrbs = evaln.orbs;
				
				if (currentOrbs < triggerCount) {
					// Replace some symbols with ORBs to reach the trigger count
					const orbsNeeded = triggerCount - currentOrbs;
					let orbsAdded = 0;
					
					// Go through the grid and replace non-ORB, non-SCATTER, non-WILD symbols with ORBs
					for (let reel = 0; reel < this.config.grid.reels && orbsAdded < orbsNeeded; reel++) {
						for (let row = 0; row < this.config.grid.rows && orbsAdded < orbsNeeded; row++) {
							const currentSymbol = grid[reel][row];
							if (currentSymbol !== "ORB" && currentSymbol !== "SCATTER" && currentSymbol !== "WILD") {
								grid[reel][row] = "ORB";
								orbsAdded++;
							}
						}
					}
					
					// Re-evaluate with the modified grid
					evaln = this.math.evaluateWays(grid);
				}

				this.holdSpin.trigger(grid);
				feature = "HOLD_AND_SPIN_START";
				hold = {
					respinsRemaining: this.holdSpin.getRemainingRespins(),
					orbCount: this.holdSpin.getOrbCount(),
					triggeredBy: evaln.orbs
				};
				this.emit("featureStart", feature);
			}

			this.lastWin = totalWin;
			const result = { 
				grid, 
				evaln, 
				totalWin, 
				feature, 
				hold, 
				freeGames: this.free.remaining,
				holdAndSpin: this.holdSpin.isActive() ? {
					active: true,
					respinsRemaining: this.holdSpin.getRemainingRespins(),
					orbCount: this.holdSpin.getOrbCount()
				} : null,
				wager: 0 // No wager for bought features
			};
			this.emit("spinEnd", result);
			return result;
		} finally {
			this.spinning = false;
		}
	}

	applyWinCredits(result) {
		this.credits = this.wallet.addCredits(result.totalWin);
		this.emit("balance", null);
	}
}
