import { Container, Graphics, Text, TextStyle, Sprite } from "pixi.js";
import { getSymbolUrl, getSymbolTexture } from "./SymbolTextures.js";
import { Assets } from "pixi.js";
import { OrbSymbol } from "./OrbSymbol.js";

const symColors = {
	WILD: 0xffc107,
	SCATTER: 0x6ec1ff,
	ORB: 0xff5252,
	LANTERN: 0xff9800,
	FROG: 0xcddc39,
	GATOR: 0x9c27b0,
	LILY: 0x4db6ac,
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
	/**
	 * @param {PIXI.Application} app
	 * @param {number} x
	 * @param {number} y
	 * @param {number} rows
	 * @param {number} cellW
	 * @param {number} cellH
	 * @param {Object} [opts]
	 * @param {Array<string>} [opts.strip] - Underlying reel strip symbols for this column
	 * @param {Function} [opts.rngFn] - RNG function to use for transient visuals
	 * @param {Object} [opts.holdAndSpin] - H&S config (creditValues/weights, jackpotChancesPerOrb, jackpotWeights)
	 */
	constructor(app, x, y, rows, cellW, cellH, opts = {}) {
		this.app = app;
		this.rows = rows;
		this.cellW = cellW;
		this.cellH = cellH;

		// Visual-only spinning data
		this.stripSymbols = Array.isArray(opts.strip) ? opts.strip.slice() : null;
		this.stripIndex = Math.floor(Math.random() * (this.stripSymbols?.length || 1));
		this.rngFn = typeof opts.rngFn === 'function' ? opts.rngFn : Math.random;
		this.hsCfg = opts.holdAndSpin || {};
		// Per-cell lock scaffold (unused for base game; future Hold&Spin)
		this.lockMask = [false, false, false];
		// Unified orb system - no separate label management needed

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

	setLockMask(mask) {
		if (Array.isArray(mask) && mask.length >= this.rows) {
			this.lockMask = [!!mask[0], !!mask[1], !!mask[2]];
		}
	}

	_nextStripSymbol() {
		if (!this.stripSymbols || this.stripSymbols.length === 0) { return null; }
		const v = this.stripSymbols[this.stripIndex % this.stripSymbols.length];
		this.stripIndex = (this.stripIndex + 1) % this.stripSymbols.length;
		return v;
	}


	// Set the column index for orb item lookup
	setColumnIndex(index) {
		this.columnIndex = index;
	}

	_createTileWithOrbData(sym, orbItem = null) {
		// For ORB symbols, use specific orb data if provided
		if (sym === "ORB") {
			const orbSymbol = new OrbSymbol(this.cellW, this.cellH, orbItem, this.hsCfg, this.rngFn);
			orbSymbol._sym = sym;
			return orbSymbol;
		}
		
		// For non-ORB symbols, use the existing logic
		const wrap = this.makeTile(sym);
		wrap._sym = sym;
		return wrap;
	}

	_createTile(sym) {
		// For ORB symbols, use the unified OrbSymbol class
		if (sym === "ORB") {
			const orbSymbol = new OrbSymbol(this.cellW, this.cellH, null, this.hsCfg, this.rngFn);
			orbSymbol._sym = sym;
			return orbSymbol;
		}
		
		// For non-ORB symbols, use the existing logic
		const wrap = this.makeTile(sym);
		wrap._sym = sym;
		return wrap;
	}


	// Get the orb item data for a visible row (if it's an OrbSymbol)
	getVisibleOrbItem(row) {
		if (row < 0 || row >= this.rows) { return null; }
		const idx = 3 + row;
		const t = this.tiles[idx];
		if (!t || t._sym !== 'ORB' || typeof t.getOrbItem !== 'function') { return null; }
		return t.getOrbItem();
	}

	makeTile(sym) {
		// Try to use sprite art for this symbol
		const url = getSymbolUrl(sym);
		const wrap = new Container();
		const maxW = this.cellW - 16;
		const maxH = this.cellH - 16;

		const existing = getSymbolTexture(sym);
		if (existing) {
			const sprite = new Sprite(existing);
			sprite.anchor.set(0.5);
			sprite.x = maxW / 2;
			sprite.y = maxH / 2;
			const natW = sprite.texture.width || 1;
			const natH = sprite.texture.height || 1;
			const scale = Math.min(maxW / natW, maxH / natH);
			sprite.scale.set(scale, scale);
			wrap.addChild(sprite);
		} else if (url) {
			// Lazy-load via Assets and attach once ready
			const sprite = new Sprite();
			sprite.visible = false;
			wrap.addChild(sprite);
			Assets.load({ src: url, alias: url }).then((tex) => {
				sprite.texture = tex;
				sprite.visible = true;
				sprite.anchor.set(0.5);
				sprite.x = maxW / 2;
				sprite.y = maxH / 2;
				const natW = tex.width || 1;
				const natH = tex.height || 1;
				const scale = Math.min(maxW / natW, maxH / natH);
				sprite.scale.set(scale, scale);
			}).catch(() => { /* ignore */ });
		} else {
			// Fallback: simple colored tile with label
			const color = symColors[sym] || 0xffffff;
			const cell = new Graphics();
			cell.roundRect(0, 0, this.cellW - 16, this.cellH - 16, 14);
			cell.fill({ color, alpha: 0.92 });
			cell.stroke({ color: 0x031421, width: 4 });
			wrap.addChild(cell);
			// For fallback tiles, do not add an empty label for ORB — it hides value labels.
			if (sym !== "ORB") {
				const label = new Text({
					text: sym,
					style: new TextStyle({ fill: "#031421", fontSize: 20, fontFamily: "system-ui", fontWeight: "700" })
				});
				label.anchor.set(0.5);
				label.x = (this.cellW - 16) / 2;
				label.y = (this.cellH - 16) / 2;
				wrap.addChild(label);
			}
		}

		return wrap;
	}

	setIdleColumn(visible3, orbItems = []) {
		this.strip.removeChildren();
		this.tiles = [];

		// Pre-roll: 3 symbols above the window (reverse of visible)
		const pre = [];
		for (let i = 0; i < 3; i += 1) { pre.push(visible3[(3 - 1 - i)]); }

		// Build: pre (0..2), visible (3..5), duplicate visible for smooth scroll (6..8)
		const vals = [...pre, ...visible3, ...visible3];

		for (let i = 0; i < vals.length; i += 1) {
			// For visible window positions (3..5), use specific orb data if available
			let orbItem = null;
			if (i >= 3 && i < 6 && vals[i] === 'ORB') {
				const row = i - 3;
				orbItem = orbItems.find(item => item.x === this.columnIndex && item.y === row);
			}
			const g = this._createTileWithOrbData(vals[i], orbItem);
			g.x = 8;
			g.y = (i * this.cellH) + 8;
			this.strip.addChild(g);
			this.tiles.push(g);
		}

		// Position so the visible window starts at rows 3..5
		this.strip.y = -(this.cellH * 3);
	}

	spinTo(final3, loops, startDelayMs, extraStopMs, orbItems = []) {
		return new Promise((resolve) => {
			const start = () => {
				this.state = "spin";
				this.travel = 0;
				this.total = ((loops * this.rows) + 3) * this.cellH;
				this.stopExtra = extraStopMs;
				this.final3 = final3;
				this.finalOrbItems = orbItems;
				this._resolve = resolve;
				this._stopInit = false;
				// ORB symbols now handle their own values automatically - no additional setup needed
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

			// With OrbSymbol, values are always consistent - no need for complex label management

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
		// Move all tiles up by one cell
		for (let i = 0; i < this.tiles.length; i += 1) {
			this.tiles[i].y -= this.cellH;
		}
		// Remove the topmost tile from container and array
		const first = this.tiles.shift();
		if (first && first.parent) { first.parent.removeChild(first); }
		// Determine next symbol for the bottom insertion
		const sym = this._nextStripSymbol() || first?._sym || "A";
		const g = this._createTile(sym);
		g.x = 8;
		g.y = this.tiles[this.tiles.length - 1].y + this.cellH;
		this.strip.addChild(g);
		this.tiles.push(g);
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
			// Respect lock mask if ever enabled (future use)
			if (this.lockMask[y] && keep[3 + y]) {
				this.strip.addChild(keep[3 + y]);
				this.tiles.push(keep[3 + y]);
				continue;
			}
			// Create tile with specific orb data if available
			let orbItem = null;
			if (this.final3[y] === 'ORB') {
				orbItem = this.finalOrbItems?.find(item => item.x === this.columnIndex && item.y === y);
			}
			const g = this._createTileWithOrbData(this.final3[y], orbItem);
			g.x = 8;
			g.y = ((3 + y) * this.cellH) + 8;
			this.strip.addChild(g);
			this.tiles.push(g);
		}
	}
}
