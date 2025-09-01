/**
 * Centralized logging utility with level control and formatting.
 * Provides consistent logging throughout the application.
 */
export class Logger {
	static LEVELS = {
		DEBUG: 0,
		INFO: 1,
		WARN: 2,
		ERROR: 3,
		OFF: 99
	};

	constructor(name = "App", level = Logger.LEVELS.INFO) {
		this.name = name;
		this.level = level;
		this.startTime = performance.now();
	}

	/**
	 * Set the logging level
	 * @param {number} level - Logging level from Logger.LEVELS
	 */
	setLevel(level) {
		this.level = level;
	}

	/**
	 * Check if a level should be logged
	 * @param {number} level - Level to check
	 * @returns {boolean}
	 */
	shouldLog(level) {
		return level >= this.level;
	}

	/**
	 * Format log message with timestamp and level
	 * @param {string} level - Log level name
	 * @param {string} message - Log message
	 * @param {Array} args - Additional arguments
	 * @returns {Array} Formatted log arguments
	 */
	format(level, message, ...args) {
		const timestamp = ((performance.now() - this.startTime) / 1000).toFixed(3);
		const prefix = `[${timestamp}s][${this.name}][${level}]`;
		return [prefix, message, ...args];
	}

	/**
	 * Log debug message
	 * @param {string} message - Message to log
	 * @param {...any} args - Additional arguments
	 */
	debug(message, ...args) {
		if (this.shouldLog(Logger.LEVELS.DEBUG)) {
			console.debug(...this.format("DEBUG", message, ...args));
		}
	}

	/**
	 * Log info message
	 * @param {string} message - Message to log
	 * @param {...any} args - Additional arguments
	 */
	info(message, ...args) {
		if (this.shouldLog(Logger.LEVELS.INFO)) {
			console.log(...this.format("INFO", message, ...args));
		}
	}

	/**
	 * Log warning message
	 * @param {string} message - Message to log
	 * @param {...any} args - Additional arguments
	 */
	warn(message, ...args) {
		if (this.shouldLog(Logger.LEVELS.WARN)) {
			console.warn(...this.format("WARN", message, ...args));
		}
	}

	/**
	 * Log error message
	 * @param {string} message - Message to log
	 * @param {...any} args - Additional arguments
	 */
	error(message, ...args) {
		if (this.shouldLog(Logger.LEVELS.ERROR)) {
			console.error(...this.format("ERROR", message, ...args));
		}
	}

	/**
	 * Log with custom level
	 * @param {number} level - Log level
	 * @param {string} message - Message to log
	 * @param {...any} args - Additional arguments
	 */
	log(level, message, ...args) {
		if (this.shouldLog(level)) {
			const levelName = Object.keys(Logger.LEVELS).find(
				key => Logger.LEVELS[key] === level
			) || "UNKNOWN";
			
			const method = level >= Logger.LEVELS.ERROR ? "error" :
						  level >= Logger.LEVELS.WARN ? "warn" :
						  level >= Logger.LEVELS.INFO ? "log" : "debug";
			
			console[method](...this.format(levelName, message, ...args));
		}
	}

	/**
	 * Time a function execution
	 * @param {string} label - Timer label
	 * @param {Function} fn - Function to time
	 * @returns {*} Function result
	 */
	async time(label, fn) {
		const start = performance.now();
		this.debug(`Starting ${label}`);
		
		try {
			const result = await fn();
			const duration = performance.now() - start;
			this.debug(`Completed ${label} in ${duration.toFixed(3)}ms`);
			return result;
		} catch (error) {
			const duration = performance.now() - start;
			this.error(`Failed ${label} after ${duration.toFixed(3)}ms:`, error);
			throw error;
		}
	}
}

// Create default loggers for common components
export const gameLogger = new Logger("Game");
export const renderLogger = new Logger("Renderer");
export const featureLogger = new Logger("Features");
export const effectsLogger = new Logger("Effects");

// Global log function for quick logging
export function log(level, message, ...args) {
	const logger = new Logger();
	logger.log(level, message, ...args);
}

// Convenience functions
export const debug = (message, ...args) => log(Logger.LEVELS.DEBUG, message, ...args);
export const info = (message, ...args) => log(Logger.LEVELS.INFO, message, ...args);
export const warn = (message, ...args) => log(Logger.LEVELS.WARN, message, ...args);
export const error = (message, ...args) => log(Logger.LEVELS.ERROR, message, ...args);