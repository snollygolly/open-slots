// Map game symbols to bundled asset URLs (Vite `?url` for stable paths)
import aceUrl from "../assets/ace.png?url";
import kingUrl from "../assets/king.png?url";
import queenUrl from "../assets/queen.png?url";
import jackUrl from "../assets/jack.png?url";
import tenUrl from "../assets/ten.png?url";

import lanternUrl from "../assets/lantern.png?url";
import frogUrl from "../assets/frog.png?url";
import gatorUrl from "../assets/gator.png?url";
import lilyUrl from "../assets/lily.png?url";

import wildUrl from "../assets/wild.png?url";
// Use "freegame" art for scatter symbol
import scatterUrl from "../assets/freegame.png?url";
import orbUrl from "../assets/orb.png?url";

// Symbol key → image URL
export const symbolToUrl = {
  A: aceUrl,
  K: kingUrl,
  Q: queenUrl,
  J: jackUrl,
  T: tenUrl,

  LANTERN: lanternUrl,
  FROG: frogUrl,
  GATOR: gatorUrl,
  LILY: lilyUrl,

  WILD: wildUrl,
  SCATTER: scatterUrl,
  ORB: orbUrl,
};

export function getSymbolUrl(sym) {
  return symbolToUrl[sym];
}

// Preload textures via Pixi Assets and cache them for fast sprite creation
import { Assets } from "pixi.js";

const symbolTextureCache = new Map(); // sym -> Texture

export async function preloadSymbolTextures() {
  const entries = Object.entries(symbolToUrl);
  const tasks = entries.map(([sym, url]) => Assets.load({ src: url, alias: url }));
  const texList = await Promise.all(tasks);
  for (let i = 0; i < entries.length; i += 1) {
    const [sym, url] = entries[i];
    symbolTextureCache.set(sym, texList[i]);
  }
}

export function getSymbolTexture(sym) {
  return symbolTextureCache.get(sym) || null;
}

