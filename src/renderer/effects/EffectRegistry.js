/**
 * Registry for all available effects in the system.
 * Effects are registered by name and can be instantiated on demand.
 */
export class EffectRegistry {
	constructor() {
		this.effects = new Map();
	}

	/**
	 * Register an effect class
	 * @param {string} name - Effect name
	 * @param {Function} EffectClass - Effect class constructor
	 */
	register(name, EffectClass) {
		if (typeof EffectClass !== "function") {
			throw new Error(`Effect class for "${name}" must be a constructor function`);
		}
		this.effects.set(name, EffectClass);
	}

	/**
	 * Create an instance of a registered effect
	 * @param {string} name - Effect name
	 * @param {Object} app - PIXI Application instance
	 * @param {Object} container - PIXI Container for the effect
	 * @returns {Object} Effect instance
	 */
	create(name, app, container) {
		const EffectClass = this.effects.get(name);
		if (!EffectClass) {
			throw new Error(`Effect "${name}" is not registered`);
		}
		return new EffectClass(app, container);
	}

	/**
	 * Check if an effect is registered
	 * @param {string} name - Effect name
	 * @returns {boolean}
	 */
	has(name) {
		return this.effects.has(name);
	}

	/**
	 * Get all registered effect names
	 * @returns {Array<string>}
	 */
	getNames() {
		return Array.from(this.effects.keys());
	}

	/**
	 * Remove an effect from the registry
	 * @param {string} name - Effect name
	 */
	unregister(name) {
		this.effects.delete(name);
	}

	/**
	 * Clear all registered effects
	 */
	clear() {
		this.effects.clear();
	}
}