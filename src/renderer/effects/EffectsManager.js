import { EffectRegistry } from "./EffectRegistry.js";
import { EffectsMap } from "./EffectsMap.js";

/**
 * Central manager for all effects in the renderer.
 * Subscribes to EventBus and spawns effects based on event-to-effect mappings.
 */
export class EffectsManager {
	constructor(app, eventBus) {
		this.app = app;
		this.eventBus = eventBus;
		this.registry = new EffectRegistry();
		this.effectsMap = new EffectsMap();
		this.activeEffects = new Set();
		this.effectPools = new Map();

		this.registerDefaultEffects();
		this.setupEventListeners();
	}

	registerDefaultEffects() {
		// Register placeholder effects to prevent errors
		this.registry.register("sparkleExplosion", class SparkleExplosion {
			constructor(app, container) {
				this.app = app;
				this.container = container;
				this.isPlaying = false;
			}
			async create() {}
			async play(options = {}) {
				console.log("SparkleExplosion effect played with options:", options);
				this.isPlaying = true;
				setTimeout(() => { this.isPlaying = false; }, options.duration || 1000);
			}
			stop() { this.isPlaying = false; }
			update(deltaTime) {}
			destroy() {}
		});

		this.registry.register("rumble", class Rumble {
			constructor(app, container) {
				this.app = app;
				this.container = container;
				this.isPlaying = false;
			}
			async create() {}
			async play(options = {}) {
				console.log("Rumble effect played with options:", options);
				this.isPlaying = true;
				setTimeout(() => { this.isPlaying = false; }, options.duration || 500);
			}
			stop() { this.isPlaying = false; }
			update(deltaTime) {}
			destroy() {}
		});

		this.registry.register("orbGlow", class OrbGlow {
			constructor(app, container) {
				this.app = app;
				this.container = container;
				this.isPlaying = false;
			}
			async create() {}
			async play(options = {}) {
				console.log("OrbGlow effect played with options:", options);
				this.isPlaying = true;
				setTimeout(() => { this.isPlaying = false; }, options.duration || 1000);
			}
			stop() { this.isPlaying = false; }
			update(deltaTime) {}
			destroy() {}
		});

		this.registry.register("freeGamesExplosion", class FreeGamesExplosion {
			constructor(app, container) {
				this.app = app;
				this.container = container;
				this.isPlaying = false;
			}
			async create() {}
			async play(options = {}) {
				console.log("FreeGamesExplosion effect played with options:", options);
				this.isPlaying = true;
				setTimeout(() => { this.isPlaying = false; }, options.duration || 2000);
			}
			stop() { this.isPlaying = false; }
			update(deltaTime) {}
			destroy() {}
		});

		this.registry.register("winCelebration", class WinCelebration {
			constructor(app, container) {
				this.app = app;
				this.container = container;
				this.isPlaying = false;
			}
			async create() {}
			async play(options = {}) {
				console.log("WinCelebration effect played with options:", options);
				this.isPlaying = true;
				setTimeout(() => { this.isPlaying = false; }, options.duration || 1500);
			}
			stop() { this.isPlaying = false; }
			update(deltaTime) {}
			destroy() {}
		});

		this.registry.register("balanceFlash", class BalanceFlash {
			constructor(app, container) {
				this.app = app;
				this.container = container;
				this.isPlaying = false;
			}
			async create() {}
			async play(options = {}) {
				console.log("BalanceFlash effect played with options:", options);
				this.isPlaying = true;
				setTimeout(() => { this.isPlaying = false; }, options.duration || 200);
			}
			stop() { this.isPlaying = false; }
			update(deltaTime) {}
			destroy() {}
		});
	}

	/**
	 * Setup event listeners for all mapped events
	 */
	setupEventListeners() {
		const events = this.effectsMap.getEvents();
		events.forEach(event => {
			this.eventBus.on(event, (payload) => {
				this.handleEvent(event, payload);
			});
		});
	}

	/**
	 * Handle an event by spawning appropriate effects
	 * @param {string} event - Event name
	 * @param {Object} payload - Event payload
	 */
	async handleEvent(event, payload) {
		const effectCues = this.effectsMap.getEffectsForEvent(event, payload);
		
		for (const cue of effectCues) {
			if (cue.delay && cue.delay > 0) {
				// Delayed effect
				setTimeout(() => {
					this.playEffect(cue, payload);
				}, cue.delay);
			} else {
				// Immediate effect
				this.playEffect(cue, payload);
			}
		}
	}

	/**
	 * Play a specific effect
	 * @param {Object} cue - Effect cue
	 * @param {Object} eventPayload - Original event payload
	 */
	async playEffect(cue, eventPayload) {
		try {
			const effect = this.getEffect(cue.effect);
			if (!effect) {
				console.warn(`Effect "${cue.effect}" not found in registry`);
				return;
			}

			// Merge cue options with event payload data if available
			const playOptions = {
				...cue.options,
				eventPayload
			};

			this.activeEffects.add(effect);
			await effect.play(playOptions);
			
		} catch (error) {
			console.error(`Error playing effect "${cue.effect}":`, error);
		}
	}

	/**
	 * Get or create an effect instance
	 * @param {string} effectName - Effect name
	 * @param {Object} [container] - Container for the effect
	 * @returns {Object|null} Effect instance
	 */
	getEffect(effectName, container = null) {
		if (!this.registry.has(effectName)) {
			return null;
		}

		// Use default effects container if none provided
		const effectContainer = container || this.getDefaultContainer();
		
		// For now, create a new instance each time
		// TODO: Implement pooling for performance
		try {
			const effect = this.registry.create(effectName, this.app, effectContainer);
			return effect;
		} catch (error) {
			console.error(`Error creating effect "${effectName}":`, error);
			return null;
		}
	}

	/**
	 * Get the default container for effects
	 * @returns {Object} PIXI Container
	 */
	getDefaultContainer() {
		// Return the main app stage as default
		return this.app.stage;
	}

	/**
	 * Update all active effects
	 * @param {number} deltaTime - Time since last update (ms)
	 */
	update(deltaTime) {
		for (const effect of this.activeEffects) {
			if (effect.update) {
				effect.update(deltaTime);
			}
			
			// Remove completed effects
			if (!effect.isPlaying) {
				this.activeEffects.delete(effect);
			}
		}
	}

	/**
	 * Stop all active effects
	 */
	stopAll() {
		for (const effect of this.activeEffects) {
			effect.stop();
		}
		this.activeEffects.clear();
	}

	/**
	 * Register an effect in the registry
	 * @param {string} name - Effect name
	 * @param {Function} EffectClass - Effect class constructor
	 */
	registerEffect(name, EffectClass) {
		this.registry.register(name, EffectClass);
	}

	/**
	 * Add a custom event-to-effect mapping
	 * @param {string} event - Event name
	 * @param {Object} effectCue - Effect configuration
	 */
	addMapping(event, effectCue) {
		this.effectsMap.addMapping(event, effectCue);
		
		// Add event listener if not already listening
		if (!this.effectsMap.getEvents().includes(event)) {
			this.eventBus.on(event, (payload) => {
				this.handleEvent(event, payload);
			});
		}
	}

	/**
	 * Cleanup all effects and resources
	 */
	destroy() {
		this.stopAll();
		
		// Clean up event listeners
		const events = this.effectsMap.getEvents();
		events.forEach(event => {
			// Note: EventBus doesn't currently support removing all listeners for an event
			// This would need to be implemented if we need complete cleanup
		});

		this.effectsMap.clear();
		this.registry.clear();
	}
}