import { Container, Text, TextStyle } from "pixi.js";
import { ReelColumn } from "./ReelColumn.js";
import { WinHighlighter } from "./WinHighlighter.js";
import { FrameUI } from "./ui/FrameUI.js";
import { OrbMeter } from "./OrbMeter.js";
import { SparkleEmitter } from "./effects/SparkleEmitter.js";

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
			this.overlayViewport.sortableChildren = true; // allow z-index ordering within overlay
			this.stage.addChild(this.overlayViewport);
			// Separate layers so highlighter resets don't wipe labels
			this.highlightLayer = new Container();
			this.highlightLayer.zIndex = 5;
			this.overlayViewport.addChild(this.highlightLayer);
			this.orbLabels = new Container();
			this.orbLabels.zIndex = 10; // ensure labels sit above highlights
			this.overlayViewport.addChild(this.orbLabels);

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
		// Position win text below the reels, centered horizontally
		const winTextY = this.offsetY + (this.cellH * this.rows) + 20;
		this.winText.position.set(this.offsetX, winTextY);
		this.winText.zIndex = 40;
		this.stage.addChild(this.winText);

		// Free games text (hidden by default)
		this.freeGamesText = new Text({
			text: "",
			style: new TextStyle({
				fill: "#00ccff",
				fontFamily: "system-ui",
				fontSize: 28,
				fontWeight: "700"
			})
		});
		// Position aligned with win text vertically, but right-justified
		const rightEdgeX = this.offsetX + (this.cellW * this.cols);
		this.freeGamesText.anchor.set(1, 0); // Right-aligned anchor
		this.freeGamesText.position.set(rightEdgeX, winTextY);
		this.freeGamesText.zIndex = 40;
		this.freeGamesText.visible = false;
		this.stage.addChild(this.freeGamesText);

		// Hold and spin text (hidden by default)
		this.holdSpinText = new Text({
			text: "",
			style: new TextStyle({
				fill: "#ff6600", // Orange color for hold and spin
				fontFamily: "system-ui",
				fontSize: 28,
				fontWeight: "700"
			})
		});
		// Position aligned with win text, centered horizontally  
		const holdSpinTextY = this.offsetY + (this.cellH * this.rows) + 20;
		this.holdSpinText.anchor.set(0.5, 0); // Center-aligned anchor
		this.holdSpinText.position.set(this.offsetX + (this.cellW * this.cols) / 2, holdSpinTextY);
		this.holdSpinText.zIndex = 40;
		this.holdSpinText.visible = false;
		this.stage.addChild(this.holdSpinText);

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
				this.highlightLayer,
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

		// Free games tracking
		this._freeGamesRemaining = 0;
		this._totalFreeGames = 0;
		this._currentFreeGame = 0;

		// Blue particle emitter for free games (positioned at center of reels)
		const reelsCenterX = this.offsetX + (this.cellW * this.cols) / 2;
		const reelsCenterY = this.offsetY + (this.cellH * this.rows) / 2;
		this.freeGamesEmitter = new SparkleEmitter(this.app, this.stage, 0x0088ff); // Blue particles
		this.freeGamesEmitter.container.position.set(reelsCenterX, reelsCenterY);
		this.freeGamesEmitter.container.visible = false; // Hide until needed
		
		// Ensure the free games emitter gets updated
		this.app.ticker.add((delta) => {
			const dtMs = (typeof delta === "number" ? delta : delta?.deltaMS) || 16.7;
			this.freeGamesEmitter.update(dtMs);
		});

		this.engine.on("spinStart", () => {
			this.prepareForSpin();
		});
	}

    prepareForSpin() {
        this.highlighter.reset();
        // Clear HUD win text at spin start, except during Hold & Spin where it should persist
        if (!this.engine.holdSpin?.isActive?.()) {
            this.winText.text = "";
        }
        // Preserve ORB labels during Hold & Spin; otherwise clear
        if (!this.engine.holdSpin?.isActive?.() && this.orbLabels) {
            this.orbLabels.removeChildren();
        }
    }

	async spinAndRender() {
		const result = await this.engine.spinOnce();

		// Handle hold and spin respins differently - locked orbs don't spin
		if (result.holdAndSpin?.active && result.feature === "HOLD_AND_SPIN_RESPIN") {
			await this._renderHoldAndSpinRespin(result);
		} else {
			// Normal spin animation
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
			}

			// Debug: log what features we're seeing
		if (result.feature) {
			console.log(`[PixiGame] Feature detected: "${result.feature}", in free games: ${this._freeGamesRemaining > 0}`);
			// Log full result when in free games to understand retrigger detection
			if (this._freeGamesRemaining > 0) {
				console.log(`[PixiGame] Full result during free games:`, result);
				
				// Try to detect free game symbols on the grid
				const freeGameSymbolCount = this._countFreeGameSymbols(result.grid);
				console.log(`[PixiGame] Free game symbols on grid: ${freeGameSymbolCount}`);
			}
		}

		// Handle different features
        if (result.feature === "HOLD_AND_SPIN_START") {
            // Hold and spin starting - trigger meter animation and show status
            this.orbMeter.triggerTransition();
            this._spinsSinceLastOrb = 0;
            this._orbProgress = 0;
            this.orbMeter.setProgress01(0);
            this.holdSpinText.text = `${result.hold.orbCount} Orbs | ${result.hold.respinsRemaining} Respins`;
            this.holdSpinText.visible = true;
            console.log(`[PixiGame] Hold and Spin started with ${result.hold.orbCount} orbs, ${result.hold.respinsRemaining} respins remaining`);
            // Render locked orb labels immediately
            this._renderHoldLockedOrbLabels();
            this._updateHoldWinText();
        } else if (result.feature === "HOLD_AND_SPIN_RESPIN") {
            this.holdSpinText.text = `${result.hold.orbCount} Orbs | ${result.hold.respinsRemaining} Respins`;
            if (result.hold.newOrbs > 0) {
                this.holdSpinText.text += ` (+${result.hold.newOrbs})`;
            }
            console.log(`[PixiGame] Hold and Spin respin - ${result.hold.newOrbs} new orbs, ${result.hold.orbCount} total, ${result.hold.respinsRemaining} respins remaining`);
            // Ensure labels reflect all locked orbs after the respin outcome
            this._renderHoldLockedOrbLabels();
            this._updateHoldWinText();
        } else if (result.feature === "HOLD_AND_SPIN_END") {
            this.holdSpinText.visible = false;
            console.log(`[PixiGame] Hold and Spin ended - won ${result.totalWin} with ${result.hold.orbCount} orbs`);
            if (result.hold.isFull) {
                console.log(`[PixiGame] Full grid bonus awarded!`);
            }
        } else if (result.feature && result.feature.includes("FREE")) {
			// Free games detected - but only handle if NOT already in free games OR this is a retrigger
			if (this._freeGamesRemaining === 0) {
				// Starting new free games
				console.log(`[PixiGame] Starting new free games: ${result.feature}`);
				this._handleFreeGamesStart(result);
			} else {
				// Already in free games - check if we actually have free game symbols
				const freeGameSymbolCount = this._countFreeGameSymbols(result.grid);
				if (freeGameSymbolCount >= 3) {
					console.log(`[PixiGame] Retrigger detected! ${freeGameSymbolCount} free game symbols`);
					this._handleFreeGamesStart(result);
				} else {
					console.log(`[PixiGame] In free games, only ${freeGameSymbolCount} free game symbols - not retriggering`);
    }
			}
		} else {
			// No special feature - advance the orb meter (only if not in free games and not in hold and spin)
			if (this._freeGamesRemaining === 0 && !result.holdAndSpin?.active) {
				this._spinsSinceLastOrb++;
				this._orbProgress = Math.min(1, this._spinsSinceLastOrb / this._orbEstimatedSpinsToTrigger);
				this.orbMeter.setProgress01(this._orbProgress);
			}
		}

		// Update free games counter if in free games
		if (this._freeGamesRemaining > 0) {
			// Decrement remaining games first
			this._freeGamesRemaining--;
			
			// Calculate current game number
			this._currentFreeGame = this._totalFreeGames - this._freeGamesRemaining;
			this.freeGamesText.text = `${this._currentFreeGame}/${this._totalFreeGames} Free Games`;
			this.freeGamesText.visible = true;
			
			// End free games when finished
			if (this._freeGamesRemaining === 0) {
				this._handleFreeGamesEnd();
			}
		}

        // Update win label
        if (result.feature === "HOLD_AND_SPIN_END") {
            // Feature concluded: show the final total win from the feature
            this.winText.text = `Win ${result.totalWin}`;
        } else if (this.engine.holdSpin?.isActive?.() || result.feature === "HOLD_AND_SPIN_START" || result.feature === "HOLD_AND_SPIN_RESPIN") {
            // During Hold & Spin, show cumulative locked total (credits + jackpots evaluated)
            this._updateHoldWinText();
        } else {
            // Normal behavior
            const excludedFeatures = ["FREE_GAMES", "FREE_GAMES_TRIGGER", "HOLD_AND_SPIN_START", "HOLD_AND_SPIN_RESPIN", "HOLD_AND_SPIN_END"];
            const displayFeature = result.feature && !excludedFeatures.includes(result.feature) ? `${result.feature}  ` : "";
            this.winText.text = `${displayFeature}Win ${result.totalWin}`;
        }

			return result;
		}

    _renderOrbLabels(result) {
        if (!this.orbLabels) { return; }
        this.orbLabels.removeChildren();
        const items = result?.evaln?.orbItems || [];
        const pgMeta = this.config?.progressives?.meta || {};
			for (let i = 0; i < items.length; i += 1) {
				const it = items[i];
				const cx = (it.x * this.cellW) + (this.cellW / 2);
				const cy = (it.y * this.cellH) + (this.cellH / 2);
				let label = "";
				if (it.type === "C") { label = `${it.amount}`; }
				else if (it.type === "JP") { label = (pgMeta[it.id]?.label || it.id); }
				const t = new Text({ text: label, style: new TextStyle({ fill: "#fff", fontFamily: "system-ui", fontSize: 26, fontWeight: "800", stroke: { color: 0x031421, width: 4 } }) });
				t.anchor.set(0.5);
				t.position.set(cx, cy);
				this.orbLabels.addChild(t);
        }
    }

    _renderHoldLockedOrbLabels() {
        if (!this.orbLabels) { return; }
        this.orbLabels.removeChildren();
        const pgMeta = this.config?.progressives?.meta || {};
        const locked = typeof this.engine.holdSpin?.getLockedOrbs === 'function'
            ? this.engine.holdSpin.getLockedOrbs()
            : [];
        for (let i = 0; i < locked.length; i += 1) {
            const it = locked[i];
            const cx = (it.reel * this.cellW) + (this.cellW / 2);
            const cy = (it.row * this.cellH) + (this.cellH / 2);
            let label = '';
            if (it.type === 'C') { label = `${it.amount}`; }
            else if (it.type === 'JP') { label = (pgMeta[it.id]?.label || it.id); }
            const t = new Text({ text: label, style: new TextStyle({ fill: '#fff', fontFamily: 'system-ui', fontSize: 26, fontWeight: '800', stroke: { color: 0x031421, width: 4 } }) });
            t.anchor.set(0.5);
            t.position.set(cx, cy);
            this.orbLabels.addChild(t);
        }
    }

    _computeHoldLockedTotalCredits() {
        const locked = typeof this.engine.holdSpin?.getLockedOrbs === 'function'
            ? this.engine.holdSpin.getLockedOrbs()
            : [];
        const pg = this.engine.wallet?.pg;
        const denom = this.engine.config?.denom || 1;
        let sum = 0;
        for (let i = 0; i < locked.length; i += 1) {
            const o = locked[i];
            if (o.type === 'C') { sum += o.amount; }
            else if (o.type === 'JP' && pg && pg.balances && typeof pg.balances[o.id] === 'number') {
                sum += Math.round(pg.balances[o.id] / denom);
            }
        }
        return sum;
    }

    _updateHoldWinText() {
        const total = this._computeHoldLockedTotalCredits();
        this.winText.text = `Win ${total}`;
    }

	async _renderHoldAndSpinRespin(result) {
		// All reels spin at the same speed - no special handling for locked positions
		const loops = [9, 10, 11, 12, 13];
		const startDelays = [0, 70, 140, 210, 280];
		const anticip = this.highlighter.anticipationDelays(result, this.engine.config);

		const tasks = [];
		for (let x = 0; x < this.cols; x += 1) {
			// All reels spin exactly the same way
			tasks.push(this.reels[x].spinTo(
				result.grid[x],
				loops[x],
				startDelays[x],
				anticip[x]
			));
		}
		await Promise.all(tasks);
	}


	async spinAndRenderWithFeature(featureType) {
		const result = await this.engine.buyFeature(featureType);

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

		// Debug: log what features we're seeing
		if (result.feature) {
			console.log(`[PixiGame] Bought feature: "${result.feature}"`);
		}

		// Handle different features (same logic as regular spins)
    if (result.feature === "HOLD_AND_SPIN_START") {
        // Hold and spin starting - trigger meter animation and show status
        this.orbMeter.triggerTransition();
        this._spinsSinceLastOrb = 0;
        this._orbProgress = 0;
        this.orbMeter.setProgress01(0);
        this.holdSpinText.text = `${result.hold.orbCount} Orbs | ${result.hold.respinsRemaining} Respins`;
        this.holdSpinText.visible = true;
        console.log(`[PixiGame] Hold and Spin started with ${result.hold.orbCount} orbs, ${result.hold.respinsRemaining} respins remaining`);
        // Render locked orb labels immediately
        this._renderHoldLockedOrbLabels();
    }

		// Show win amount for bought features, but exclude features that have their own visual feedback
		const excludedFeatures = ["FREE_GAMES", "FREE_GAMES_TRIGGER", "HOLD_AND_SPIN_START", "HOLD_AND_SPIN_RESPIN", "HOLD_AND_SPIN_END"];
		const displayFeature = result.feature && !excludedFeatures.includes(result.feature) ? `${result.feature}  ` : "";
		this.winText.text = `${displayFeature}Win ${result.totalWin}`;

		return result;
	}

	_handleFreeGamesStart(result) {
		// Parse free games count from feature text (e.g., "FREE_GAMES_10" or just "FREE_GAMES")
		const match = result.feature.match(/FREE.*?(\d+)/);
		let freeGamesAwarded = match ? parseInt(match[1]) : this.engine.config.freeGames.spins;
		
		// If we're already in free games and this is "FREE_GAMES" (retrigger), use retrigger amount
		if (this._freeGamesRemaining > 0 && result.feature === "FREE_GAMES") {
			freeGamesAwarded = this.engine.config.freeGames.retrigger;
		}
		
		if (this._freeGamesRemaining > 0) {
			// Already in free games - add to the total (retrigger)
			this._freeGamesRemaining += freeGamesAwarded;
			this._totalFreeGames += freeGamesAwarded;
			console.log(`[PixiGame] Free games retriggered! Added ${freeGamesAwarded} games. Now ${this._currentFreeGame}/${this._totalFreeGames}`);
		} else {
			// Starting new free games session
			this._freeGamesRemaining = freeGamesAwarded;
			this._totalFreeGames = freeGamesAwarded;
			this._currentFreeGame = 0;
			console.log(`[PixiGame] Free games started: ${freeGamesAwarded} games`);
		}
		
		// Blue particle explosion (always trigger on free games)
		console.log(`[PixiGame] Triggering blue particle explosion at center of reels`);
		this.freeGamesEmitter.container.visible = true;
		this.freeGamesEmitter.burst({ 
			x: 0, 
			y: 0, 
			count: 50
		});
		
		// Hide the emitter after particles fade
		setTimeout(() => {
			this.freeGamesEmitter.container.visible = false;
		}, 2000);
	}
	
	_countFreeGameSymbols(grid) {
		if (!grid || !Array.isArray(grid)) return 0;
		
		let count = 0;
		// Iterate through all positions in the grid
		for (let reel = 0; reel < grid.length; reel++) {
			if (Array.isArray(grid[reel])) {
				for (let pos = 0; pos < grid[reel].length; pos++) {
					const symbol = grid[reel][pos];
					// Look for free game symbols - common names: "FREE", "FREEGAME", "SCATTER", etc.
					if (typeof symbol === 'string' && 
						(symbol.includes('FREE') || symbol.includes('SCATTER'))) {
						count++;
					}
				}
			}
		}
		return count;
	}

	_handleFreeGamesEnd() {
		this.freeGamesText.visible = false;
		this._freeGamesRemaining = 0;
		this._totalFreeGames = 0;
		this._currentFreeGame = 0;
		
		console.log("[PixiGame] Free games ended");
	}

    showWins(result) {
        // Always show path highlights (compat if older bundles expected .show)
        if (typeof this.highlighter.showPaths === "function") {
            this.highlighter.showPaths(result);
        } else if (typeof this.highlighter.show === "function") {
            this.highlighter.show(result, "paths");
        }
        // Draw ORB value labels on top of any highlight shade
        if (this.engine.holdSpin?.isActive?.()) {
            // During Hold & Spin, render persistent locked values
            this._renderHoldLockedOrbLabels();
        } else {
            // Base game rendering uses this spin's orb items
            this._renderOrbLabels(result);
        }
        // Bring label layer to top just in case
        if (this.overlayViewport && this.orbLabels) {
            this.orbLabels.zIndex = 10;
            this.highlightLayer.zIndex = 5;
        }
    }
}
