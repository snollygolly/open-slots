/**
 * Registry for all available game features.
 * Features are registered by name and managed through a common interface.
 */
export class FeaturesRegistry {
	constructor() {
		this.features = new Map();
		this.featureInstances = new Map();
	}

	/**
	 * Register a feature class
	 * @param {string} name - Feature name
	 * @param {Function} FeatureClass - Feature class constructor
	 */
	register(name, FeatureClass) {
		if (typeof FeatureClass !== "function") {
			throw new Error(`Feature class for "${name}" must be a constructor function`);
		}
		this.features.set(name, FeatureClass);
	}

	/**
	 * Create an instance of a registered feature
	 * @param {string} name - Feature name
	 * @param {Object} config - Feature configuration
	 * @param {Object} dependencies - Feature dependencies (rng, wallet, etc.)
	 * @returns {Object} Feature instance
	 */
	create(name, config, dependencies = {}) {
		const FeatureClass = this.features.get(name);
		if (!FeatureClass) {
			throw new Error(`Feature "${name}" is not registered`);
		}

		const instance = new FeatureClass(config, dependencies);
		this.featureInstances.set(name, instance);
		return instance;
	}

	/**
	 * Get an existing feature instance
	 * @param {string} name - Feature name
	 * @returns {Object|null} Feature instance or null if not found
	 */
	getInstance(name) {
		return this.featureInstances.get(name) || null;
	}

	/**
	 * Get all active features
	 * @returns {Array<Object>} Array of active feature instances
	 */
	getActiveFeatures() {
		const activeFeatures = [];
		for (const feature of this.featureInstances.values()) {
			if (feature.isActive && feature.isActive()) {
				activeFeatures.push(feature);
			}
		}
		return activeFeatures;
	}

	/**
	 * Check if a feature is registered
	 * @param {string} name - Feature name
	 * @returns {boolean}
	 */
	has(name) {
		return this.features.has(name);
	}

	/**
	 * Get all registered feature names
	 * @returns {Array<string>}
	 */
	getRegisteredNames() {
		return Array.from(this.features.keys());
	}

	/**
	 * Get all feature instance names
	 * @returns {Array<string>}
	 */
	getInstanceNames() {
		return Array.from(this.featureInstances.keys());
	}

	/**
	 * Remove a feature from the registry
	 * @param {string} name - Feature name
	 */
	unregister(name) {
		// Clean up instance if it exists
		const instance = this.featureInstances.get(name);
		if (instance && instance.destroy) {
			instance.destroy();
		}
		
		this.features.delete(name);
		this.featureInstances.delete(name);
	}

	/**
	 * Clear all registered features and instances
	 */
	clear() {
		// Clean up all instances
		for (const instance of this.featureInstances.values()) {
			if (instance.destroy) {
				instance.destroy();
			}
		}

		this.features.clear();
		this.featureInstances.clear();
	}

	/**
	 * Reset all feature instances to inactive state
	 */
	resetAll() {
		for (const feature of this.featureInstances.values()) {
			if (feature.reset) {
				feature.reset();
			}
		}
	}

	/**
	 * Validate all feature configurations
	 * @returns {Array<Object>} Array of validation results
	 */
	validateAll() {
		const results = [];
		
		for (const [name, feature] of this.featureInstances.entries()) {
			if (feature.validateConfig) {
				const isValid = feature.validateConfig();
				results.push({
					feature: name,
					valid: isValid,
					config: feature.getConfig ? feature.getConfig() : null
				});
			}
		}
		
		return results;
	}
}