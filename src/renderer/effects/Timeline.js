/**
 * Timeline class for sequencing tweens and function calls.
 * Provides a simple API for chaining animations and delays.
 */
export class Timeline {
	constructor() {
		this.steps = [];
		this.currentIndex = 0;
		this.isPlaying = false;
		this.startTime = 0;
		this.currentStepStartTime = 0;
	}

	/**
	 * Add a tween step to the timeline
	 * @param {Object} target - Target object to tween
	 * @param {Object} to - Properties to tween to
	 * @param {number} duration - Duration in milliseconds
	 * @param {string} [ease="linear"] - Easing function
	 * @returns {Timeline} This timeline for chaining
	 */
	tween(target, to, duration, ease = "linear") {
		this.steps.push({
			type: "tween",
			target,
			to,
			from: null, // Will be captured when step starts
			duration,
			ease,
			startTime: null
		});
		return this;
	}

	/**
	 * Add a wait/delay step to the timeline
	 * @param {number} duration - Duration in milliseconds
	 * @returns {Timeline} This timeline for chaining
	 */
	wait(duration) {
		this.steps.push({
			type: "wait",
			duration,
			startTime: null
		});
		return this;
	}

	/**
	 * Add a function call step to the timeline
	 * @param {Function} callback - Function to call
	 * @returns {Timeline} This timeline for chaining
	 */
	call(callback) {
		this.steps.push({
			type: "call",
			callback
		});
		return this;
	}

	/**
	 * Start playing the timeline
	 * @returns {Promise<void>} Promise that resolves when timeline completes
	 */
	play() {
		return new Promise((resolve, reject) => {
			if (this.isPlaying) {
				reject(new Error("Timeline is already playing"));
				return;
			}

			this.isPlaying = true;
			this.currentIndex = 0;
			this.startTime = performance.now();
			this.onComplete = resolve;
			this.onError = reject;

			this.startNextStep();
		});
	}

	/**
	 * Start the next step in the timeline
	 */
	startNextStep() {
		if (this.currentIndex >= this.steps.length) {
			this.complete();
			return;
		}

		const step = this.steps[this.currentIndex];
		step.startTime = performance.now();
		this.currentStepStartTime = step.startTime;

		if (step.type === "call") {
			// Execute function immediately and move to next step
			try {
				step.callback();
				this.currentIndex++;
				this.startNextStep();
			} catch (error) {
				this.error(error);
			}
		} else {
			// For tween and wait, capture initial values
			if (step.type === "tween") {
				step.from = {};
				Object.keys(step.to).forEach(key => {
					step.from[key] = step.target[key];
				});
			}

			// Schedule next step
			this.scheduleUpdate();
		}
	}

	/**
	 * Schedule the next update
	 */
	scheduleUpdate() {
		if (!this.isPlaying) return;

		requestAnimationFrame(() => {
			this.update();
		});
	}

	/**
	 * Update the current step
	 */
	update() {
		if (!this.isPlaying || this.currentIndex >= this.steps.length) {
			return;
		}

		const step = this.steps[this.currentIndex];
		const elapsed = performance.now() - step.startTime;
		const progress = Math.min(elapsed / step.duration, 1);

		if (step.type === "tween") {
			// Apply tween values
			Object.keys(step.to).forEach(key => {
				const from = step.from[key];
				const to = step.to[key];
				const easedProgress = this.applyEasing(progress, step.ease);
				step.target[key] = from + (to - from) * easedProgress;
			});
		}

		if (progress >= 1) {
			// Step completed
			this.currentIndex++;
			this.startNextStep();
		} else {
			// Continue this step
			this.scheduleUpdate();
		}
	}

	/**
	 * Apply easing function to progress
	 * @param {number} t - Progress (0-1)
	 * @param {string} ease - Easing function name
	 * @returns {number} Eased progress
	 */
	applyEasing(t, ease) {
		switch (ease) {
			case "linear":
				return t;
			case "easeIn":
				return t * t;
			case "easeOut":
				return 1 - (1 - t) * (1 - t);
			case "easeInOut":
				return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
			case "bounce":
				if (t < 0.36) {
					return 7.5625 * t * t;
				} else if (t < 0.73) {
					return 7.5625 * (t -= 0.545) * t + 0.75;
				} else if (t < 0.91) {
					return 7.5625 * (t -= 0.82) * t + 0.9375;
				} else {
					return 7.5625 * (t -= 0.955) * t + 0.984375;
				}
			default:
				return t;
		}
	}

	/**
	 * Stop the timeline
	 */
	stop() {
		this.isPlaying = false;
	}

	/**
	 * Complete the timeline
	 */
	complete() {
		this.isPlaying = false;
		if (this.onComplete) {
			this.onComplete();
		}
	}

	/**
	 * Handle timeline error
	 * @param {Error} error - The error that occurred
	 */
	error(error) {
		this.isPlaying = false;
		if (this.onError) {
			this.onError(error);
		} else {
			console.error("Timeline error:", error);
		}
	}

	/**
	 * Clear all steps and reset timeline
	 */
	clear() {
		this.stop();
		this.steps = [];
		this.currentIndex = 0;
	}

	/**
	 * Create a new timeline instance
	 * @returns {Timeline} New timeline
	 */
	static create() {
		return new Timeline();
	}
}