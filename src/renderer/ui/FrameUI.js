import { Container, Graphics } from "pixi.js";

export class FrameUI {
	constructor(offsetX, offsetY, cellW, cellH, cols, rows) {
		this.offsetX = offsetX;
		this.offsetY = offsetY;
		this.cellW = cellW;
		this.cellH = cellH;
		this.cols = cols;
		this.rows = rows;

		this.container = new Container();
		this.container.sortableChildren = true;

		this.drawFrame();
		this.makeMask();
	}

	drawFrame() {
		// Background panel (subtle — sits BEHIND reels)
		const bg = new Graphics();
		bg.roundRect(
			this.offsetX - 10,
			this.offsetY - 10,
			(this.cellW * this.cols) + 20,
			(this.cellH * this.rows) + 20,
			16
		);
		// Slightly translucent so it won't feel like a hard cover even if layering changes
		bg.fill({ color: 0x0d223a, alpha: 0.7 });
		bg.stroke({ color: 0x00e1ff, width: 4 });
		bg.zIndex = 0;
		this.container.addChild(bg);
	}

	makeMask() {
		// Shared rectangular mask for reels + overlays
		this.mask = new Graphics();
		this.mask.rect(
			this.offsetX,
			this.offsetY,
			this.cellW * this.cols,
			this.cellH * this.rows
		);
		this.mask.fill({ color: 0xffffff, alpha: 1 });
		this.mask.zIndex = 1; // above bg in the container, but used only as a mask
		this.container.addChild(this.mask);
	}

	applyMask(layer) {
		layer.mask = this.mask;
	}
}
