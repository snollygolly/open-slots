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

class Reel {
	constructor(app, x, y, rows, cellW, cellH, makeTile, id) {
		this.app = app;
		this.rows = rows;
		this.cellW = cellW;
		this.cellH = cellH;
		this.makeTile = makeTile;
		this.id = id;
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

	setIdleColumn(visible3) {
		this.strip.removeChildren();
		this.tiles = [];
		const pre = [];
		for (let i = 0; i < 3; i += 1) { pre.push(visible3[(3 - 1 - i)]); }
		const vals = [...pre, ...visible3, ...visible3];
		for (let i = 0; i < vals.length; i += 1) {
			const g = this.makeTile(vals[i]);
			g.x = 8;
			g.y = (i * this.cellH) + 8;
			this.strip.addChild(g);
			this.tiles.push(g);
		}
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
		const keep = this.tiles.slice(0, 6);
		this.strip.removeChildren();
		this.tiles = [];
		for (let i = 0; i < keep.length; i += 1) {
			this.strip.addChild(keep[i]);
			this.tiles.push(keep[i]);
		}
		for (let y = 0; y < this.rows; y += 1) {
			const g = this.makeTile(this.final3[y]);
			g.x = 8;
			g.y = ((3 + y) * this.cellH) + 8;
			this.strip.addChild(g);
			this.tiles.push(g);
		}
	}
}

export class PixiRenderer {
	constructor(app, engine) {
		this.app = app;
		this.engine = engine;
		this.stage = new Container();
		this.app.stage.addChild(this.stage);
		this.cellW = 200;
		this.cellH = 140;
		this.cols = 5;
		this.rows = 3;
		this.offsetX = 80;
		this.offsetY = 100;
		this.gridWindow = new Container();
		this.reelLayer = new Container();
		this.overlayLayer = new Container();
		this.winText = new Text({
			text: "",
			style: new TextStyle({ fill: "#fff", fontFamily: "system-ui", fontSize: 28, fontWeight: "700" })
		});
		this.stage.addChild(this.gridWindow);
		this.stage.addChild(this.reelLayer);
		this.stage.addChild(this.overlayLayer);
		this.stage.addChild(this.winText);
		this.winText.position.set(20, 20);
		this.drawFrame();
		this.makeMask();
		this.reels = [];
		for (let x = 0; x < this.cols; x += 1) {
			const reel = new Reel(
				this.app,
				this.offsetX + (x * this.cellW),
				this.offsetY,
				this.rows,
				this.cellW,
				this.cellH,
				(sym) => this.symbolTile(sym),
				x + 1
			);
			this.reelLayer.addChild(reel.container);
			this.reels.push(reel);
		}
		this._cycleTimer = null;
		this._cycleIndex = 0;
		this._cyclePaths = [];
		this._cycleDots = [];
		this._shade = null;
		const boot = this.engine.math.spinReels();
		for (let x = 0; x < this.cols; x += 1) {
			this.reels[x].setIdleColumn(boot[x]);
		}
	}

	renderMatrix(matrix) {
		for (let x = 0; x < this.cols; x += 1) {
			this.reels[x].setIdleColumn(matrix[x]);
		}
	}

	async playSpin() {
		this.resetWinVisuals();
		const result = await this.engine.spinOnce();
		const loops = [9, 10, 11, 12, 13];
		const startDelays = [0, 70, 140, 210, 280];
		const anticip = this.anticipationDelays(result);
		const tasks = [];
		for (let x = 0; x < this.cols; x += 1) {
			tasks.push(this.reels[x].spinTo(result.grid[x], loops[x], startDelays[x], anticip[x]));
		}
		await Promise.all(tasks);
		await this.flashWin(result.totalWin, result.feature);
		return result;
	}

	resetWinVisuals() {
		if (this._cycleTimer) {
			clearTimeout(this._cycleTimer);
			this._cycleTimer = null;
		}
		this._cycleIndex = 0;
		this._cyclePaths = [];
		this._cycleDots = [];
		this.overlayLayer.removeChildren();
		this._shade = null;
	}

	showWins(result) {
		this.resetWinVisuals();
		if (!result?.evaln?.waysDetail?.length) { return; }
		const matrix = result.grid;
		const wild = this.engine.config.symbols.WILD;
		const winners = [];
		const usedCells = new Set();
		for (let i = 0; i < result.evaln.waysDetail.length; i += 1) {
			const entry = result.evaln.waysDetail[i];
			const sym = entry.sym;
			const count = entry.count;
			const color = symColors[sym] || 0xffffff;
			const paths = this.enumerateWays(matrix, sym, wild, count);
			for (let p = 0; p < paths.length; p += 1) {
				winners.push({ color, path: paths[p] });
				for (let k = 0; k < paths[p].length; k += 1) {
					const pt = paths[p][k];
					usedCells.add(`${pt.x},${pt.y}`);
				}
			}
		}
		const shade = new Graphics();
		for (let x = 0; x < this.cols; x += 1) {
			for (let y = 0; y < this.rows; y += 1) {
				if (usedCells.has(`${x},${y}`)) { continue; }
				const rx = this.offsetX + (x * this.cellW) + 8;
				const ry = this.offsetY + (y * this.cellH) + 8;
				shade.roundRect(rx, ry, this.cellW - 16, this.cellH - 16, 14);
			}
		}
		shade.fill({ color: 0x000000, alpha: 0.45 });
		this.overlayLayer.addChild(shade);
		this._shade = shade;
		this._cyclePaths = winners;
		this._cycleIndex = 0;
		this.advanceWinCycle();
	}

	advanceWinCycle() {
		if (!this._cyclePaths.length) { return; }
		for (let i = 0; i < this._cycleDots.length; i += 1) {
			if (this._cycleDots[i]?.parent) { this._cycleDots[i].parent.removeChild(this._cycleDots[i]); }
		}
		this._cycleDots = [];
		if (this._currentLine && this._currentLine.parent) {
			this._currentLine.parent.removeChild(this._currentLine);
		}
		const w = this._cyclePaths[this._cycleIndex];
		const g = this.drawPath(w.path, w.color);
		this._currentLine = g;
		for (let k = 0; k < w.path.length; k += 1) {
			const pt = w.path[k];
			const dot = this.dotAt(pt.x, pt.y, w.color);
			this.overlayLayer.addChild(dot);
			this.animatePulseIn(dot, 380);
			this._cycleDots.push(dot);
		}
		this._cycleIndex = (this._cycleIndex + 1) % this._cyclePaths.length;
		this._cycleTimer = setTimeout(() => this.advanceWinCycle(), 650);
	}

	enumerateWays(matrix, sym, wild, count) {
		const rows = this.rows;
		const cols = count;
		const matchesInCol = [];
		for (let x = 0; x < cols; x += 1) {
			const arr = [];
			for (let y = 0; y < rows; y += 1) {
				const v = matrix[x][y];
				if (v === sym || v === wild) { arr.push({ x, y }); }
			}
			if (arr.length === 0) { return []; }
			matchesInCol.push(arr);
		}
		const paths = [];
		const cur = [];
		const dfs = (c) => {
			if (c === cols) {
				paths.push(cur.slice(0));
				return;
			}
			const options = matchesInCol[c];
			for (let i = 0; i < options.length; i += 1) {
				cur.push(options[i]);
				dfs(c + 1);
				cur.pop();
			}
		};
		dfs(0);
		return paths;
	}

	drawPath(points, color) {
		const g = new Graphics();
		const c = this.cellCenter(points[0].x, points[0].y);
		g.moveTo(c.x, c.y);
		for (let i = 1; i < points.length; i += 1) {
			const p = this.cellCenter(points[i].x, points[i].y);
			g.lineTo(p.x, p.y);
		}
		g.stroke({ color, width: 6, alpha: 1, join: "round", cap: "round" });
		this.overlayLayer.addChild(g);
		this.animatePathReveal(g, 260);
		return g;
	}

	cellCenter(col, row) {
		const x = this.offsetX + (col * this.cellW) + (this.cellW / 2);
		const y = this.offsetY + (row * this.cellH) + (this.cellH / 2);
		return { x, y };
	}

	dotAt(col, row, color) {
		const c = this.cellCenter(col, row);
		const g = new Graphics();
		g.circle(c.x, c.y, 14);
		g.fill({ color, alpha: 0.95 });
		const inner = new Graphics();
		inner.circle(c.x, c.y, 6);
		inner.fill({ color: 0x031421, alpha: 0.9 });
		const wrap = new Container();
		wrap.addChild(g);
		wrap.addChild(inner);
		return wrap;
	}

	animatePathReveal(g, ms) {
		const start = performance.now();
		const total = ms;
		const baseAlpha = 1;
		const tick = () => {
			const t = Math.min(1, (performance.now() - start) / total);
			g.alpha = baseAlpha * (0.6 + (0.4 * t));
			if (t < 1) {
				this.app.ticker.addOnce(tick);
			}
		};
		this.app.ticker.addOnce(tick);
	}

	animatePulseIn(displayObject, ms) {
		const start = performance.now();
		const tick = () => {
			const t = Math.min(1, (performance.now() - start) / ms);
			const pulse = 0.5 + (0.5 * Math.cos(t * Math.PI * 2));
			displayObject.alpha = Math.min(1, t * 1.2);
			displayObject.scale.set(1 + (0.06 * pulse));
			if (t < 1) {
				this.app.ticker.addOnce(tick);
			} else {
				this.animateFadeOut(displayObject, 260);
			}
		};
		this.app.ticker.addOnce(tick);
	}

	animateFadeOut(displayObject, ms) {
		const start = performance.now();
		const baseScale = displayObject.scale.x || 1;
		const tick = () => {
			const t = Math.min(1, (performance.now() - start) / ms);
			displayObject.alpha = 1 - (t * 0.9);
			displayObject.scale.set(baseScale + (0.02 * t));
			if (t < 1) {
				this.app.ticker.addOnce(tick);
			} else {
				displayObject.removeFromParent();
			}
		};
		this.app.ticker.addOnce(tick);
	}

	anticipationDelays(result) {
		const hsNeed = this.engine.config.holdAndSpin.triggerCount;
		const fgNeed = this.engine.config.freeGames.triggerScatters;
		const arr = [0, 0, 0, 0, 0];
		let orbsSeen = 0;
		let scattersSeen = 0;
		for (let x = 0; x < this.cols; x += 1) {
			for (let y = 0; y < this.rows; y += 1) {
				const v = result.grid[x][y];
				if (v === "ORB") { orbsSeen += 1; }
				if (v === "SCATTER") { scattersSeen += 1; }
			}
			if (x < 4) {
				if (orbsSeen >= (hsNeed - 1)) { arr[x + 1] += 250; }
				if (fgNeed === 3 && scattersSeen >= 2) { arr[x + 1] += 250; }
			}
		}
		return arr;
	}

	drawFrame() {
		const g = new Graphics();
		g.roundRect(this.offsetX - 10, this.offsetY - 10, this.cellW * 5 + 20, this.cellH * 3 + 20, 16);
		g.fill({ color: 0x0d223a, alpha: 1 });
		g.stroke({ color: 0x00e1ff, width: 4 });
		this.gridWindow.addChild(g);
	}

	makeMask() {
		const mask = new Graphics();
		mask.rect(this.offsetX, this.offsetY, this.cellW * 5, this.cellH * 3);
		mask.fill({ color: 0xffffff, alpha: 1 });
		this.reelLayer.mask = mask;
		this.overlayLayer.mask = mask;
		this.stage.addChild(mask);
	}

	symbolTile(sym) {
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

	async flashWin(win, feature) {
		this.winText.text = feature ? `${feature}  Win ${win}` : `Win ${win}`;
		await new Promise((res) => { setTimeout(res, 380); });
	}
}
