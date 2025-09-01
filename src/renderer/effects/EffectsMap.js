import { Events } from "../../core/events.js";

/**
 * @typedef {Object} EffectCue
 * @property {string} effect - Effect name from registry
 * @property {Object} [options] - Effect play options
 * @property {number} [delay] - Delay before playing effect (ms)
 * @property {Function} [condition] - Function to determine if effect should play
 */

/**
 * Maps game events to effect cues.
 * This centralized mapping allows easy configuration of which effects
 * trigger in response to which game events.
 */
export class EffectsMap {
	constructor() {
		this.eventToEffects = new Map();
		this.setupDefaultMappings();
	}

	/**
	 * Setup default effect mappings
	 */
	setupDefaultMappings() {
		// Spin start effects
		this.addMapping(Events.SPIN_START, {
			effect: "rumble",
			options: { duration: 300, intensity: 0.5 }
		});

		// Feature start effects
		this.addMapping(Events.FEATURE_START, {
			effect: "sparkleExplosion",
			options: { count: 30, duration: 2000 },
			condition: (payload) => payload.type !== "HOLD_AND_SPIN_START"
		});

		// Hold and spin start
		this.addMapping(Events.FEATURE_START, {
			effect: "orbGlow",
			options: { duration: 1000 },
			condition: (payload) => payload.type === "HOLD_AND_SPIN_START"
		});

		// Free games effects
		this.addMapping(Events.FEATURE_START, {
			effect: "freeGamesExplosion",
			options: { color: 0x00ccff, count: 50 },
			condition: (payload) => payload.type?.includes("FREE_GAMES")
		});

		// Win celebration effects
		this.addMapping(Events.PAYING, {
			effect: "winCelebration",
			options: { duration: 1500 },
			condition: (payload) => payload.totalWin > 0
		});

		// Balance update effects
		this.addMapping(Events.BALANCE, {
			effect: "balanceFlash",
			options: { duration: 200 }
		});
	}

	/**
	 * Add an effect mapping for an event
	 * @param {string} event - Event name
	 * @param {EffectCue} effectCue - Effect configuration
	 */
	addMapping(event, effectCue) {
		if (!this.eventToEffects.has(event)) {
			this.eventToEffects.set(event, []);
		}
		this.eventToEffects.get(event).push(effectCue);
	}

	/**
	 * Remove all mappings for an event
	 * @param {string} event - Event name
	 */
	removeMapping(event) {
		this.eventToEffects.delete(event);
	}

	/**
	 * Get effect cues for an event
	 * @param {string} event - Event name
	 * @param {Object} payload - Event payload for condition checking
	 * @returns {Array<EffectCue>}
	 */
	getEffectsForEvent(event, payload = {}) {
		const effects = this.eventToEffects.get(event) || [];
		return effects.filter(effectCue => {
			if (typeof effectCue.condition === "function") {
				return effectCue.condition(payload);
			}
			return true;
		});
	}

	/**
	 * Get all registered events
	 * @returns {Array<string>}
	 */
	getEvents() {
		return Array.from(this.eventToEffects.keys());
	}

	/**
	 * Clear all mappings
	 */
	clear() {
		this.eventToEffects.clear();
	}
}