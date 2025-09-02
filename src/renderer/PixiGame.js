import { Container, Text, TextStyle, Graphics } from "pixi.js";
import { ReelColumn } from "./ReelColumn.js";
import { OrbSymbol } from "./OrbSymbol.js";
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
			this.reelPotentialLayer.zIndex = 4;
			this.overlayViewport.addChild(this.reelPotentialLayer);
			// Layer for visually locked orbs during Hold & Spin (stays static over spinning reels)
			this.holdLockedOverlayLayer = new Container();
			this.holdLockedOverlayLayer.zIndex = 6;
			this.overlayViewport.addChild(this.holdLockedOverlayLayer);
			this.highlightLayer = new Container();
			this.highlightLayer.zIndex = 5;
			this.overlayViewport.addChild(this.highlightLayer);

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
				this.cellH,
				{ strip: (this.config?.reels?.[x] || null), rngFn: () => this.engine.rngService.random(), holdAndSpin: (this.config?.holdAndSpin || {}) }
			);
			reel.setColumnIndex(x);
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
				this.reels[i].setIdleColumn(boot[i], []);
			}
			// Do not render overlay labels at boot; tiles handle base-game labels.
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

		// Free Games cumulative win tracking for persistent Win label during feature
		this._freeGamesActive = false;
		this._freeGamesCumulativeWin = 0;

		// Blue particle emitter for free games
		const reelsCenterX = this.offsetX + (this.cellW * this.cols) / 2;
		const reelsCenterY = this.offsetY + (this.cellH * this.rows) / 2;
		this.freeGamesEmitter = new SparkleEmitter(this.app, this.layers.fx_front, 0x0088ff);
		this.freeGamesEmitter.container.position.set(reelsCenterX, reelsCenterY);
		this.freeGamesEmitter.container.visible = false;
		
		// Setup ticker updates
		this._reelPotentialPulse = 0;
		this.app.ticker.add((delta) => {
			const dtMs = (typeof delta === "number" ? delta : delta?.deltaMS) || 16.7;
			this.freeGamesEmitter.update(dtMs);
			this.effectsManager.update(dtMs);
			// Unified orb system eliminates need for label following
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

	// ----- Hold & Spin: Visual lock overlays -----
	_clearHoldLockedOverlays() {
		if (!this.holdLockedOverlayLayer) return;
		this.holdLockedOverlayLayer.removeChildren();
	}

	_rebuildHoldLockedOverlays() {
		// Only show overlays while Hold & Spin is active
		if (!this.engine.holdSpin?.isActive?.()) {
			this._clearHoldLockedOverlays();
			return;
		}
		const locked = typeof this.engine.holdSpin?.getLockedOrbs === 'function'
			? this.engine.holdSpin.getLockedOrbs()
			: [];

		this._clearHoldLockedOverlays();

		// For each locked orb, draw a full-cell background to completely mask the spinning reel
		// and place a copy of the orb symbol in the same inset as base tiles (8px margin)
		for (let i = 0; i < locked.length; i += 1) {
			const o = locked[i];
			if (typeof o.reel !== 'number' || typeof o.row !== 'number') continue;
			const wrap = new Container();
			wrap.position.set(o.reel * this.cellW, o.row * this.cellH);
			wrap.zIndex = 1;

			// Solid background to fully cover the cell area and hide any reel motion behind it
			const bg = new Graphics();
			bg.rect(0, 0, this.cellW, this.cellH);
			bg.fill({ color: 0x0b1d31, alpha: 1 }); // cell background color
			wrap.addChild(bg);

			// Build orb item payload for OrbSymbol
			const orbItem = (o.type === 'JP')
				? { type: 'JP', id: o.id }
				: { type: 'C', amount: o.amount };
			// Create a static orb symbol and position it with the standard 8px inset
			const orb = OrbSymbol.fromOrbItem(this.cellW, this.cellH, orbItem);
			orb.position.set(8, 8);
			wrap.addChild(orb);

			this.holdLockedOverlayLayer.addChild(wrap);
		}
	}

	onSpinStart() {
		this.highlighter.reset();
		
		// Orb values are now built into symbols - no separate labels to clear
		
		// Clear win text unless we're in an active Hold & Spin OR Free Games feature
		if (!this.engine.holdSpin?.isActive?.() && !this._freeGamesActive) {
			this.winText.text = "";
		} else {
			// Update Hold & Spin status immediately at spin start (after respin was spent)
			const orbCount = this.engine.holdSpin.getOrbCount() || 0;
			const respinsRemaining = this.engine.holdSpin.getRemainingRespins() || 0;
			this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
			this.holdSpinText.visible = true;
			this._updateHoldWinText();
			// Ensure locked overlays are present over the spinning reels
			this._rebuildHoldLockedOverlays();
		}
	}

	onSpinResult(result) {
		// Pure rendering - just display the grid result, no wins yet
		this.renderSpinResult(result, false); // false = don't show wins yet
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
				// Build initial visual locks for existing orbs
				this._rebuildHoldLockedOverlays();
			}
		}
	}

	onFeatureEnd(data) {
		console.log(`Feature ended: ${data.feature}`);
		
		// Hide Hold and Spin text when the feature ends
		if (data.feature === "HoldAndSpin" || (data.feature && data.feature.includes("HOLD_AND_SPIN"))) {
			this.holdSpinText.visible = false;
			console.log(`[PixiGame] Hold and Spin ended, hiding status text`);
			this._clearHoldLockedOverlays();
		}
	}

	onPaying(result) {
		// During Hold and Spin, don't override the accumulated orb total display
		if (this.engine.holdSpin?.isActive?.()) {
			this._updateHoldWinText();
			return;
		}
		// During Free Games, keep a persistent cumulative total visible
		if (this._freeGamesActive) {
			const add = typeof result?.totalWin === 'number' ? result.totalWin : 0;
			this._freeGamesCumulativeWin += Math.max(0, add);
			this.winText.text = `Win ${this._freeGamesCumulativeWin}`;
			return;
		}
		// Normal win display for base game and other features
		this.winText.text = `Win ${result.totalWin}`;
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

    // Activate persistent win label and reset cumulative total unless this is a retrigger
    this._freeGamesActive = true;
    if (!data?.isRetrigger) {
        this._freeGamesCumulativeWin = 0;
    }

    // Trigger particle effect
    this.freeGamesEmitter.container.visible = true;
		this.freeGamesEmitter.burst({ x: 0, y: 0, count: 50 });
		setTimeout(() => {
			this.freeGamesEmitter.container.visible = false;
		}, 2000);

    // Immediately show free games status text
    this.freeGamesText.text = `0/${this._totalFreeGames} Free Games`;
    this.freeGamesText.visible = true;
    // Show persistent cumulative win label during free games
    this.winText.text = `Win ${this._freeGamesCumulativeWin}`;
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
    // Feature ended — revert to normal win label behavior on next spin
    this._freeGamesActive = false;
}

	renderSpinResult(result, showWins = false) {
		// Render the grid result with orb item data
		const orbItems = result?.evaln?.orbItems || [];
		for (let x = 0; x < this.cols; x += 1) {
			this.reels[x].setIdleColumn(result.grid[x], orbItems);
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
				// After landing, rebuild overlays to include any newly-locked orbs for upcoming respins
				this._rebuildHoldLockedOverlays();
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

        // Animation will start - don't show Hold & Spin labels until after orbs land

        // Animation only - no game logic, no wins shown yet
        await this.animateReels(result);

        // Orb values are now permanent - no overlay management needed

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
		
		// Orb values are now built into symbols - no separate labels to clear
		
		// Clear win text unless we're in an active Hold & Spin OR Free Games feature
		if (!this.engine.holdSpin?.isActive?.() && !this._freeGamesActive) {
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

		// With OrbSymbol, each orb handles its own value - no coordination needed

		// Initialize potential-orb highlight logic for base game (not during Hold & Spin)
		this._initOrbPotentialHighlight(result, startDelays, loops);

		const orbItems = result?.evaln?.orbItems || [];
		const tasks = [];
		for (let x = 0; x < this.cols; x += 1) {
			const p = this.reels[x].spinTo(
				result.grid[x],
				loops[x],
				startDelays[x],
				anticip[x],
				orbItems
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

		const orbItems = result?.evaln?.orbItems || [];
		const tasks = [];
		for (let x = 0; x < this.cols; x += 1) {
			// All reels spin exactly the same way
			tasks.push(this.reels[x].spinTo(
				result.grid[x],
				loops[x],
				startDelays[x],
				anticip[x],
				orbItems
			));
		}
		await Promise.all(tasks);
	}


    async spinAndRenderWithFeature(featureType) {
        // Clear visuals before starting spin (same as regular spin)
        this.prepareForSpin();
        
        const result = await this.engine.buyFeature(featureType);

        // Don't show Hold & Spin labels immediately - wait for animation to complete

		const loops = [9, 10, 11, 12, 13];
		const startDelays = [0, 70, 140, 210, 280];
		const anticip = this.highlighter.anticipationDelays(result, this.engine.config);

		const orbItems = result?.evaln?.orbItems || [];
		const tasks = [];
		for (let x = 0; x < this.cols; x += 1) {
			tasks.push(this.reels[x].spinTo(
				result.grid[x],
				loops[x],
				startDelays[x],
				anticip[x],
				orbItems
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
        // Hold and spin starting - trigger meter animation
        this.orbMeter.triggerTransition();
        this._spinsSinceLastOrb = 0;
        this._orbProgress = 0;
        this.orbMeter.setProgress01(0);
        
        console.log(`[PixiGame] Hold and Spin feature started`);
    }
    
    // Update Hold and Spin status after orbs have landed (when the feature is active)
    if (this.engine.holdSpin?.isActive?.()) {
        const orbCount = this.engine.holdSpin.getOrbCount() || 0;
        const respinsRemaining = this.engine.holdSpin.getRemainingRespins() || 0;
        this.holdSpinText.text = `${orbCount} Orbs | ${respinsRemaining} Respins`;
        this.holdSpinText.visible = true;
        
        // Update win text with locked orb total
        this._updateHoldWinText();
        // Note: Orb labels are handled by OrbSymbol - no overlay needed
        
        console.log(`[PixiGame] Hold and Spin status: ${orbCount} orbs, ${respinsRemaining} respins`);
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
        // With OrbSymbol consolidation, all orb labels are built into the symbols themselves
        // No overlay labels needed for any game mode - eliminates duplicate labels
        // Hold & Spin orbs get their values from the OrbSymbol when created
        // Orb values are built into symbols - no overlay management needed
    }
}
