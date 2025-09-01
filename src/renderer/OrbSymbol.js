import { Container, Sprite, Text, TextStyle } from "pixi.js";
import { getSymbolTexture } from "./SymbolTextures.js";
import { pickWeighted } from "../core/utils.js";

/**
 * Unified ORB symbol that combines graphic + label into one inseparable container.
 * Once created with a value, that value never changes - prevents sync issues.
 */
export class OrbSymbol extends Container {
	constructor(cellW, cellH, orbItem = null, holdAndSpinConfig = null, rngFn = null) {
		super();
		
		this.cellW = cellW;
		this.cellH = cellH;
		this.orbItem = orbItem;
		
		// If no orbItem provided, generate one using existing logic
		if (!orbItem) {
			this.orbItem = this._generateOrbItem(holdAndSpinConfig, rngFn);
		}
		
		this._createVisuals();
	}
	
	_generateOrbItem(hsCfg = {}, rngFn = Math.random) {
		// Reuse exact logic from existing codebase (GameMath.js)
		if (rngFn() < (hsCfg.jackpotChancesPerOrb || 0)) {
			const ids = Object.keys(hsCfg.jackpotWeights || {});
			if (ids.length > 0) {
				const weights = ids.map((k) => hsCfg.jackpotWeights[k]);
				const id = pickWeighted(rngFn, ids, weights);
				return { type: "JP", id };
			}
		}
		// Default to credit value
		const amt = pickWeighted(rngFn, hsCfg.creditValues || [50, 100, 150], hsCfg.creditWeights || [1, 1, 1]);
		return { type: "C", amount: amt };
	}
	
	_createVisuals() {
		const maxW = this.cellW - 16;
		const maxH = this.cellH - 16;
		
		// Create orb sprite (or fallback graphic)
		const texture = getSymbolTexture("ORB");
		if (texture) {
			const sprite = new Sprite(texture);
			sprite.anchor.set(0.5);
			sprite.x = maxW / 2;
			sprite.y = maxH / 2;
			const natW = sprite.texture.width || 1;
			const natH = sprite.texture.height || 1;
			const scale = Math.min(maxW / natW, maxH / natH);
			sprite.scale.set(scale, scale);
			this.addChild(sprite);
		}
		
		// Create label text
		const labelText = this._getLabelText();
		const label = new Text({
			text: labelText,
			style: new TextStyle({
				fill: "#fff",
				fontFamily: "system-ui",
				fontSize: 26,
				fontWeight: "800",
				stroke: { color: 0x031421, width: 4 }
			})
		});
		label.anchor.set(0.5);
		label.position.set(maxW / 2, maxH / 2);
		this.addChild(label);
		
		// Store reference for external access
		this.label = label;
	}
	
	_getLabelText() {
		if (this.orbItem.type === "C") {
			return String(this.orbItem.amount);
		} else if (this.orbItem.type === "JP") {
			return this.orbItem.id;
		}
		return "?";
	}
	
	/**
	 * Get the orb item data (type, amount/id)
	 */
	getOrbItem() {
		return { ...this.orbItem };
	}
	
	/**
	 * Get display text for this orb
	 */
	getDisplayText() {
		return this.label.text;
	}
	
	/**
	 * Create an OrbSymbol from existing orbItem data (for consistency)
	 */
	static fromOrbItem(cellW, cellH, orbItem) {
		return new OrbSymbol(cellW, cellH, orbItem);
	}
	
	/**
	 * Format orb item for display (with progressive meta)
	 */
	static formatOrbItemText(orbItem, progressiveMeta = {}) {
		if (orbItem.type === "C") {
			return String(orbItem.amount);
		} else if (orbItem.type === "JP") {
			return progressiveMeta[orbItem.id]?.label || orbItem.id;
		}
		return "?";
	}
}