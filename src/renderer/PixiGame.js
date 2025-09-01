import { Container, Text, TextStyle } from "pixi.js";
import { ReelColumn } from "./ReelColumn.js";
import { WinHighlighter } from "./WinHighlighter.js";
import { FrameUI } from "./ui/FrameUI.js";
import { OrbMeter } from "./OrbMeter.js";

export class PixiGame {
	constructor(app, engine, config) {
		this.app = app;
		this.engine = engine;
		this.config = config;

		this.stage = new Container();
		this.stage.sortableChildren = true;
		this.app.stage.addChild(this.stage);

		this.cellW = 200;
		this.cellH = 140;
		this.cols = config.grid.reels;
		this.rows = config.grid.rows;
		this.offsetX = 80;
		// Move reels down a bit to make room for the progressive meter above
		this.offsetY = 140;

		this.frame = new FrameUI(
			this.offsetX,
			this.offsetY,
			this.cellW,
			this.cellH,
			this.cols,
			this.rows
		);
		this.frame.container.zIndex = 0;
		this.stage.addChild(this.frame.container);

		this.reelViewport = new Container();
		this.reelViewport.position.set(this.offsetX, this.offsetY);
		this.reelViewport.zIndex = 10;
		this.stage.addChild(this.reelViewport);

		this.overlayViewport = new Container();
		this.overlayViewport.position.set(this.offsetX, this.offsetY);
		this.overlayViewport.zIndex = 30;
		this.stage.addChild(this.overlayViewport);

		// Clip reels and overlays to the frame area
		this.frame.applyMask(this.reelViewport);
		this.frame.applyMask(this.overlayViewport);

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

		this.reels = [];
		for (let x = 0; x < this.cols; x += 1) {
			const reel = new ReelColumn(
				this.app,
				x * this.cellW,
				0,
				this.rows,
				this.cellW,
				this.cellH
			);
			reel.container.zIndex = 10;
			this.reelViewport.addChild(reel.container);
			this.reels.push(reel);
		}

		this.highlighter = new WinHighlighter(
			this.app,
			this.overlayViewport,
			0,
			0,
			this.cellW,
			this.cellH,
			this.cols,
			this.rows,
			config.symbols
		);

		const boot = engine.math.spinReels();
		for (let i = 0; i < this.cols; i += 1) {
			this.reels[i].setIdleColumn(boot[i]);
		}

		/* ORB meter centered above the reels */
		this.orbMeter = new OrbMeter(this.app, this.stage, 0, 0);
		// Center horizontally above the frame; anchor the sprite to its center-bottom
		const centerX = this.offsetX + (this.cellW * this.cols) / 2;
		// Position and scale the meter after it loads
		this.orbMeter.ready?.then(() => {
			if (this.orbMeter.sprite?.anchor) { 
				this.orbMeter.sprite.anchor.set(0.5, 0); // top-center anchor
			}
			
			// Fit the meter into the space above the frame
			const naturalH = this.orbMeter.sprite?.height || 0;
			const maxH = Math.max(64, this.offsetY - 24); // keep buffer space
			if (naturalH > 0) {
				const scale = Math.min(1, maxH / naturalH);
				this.orbMeter.sprite.scale.set(scale, scale);
			}
			
			// Position centered above the reels
			const finalHeight = this.orbMeter.sprite?.height || this.orbMeter.container.height || 0;
			const finalY = Math.max(8, this.offsetY - finalHeight - 8);
			this.orbMeter.container.position.set(centerX, finalY);
			
			// Set initial progress based on starting spin count
			this.orbMeter.setProgress01(this._orbProgress);
		});
		this.stage.addChild(this.orbMeter.container);

		// Track spins since last ORB feature to drive the meter
		this._orbEstimatedSpinsToTrigger = 50; // Estimate: ORB should trigger around every 50 spins
		this._spinsSinceLastOrb = 8; // Start with some spins so art is visible immediately
		this._orbProgress = this._spinsSinceLastOrb / this._orbEstimatedSpinsToTrigger;

		this.engine.on("spinStart", () => {
			this.prepareForSpin();
		});
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

		// Update orb meter based on spin result
		if (result.feature === "HOLD_AND_SPIN") {
			// ORB feature triggered - reset the meter
			this.orbMeter.triggerTransition();
			this._spinsSinceLastOrb = 0;
			this._orbProgress = 0;
			this.orbMeter.setProgress01(0);
		} else {
			// No ORB feature - advance the meter
			this._spinsSinceLastOrb++;
			this._orbProgress = Math.min(1, this._spinsSinceLastOrb / this._orbEstimatedSpinsToTrigger);
			this.orbMeter.setProgress01(this._orbProgress);
		}

		this.winText.text = result.feature
			? `${result.feature}  Win ${result.totalWin}`
			: `Win ${result.totalWin}`;

		return result;
	}

	showWins(result) {
		// Always show path highlights (compat if older bundles expected .show)
		if (typeof this.highlighter.showPaths === "function") {
			this.highlighter.showPaths(result);
		} else if (typeof this.highlighter.show === "function") {
			this.highlighter.show(result, "paths");
		}
	}
}
