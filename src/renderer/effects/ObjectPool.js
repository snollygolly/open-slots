import { Sprite } from "pixi.js";

/**
 * Generic object pool for reusing expensive objects like particles, sprites, etc.
 * Helps reduce garbage collection pressure and improve performance.
 */
export class ObjectPool {
	constructor(createFn, resetFn = null, maxSize = 100) {
		this.createFn = createFn;
		this.resetFn = resetFn;
		this.maxSize = maxSize;
		this.pool = [];
		this.activeObjects = new Set();
	}

	/**
	 * Get an object from the pool
	 * @returns {Object} Pooled object
	 */
	get() {
		let obj;
		
		if (this.pool.length > 0) {
			obj = this.pool.pop();
		} else {
			obj = this.createFn();
		}

		this.activeObjects.add(obj);
		return obj;
	}

	/**
	 * Return an object to the pool
	 * @param {Object} obj - Object to return
	 */
	release(obj) {
		if (!this.activeObjects.has(obj)) {
			console.warn("Attempting to release object that wasn't obtained from this pool");
			return;
		}

		this.activeObjects.delete(obj);

		// Reset object if reset function provided
		if (this.resetFn) {
			this.resetFn(obj);
		}

		// Only return to pool if under max size
		if (this.pool.length < this.maxSize) {
			this.pool.push(obj);
		}
	}

	/**
	 * Release all active objects back to the pool
	 */
	releaseAll() {
		const objects = Array.from(this.activeObjects);
		objects.forEach(obj => this.release(obj));
	}

	/**
	 * Get the number of objects currently in the pool
	 * @returns {number}
	 */
	getPoolSize() {
		return this.pool.length;
	}

	/**
	 * Get the number of active objects
	 * @returns {number}
	 */
	getActiveCount() {
		return this.activeObjects.size;
	}

	/**
	 * Clear the entire pool and destroy objects if needed
	 * @param {Function} [destroyFn] - Optional function to destroy objects
	 */
	clear(destroyFn = null) {
		// Release all active objects first
		this.releaseAll();

		// Destroy pooled objects if destroy function provided
		if (destroyFn) {
			this.pool.forEach(destroyFn);
		}

		this.pool = [];
		this.activeObjects.clear();
	}

	/**
	 * Pre-fill the pool with objects
	 * @param {number} count - Number of objects to create
	 */
	preFill(count) {
		const needed = Math.min(count, this.maxSize - this.pool.length);
		for (let i = 0; i < needed; i++) {
			this.pool.push(this.createFn());
		}
	}
}

/**
 * Specialized pool for PIXI sprites
 */
export class SpritePool extends ObjectPool {
	constructor(texture, maxSize = 100) {
		const createSprite = () => {
			return new Sprite(texture);
		};

		const resetSprite = (sprite) => {
			sprite.visible = false;
			sprite.x = 0;
			sprite.y = 0;
			sprite.rotation = 0;
			sprite.scale.set(1, 1);
			sprite.alpha = 1;
			sprite.tint = 0xffffff;
			if (sprite.parent) {
				sprite.parent.removeChild(sprite);
			}
		};

		super(createSprite, resetSprite, maxSize);
		this.texture = texture;
	}
}

/**
 * Specialized pool for particles/graphics objects
 */
export class ParticlePool extends ObjectPool {
	constructor(createParticleFn, maxSize = 200) {
		const resetParticle = (particle) => {
			// Common particle reset properties
			particle.x = 0;
			particle.y = 0;
			particle.vx = 0;
			particle.vy = 0;
			particle.life = 1;
			particle.age = 0;
			particle.alpha = 1;
			particle.rotation = 0;
			particle.scale = { x: 1, y: 1 };
			particle.visible = false;
			
			if (particle.parent) {
				particle.parent.removeChild(particle);
			}
		};

		super(createParticleFn, resetParticle, maxSize);
	}
}