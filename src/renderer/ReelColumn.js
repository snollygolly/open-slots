import { Container, Graphics, Text, TextStyle } from "pixi.js";

const symColors = {
	WILD: 0xffc107,
	SCATTER: 0x6ec1ff,
	ORB: 0xff5252,
	LANTERN: 0xff9800,
	COINS: 0xcddc39,
	COWBOY: 0x9c27b0,
	A: 0xffffff,
	K: 0xdedede,
	Q: 0xbdbdbd,
	J: 0x9e9e9e,
	T: 0x7e7e7e
};

const easeOutBack = (t) => {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + (c3 * ((t - 1) ** 3)) + (c1 * ((t - 1) ** 2));
};

export class ReelColumn {
	constructor(app, x, y, rows, cellW, cellH) {
		this.app = app;
		this.rows = rows;
		this.cellW = cellW;
		this.cellH = cellH;

		this.container = new Container();
		this.container.x = x;
		this.container.y = y;

		this.strip = new Container();
		this.container.addChild(this.strip);

		this.tiles = [];
		this.state = "idle";
		this.travel = 0;
		this.total = 0;
		this.stopExtra = 0;
		this.final3 = null;
		this._resolve = null;
		this._ticking = false;
		this._stopInit = false;
		this.stopStartY = 0;
		this.landStart = 0;

		this._onTick = (arg) => { this.onTick(arg); };
	}

	makeTile(sym) {
		const color = symColors[sym] || 0xffffff;

		const cell = new Graphics();
		cell.roundRect(0, 0, this.cellW - 16, this.cellH - 16, 14);
		cell.fill({ color, alpha: 0.92 });
		cell.stroke({ color: 0x031421, width: 4 });

		const label = new Text({
			text: sym,
			style: new TextStyle({ fill: "#031421", fontSize: 20, fontFamily: "system-ui", fontWeight: "700" })
		});
		label.anchor.set(0.5);
		label.x = (this.cellW - 16) / 2;
		label.y = (this.cellH - 16) / 2;

		const wrap = new Container();
		wrap.addChild(cell);
		wrap.addChild(label);
		return wrap;
	}

	setIdleColumn(visible3) {
		this.strip.removeChildren();
		this.tiles = [];

		// Pre-roll: 3 symbols above the window (reverse of visible)
		const pre = [];
		for (let i = 0; i < 3; i += 1) { pre.push(visible3[(3 - 1 - i)]); }

		// Build: pre (0..2), visible (3..5), duplicate visible for smooth scroll (6..8)
		const vals = [...pre, ...visible3, ...visible3];

		for (let i = 0; i < vals.length; i += 1) {
			const g = this.makeTile(vals[i]);
			g.x = 8;
			g.y = (i * this.cellH) + 8;
			this.strip.addChild(g);
			this.tiles.push(g);
		}

		// Position so the visible window starts at rows 3..5
		this.strip.y = -(this.cellH * 3);
	}

	spinTo(final3, loops, startDelayMs, extraStopMs) {
		return new Promise((resolve) => {
			const start = () => {
				this.state = "spin";
				this.travel = 0;
				this.total = ((loops * this.rows) + 3) * this.cellH;
				this.stopExtra = extraStopMs;
				this.final3 = final3;
				this._resolve = resolve;
				this._stopInit = false;
				if (!this._ticking) {
					this._ticking = true;
					this.app.ticker.add(this._onTick);
				}
			};
			if (startDelayMs > 0) { setTimeout(start, startDelayMs); } else { start(); }
		});
	}

	onTick(arg) {
		const dt = typeof arg === "number" ? arg : (arg && typeof arg.deltaTime === "number" ? arg.deltaTime : 1);

		if (this.state === "spin") {
			const base = 42;
			const t = Math.min(1, this.travel / this.total);
			const speed = base * (1 - (0.6 * t));

			this.travel += speed * dt;
			this.strip.y += speed * dt;

			while (this.strip.y >= 0) {
				this.strip.y -= this.cellH;
				this.shiftDown();
			}

			if (this.travel >= (this.total - (this.cellH * 3))) {
				this.state = "stop";
				this.injectLanding();
				this.landStart = performance.now();
			}
			return;
		}

		if (this.state === "stop") {
			if (!this._stopInit) {
				this._stopInit = true;
				this.stopStartY = this.strip.y;
			}
			const ms = 320 + this.stopExtra;
			const tt = Math.min(1, (performance.now() - this.landStart) / ms);
			const e = easeOutBack(tt);
			const target = -(this.cellH * 3);
			this.strip.y = this.stopStartY + ((target - this.stopStartY) * e);

			if (tt >= 1) {
				this.state = "idle";
				this.strip.y = target;

				const cb = this._resolve;
				this._resolve = null;
				this._ticking = false;
				this.app.ticker.remove(this._onTick);

				if (cb) { cb(); }
			}
			return;
		}
	}

	shiftDown() {
		for (let i = 0; i < this.tiles.length; i += 1) {
			this.tiles[i].y -= this.cellH;
		}
		const first = this.tiles.shift();
		first.y = this.tiles[this.tiles.length - 1].y + this.cellH;
		this.tiles.push(first);
	}

	injectLanding() {
		// ✅ Keep ONLY the top 3 pre-roll tiles (rows 0..2)
		const keep = this.tiles.slice(0, 3);

		// Rebuild the strip with the 3 pre tiles + the NEW final visible 3 tiles
		this.strip.removeChildren();
		this.tiles = [];

		// Re-add the pre tiles (y already set correctly)
		for (let i = 0; i < keep.length; i += 1) {
			this.strip.addChild(keep[i]);
			this.tiles.push(keep[i]);
		}

		// Add brand new symbols for rows 3..5 (the visible window after landing)
		for (let y = 0; y < this.rows; y += 1) {
			const g = this.makeTile(this.final3[y]);
			g.x = 8;
			g.y = ((3 + y) * this.cellH) + 8;
			this.strip.addChild(g);
			this.tiles.push(g);
		}
	}
}
