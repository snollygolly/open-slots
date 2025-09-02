/**
 * Runtime configuration validator to ensure game configuration is valid
 * and all components are properly aligned.
 */
export class ConfigValidator {
	constructor() {
		this.errors = [];
		this.warnings = [];
	}

	/**
	 * Validate the entire game configuration
	 * @param {Object} config - Game configuration object
	 * @returns {Object} Validation result
	 */
	validate(config) {
		this.errors = [];
		this.warnings = [];

		this.validateGrid(config.grid);
		this.validateSymbols(config.symbols);
		this.validatePaytable(config.paytable, config.symbols);
		this.validateReels(config.reels, config.grid, config.symbols);
		this.validateBet(config.bet);
		this.validateFreeGames(config.freeGames);
		this.validateHoldAndSpin(config.holdAndSpin, config.grid);
		this.validateProgressives(config.progressives);

		return {
			valid: this.errors.length === 0,
			errors: [...this.errors],
			warnings: [...this.warnings]
		};
	}

	/**
	 * Validate grid configuration
	 */
	validateGrid(grid) {
		if (!grid) {
			this.errors.push("Grid configuration is missing");
			return;
		}

		if (typeof grid.reels !== "number" || grid.reels <= 0) {
			this.errors.push("Grid reels must be a positive number");
		}

		if (typeof grid.rows !== "number" || grid.rows <= 0) {
			this.errors.push("Grid rows must be a positive number");
		}

		if (grid.reels < 3) {
			this.warnings.push("Less than 3 reels may not provide good gameplay");
		}

		if (grid.rows < 3) {
			this.warnings.push("Less than 3 rows may not provide good gameplay");
		}
	}

	/**
	 * Validate symbols configuration
	 */
	validateSymbols(symbols) {
		if (!symbols) {
			this.errors.push("Symbols configuration is missing");
			return;
		}

		// Handle both array and object formats
		let symbolValues = [];
		if (Array.isArray(symbols)) {
			symbolValues = symbols;
		} else if (typeof symbols === "object") {
			symbolValues = Object.values(symbols);
		} else {
			this.errors.push("Symbols must be an array or object");
			return;
		}

		if (symbolValues.length === 0) {
			this.errors.push("Symbols must not be empty");
			return;
		}

		const uniqueSymbols = new Set(symbolValues);
		if (uniqueSymbols.size !== symbolValues.length) {
			this.errors.push("Duplicate symbols found in symbols configuration");
		}

		// Check for required special symbols
		const hasWild = symbolValues.some(s => s.toUpperCase().includes("WILD"));
		const hasScatter = symbolValues.some(s => s.toUpperCase().includes("SCATTER"));
		
		if (!hasWild) {
			this.warnings.push("No WILD symbol found - consider adding for better gameplay");
		}

		if (!hasScatter) {
			this.warnings.push("No SCATTER symbol found - may affect feature triggers");
		}
	}

	/**
	 * Validate paytable against symbols
	 */
	validatePaytable(paytable, symbols) {
		if (!paytable) {
			this.errors.push("Paytable configuration is missing");
			return;
		}

		if (!symbols) {
			return; // Already handled in validateSymbols
		}

		// Get symbol values for validation
		let symbolValues = [];
		if (Array.isArray(symbols)) {
			symbolValues = symbols;
		} else if (typeof symbols === "object") {
			symbolValues = Object.values(symbols);
		}

		// Check that all symbols in paytable exist in symbols
		Object.keys(paytable).forEach(symbol => {
			if (!symbolValues.includes(symbol)) {
				this.errors.push(`Paytable contains symbol "${symbol}" not found in symbols configuration`);
			}
		});

		// Check paytable structure
		Object.entries(paytable).forEach(([symbol, pays]) => {
			if (!Array.isArray(pays) || pays.length === 0) {
				this.errors.push(`Paytable for symbol "${symbol}" must be a non-empty array`);
			} else {
				pays.forEach((pay, index) => {
					if (typeof pay !== "number" || pay < 0) {
						this.errors.push(`Paytable for symbol "${symbol}" at index ${index} must be a non-negative number`);
					}
				});
			}
		});
	}

	/**
	 * Validate reels against grid and symbols
	 */
	validateReels(reels, grid, symbols) {
		if (!Array.isArray(reels)) {
			this.errors.push("Reels configuration must be an array");
			return;
		}

		if (!grid || !symbols) {
			return; // Already handled in other validators
		}

		// Get symbol values for validation
		let symbolValues = [];
		if (Array.isArray(symbols)) {
			symbolValues = symbols;
		} else if (typeof symbols === "object") {
			symbolValues = Object.values(symbols);
		}

		if (reels.length !== grid.reels) {
			this.errors.push(`Number of reels (${reels.length}) doesn't match grid reels (${grid.reels})`);
		}

		reels.forEach((reel, index) => {
			if (!Array.isArray(reel)) {
				this.errors.push(`Reel ${index} must be an array`);
				return;
			}

			if (reel.length === 0) {
				this.errors.push(`Reel ${index} is empty`);
			}

			// Check that all symbols in reel exist in symbols configuration
			reel.forEach((symbol, pos) => {
				if (!symbolValues.includes(symbol)) {
					this.errors.push(`Reel ${index} position ${pos} contains unknown symbol "${symbol}"`);
				}
			});

			// Check reel length recommendations
			if (reel.length < 20) {
				this.warnings.push(`Reel ${index} has only ${reel.length} symbols - consider more for better randomness`);
			}
		});
	}

	/**
	 * Validate bet configuration
	 */
	validateBet(bet) {
		if (typeof bet !== "number" || bet <= 0) {
			this.errors.push("Bet must be a positive number");
		}
	}

	/**
	 * Validate free games configuration
	 */
	validateFreeGames(freeGames) {
		if (!freeGames) {
			this.warnings.push("Free games configuration is missing");
			return;
		}

		if (typeof freeGames.spins !== "number" || freeGames.spins <= 0) {
			this.errors.push("Free games spins must be a positive number");
		}

		if (typeof freeGames.retrigger !== "number" || freeGames.retrigger <= 0) {
			this.errors.push("Free games retrigger must be a positive number");
		}

		if (typeof freeGames.triggerScatters !== "number" || freeGames.triggerScatters <= 0) {
			this.errors.push("Free games triggerScatters must be a positive number");
		}

		// Multiplier is not used
	}

	/**
	 * Validate hold and spin configuration
	 */
	validateHoldAndSpin(holdAndSpin, grid) {
		if (!holdAndSpin) {
			this.warnings.push("Hold and spin configuration is missing");
			return;
		}

		if (typeof holdAndSpin.respins !== "number" || holdAndSpin.respins <= 0) {
			this.errors.push("Hold and spin respins must be a positive number");
		}

		if (typeof holdAndSpin.triggerCount !== "number" || holdAndSpin.triggerCount <= 0) {
			this.errors.push("Hold and spin triggerCount must be a positive number");
		}

		if (grid && holdAndSpin.triggerCount > (grid.reels * grid.rows)) {
			this.errors.push("Hold and spin triggerCount cannot exceed grid size");
		}

		if (!Array.isArray(holdAndSpin.creditValues) || holdAndSpin.creditValues.length === 0) {
			this.errors.push("Hold and spin creditValues must be a non-empty array");
		}

		if (!Array.isArray(holdAndSpin.creditWeights) || holdAndSpin.creditWeights.length === 0) {
			this.errors.push("Hold and spin creditWeights must be a non-empty array");
		}

		if (holdAndSpin.creditValues?.length !== holdAndSpin.creditWeights?.length) {
			this.errors.push("Hold and spin creditValues and creditWeights arrays must have same length");
		}
	}

	/**
	 * Validate progressives configuration
	 */
	validateProgressives(progressives) {
		if (!progressives) {
			this.warnings.push("Progressives configuration is missing");
			return;
		}

		if (progressives.meta && typeof progressives.meta !== "object") {
			this.errors.push("Progressives meta must be an object");
		}

		if (progressives.balances && typeof progressives.balances !== "object") {
			this.errors.push("Progressives balances must be an object");
		}
	}

	/**
	 * Add a custom validation rule
	 * @param {Function} validator - Custom validation function
	 * @param {string} name - Name of the validation rule
	 */
	addCustomRule(validator, name) {
		if (typeof validator !== "function") {
			throw new Error("Custom validator must be a function");
		}

		try {
			const result = validator();
			if (result && typeof result === "object") {
				if (result.errors) {
					this.errors.push(...result.errors);
				}
				if (result.warnings) {
					this.warnings.push(...result.warnings);
				}
			}
		} catch (error) {
			this.errors.push(`Custom validation rule "${name}" failed: ${error.message}`);
		}
	}

	/**
	 * Clear all validation results
	 */
	clear() {
		this.errors = [];
		this.warnings = [];
	}
}
