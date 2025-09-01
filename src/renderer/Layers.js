import { Container } from "pixi.js";

/**
 * Defines predictable rendering layers for the slot machine renderer.
 * Higher zIndex values render on top of lower values.
 */
export const Layers = {
	// Background elements (lowest layer)
	BACKGROUND: 0,
	
	// Reel symbols and spinning elements
	REELS: 10,
	
	// Overlay elements like win highlights
	OVERLAY: 20,
	
	// Background effects (behind UI but above reels)
	FX_BACK: 30,
	
	// Foreground effects (above everything except UI)
	FX_FRONT: 40,
	
	// User interface elements (highest layer)
	UI: 50
};

/**
 * Utility function to set up standard layers on a container
 * @param {Object} parentContainer - PIXI Container to add layers to
 * @returns {Object} Object containing references to each layer container
 */
export function setupLayers(parentContainer) {
	const layers = {};
	
	Object.entries(Layers).forEach(([name, zIndex]) => {
		const layer = new Container();
		layer.zIndex = zIndex;
		layer.sortableChildren = true;
		parentContainer.addChild(layer);
		layers[name.toLowerCase()] = layer;
	});
	
	// Ensure parent container sorts children by zIndex
	parentContainer.sortableChildren = true;
	
	return layers;
}

/**
 * Get layer name by zIndex value
 * @param {number} zIndex - Z-index value
 * @returns {string|null} Layer name or null if not found
 */
export function getLayerName(zIndex) {
	const entry = Object.entries(Layers).find(([, value]) => value === zIndex);
	return entry ? entry[0] : null;
}

/**
 * Validate that a zIndex is a known layer
 * @param {number} zIndex - Z-index to validate
 * @returns {boolean} True if valid layer
 */
export function isValidLayer(zIndex) {
	return Object.values(Layers).includes(zIndex);
}