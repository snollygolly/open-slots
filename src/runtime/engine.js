import { EventBus } from "./eventBus.js";
import { GameMath } from "./math.js";
import { deepClone, mulberry32 } from "./util.js";

export class GameEngine extends EventBus {
	constructor(config) {
		super();
		this.config = deepClone(config);
		this.progressives = this.#initMeters(config.progressives);
		this.bet = config.bet;
		this.credits = this.#loadNumber("credits", 100000);
		this.lastWin = 0;
		this.state = "IDLE";
		this.freeGames = { remaining: 0 };
		this.math = new GameMath(config, this.#loadNumber("rngSeed", config.rngSeed));
		this.spinning = false;
		this.emit("balance");
		this.emit("progressives");
	}

	async simulate(n) {
		const rng = mulberry32(999);
		let wagered = 0;
		let paid = 0;
		let hits = 0;
		for (let i = 0; i < n; i += 1) {
			const res = this.#simulateOnce(rng);
			wagered += this.bet;
			paid += res.totalWin;
			if (res.totalWin > 0) { hits += 1; }
		}
		return { spins: n, rtp: paid / wagered, hitRate: hits / n };
	}

	async spinOnce() {
		if (this.spinning) { return null; }
		this.spinning = true;
		try {
			this.emit("status", "Spinning…");
			const result = this.#doSpin();
			this.emit("status", result.feature ? `Feature: ${result.feature}` : "Result");
			return result;
		} finally {
			this.spinning = false;
		}
	}

	#doSpin() {
		const wager = this.freeGames.remaining > 0 ? 0 : this.bet;
		if (wager > 0) {
			if (this.credits < wager) { throw new Error("Insufficient credits"); }
			this.credits -= wager;
			this.#contributeToMeters(this.bet);
		}
		const grid = this.math.spinReels();
		const evaln = this.math.evaluateWays(grid);

		let totalWin = 0;
		let feature = null;
		let hold = null;

		const fgCfg = this.config.freeGames;
		const hsCfg = this.config.holdAndSpin;

		if (evaln.orbs >= hsCfg.triggerCount) {
			const startOrbs = [];
			for (let i = 0; i < evaln.orbs; i += 1) {
				startOrbs.push({ type: "C", amount: 50 });
			}
			const round = this.math.playHoldAndSpin(startOrbs, this.bet, (id) => this.#takeJackpot(id));
			hold = round;
			totalWin += round.sumCredits;
			feature = "HOLD_AND_SPIN";
		} else if (evaln.scatters >= fgCfg.triggerScatters) {
			this.freeGames.remaining += this.freeGames.remaining > 0 ? fgCfg.retrigger : fgCfg.spins;
			feature = "FREE_GAMES_TRIGGER";
		} else {
			totalWin += evaln.lineWin;
		}

		if (this.freeGames.remaining > 0 && feature !== "HOLD_AND_SPIN") {
			let bonusBoost = 0;
			if (Math.random() < fgCfg.extraWildChance) { bonusBoost = Math.floor(10 + Math.random() * 40); }
			const boost = Math.round((evaln.lineWin + bonusBoost) * fgCfg.multiplier);
			totalWin += boost;
			this.freeGames.remaining -= 1;
			feature = "FREE_GAMES";
		}

		this.lastWin = totalWin;
		this.credits += totalWin;
		this.#saveNumber("credits", this.credits);
		this.emit("balance");
		return { grid, evaln, totalWin, feature, hold, freeGames: this.freeGames.remaining };
	}

	#simulateOnce(rng) {
		const wager = this.bet;
		let totalWin = 0;
		if (rng() < 0.12) {
			totalWin += Math.round(this.bet * (1 + rng() * 8));
		}
		return { totalWin, wager };
	}

	#initMeters(pg) {
		const balances = {};
		pg.order.forEach((id) => { balances[id] = this.#loadNumber(`pg_${id}`, pg.meta[id].seed); });
		return { order: pg.order.slice(0), meta: pg.meta, balances };
	}

	#contributeToMeters(bet) {
		const cents = bet * this.config.denom;
		const toAdd = cents * this.config.progressives.contributionRate;
		let rem = toAdd;
		const each = rem / this.progressives.order.length;
		for (let i = 0; i < this.progressives.order.length; i += 1) {
			const id = this.progressives.order[i];
			this.progressives.balances[id] += each;
			this.#saveNumber(`pg_${id}`, this.progressives.balances[id]);
		}
		this.emit("progressives");
	}

	#takeJackpot(id) {
		const bal = this.progressives.balances[id];
		this.progressives.balances[id] = this.config.progressives.meta[id].seed;
		this.#saveNumber(`pg_${id}`, this.progressives.balances[id]);
		this.emit("progressives");
		return Math.round(bal / this.config.denom);
	}

	#saveNumber(key, value) {
		try {
			const store = this.config.persistenceKey;
			const raw = localStorage.getItem(store);
			const json = raw ? JSON.parse(raw) : {};
			json[key] = value;
			localStorage.setItem(store, JSON.stringify(json));
		} catch {
			/* no-op */
		}
	}

	#loadNumber(key, fallback) {
		try {
			const raw = localStorage.getItem(this.config.persistenceKey);
			if (!raw) { return fallback; }
			const json = JSON.parse(raw);
			return typeof json[key] === "number" ? json[key] : fallback;
		} catch {
			return fallback;
		}
	}
}
