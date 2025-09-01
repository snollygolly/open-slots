import { EventBus } from "../core/EventBus.js";
import { GameMath } from "./GameMath.js";
import { FreeGames } from "../features/FreeGames.js";

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
			const wager = this.free.isActive() ? 0 : this.bet;
			if (wager > 0) {
				this.credits = this.wallet.deductCredits(wager);
				this.wallet.contributeToMeters(this.bet);
				this.emit("balance", null);
				this.emit("progressives", null);
			}
			const grid = this.math.spinReels();
			const evaln = this.math.evaluateWays(grid);
			let totalWin = 0;
			let feature = null;
			let hold = null;
			const fgCfg = this.config.freeGames;
			const hsCfg = this.config.holdAndSpin;
			if (evaln.orbs >= hsCfg.triggerCount) {
				const startOrbs = []; for (let i = 0; i < evaln.orbs; i += 1) { startOrbs.push({ type: "C", amount: 50 }); }
				hold = this.math.playHoldAndSpin(startOrbs, this.bet, (id) => this.wallet.takeJackpot(id));
				totalWin += hold.sumCredits;
				feature = "HOLD_AND_SPIN";
				this.emit("featureStart", feature);
			} else if (evaln.scatters >= fgCfg.triggerScatters) {
				this.free.trigger();
				feature = "FREE_GAMES_TRIGGER";
				this.emit("featureStart", feature);
			} else {
				totalWin += evaln.lineWin;
			}
			if (this.free.isActive() && feature !== "HOLD_AND_SPIN") {
				let bonusBoost = 0;
				if (Math.random() < fgCfg.extraWildChance) { bonusBoost = Math.floor(10 + Math.random() * 40); }
				const boost = Math.round((evaln.lineWin + bonusBoost) * fgCfg.multiplier);
				totalWin += boost;
				this.free.consume();
				feature = "FREE_GAMES";
			}
			this.lastWin = totalWin;
			const result = { grid, evaln, totalWin, feature, hold, freeGames: this.free.remaining, wager };
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
			const startOrbs = []; for (let i = 0; i < evaln.orbs; i += 1) { startOrbs.push({ type: "C", amount: 50 }); }
			hold = this.math.playHoldAndSpin(startOrbs, this.bet, () => 1000);
			totalWin += hold.sumCredits;
			feature = "HOLD_AND_SPIN";
		} else if (evaln.scatters >= fgCfg.triggerScatters) {
			feature = "FREE_GAMES_TRIGGER";
		} else {
			totalWin += evaln.lineWin;
		}
		const wager = this.bet;
		return { grid, evaln, totalWin, feature, hold, wager };
	}

	applyWinCredits(result) {
		this.credits = this.wallet.addCredits(result.totalWin);
		this.emit("balance", null);
	}
}
