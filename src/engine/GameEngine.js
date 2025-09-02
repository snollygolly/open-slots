import { EventBus } from "../core/EventBus.js";
import { Events } from "../core/events.js";
import { SpinFSM } from "./SpinFSM.js";
import { FeaturesRegistry } from "./FeaturesRegistry.js";
import { GameMath } from "./GameMath.js";
import { FreeGames } from "../features/FreeGames.js";
import { HoldAndSpin } from "../features/HoldAndSpin.js";
import { ConfigValidator } from "../core/ConfigValidator.js";
import { gameLogger } from "../core/log.js";

export class GameEngine extends EventBus {
	constructor(config, rngService, walletService) {
		super();
		
		// Validate configuration before initializing
		this.validateConfiguration(config);
		
		this.config = config;
		this.rngService = rngService;
		this.wallet = walletService;
		this.credits = typeof walletService.getCredits === "function" ? walletService.getCredits() : 0;
		this.progressives = typeof walletService.pg === "object" ? walletService.pg : walletService.progressives;
		this.lastWin = 0;
		this.bet = config.bet;

		// Initialize FSM
		this.fsm = new SpinFSM();
		this.setupFSMListeners();

		// Initialize features registry
		this.featuresRegistry = new FeaturesRegistry();
		this.setupFeatures();

		// Initialize math engine
		this.math = new GameMath(config, () => this.rngService.random());

		gameLogger.info("GameEngine initialized successfully");

		// Initial state notifications
		this.emit(Events.BALANCE, this.getBalanceData());
		this.emit(Events.PROGRESSIVES, this.getProgressivesData());
		this.emit(Events.STATUS, "Ready");
	}

	validateConfiguration(config) {
		const validator = new ConfigValidator();
		const result = validator.validate(config);

		if (!result.valid) {
			const errorMessage = "Configuration validation failed:\n" + result.errors.join("\n");
			gameLogger.error(errorMessage);
			throw new Error(errorMessage);
		}

		if (result.warnings.length > 0) {
			gameLogger.warn("Configuration warnings:\n" + result.warnings.join("\n"));
		}

		gameLogger.info("Configuration validation passed");
	}

	setupFSMListeners() {
		this.fsm.on("stateChanged", (data) => {
			this.emit("fsmStateChanged", data);
		});
	}

	setupFeatures() {
		// Register available features
		this.featuresRegistry.register("FreeGames", FreeGames);
		this.featuresRegistry.register("HoldAndSpin", HoldAndSpin);

		// Create feature instances with dependencies
		const featureDependencies = {
			rngFn: () => this.rngService.random(),
			claimJackpotFn: (id) => this.wallet.takeJackpot(id)
		};

		this.free = this.featuresRegistry.create("FreeGames", this.config, featureDependencies);
		this.holdSpin = this.featuresRegistry.create("HoldAndSpin", this.config, featureDependencies);

		// Forward feature events to the engine's EventBus so the renderer can listen on the engine
		const forward = (src, eventName) => {
			if (src && typeof src.on === 'function') {
				src.on(eventName, (payload) => this.emit(eventName, payload));
			}
		};
		// Free Games events
		forward(this.free, Events.FREE_GAMES_START);
		forward(this.free, Events.FREE_GAMES_CHANGE);
		forward(this.free, Events.FREE_GAMES_END);
		// Hold & Spin events (forward if emitted by feature)
		forward(this.holdSpin, Events.HOLD_SPIN_START);
		forward(this.holdSpin, Events.HOLD_SPIN_RESPIN);
		forward(this.holdSpin, Events.HOLD_SPIN_END);
		forward(this.holdSpin, Events.HOLD_SPIN_ORBS_ADDED);
		forward(this.holdSpin, Events.HOLD_SPIN_NO_ORBS);
		forward(this.holdSpin, Events.HOLD_SPIN_COMPLETE);
	}

	getBalanceData() {
		return {
			credits: this.credits,
			bet: this.bet
		};
	}

	getProgressivesData() {
		return this.progressives;
	}

	async spinOnce() {
		if (!this.fsm.canSpin()) {
			return null;
		}

		// Request spin through FSM
		const spinData = {
			bet: this.bet,
			freeGamesActive: this.free.isActive(),
			holdSpinActive: this.holdSpin.isActive()
		};

		if (!this.fsm.requestSpin(spinData)) {
			return null;
		}

		try {
			// Begin spinning
			this.fsm.beginSpin();

			// Determine wager (no charge during features)
			const wager = (this.free.isActive() || this.holdSpin.isActive()) ? 0 : this.bet;
			if (wager > 0) {
				this.credits = this.wallet.deductCredits(wager);
				this.wallet.contributeToMeters(this.bet);
				this.emit(Events.BALANCE, this.getBalanceData());
				this.emit(Events.PROGRESSIVES, this.getProgressivesData());
			}

			// Generate spin result
			let grid = this.math.spinReels();
			let evaln = this.math.evaluateWays(grid);

			// Apply hold and spin modifications if active
			if (this.holdSpin.isActive()) {
				grid = this.holdSpin.applyLockedOrbsToGrid(grid);
				evaln = this.math.evaluateWays(grid);
			}

			const spinResult = {
				grid,
				evaln,
				totalWin: evaln.lineWin,
				wager,
				freeGames: this.free.remaining,
				holdAndSpin: this.holdSpin.isActive() ? this.holdSpin.getState() : null
			};

			// Complete spin and evaluate
			this.fsm.completeSpinAndEvaluate(spinResult);

			// Process features
			await this.processFeatures(spinResult);

			return spinResult;

		} catch (error) {
			console.error("Error during spin:", error);
			this.fsm.returnToIdle();
			throw error;
		}
	}

	async processFeatures(spinResult) {
		const activeFeatures = this.featuresRegistry.getActiveFeatures();
		let featureTriggered = false;
		let totalFeatureWin = 0;

		// Handle bought features first
		if (spinResult.boughtFeature) {
			if (spinResult.boughtFeature === "HOLD_AND_SPIN") {
				const triggerData = {
					grid: spinResult.grid,
					orbItems: spinResult.evaln.orbItems
				};
				const triggerResult = this.holdSpin.trigger(triggerData);
				this.fsm.triggerFeature({
					type: "HOLD_AND_SPIN",
					data: triggerResult
				});
				featureTriggered = true;
			} else if (spinResult.boughtFeature === "FREE_GAMES") {
				// Trigger Free Games as if naturally triggered by scatters
				const triggerData = {
					data: { scatterCount: spinResult.evaln?.scatters || 0, triggerScatters: this.config.freeGames.triggerScatters }
				};
				const triggerResult = this.free.trigger(triggerData);
				this.fsm.triggerFeature({
					type: this.free.name,
					data: triggerResult
				});
				featureTriggered = true;
			}
		} else {
			// Check for natural feature triggers
			for (const feature of [this.holdSpin, this.free]) {
				if (!feature.isActive()) {
					const triggerCheck = feature.checkTrigger(spinResult);
					if (triggerCheck.triggered) {
						const triggerResult = feature.trigger(triggerCheck.data);
						this.fsm.triggerFeature({
							type: feature.name,
							data: triggerResult
						});
						featureTriggered = true;
						break; // Only one feature can trigger per spin
					}
				}
			}
		}

		// Process active features
		if (activeFeatures.length > 0 && !featureTriggered) {
			// If we have active features but didn't trigger a new one, ensure we're in FEATURE state
			if (this.fsm.isInState("EVALUATING")) {
				// Transition to FEATURE state to process ongoing features
				this.fsm.triggerFeature({
					type: "ONGOING_FEATURE",
					data: { activeFeatures: activeFeatures.length }
				});
			}
		}

		for (const feature of activeFeatures) {
			const processResult = feature.process(spinResult);
			totalFeatureWin += processResult.totalWin;

			// Only call completeFeature if FSM is in FEATURE state
			if (this.fsm.isInState("FEATURE")) {
				if (processResult.completed) {
					this.fsm.completeFeature({
						feature: feature.name,
						totalWin: processResult.totalWin,
						data: processResult.data,
						continueSpin: processResult.continueSpin
					});
				} else if (processResult.continueSpin) {
					// Feature wants to continue spinning (e.g., hold and spin respins)
					this.fsm.completeFeature({
						feature: feature.name,
						totalWin: 0,
						continueSpin: true,
						data: processResult.data
					});
					return;
				}
			}
		}

		// Update spin result with feature wins
		spinResult.totalWin += totalFeatureWin;
		this.lastWin = spinResult.totalWin;

		// Complete evaluation
		if (!featureTriggered && activeFeatures.length === 0) {
			this.fsm.completeEvaluation();
		}

		// Complete evaluation and transition to appropriate state
		// Don't emit PAYING event immediately - let the UI control when to show wins
		
		if (!featureTriggered) {
			this.fsm.returnToIdle();
		}
	}
	
			simulateSpinOnly() {
				const grid = this.math.spinReels();
				const evaln = this.math.evaluateWays(grid);
				let totalWin = 0;
				let feature = null;
				let hold = null;
				// Aggregate sim-only stats (e.g., jackpots during FG)
				const sim = { jackpots: {} , freeGamesPlayed: 0 };
				const fgCfg = this.config.freeGames;
				const hsCfg = this.config.holdAndSpin;
				if (evaln.orbs >= hsCfg.triggerCount) {
					// Mirror runtime Hold&Spin logic with a temporary instance (does not mutate real state)
					const creditForJackpot = (id) => {
						const bal = this.wallet?.pg?.balances?.[id];
						const denom = this.config?.denom || 1;
						return typeof bal === 'number' ? Math.round(bal / denom) : 0;
					};
					const simHS = new HoldAndSpin(this.config, { rngFn: () => this.rngService.random(), claimJackpotFn: creditForJackpot });
					simHS.trigger({ grid, orbItems: evaln.orbItems });
            let result = null;
            while (!result) {
                // Spend a respin at the start of each respin cycle (mirror runtime flow)
                if (typeof simHS.spendRespin === 'function') { simHS.spendRespin(); }
                let next = this.math.spinReels();
                next = simHS.applyLockedOrbsToGrid(next);
                result = simHS.processRespin(next);
            }
            // Base line wins still pay alongside Hold & Spin
            totalWin += evaln.lineWin + result.totalWin;
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
					// Base spin still pays its line win
					totalWin += evaln.lineWin;
					feature = "FREE_GAMES_TRIGGER";
					// Simulate a full Free Games session as runtime would play it
					let remaining = fgCfg.spins;
					let fgPlayed = 0;
					while (remaining > 0) {
						// One free game spin
						const g2 = this.math.spinReels();
						const e2 = this.math.evaluateWays(g2);
						let spinWin = e2.lineWin;
						// If Hold & Spin triggers inside Free Games, simulate it fully and add its total (not multiplied)
						if (e2.orbs >= hsCfg.triggerCount) {
							const creditForJackpotFG = (id) => {
								const bal = this.wallet?.pg?.balances?.[id];
								const denom = this.config?.denom || 1;
								return typeof bal === 'number' ? Math.round(bal / denom) : 0;
							};
							const simFGHS = new HoldAndSpin(this.config, { rngFn: () => this.rngService.random(), claimJackpotFn: creditForJackpotFG });
							simFGHS.trigger({ grid: g2, orbItems: e2.orbItems });
							let resHS = null;
							while (!resHS) {
								if (typeof simFGHS.spendRespin === 'function') { simFGHS.spendRespin(); }
								let next = this.math.spinReels();
								next = simFGHS.applyLockedOrbsToGrid(next);
								resHS = simFGHS.processRespin(next);
							}
							spinWin += resHS.totalWin; // Hold & Spin is not multiplied during FG
							// Aggregate jackpot counts into sim.jackpots
							if (Array.isArray(resHS.orbs)) {
								for (let i = 0; i < resHS.orbs.length; i += 1) {
									const o = resHS.orbs[i];
									if (o && o.type === 'JP' && o.id) {
										sim.jackpots[o.id] = (sim.jackpots[o.id] || 0) + 1;
									}
								}
							}
							if (resHS.isFull && this.config.holdAndSpin.fullGridWinsGrand) {
								sim.jackpots.GRAND = (sim.jackpots.GRAND || 0) + 1;
							}
						}
						// Retrigger check within free games
						if (e2.scatters >= fgCfg.triggerScatters) {
							remaining += fgCfg.retrigger;
						}
						totalWin += spinWin;
						fgPlayed += 1;
						remaining -= 1;
					}
					sim.freeGamesPlayed = fgPlayed;
				} else {
					totalWin += evaln.lineWin;
				}
				const wager = this.bet;
				return { grid, evaln, totalWin, feature, hold, wager, sim };
			}

	async buyFeature(featureType) {
		if (!this.fsm.canSpin()) { return null; }

		// Request spin through FSM (no wager for bought features)
		const spinData = {
			bet: 0,
			freeGamesActive: this.free.isActive(),
			holdSpinActive: this.holdSpin.isActive(),
			boughtFeature: featureType
		};

		if (!this.fsm.requestSpin(spinData)) {
			return null;
		}

		try {
			// Begin spinning
			this.fsm.beginSpin();

			// Generate spin result and force feature trigger
			let grid = this.math.spinReels();
			let evaln = this.math.evaluateWays(grid);

			if (featureType === "HOLD_AND_SPIN") {
				// Force the grid to have enough orbs to trigger hold and spin
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
			} else if (featureType === "FREE_GAMES") {
				// Force the grid to have enough scatters to trigger free games
				const triggerScatters = this.config.freeGames.triggerScatters;
				const currentScatters = evaln.scatters;
				if (currentScatters < triggerScatters) {
					const need = triggerScatters - currentScatters;
					let added = 0;
					for (let reel = 0; reel < this.config.grid.reels && added < need; reel++) {
						for (let row = 0; row < this.config.grid.rows && added < need; row++) {
							const currentSymbol = grid[reel][row];
							// Avoid replacing ORB or WILD to keep other features natural
							if (currentSymbol !== "SCATTER" && currentSymbol !== "ORB" && currentSymbol !== "WILD") {
								grid[reel][row] = "SCATTER";
								added++;
							}
						}
					}
					// Re-evaluate with the modified grid
					evaln = this.math.evaluateWays(grid);
				}
			}

			const spinResult = {
				grid,
				evaln,
				totalWin: evaln.lineWin,
				wager: 0, // No wager for bought features
				freeGames: this.free.remaining,
				holdAndSpin: this.holdSpin.isActive() ? this.holdSpin.getState() : null,
				boughtFeature: featureType
			};

			// Complete spin and evaluate
			this.fsm.completeSpinAndEvaluate(spinResult);

			// Process features - this will handle the feature triggering
			await this.processFeatures(spinResult);

			return spinResult;

		} catch (error) {
			console.error("Error during feature purchase:", error);
			this.fsm.returnToIdle();
			throw error;
		}
	}

	applyWinCredits(result) {
		// Only apply credits if there's a win
		if (result.totalWin > 0) {
			this.credits = this.wallet.addCredits(result.totalWin);
			this.emit(Events.PAYING, result); // NOW emit the paying event
		}
		
		this.emit(Events.BALANCE, this.getBalanceData());
		
		// Complete the payment and return to idle if FSM is in a payable state  
		if (this.fsm.isInState("PAYING") || this.fsm.isInState("EVALUATING")) {
			this.fsm.returnToIdle();
		}

		// After completing payment and returning to idle, finalize Hold & Spin cleanup
		if (!this.holdSpin.isActive() && typeof this.holdSpin.reset === 'function') {
			this.holdSpin.reset();
		}
	}
}
