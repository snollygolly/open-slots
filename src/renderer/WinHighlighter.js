import { Container, Graphics } from "pixi.js";

// Force a single highlight color for all wins (red)
const HIGHLIGHT_COLOR = 0xff0000;
// Make the line 25% thicker than previous 6px
const STROKE_WIDTH = 6 * 1.25; // 7.5px

/**
 * Renders winning paths and subtle shading over non-used cells.
 * Also cycles through each winning path to highlight them one at a time.
 */
export class WinHighlighter {
  /**
   * @param {import('pixi.js').Application} app - PIXI application for timing/helpers
   * @param {import('pixi.js').Container} layer - Display layer to draw highlights into
   * @param {number} offsetX - Left pixel offset of the grid
   * @param {number} offsetY - Top pixel offset of the grid
   * @param {number} cellW - Cell width in pixels
   * @param {number} cellH - Cell height in pixels
   * @param {number} cols - Number of columns (reels)
   * @param {number} rows - Number of rows
   * @param {Record<string,string>} symbols - Symbol mapping from config
   */
  constructor(app, layer, offsetX, offsetY, cellW, cellH, cols, rows, symbols) {
    this.layer = layer;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.cellW = cellW;
    this.cellH = cellH;
    this.cols = cols;
    this.rows = rows;
    this.symbols = symbols;

    this._cyclePaths = [];
    this._cycleDots = [];
    this._cycleIndex = 0;
    this._currentLine = null;
    this._timer = null;
  }

  /**
   * Clear all highlight drawings and timers.
   */
  reset() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.layer.removeChildren();
    this._cyclePaths = [];
    this._cycleDots = [];
    this._cycleIndex = 0;
    this._currentLine = null;
  }

  /**
   * Compute small anticipation delays per reel to build suspense when near features.
   * Returns an array of length = cols with millisecond delays to add for each reel.
   *
   * - Adds delay next reel when orbs are one short of Hold & Spin trigger.
   * - Adds delay next reel when scatters are 2 and trigger is 3.
   *
   * @param {Object} result - Spin result with `grid`
   * @param {Object} config - Game config with `holdAndSpin` and `freeGames`
   * @returns {number[]}
   */
  anticipationDelays(result, config) {
    const hsNeed = config.holdAndSpin.triggerCount;
    const fgNeed = config.freeGames.triggerScatters;
    const delays = [0, 0, 0, 0, 0];
    let orbsSeen = 0;
    let scattersSeen = 0;

    for (let x = 0; x < this.cols; x += 1) {
      for (let y = 0; y < this.rows; y += 1) {
        const v = result.grid[x][y];
        if (v === "ORB") { orbsSeen += 1; }
        if (v === "SCATTER") { scattersSeen += 1; }
      }
      // Only add anticipation for upcoming reels
      if (x < this.cols - 1) {
        if (orbsSeen >= (hsNeed - 1)) { delays[x + 1] += 250; }
        if (fgNeed === 3 && scattersSeen >= 2) { delays[x + 1] += 250; }
      }
    }
    return delays;
  }

  /**
   * Show all winning ways as cycling highlighted paths with dots on used cells.
   * Adds a dim shade over cells that are not part of any win path.
   *
   * @param {Object} result - Spin result with `grid` and `evaln.waysDetail`
   */
  showPaths(result) {
    this.reset();
    if (!result?.evaln?.waysDetail?.length) { return; }

    const matrix = result.grid;
    const wild = this.symbols.WILD;
    const winners = [];
    const usedCells = new Set();

    for (let i = 0; i < result.evaln.waysDetail.length; i += 1) {
      const entry = result.evaln.waysDetail[i];
      const sym = entry.sym;
      const count = entry.count;
      const color = HIGHLIGHT_COLOR;
      const paths = this.enumerateWays(matrix, sym, wild, count);
      for (let p = 0; p < paths.length; p += 1) {
        winners.push({ color, path: paths[p] });
        for (let k = 0; k < paths[p].length; k += 1) {
          const pt = paths[p][k];
          usedCells.add(`${pt.x},${pt.y}`);
        }
      }
    }

    // Draw dim shade over cells not used by any winning path
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
    this.layer.addChild(shade);

    this._cyclePaths = winners;
    this._cycleIndex = 0;
    this.advanceCycle();
  }

  /**
   * Cycle to the next winning path (line + dots) and schedule the next cycle.
   */
  advanceCycle() {
    if (!this._cyclePaths.length) { return; }

    // Remove previous dots and line
    for (let i = 0; i < this._cycleDots.length; i += 1) {
      const d = this._cycleDots[i];
      if (d?.parent) { d.parent.removeChild(d); }
    }
    this._cycleDots = [];
    if (this._currentLine && this._currentLine.parent) {
      this._currentLine.parent.removeChild(this._currentLine);
    }

    // Draw new line and dots
    const w = this._cyclePaths[this._cycleIndex];
    const g = this.drawPath(w.path, w.color);
    this._currentLine = g;
    for (let k = 0; k < w.path.length; k += 1) {
      const pt = w.path[k];
      const dot = this.dotAt(pt.x, pt.y, w.color);
      this.layer.addChild(dot);
      this._cycleDots.push(dot);
    }

    // Schedule next
    this._cycleIndex = (this._cycleIndex + 1) % this._cyclePaths.length;
    this._timer = setTimeout(() => this.advanceCycle(), 650);
  }

  /**
   * Enumerate all winning paths for a symbol across the first N reels.
   * Uses DFS across columns 0..count-1 where a cell matches sym or wild.
   *
   * @param {string[][]} matrix - Grid matrix [col][row]
   * @param {string} sym - Target symbol
   * @param {string} wild - Wild symbol key
   * @param {number} count - Required consecutive reels
   * @returns {{x:number,y:number}[][]}
   */
  enumerateWays(matrix, sym, wild, count) {
    const matchesInCol = [];
    for (let x = 0; x < count; x += 1) {
      const arr = [];
      for (let y = 0; y < this.rows; y += 1) {
        const v = matrix[x][y];
        if (v === sym || v === wild) { arr.push({ x, y }); }
      }
      if (arr.length === 0) { return []; }
      matchesInCol.push(arr);
    }

    const paths = [];
    const cur = [];
    const dfs = (c) => {
      if (c === count) {
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

  /**
   * Draw a single polyline across cell centers.
   * @param {{x:number,y:number}[]} points
   * @param {number} color - Hex color
   * @returns {import('pixi.js').Graphics}
   */
  drawPath(points, color) {
    const g = new Graphics();
    const c0 = this.center(points[0].x, points[0].y);
    g.moveTo(c0.x, c0.y);
    for (let i = 1; i < points.length; i += 1) {
      const p = this.center(points[i].x, points[i].y);
      g.lineTo(p.x, p.y);
    }
    // Always use the unified highlight color and thicker width
    g.stroke({ color: HIGHLIGHT_COLOR, width: STROKE_WIDTH, alpha: 1, join: "round", cap: "round" });
    this.layer.addChild(g);
    return g;
  }

  /**
   * Get pixel center of a cell.
   * @param {number} col
   * @param {number} row
   * @returns {{x:number,y:number}}
   */
  center(col, row) {
    const x = this.offsetX + (col * this.cellW) + (this.cellW / 2);
    const y = this.offsetY + (row * this.cellH) + (this.cellH / 2);
    return { x, y };
  }

  /**
   * Create a dot graphic at a cell center with an inner core.
   * @param {number} col
   * @param {number} row
   * @param {number} color - Hex color
   * @returns {import('pixi.js').Container}
   */
  dotAt(col, row, color) {
    const c = this.center(col, row);
    const outer = new Graphics();
    outer.circle(c.x, c.y, 14);
    outer.fill({ color, alpha: 0.95 });

    const inner = new Graphics();
    inner.circle(c.x, c.y, 6);
    inner.fill({ color: 0x031421, alpha: 0.9 });

    const wrap = new Container();
    wrap.addChild(outer);
    wrap.addChild(inner);
    return wrap;
  }
}
