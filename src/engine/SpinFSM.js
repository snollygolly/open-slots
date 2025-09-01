import { EventBus } from "../core/EventBus.js";
import { Events } from "../core/events.js";

/**
 * @typedef {Object} SpinState
 * @property {"IDLE"|"REQUEST_SPIN"|"SPINNING"|"EVALUATING"|"FEATURE"|"PAYING"} name
 * @property {Object} data - State-specific data
 */

/**
 * @typedef {Object} SpinResult
 * @property {Array<Array<string>>} grid - The reel grid result
 * @property {Object} evaln - Evaluation result (wins, scatters, orbs, etc.)
 * @property {number} totalWin - Total win amount
 * @property {string|null} feature - Feature triggered
 * @property {Object|null} hold - Hold and spin data
 * @property {number} freeGames - Free games remaining
 * @property {Object|null} holdAndSpin - Hold and spin state
 * @property {number} wager - Amount wagered
 */

/**
 * @typedef {Object} FeaturePayload
 * @property {string} type - Feature type
 * @property {Object} data - Feature-specific data
 */

const STATES = {
	IDLE: "IDLE",
	REQUEST_SPIN: "REQUEST_SPIN", 
	SPINNING: "SPINNING",
	EVALUATING: "EVALUATING",
	FEATURE: "FEATURE",
	PAYING: "PAYING"
};

export class SpinFSM extends EventBus {
	constructor() {
		super();
		this.currentState = STATES.IDLE;
		this.stateData = {};
	}

	/**
	 * Get the current state
	 * @returns {SpinState}
	 */
	getState() {
		return {
			name: this.currentState,
			data: { ...this.stateData }
		};
	}

	/**
	 * Transition to a new state
	 * @param {string} newState - The target state
	 * @param {Object} data - State-specific data
	 */
	transition(newState, data = {}) {
		if (!Object.values(STATES).includes(newState)) {
			throw new Error(`Invalid state: ${newState}`);
		}

		const previousState = this.currentState;
		this.currentState = newState;
		this.stateData = { ...data };

		this.emit("stateChanged", {
			previous: previousState,
			current: newState,
			data: this.stateData
		});
	}

	/**
	 * Check if FSM is in a specific state
	 * @param {string} state - State to check
	 * @returns {boolean}
	 */
	isInState(state) {
		return this.currentState === state;
	}

	/**
	 * Check if FSM can accept a spin request
	 * @returns {boolean}
	 */
	canSpin() {
		// Can spin from IDLE or from FEATURE state (for feature respins)
		return this.currentState === STATES.IDLE || this.currentState === STATES.FEATURE;
	}

	/**
	 * Request a spin - transitions from IDLE or FEATURE to REQUEST_SPIN
	 * @param {Object} spinData - Spin request data
	 * @returns {boolean} Success
	 */
	requestSpin(spinData = {}) {
		if (!this.canSpin()) {
			return false;
		}
		
		this.transition(STATES.REQUEST_SPIN, spinData);
		this.emit(Events.SPIN_START, spinData);
		return true;
	}

	/**
	 * Begin spinning - transitions from REQUEST_SPIN to SPINNING
	 */
	beginSpin() {
		if (this.currentState !== STATES.REQUEST_SPIN) {
			throw new Error("Cannot begin spin from current state");
		}
		
		this.transition(STATES.SPINNING);
	}

	/**
	 * Complete spinning and begin evaluation - transitions from SPINNING to EVALUATING
	 * @param {SpinResult} result - Spin result to evaluate
	 */
	completeSpinAndEvaluate(result) {
		if (this.currentState !== STATES.SPINNING) {
			throw new Error("Cannot complete spin from current state");
		}
		
		this.transition(STATES.EVALUATING, { result });
		this.emit(Events.SPIN_RESULT, result);
	}

	/**
	 * Trigger a feature - transitions from EVALUATING to FEATURE
	 * @param {FeaturePayload} featurePayload - Feature data
	 */
	triggerFeature(featurePayload) {
		if (this.currentState !== STATES.EVALUATING) {
			throw new Error("Cannot trigger feature from current state");
		}
		
		this.transition(STATES.FEATURE, featurePayload);
		this.emit(Events.FEATURE_START, featurePayload);
	}

	/**
	 * Complete evaluation without feature - transitions from EVALUATING to PAYING (if wins) or IDLE
	 */
	completeEvaluation() {
		if (this.currentState !== STATES.EVALUATING) {
			throw new Error("Cannot complete evaluation from current state");
		}
		
		const result = this.stateData.result;
		if (result && result.totalWin > 0) {
			this.transition(STATES.PAYING, { result });
			// Don't emit PAYING event here - let GameEngine control when to pay
		} else {
			this.returnToIdle();
		}
	}

	/**
	 * Complete feature - transitions from FEATURE back to EVALUATING, PAYING, or IDLE
	 * @param {Object} featureResult - Feature completion result
	 */
	completeFeature(featureResult) {
		if (this.currentState !== STATES.FEATURE) {
			throw new Error("Cannot complete feature from current state");
		}
		
		this.emit(Events.FEATURE_END, featureResult);
		
		if (featureResult.continueSpin) {
			// Feature wants to continue the spin (e.g., hold and spin respins)
			// Stay in FEATURE state so canSpin() allows the next respin
			this.transition(STATES.FEATURE);
		} else if (featureResult.totalWin > 0) {
			// Feature completed with wins, go to paying
			this.transition(STATES.PAYING, { result: featureResult });
			// Don't emit PAYING event here - let GameEngine control when to pay
		} else {
			// Feature completed, return to idle
			this.returnToIdle();
		}
	}

	/**
	 * Complete payment - transitions from PAYING to IDLE
	 */
	completePayment() {
		if (this.currentState !== STATES.PAYING) {
			throw new Error("Cannot complete payment from current state");
		}
		
		this.returnToIdle();
	}

	/**
	 * Return to idle state
	 */
	returnToIdle() {
		this.transition(STATES.IDLE);
		this.emit(Events.SPIN_END);
	}

	/**
	 * Get available states
	 * @returns {Object}
	 */
	static getStates() {
		return { ...STATES };
	}
}