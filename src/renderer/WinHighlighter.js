import { Container, Graphics } from "pixi.js";
const symColors = { WILD: 0xffc107, SCATTER: 0x6ec1ff, ORB: 0xff5252, LANTERN: 0xff9800, COINS: 0xcddc39, COWBOY: 0x9c27b0, A: 0xffffff, K: 0xdedede, Q: 0xbdbdbd, J: 0x9e9e9e, T: 0x7e7e7e };
export class WinHighlighter {
	constructor(app, layer, offsetX, offsetY, cellW, cellH, cols, rows, symbols) {
		this.app = app; this.layer = layer; this.offsetX = offsetX; this.offsetY = offsetY; this.cellW = cellW; this.cellH = cellH; this.cols = cols; this.rows = rows; this.symbols = symbols;
		this._shade = null; this._cyclePaths = []; this._cycleDots = []; this._cycleIndex = 0; this._timer = null;
	}
	reset() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } this.layer.removeChildren(); this._shade = null; this._cyclePaths = []; this._cycleDots = []; this._cycleIndex = 0; }
	anticipationDelays(result, config) {
		const hsNeed = config.holdAndSpin.triggerCount; const fgNeed = config.freeGames.triggerScatters; const arr = [0, 0, 0, 0, 0]; let orbsSeen = 0; let scattersSeen = 0;
		for (let x = 0; x < this.cols; x += 1) { for (let y = 0; y < this.rows; y += 1) { const v = result.grid[x][y]; if (v === "ORB") { orbsSeen += 1; } if (v === "SCATTER") { scattersSeen += 1; } }
			if (x < 4) { if (orbsSeen >= (hsNeed - 1)) { arr[x + 1] += 250; } if (fgNeed === 3 && scattersSeen >= 2) { arr[x + 1] += 250; } } }
		return arr;
	}
	showPaths(result) {
		this.reset(); if (!result?.evaln?.waysDetail?.length) { return; }
		const matrix = result.grid; const wild = this.symbols.WILD; const winners = []; const usedCells = new Set();
		for (let i = 0; i < result.evaln.waysDetail.length; i += 1) { const entry = result.evaln.waysDetail[i]; const sym = entry.sym; const count = entry.count; const color = symColors[sym] || 0xffffff; const paths = this.enumerateWays(matrix, sym, wild, count);
			for (let p = 0; p < paths.length; p += 1) { winners.push({ color, path: paths[p] }); for (let k = 0; k < paths[p].length; k += 1) { const pt = paths[p][k]; usedCells.add(`${pt.x},${pt.y}`); } } }
		const shade = new Graphics(); for (let x = 0; x < this.cols; x += 1) { for (let y = 0; y < this.rows; y += 1) { if (usedCells.has(`${x},${y}`)) { continue; } const rx = this.offsetX + (x * this.cellW) + 8; const ry = this.offsetY + (y * this.cellH) + 8; shade.roundRect(rx, ry, this.cellW - 16, this.cellH - 16, 14); } }
		shade.fill({ color: 0x000000, alpha: 0.45 }); this.layer.addChild(shade); this._shade = shade; this._cyclePaths = winners; this._cycleIndex = 0; this.advanceCycle();
	}
	advanceCycle() {
		if (!this._cyclePaths.length) { return; }
		for (let i = 0; i < this._cycleDots.length; i += 1) { if (this._cycleDots[i]?.parent) { this._cycleDots[i].parent.removeChild(this._cycleDots[i]); } }
		this._cycleDots = []; if (this._currentLine && this._currentLine.parent) { this._currentLine.parent.removeChild(this._currentLine); }
		const w = this._cyclePaths[this._cycleIndex]; const g = this.drawPath(w.path, w.color); this._currentLine = g;
		for (let k = 0; k < w.path.length; k += 1) { const pt = w.path[k]; const dot = this.dotAt(pt.x, pt.y, w.color); this.layer.addChild(dot); this._cycleDots.push(dot); }
		this._cycleIndex = (this._cycleIndex + 1) % this._cyclePaths.length; this._timer = setTimeout(() => this.advanceCycle(), 650);
	}
	enumerateWays(matrix, sym, wild, count) {
		const matchesInCol = []; for (let x = 0; x < count; x += 1) { const arr = []; for (let y = 0; y < this.rows; y += 1) { const v = matrix[x][y]; if (v === sym || v === wild) { arr.push({ x, y }); } } if (arr.length === 0) { return []; } matchesInCol.push(arr); }
		const paths = []; const cur = []; const dfs = (c) => { if (c === count) { paths.push(cur.slice(0)); return; } const options = matchesInCol[c]; for (let i = 0; i < options.length; i += 1) { cur.push(options[i]); dfs(c + 1); cur.pop(); } }; dfs(0); return paths;
	}
	drawPath(points, color) {
		const g = new Graphics(); const c = this.center(points[0].x, points[0].y); g.moveTo(c.x, c.y);
		for (let i = 1; i < points.length; i += 1) { const p = this.center(points[i].x, points[i].y); g.lineTo(p.x, p.y); }
		g.stroke({ color, width: 6, alpha: 1, join: "round", cap: "round" }); this.layer.addChild(g); return g;
	}
	center(col, row) { const x = this.offsetX + (col * this.cellW) + (this.cellW / 2); const y = this.offsetY + (row * this.cellH) + (this.cellH / 2); return { x, y }; }
	dotAt(col, row, color) { const c = this.center(col, row); const g = new Graphics(); g.circle(c.x, c.y, 14); g.fill({ color, alpha: 0.95 }); const inner = new Graphics(); inner.circle(c.x, c.y, 6); inner.fill({ color: 0x031421, alpha: 0.9 }); const wrap = new Container(); wrap.addChild(g); wrap.addChild(inner); return wrap; }
}
