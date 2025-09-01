/* Simple stage rumble with easing. One target at a time. */
export class Rumble {
	constructor(target) {
		this.target = target;
		this.active = false;
		this.amp = 0;
		this.dur = 0;
		this.t0 = 0;
		this.baseX = 0;
		this.baseY = 0;
	}

	start(amplitude, durationMs) {
		if (!this.target) {
			return;
		}
		this.active = true;
		this.amp = Math.max(1, amplitude | 0);
		this.dur = Math.max(16, durationMs | 0);
		this.t0 = performance.now();
		this.baseX = this.target.x | 0;
		this.baseY = this.target.y | 0;
	}

	update() {
		if (!this.active) {
			return;
		}
		const t = (performance.now() - this.t0) / this.dur;
		if (t >= 1) {
			this.active = false;
			this.target.x = this.baseX;
			this.target.y = this.baseY;
			return;
		}
		const falloff = 1 - t;
		const a = this.amp * falloff;
		const ox = ((Math.random() * 2) - 1) * a;
		const oy = ((Math.random() * 2) - 1) * a;
		this.target.x = (this.baseX + ox) | 0;
		this.target.y = (this.baseY + oy) | 0;
	}
}
