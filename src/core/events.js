/**
 * Centralized event constants for the slot machine simulator.
 * Replace all string literals throughout the codebase with these constants.
 */
export const Events = {
	// Spin lifecycle events
	SPIN_START: "spinStart",
	SPIN_RESULT: "spinResult", 
	SPIN_END: "spinEnd",
	
	// Feature events
	FEATURE_START: "featureStart",
	FEATURE_TICK: "featureTick",
	FEATURE_END: "featureEnd",
	
	// Payment events
	PAYING: "paying",
	
	// Balance and progressive events
	BALANCE: "balance",
	PROGRESSIVES: "progressives",
	
	// Status events
	STATUS: "status",
	
	// Hold and Spin specific events
	HOLD_SPIN_START: "holdSpinStart",
	HOLD_SPIN_RESPIN: "holdSpinRespin", 
	HOLD_SPIN_END: "holdSpinEnd",
	HOLD_SPIN_ORBS_ADDED: "holdSpinOrbsAdded",
	HOLD_SPIN_NO_ORBS: "holdSpinNoOrbs",
	HOLD_SPIN_COMPLETE: "holdSpinComplete",
	
	// Free Games specific events
	FREE_GAMES_START: "freeGamesStart",
	FREE_GAMES_CHANGE: "freeGamesChange",
	FREE_GAMES_END: "freeGamesEnd"
};