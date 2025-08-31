import { EventBus } from "../core/EventBus.js";
export class FreeGames extends EventBus {
	constructor(config) { super(); this.cfg = config.freeGames; this.remaining = 0; }
	trigger() { this.remaining += this.remaining > 0 ? this.cfg.retrigger : this.cfg.spins; this.emit("change", this.remaining); return this.remaining; }
	consume() { if (this.remaining <= 0) { return 0; } this.remaining -= 1; this.emit("change", this.remaining); return this.remaining; }
	isActive() { return this.remaining > 0; }
}
