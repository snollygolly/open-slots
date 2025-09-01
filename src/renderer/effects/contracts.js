/**
 * @typedef {Object} EffectContract
 * @property {Function} create - Create effect instance
 * @property {Function} play - Play effect with parameters
 * @property {Function} stop - Stop effect
 * @property {Function} update - Update effect (called each frame)
 * @property {Function} destroy - Cleanup effect resources
 */

/**
 * @typedef {Object} EffectPlayOptions
 * @property {number} x - X position
 * @property {number} y - Y position
 * @property {number} [duration] - Effect duration in milliseconds
 * @property {Object} [data] - Additional effect-specific data
 */

/**
 * @typedef {Object} TimelineStep
 * @property {"tween"|"wait"|"call"} type - Step type
 * @property {number} [duration] - Duration for tween/wait
 * @property {Object} [target] - Target object for tween
 * @property {Object} [to] - Tween destination values
 * @property {Function} [callback] - Function to call
 * @property {string} [ease] - Easing function name
 */

/**
 * Base contract interface that all effects must implement
 */
export class BaseEffect {
	constructor(app, container) {
		this.app = app;
		this.container = container;
		this.isPlaying = false;
		this.elements = [];
	}

	/**
	 * Create the effect (setup graphics, sprites, etc.)
	 * @returns {Promise<void>}
	 */
	async create() {
		throw new Error("create() must be implemented by effect");
	}

	/**
	 * Play the effect
	 * @param {EffectPlayOptions} options - Play options
	 * @returns {Promise<void>}
	 */
	async play(options = {}) {
		throw new Error("play() must be implemented by effect");
	}

	/**
	 * Stop the effect
	 */
	stop() {
		this.isPlaying = false;
	}

	/**
	 * Update effect animation (called each frame)
	 * @param {number} deltaTime - Time since last update (ms)
	 */
	update(deltaTime) {
		// Override if needed
	}

	/**
	 * Cleanup effect resources
	 */
	destroy() {
		this.stop();
		this.elements.forEach(element => {
			if (element.parent) {
				element.parent.removeChild(element);
			}
			if (element.destroy) {
				element.destroy();
			}
		});
		this.elements = [];
	}
}