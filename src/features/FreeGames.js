import { BaseFeature } from "../engine/FeatureContracts.js";
import { Events } from "../core/events.js";

export class FreeGames extends BaseFeature {
	constructor(config, dependencies = {}) {
		super(config.freeGames, "FreeGames");
		this.cfg = config.freeGames;
	}

	checkTrigger(spinResult) {
		const triggerScatters = this.cfg.triggerScatters || 3;
		const scatterCount = spinResult.evaln?.scatters || 0;
		
		return {
			triggered: scatterCount >= triggerScatters,
			data: { scatterCount, triggerScatters }
		};
	}

	trigger(triggerData = {}) {
		const spinsToAdd = this.remaining > 0 ? this.cfg.retrigger : this.cfg.spins;
		this.remaining += spinsToAdd;
		this.active = this.remaining > 0;
		
		this.stateData = {
			totalSpins: this.remaining,
			isRetrigger: triggerData.data?.scatterCount >= this.cfg.triggerScatters && this.remaining > spinsToAdd
		};

		this.emit(Events.FREE_GAMES_START, {
			feature: this.name,
			spinsAdded: spinsToAdd,
			totalSpins: this.remaining,
			isRetrigger: this.stateData.isRetrigger
		});

		return { spinsAdded: spinsToAdd, totalSpins: this.remaining };
	}

	process(spinResult) {
		if (!this.active || this.remaining <= 0) {
			return { completed: true, totalWin: 0, continueSpin: false, data: {} };
		}

		this.remaining -= 1;
		const completed = this.remaining <= 0;
		
		if (completed) {
			this.active = false;
			this.emit(Events.FREE_GAMES_END, {
				feature: this.name,
				totalSpins: this.stateData.totalSpins
			});
		} else {
			this.emit(Events.FREE_GAMES_CHANGE, {
				feature: this.name,
				remaining: this.remaining
			});
		}

		return {
			completed,
			totalWin: 0, // Free games don't directly add win, they modify the spin
			continueSpin: !completed,
			data: { remaining: this.remaining }
		};
	}

	consume() {
		if (this.remaining <= 0) return 0;
		this.remaining -= 1;
		this.emit(Events.FREE_GAMES_CHANGE, { remaining: this.remaining });
		return this.remaining;
	}

	validateConfig() {
		return (
			typeof this.cfg.spins === "number" &&
			typeof this.cfg.retrigger === "number" &&
			typeof this.cfg.triggerScatters === "number" &&
			this.cfg.spins > 0 &&
			this.cfg.retrigger > 0 &&
			this.cfg.triggerScatters > 0
		);
	}
}
