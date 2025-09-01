import { EventBus } from "../core/EventBus.js";

/**
 * @typedef {Object} FeatureState
 * @property {boolean} active - Is the feature currently active
 * @property {number} remaining - Remaining feature count (spins, respins, etc.)
 * @property {Object} data - Feature-specific state data
 */

/**
 * @typedef {Object} FeatureTriggerResult
 * @property {boolean} triggered - Whether feature was triggered
 * @property {Object} data - Feature trigger data
 */

/**
 * @typedef {Object} FeatureProcessResult
 * @property {boolean} completed - Whether feature is completed
 * @property {number} totalWin - Win amount from feature
 * @property {boolean} continueSpin - Whether to continue spinning
 * @property {Object} data - Feature result data
 */

/**
 * Base contract that all game features must implement.
 * Provides standardized interface for feature management.
 */
export class BaseFeature extends EventBus {
	constructor(config, name) {
		super();
		this.config = config;
		this.name = name;
		this.active = false;
		this.remaining = 0;
		this.stateData = {};
	}

	/**
	 * Get the current feature state
	 * @returns {FeatureState}
	 */
	getState() {
		return {
			active: this.active,
			remaining: this.remaining,
			data: { ...this.stateData }
		};
	}

	/**
	 * Check if this feature should trigger based on spin result
	 * @param {Object} spinResult - Result from spin evaluation
	 * @returns {FeatureTriggerResult}
	 */
	checkTrigger(spinResult) {
		throw new Error(`${this.name} must implement checkTrigger()`);
	}

	/**
	 * Trigger the feature
	 * @param {Object} triggerData - Data from trigger check
	 * @returns {Object} Trigger result
	 */
	trigger(triggerData) {
		throw new Error(`${this.name} must implement trigger()`);
	}

	/**
	 * Process a step of the feature (e.g., consume a free spin)
	 * @param {Object} spinResult - Current spin result
	 * @returns {FeatureProcessResult}
	 */
	process(spinResult) {
		throw new Error(`${this.name} must implement process()`);
	}

	/**
	 * Check if feature is currently active
	 * @returns {boolean}
	 */
	isActive() {
		return this.active;
	}

	/**
	 * Get remaining feature count
	 * @returns {number}
	 */
	getRemaining() {
		return this.remaining;
	}

	/**
	 * Reset feature to inactive state
	 */
	reset() {
		this.active = false;
		this.remaining = 0;
		this.stateData = {};
		this.emit("reset", { feature: this.name });
	}

	/**
	 * Get feature configuration
	 * @returns {Object}
	 */
	getConfig() {
		return { ...this.config };
	}

	/**
	 * Validate feature configuration
	 * @returns {boolean} True if config is valid
	 */
	validateConfig() {
		// Override in specific features for validation
		return true;
	}
}