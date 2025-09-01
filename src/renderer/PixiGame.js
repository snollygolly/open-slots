import { Container, Text, TextStyle } from "pixi.js";
import { ReelColumn } from "./ReelColumn.js";
import { WinHighlighter } from "./WinHighlighter.js";
import { FrameUI } from "./ui/FrameUI.js";

export class PixiGame {
	constructor(app, engine, config) {
		this.app = app;
		this.engine = engine;
		this.config = config;

		// Root stage and layers
		this.stage = new Container();
		this.stage.sortableChildren = true; // allow zIndex ordering
		this.app.stage.addChild(this.stage);

		// Grid geometry
		this.cellW = 200;
		this.cellH = 140;
		this.cols = config.grid.reels;
		this.rows = config.grid.rows;
		this.offsetX = 80;
		this.offsetY = 100;

		// Layers
		this.reelLayer = new Container();
		this.reelLayer.zIndex = 10;

		this.overlayLayer = new Container();
		this.overlayLayer.zIndex = 30;

		// Frame & mask (background should be BEHIND reels)
		this.frame = new FrameUI(
			this.offsetX,
			this.offsetY,
			this.cellW,
			this.cellH,
			this.cols,
			this.rows
		);
		this.frame.container.zIndex = 0;

		// Add in the right visual order
		this.stage.addChild(this.frame.container);
		this.stage.addChild(this.reelLayer);
		this.stage.addChild(this.overlayLayer);

		// Apply the same mask to reels and overlays
		this.frame.applyMask(this.reelLayer);
		this.frame.applyMask(this.overlayLayer);

		// Minimal HUD text
		this.winText = new Text({
			text: "",
			style: new TextStyle({
				fill: "#fff",
				fontFamily: "system-ui",
				fontSize: 28,
				fontWeight: "700"
			})
		});
		this.winText.position.set(20, 20);
		this.winText.zIndex = 40;
		this.stage.addChild(this.winText);

		// Build reels
		this.reels = [];
		for (let x = 0; x < this.cols; x += 1) {
			const reel = new ReelColumn(
				this.app,
				this.offsetX + (x * this.cellW),
				this.offsetY,
				this.rows,
				this.cellW,
				this.cellH
			);
			reel.container.zIndex = 10;
			this.reelLayer.addChild(reel.container);
			this.reels.push(reel);
		}

		// Win highlighter
		this.highlighter = new WinHighlighter(
			this.app,
			this.overlayLayer,
			this.offsetX,
			this.offsetY,
			this.cellW,
			this.cellH,
			this.cols,
			this.rows,
			config.symbols
		);

		// Boot: show a random matrix immediately
		const boot = engine.math.spinReels();
		for (let x = 0; x < this.cols; x += 1) {
			this.reels[x].setIdleColumn(boot[x]);
		}

		// Clear highlights as soon as a spin begins
		this.engine.on("spinStart", () => { this.prepareForSpin(); });
	}

	prepareForSpin() {
		this.highlighter.reset();
		// Clear HUD win text at spin start
		this.winText.text = "";
	}

	async spinAndRender() {
		const result = await this.engine.spinOnce();

		const loops = [9, 10, 11, 12, 13];
		const startDelays = [0, 70, 140, 210, 280];
		const anticip = this.highlighter.anticipationDelays(result, this.engine.config);

		const tasks = [];
		for (let x = 0; x < this.cols; x += 1) {
			tasks.push(this.reels[x].spinTo(
				result.grid[x],
				loops[x],
				startDelays[x],
				anticip[x]
			));
		}
		await Promise.all(tasks);

		this.winText.text = result.feature
			? `${result.feature}  Win ${result.totalWin}`
			: `Win ${result.totalWin}`;

		return result;
	}

	showWins(result) {
		this.highlighter.showPaths(result);
	}
}
