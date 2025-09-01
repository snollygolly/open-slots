import { Container, Text, TextStyle, Graphics } from "pixi.js";
import { ReelColumn } from "./ReelColumn.js";
import { WinHighlighter } from "./WinHighlighter.js";
import { FrameUI } from "./ui/FrameUI.js";
import { OrbMeter } from "./OrbMeter.js";
import { SparkleEmitter } from "./effects/SparkleEmitter.js";
import { Events } from "../core/events.js";
import { Layers, setupLayers } from "./Layers.js";
import { EffectsManager } from "./effects/EffectsManager.js";
import { preloadSymbolTextures } from "./SymbolTextures.js";

export class PixiGame {
	constructor(app, engine, config) {
		this.app = app;
		this.engine = engine;
		this.config = config;

		this.stage = new Container();
		this.stage.sortableChildren = true;
		this.app.stage.addChild(this.stage);

		// Setup layered rendering system
		this.layers = setupLayers(this.stage);

		// Initialize effects manager
		this.effectsManager = new EffectsManager(this.app, this.engine);

		this.cellW = 200;
		this.cellH = 140;
		this.cols = config.grid.reels;
		this.rows = config.grid.rows;
		// Center reels horizontally within the 1280x720 stage
		const gridW = this.cellW * this.cols;
		this.offsetX = Math.floor(((this.app.screen?.width || 1280) - gridW) / 2);
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
		this.layers.background.addChild(this.frame.container);

		this.reelViewport = new Container();
		this.reelViewport.position.set(this.offsetX, this.offsetY);
		this.layers.reels.addChild(this.reelViewport);

			this.overlayViewport = new Container();
			this.overlayViewport.position.set(this.offsetX, this.offsetY);
			this.overlayViewport.sortableChildren = true;
			this.layers.overlay.addChild(this.overlayViewport);
			// Separate layers so highlighter resets don't wipe labels
			this.reelPotentialLayer = new Container();
			this.reelPotentialLayer.zIndex = 4; // below highlights and labels
			this.overlayViewport.addChild(this.reelPotentialLayer);
			this.highlightLayer = new Container();
			this.highlightLayer.zIndex = 5;
			this.overlayViewport.addChild(this.highlightLayer);
			this.orbLabels = new Container();
			this.orbLabels.zIndex = 10; // ensure labels sit above highlights
			this.overlayViewport.addChild(this.orbLabels);

		// Pre-build per-reel potential highlight overlays (glow/veil + additive ring)
		this._reelPotentialOverlays = [];
		for (let x = 0; x < this.cols; x += 1) {
			const wrap = new Container();
			wrap.position.set(x * this.cellW, 0);
			wrap.visible = false;
			wrap.zIndex = 1;
			const fill = new Graphics();
			fill.roundRect(0, 0, this.cellW, this.cellH * this.rows, 18);
			fill.fill({ color: 0xff6a00, alpha: 0.18 });
			fill.stroke({ color: 0xffcc66, width: 3, alpha: 0.35 });
            const ring = new Graphics();
            ring.roundRect(4, 4, this.cellW - 8, (this.cellH * this.rows) - 8, 16);
            ring.stroke({ color: 0xffaa22, width: 8, alpha: 0.35 });
            // Use higher alpha to simulate strong glow without blend mode dependency
			wrap.addChild(fill);
			wrap.addChild(ring);
			this.reelPotentialLayer.addChild(wrap);
			this._reelPotentialOverlays.push({ wrap, fill, ring });
		}

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
		this.layers.ui.addChild(this.winText);

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
		this.freeGamesText.visible = false;
		this.layers.ui.addChild(this.freeGamesText);

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
		this.holdSpinText.visible = false;
		this.layers.ui.addChild(this.holdSpinText);

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

		// Preload symbol textures, then set initial grid to ensure art is ready
		this._assetsReady = preloadSymbolTextures();
		const boot = engine.math.spinReels();
		this._assetsReady.then(() => {
			for (let i = 0; i < this.cols; i += 1) {
				this.reels[i].setIdleColumn(boot[i]);
			}
			// Also render initial ORB labels (if any) so orbs aren't label-less on load
			try {
				const evaln = this.engine.math.evaluateWays(boot);
				this._renderOrbLabels({ evaln });
				if (this.overlayViewport && this.orbLabels) {
					this.orbLabels.zIndex = 10;
					this.highlightLayer.zIndex = 5;
				}
			} catch (e) { /* ignore */ }
		});

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
		this.layers.ui.addChild(this.orbMeter.container);

		// Track spins since last ORB feature to drive the meter
		this._orbEstimatedSpinsToTrigger = 50;
		this._spinsSinceLastOrb = 8;
		this._orbProgress = this._spinsSinceLastOrb / this._orbEstimatedSpinsToTrigger;

		// Free games tracking
		this._freeGamesRemaining = 0;
		this._totalFreeGames = 0;
		this._currentFreeGame = 0;

		// Blue particle emitter for free games
		const reelsCenterX = this.offsetX + (this.cellW * this.cols) / 2;
		const reelsCenterY = this.offsetY + (this.cellH * this.rows) / 2;
		this.freeGamesEmitter = new SparkleEmitter(this.app, this.layers.fx_front, 0x0088ff);
		this.freeGamesEmitter.container.position.set(reelsCenterX, reelsCenterY);
		this.freeGamesEmitter.container.visible = false;
		
		// Setup ticker updates
		this._followOrbsUpdate = null;
		this._followingOrbs = [];
		this._followTimeouts = [];
		this._reelPotentialPulse = 0;
		this.app.ticker.add((delta) => {
			const dtMs = (typeof delta === "number" ? delta : delta?.deltaMS) || 16.7;
			this.freeGamesEmitter.update(dtMs);
			this.effectsManager.update(dtMs);
			// If we are following ORB labels during a spin, update their positions
			if (typeof this._followOrbsUpdate === 'function') { this._followOrbsUpdate(); }
			// Pulse glow for reel potential overlays; emphasize the next-to-stop reel
			if (Array.isArray(this._reelPotentialOverlays) && this._reelPotentialOverlays.length) {
				this._reelPotentialPulse += dtMs * 0.009; // increased speed for more energy
				const s = 0.5 + 0.5 * Math.sin(this._reelPotentialPulse);
				const focus = this._orbPotential?.focus;
				for (let i = 0; i < this._reelPotentialOverlays.length; i += 1) {
					const ov = this._reelPotentialOverlays[i];
					if (!ov.wrap.visible) { continue; }
					const isFocus = (typeof focus === 'number') && (i === focus);
					// Stronger fill on focus; slightly lower on others
					ov.fill.alpha = isFocus ? (0.28 + 0.14 * s) : (0.16 + 0.08 * s);
					// Additive ring pops on focus
					ov.ring.alpha = isFocus ? (0.50 + 0.35 * s) : (0.18 + 0.16 * s);
				}
			}
		});

		this.setupEventListeners();
	}

	setupEventListeners() {
		// Listen to engine events for rendering
		this.engine.on(Events.SPIN_START, () => this.onSpinStart());
		this.engine.on(Events.SPIN_RESULT, (result) => this.onSpinResult(result));
		this.engine.on(Events.FEATURE_START, (data) => this.onFeatureStart(data));
		this.engine.on(Events.FEATURE_END, (data) => this.onFeatureEnd(data));
		this.engine.on(Events.PAYING, (result) => this.onPaying(result));
		this.engine.on(Events.BALANCE, (data) => this.onBalanceUpdate(data));
		this.engine.on(Events.SPIN_END, () => this.onSpinEnd());

		// Listen to feature-specific events
		this.engine.on(Events.FREE_GAMES_START, (data) => this.onFreeGamesStart(data));
		this.engine.on(Events.FREE_GAMES_CHANGE, (data) => this.onFreeGamesChange(data));
		this.engine.on(Events.FREE_GAMES_END, (data) => this.onFreeGamesEnd(data));
	}

	onSpinStart() {
		this.highlighter.reset();
		
		// Always clear orb labels at spin start (except during Hold & Spin respins)
		if (this.orbLabels) {
			this.orbLabels.removeChildren();
		}
		
		// Clear win text unless we're in an active Hold & Spin feature
		if (!this.engine.holdSpin?.isActive?.()) {
			this.winText.text = "";
		} else {
			// Update Hold & Spin status immediately at spin start (after respin was spent)
			const orbCount = this.engine.holdSpin.getOrbCount() || 0;
			const respinsRemaining = this.engine.holdSpin.getRemainingRespins() || 0;
			this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
			this.holdSpinText.visible = true;
			this._updateHoldWinText();
		}
	}

	onSpinResult(result) {
		// Pure rendering - just display the grid result, no wins yet
		this.renderSpinResult(result, false); // false = don't show wins yet
	}

	// Create a text label for an ORB item
	_createOrbTextForItem(it) {
		const pgMeta = this.config?.progressives?.meta || {};
		let label = "";
		if (it.type === "C") { label = `${it.amount}`; }
		else if (it.type === "JP") { label = (pgMeta[it.id]?.label || it.id); }
		const t = new Text({ text: label, style: new TextStyle({ fill: "#fff", fontFamily: "system-ui", fontSize: 26, fontWeight: "800", stroke: { color: 0x031421, width: 4 } }) });
		t.anchor.set(0.5);
		return t;
	}

	// During base-game spin animation, make ORB labels move with their landing symbols
	_startOrbFollowDuringSpin(result, startDelays = [0, 70, 140, 210, 280]) {
		if (!this.orbLabels) { return; }
		this.orbLabels.removeChildren();
		const items = result?.evaln?.orbItems || [];
		this._followingOrbs = [];
		for (let i = 0; i < items.length; i += 1) {
			const it = items[i];
			if (typeof it.x !== 'number' || typeof it.y !== 'number') { continue; }
			const text = this._createOrbTextForItem(it);
			// Position immediately at current strip position; reveal when reel begins
			const col = it.x; const row = it.y;
			const stripY = this.reels[col]?.strip?.y || 0;
			const cx = (col * this.cellW) + (this.cellW / 2);
			const cy = stripY + ((3 + row) * this.cellH) + (this.cellH / 2);
			text.position.set(cx, cy);
			text.visible = false;
			this.orbLabels.addChild(text);
			this._followingOrbs.push({ it, text });
            const delay = startDelays[col] || 0;
            const tid = setTimeout(() => { text.visible = true; }, delay);
            this._followTimeouts.push(tid);
		}
		this._followOrbsUpdate = () => {
			for (let i = 0; i < (this._followingOrbs?.length || 0); i += 1) {
				const f = this._followingOrbs[i];
				const col = f.it.x;
				const row = f.it.y;
				const stripY = this.reels[col]?.strip?.y || 0;
				const cx = (col * this.cellW) + (this.cellW / 2);
				const cy = stripY + ((3 + row) * this.cellH) + (this.cellH / 2);
				f.text.position.set(cx, cy);
			}
		};
	}

    _stopOrbFollowDuringSpin() {
        this._followOrbsUpdate = null;
        if (Array.isArray(this._followTimeouts)) {
            while (this._followTimeouts.length) { clearTimeout(this._followTimeouts.pop()); }
        }
    }

	onFeatureStart(data) {
		// Render feature start effects - delegate to effects manager
		console.log(`Feature started: ${data.type}`);
		
		// Handle Hold and Spin feature start
		if (data.type === "HOLD_AND_SPIN" || (data.type && data.type.includes("HOLD_AND_SPIN"))) {
			// Get Hold and Spin state from engine using correct methods
			if (this.engine.holdSpin?.isActive?.()) {
				const orbCount = this.engine.holdSpin.getOrbCount() || 0;
				const respinsRemaining = this.engine.holdSpin.getRemainingRespins() || 0;
				
				this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
				this.holdSpinText.visible = true;
				
				// Trigger meter animation 
				this.orbMeter.triggerTransition();
				this._spinsSinceLastOrb = 0;
				this._orbProgress = 0;
				this.orbMeter.setProgress01(0);
				
				console.log(`[PixiGame] Natural Hold and Spin triggered: ${orbCount} orbs, ${respinsRemaining} respins`);
				console.log(`[PixiGame] holdSpinText visible: ${this.holdSpinText.visible}, text: "${this.holdSpinText.text}"`);
				
				// Update win text with locked orb total
				this._updateHoldWinText();
			}
		}
	}

	onFeatureEnd(data) {
		console.log(`Feature ended: ${data.feature}`);
		
		// Hide Hold and Spin text when the feature ends
		if (data.feature === "HoldAndSpin" || (data.feature && data.feature.includes("HOLD_AND_SPIN"))) {
			this.holdSpinText.visible = false;
			console.log(`[PixiGame] Hold and Spin ended, hiding status text`);
		}
	}

	onPaying(result) {
		// During Hold and Spin, don't override the accumulated orb total display
		if (this.engine.holdSpin?.isActive?.()) {
			// Update the Hold and Spin win display instead
			this._updateHoldWinText();
		} else {
			// Normal win display for base game and other features
			this.winText.text = `Win ${result.totalWin}`;
		}
	}

	onBalanceUpdate(data) {
		// Update balance display if needed
		console.log("Balance updated:", data);
	}

	onSpinEnd() {
		// Spin completed
	}

	onFreeGamesStart(data) {
		this._freeGamesRemaining = data.totalSpins || data.spinsAdded;
		this._totalFreeGames = data.totalSpins || data.spinsAdded;
		this._currentFreeGame = 0;

		// Trigger particle effect
		this.freeGamesEmitter.container.visible = true;
		this.freeGamesEmitter.burst({ x: 0, y: 0, count: 50 });
		setTimeout(() => {
			this.freeGamesEmitter.container.visible = false;
		}, 2000);
	}

	onFreeGamesChange(data) {
		this._freeGamesRemaining = data.remaining;
		this._currentFreeGame = this._totalFreeGames - this._freeGamesRemaining;
		this.freeGamesText.text = `${this._currentFreeGame}/${this._totalFreeGames} Free Games`;
		this.freeGamesText.visible = this._freeGamesRemaining > 0;
	}

	onFreeGamesEnd() {
		this.freeGamesText.visible = false;
		this._freeGamesRemaining = 0;
		this._totalFreeGames = 0;
		this._currentFreeGame = 0;
	}

	renderSpinResult(result, showWins = false) {
		// Render the grid result
		for (let x = 0; x < this.cols; x += 1) {
			this.reels[x].setIdleColumn(result.grid[x]);
		}

		// Only show wins if requested (after animation completes)
		if (showWins) {
			this.showWins(result);
			// During Hold and Spin, always update the accumulated total and status
			if (this.engine.holdSpin?.isActive?.()) {
				this._updateHoldWinText();
				
				// Also update Hold and Spin status during respins using correct methods
				const orbCount = this.engine.holdSpin.getOrbCount() || 0;
				const respinsRemaining = this.engine.holdSpin.getRemainingRespins() || 0;
				
				this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
				this.holdSpinText.visible = true;
				console.log(`[PixiGame] Updated Hold and Spin status during spin: ${orbCount} orbs, ${respinsRemaining} respins`);
			}
			// Other win display will be handled by PAYING event
		}
	}

    async spinAndRender() {
        // If Hold & Spin is active, spend a respin immediately on click
        if (this.engine.holdSpin?.isActive?.() && typeof this.engine.holdSpin.spendRespin === 'function') {
            this.engine.holdSpin.spendRespin();
            // Reflect the decremented value right away
            const orbCount = this.engine.holdSpin.getOrbCount() || 0;
            const respinsRemaining = this.engine.holdSpin.getRemainingRespins() || 0;
            this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
            this.holdSpinText.visible = true;
            this._updateHoldWinText();
        }

        // Clear visuals before starting spin
        this.prepareForSpin();

        // Trigger the engine to handle the spin logic (bet deducted here)
        const result = await this.engine.spinOnce();

        // Keep ORB labels visible and moving with reels during the spin animation
        const lockedBeforeAnim = typeof this.engine.holdSpin?.getLockedOrbs === 'function' ? this.engine.holdSpin.getLockedOrbs() : [];
        if (this.engine.holdSpin?.isActive?.() || (Array.isArray(lockedBeforeAnim) && lockedBeforeAnim.length > 0)) {
            // During Hold & Spin, show persistent locked values
            this._renderHoldLockedOrbLabels();
            this._updateHoldWinText();
            const orbCount = this.engine.holdSpin.getOrbCount?.() || 0;
            const respinsRemaining = this.engine.holdSpin.getRemainingRespins?.() || 0;
            this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
            this.holdSpinText.visible = true;
        } else {
            // Base game: follow landing orbs throughout the spin
            const startDelays = [0, 70, 140, 210, 280];
            this._startOrbFollowDuringSpin(result, startDelays);
            if (this.overlayViewport && this.orbLabels) {
                this.orbLabels.zIndex = 10;
                this.highlightLayer.zIndex = 5;
            }
        }

        // Animation only - no game logic, no wins shown yet
        await this.animateReels(result);

        // Stop following; labels have reached their landing positions
        this._stopOrbFollowDuringSpin();

		// After animation completes, now show the results and apply win credits
		this.renderSpinResult(result, true); // true = show wins
		
		// Apply win credits and emit PAYING event (if wins exist)
		this.engine.applyWinCredits(result);

		// Update orb meter (simple meter progression)
		if (this._freeGamesRemaining === 0 && !result.holdAndSpin?.active) {
			this._spinsSinceLastOrb++;
			this._orbProgress = Math.min(1, this._spinsSinceLastOrb / this._orbEstimatedSpinsToTrigger);
			this.orbMeter.setProgress01(this._orbProgress);
		}

		return result;
	}

	prepareForSpin() {
		this.highlighter.reset();
		
		// Always clear orb labels at spin start (except during Hold & Spin)
		if (this.orbLabels && !this.engine.holdSpin?.isActive?.()) {
			this.orbLabels.removeChildren();
		}
		
		// Clear win text unless we're in an active Hold & Spin feature
		if (!this.engine.holdSpin?.isActive?.()) {
			this.winText.text = "";
			// Also hide hold spin text when not in the feature
			this.holdSpinText.visible = false;
		}
	}

	async animateReels(result) {
		// Standard reel animation parameters
		const loops = [9, 10, 11, 12, 13];
		const startDelays = [0, 70, 140, 210, 280];
		const anticip = this.highlighter.anticipationDelays(result, this.engine.config);

		// Initialize potential-orb highlight logic for base game (not during Hold & Spin)
		this._initOrbPotentialHighlight(result, startDelays, loops);

		const tasks = [];
		for (let x = 0; x < this.cols; x += 1) {
			const p = this.reels[x].spinTo(
				result.grid[x],
				loops[x],
				startDelays[x],
				anticip[x]
			);
			// When each reel completes, update potential highlight state
			p.then(() => { this._onReelStoppedForOrbPotential(x); });
			tasks.push(p);
		}

		await Promise.all(tasks);
		// Clear potential highlights after all reels stop
		this._clearOrbPotentialHighlight();
		}

	// ----- Orb Feature Potential Highlight (base game) -----
	_initOrbPotentialHighlight(result, startDelays = [], loops = []) {
		// Skip during Hold & Spin
		if (this.engine.holdSpin?.isActive?.()) { return; }
		const target = this.engine.config?.holdAndSpin?.triggerCount || 5;
		const items = result?.evaln?.orbItems || [];
		// Only enable the new highlight behavior if we know at least 4 orbs will land
		const totalPlannedOrbs = Array.isArray(items) ? items.length : 0;
		if (totalPlannedOrbs < 4) {
			this._clearOrbPotentialHighlight();
			return; // keep previous behavior (no highlights)
		}
		this._orbPotential = {
			perReel: new Array(this.cols).fill(0),
			orbsSoFar: 0,
			spinning: new Set(Array.from({ length: this.cols }, (_, i) => i)),
			target,
			startDelays: [...startDelays],
			loops: [...loops],
			focus: null
		};
		for (let i = 0; i < items.length; i += 1) {
			const it = items[i];
			if (typeof it.x === 'number') { this._orbPotential.perReel[it.x] += 1; }
		}
		this._updateOrbPotentialHighlight();
	}

	_onReelStoppedForOrbPotential(col) {
		if (!this._orbPotential) { return; }
		if (this._orbPotential.spinning.has(col)) {
			this._orbPotential.spinning.delete(col);
			this._orbPotential.orbsSoFar += (this._orbPotential.perReel[col] || 0);
			this._updateOrbPotentialHighlight();
		}
	}

	_updateOrbPotentialHighlight() {
		if (!this._orbPotential) { return; }
		const remainingReels = this._orbPotential.spinning.size;
		const maxFromRemaining = remainingReels * this.rows;
		const canStillReach = (this._orbPotential.orbsSoFar + maxFromRemaining) >= this._orbPotential.target;
		// Determine which reel is likely to stop next among spinning ones
		let focusIndex = null;
		let bestTime = Infinity;
		for (const x of this._orbPotential.spinning) {
			const t = (this._orbPotential.startDelays[x] || 0) + (this._orbPotential.loops[x] || 0) * 100; // rough weighting
			if (t < bestTime) { bestTime = t; focusIndex = x; }
		}
		this._orbPotential.focus = focusIndex;
		for (let x = 0; x < this._reelPotentialOverlays.length; x += 1) {
			const ov = this._reelPotentialOverlays[x];
			const isSpinning = this._orbPotential.spinning.has(x);
			ov.wrap.visible = canStillReach && isSpinning;
		}
	}

	_clearOrbPotentialHighlight() {
		this._orbPotential = null;
		for (let x = 0; x < this._reelPotentialOverlays.length; x += 1) {
			this._reelPotentialOverlays[x].visible = false;
		}
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
        // Clear visuals before starting spin (same as regular spin)
        this.prepareForSpin();
        
        const result = await this.engine.buyFeature(featureType);

        // For bought features, Hold & Spin becomes active; show persistent locked labels
        const lockedPre = typeof this.engine.holdSpin?.getLockedOrbs === 'function' ? this.engine.holdSpin.getLockedOrbs() : [];
        if (this.engine.holdSpin?.isActive?.() || (Array.isArray(lockedPre) && lockedPre.length > 0)) {
            this._renderHoldLockedOrbLabels();
            this._updateHoldWinText();
            const orbCount = this.engine.holdSpin.getOrbCount?.() || 0;
            const respinsRemaining = this.engine.holdSpin.getRemainingRespins?.() || 0;
            this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
            this.holdSpinText.visible = true;
            if (this.overlayViewport && this.orbLabels) {
                this.orbLabels.zIndex = 10;
                this.highlightLayer.zIndex = 5;
            }
        }

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

		// After animation completes, render the spin results and show wins
		this.renderSpinResult(result, true); // true = show wins

		// Debug: log what features we're seeing
		if (result.feature) {
			console.log(`[PixiGame] Bought feature: "${result.feature}"`);
			console.log(`[PixiGame] Result object:`, result);
		}

		// Handle different features (same logic as regular spins)
    if (result.feature === "HOLD_AND_SPIN_START" || (result.feature && result.feature.includes("HOLD_AND_SPIN"))) {
        // Hold and spin starting - trigger meter animation and show status
        this.orbMeter.triggerTransition();
        this._spinsSinceLastOrb = 0;
        this._orbProgress = 0;
        this.orbMeter.setProgress01(0);
        
        // Set and show the hold spin status text using engine methods
        const orbCount = this.engine.holdSpin?.getOrbCount?.() || 0;
        const respinsRemaining = this.engine.holdSpin?.getRemainingRespins?.() || 0;
        this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
        this.holdSpinText.visible = true;
        
        console.log(`[PixiGame] Hold and Spin started with ${orbCount} orbs, ${respinsRemaining} respins remaining`);
        console.log(`[PixiGame] holdSpinText visible: ${this.holdSpinText.visible}, text: "${this.holdSpinText.text}"`);
        
        // Render locked orb labels immediately (this will override the base game orb labels from renderSpinResult)
        this._renderHoldLockedOrbLabels();
        // Update win text with locked orb total
        this._updateHoldWinText();
    }
    
    // Update Hold and Spin status during any spin when the feature is active
    if (this.engine.holdSpin?.isActive?.()) {
        const orbCount = this.engine.holdSpin.getOrbCount() || 0;
        const respinsRemaining = this.engine.holdSpin.getRemainingRespins() || 0;
        this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
        this.holdSpinText.visible = true;
        console.log(`[PixiGame] Updated Hold and Spin status: ${orbCount} orbs, ${respinsRemaining} respins`);
    }

		// Apply win credits after animation (this will handle win display via PAYING event)
		this.engine.applyWinCredits(result);

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
        const locked = typeof this.engine.holdSpin?.getLockedOrbs === 'function' ? this.engine.holdSpin.getLockedOrbs() : [];
        if (this.engine.holdSpin?.isActive?.() || (Array.isArray(locked) && locked.length > 0)) {
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
