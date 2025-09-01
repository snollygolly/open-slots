// src/renderer/effects/SparkleEmitter.js
import { Container, Graphics, Sprite } from "pixi.js";

/**
 * Lightweight sparkle emitter for Pixi v8.
 * Uses app.renderer.generateTexture(...) to create a texture from Graphics.
 */
export class SparkleEmitter {
	constructor(app, parent, color = 0xffffff) {
		this.app = app;
		this.parent = parent;
		this.container = new Container();
		this.parent.addChild(this.container);
		this.alive = [];

		this.tex = SparkleEmitter.makeSparkleTexture(app, color);
	}

	/**
	 * In Pixi v8, you cannot Texture.from(Graphics).
	 * Instead, render the Graphics to a texture via the renderer.
	 */
	static makeSparkleTexture(app, color = 0xffffff) {
		const g = new Graphics();

		// simple bright dot with halo
		g.circle(16, 16, 3);
		g.fill({ color: color, alpha: 1 });

		g.circle(16, 16, 6);
		g.stroke({ width: 1, color: color, alpha: 0.85 });

		// render Graphics into a texture
		const tex = app.renderer.generateTexture(g);
		g.destroy(true);

		return tex;
	}

	burst(opts) {
		const count = Math.max(8, (opts?.count | 0) || 0);
		const x = (opts?.x | 0) || 0;
		const y = (opts?.y | 0) || 0;

		for (let i = 0; i < count; i += 1) {
			const s = new Sprite(this.tex);
			s.anchor.set(0.5);
			s.x = x;
			s.y = y;
			s.alpha = 1;
			s.scale.set(0.8 + (Math.random() * 0.6));
			this.container.addChild(s);

			const a = Math.random() * Math.PI * 2;
			const sp = 2 + (Math.random() * 5);

			this.alive.push({
				sprite: s,
				age: 0,
				life: 500 + (Math.random() * 500),
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp,
				vr: ((Math.random() * 2) - 1) * 0.12
			});
		}
	}

	update(dtMs) {
		if (!this.alive.length) {
			return;
		}
		for (let i = this.alive.length - 1; i >= 0; i -= 1) {
			const p = this.alive[i];
			p.age += dtMs;
			const t = p.age / p.life;

			if (t >= 1) {
				if (p.sprite.parent) {
					p.sprite.parent.removeChild(p.sprite);
				}
				p.sprite.destroy();
				this.alive.splice(i, 1);
				continue;
			}

			p.sprite.x += p.vx;
			p.sprite.y += p.vy;
			p.sprite.rotation += p.vr;
			p.vy += 0.02;                // tiny gravity
			p.sprite.alpha = 1 - t;      // fade out
			const s = 1 + (t * 0.4);     // slight grow
			p.sprite.scale.set(s, s);
		}
	}
}
