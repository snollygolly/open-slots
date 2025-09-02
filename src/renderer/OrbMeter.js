import { Container, Sprite, Texture } from "pixi.js";
import { Rumble } from "./effects/Rumble.js";
import { SparkleEmitter } from "./effects/SparkleEmitter.js";

export class OrbMeter {
  constructor(app, hostStage, x, y) {
    this.app = app;
    this.hostStage = hostStage;

    this.container = new Container();
    this.container.position.set(x, y);
    this.container.zIndex = 50;

    this.sprite = new Sprite(Texture.WHITE);
    this.container.addChild(this.sprite);
    
    this.spark = new SparkleEmitter(this.app, this.container);
    this.rumble = new Rumble(this.hostStage);

    this.progress01 = 0;
    this.frames = [];
    this.currentFrameIndex = 0;
    this._spinsPerFrame = 100;
    this._spinCounter = 0;

    this._boundUpdate = (delta) => {
      const dtMs = (typeof delta === "number" ? delta : delta?.deltaMS) || 16.7;
      this.spark.update(dtMs);
      this.rumble.update();
    };
    this.app.ticker.add(this._boundUpdate);

    this.ready = this._load();
  }

  async _load() {
    try {
      // Eagerly collect all progress frame images as URLs (Vite import glob)
      const progressUrls = import.meta.glob("../assets/progress*.png", { eager: true, as: "url" });
      const entries = Object.keys(progressUrls).map((p) => {
        const m = p.match(/progress(\d+)\.png$/);
        return { path: p, url: progressUrls[p], index: m ? parseInt(m[1], 10) : 0 };
      }).filter(e => !!e.url);

      if (entries.length === 0) {
        console.warn("[OrbMeter] No progress frames found (assets/progress*.png). Meter hidden.");
        this.container.visible = false;
        return;
      }

      // Sort by numeric suffix so adding progress5.png, progress6.png, ... just works
      entries.sort((a, b) => a.index - b.index);

      // Load images to ensure textures are ready
      const loadImage = (url) => new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
      });

      const images = await Promise.all(entries.map(e => loadImage(e.url)));
      const frames = images.map(img => Texture.from(img));

      this.frames = frames;
      this.sprite.texture = frames[0];
      this.sprite.visible = true;
    } catch (err) {
      console.error("[OrbMeter] Failed to load progress frames:", err);
      this.container.visible = false;
    }
  }

  setProgress01(v) {
    this.progress01 = Math.max(0, Math.min(1, v));
    
    if (!this.frames || this.frames.length <= 1) {
      return;
    }
    
    const idx = Math.round(this.progress01 * (this.frames.length - 1));
    if (idx !== this.currentFrameIndex) {
      const oldFrame = this.currentFrameIndex;
      this.currentFrameIndex = idx;
      this.sprite.texture = this.frames[idx];
      
      // Progressive effects when advancing to a new frame
      if (idx > oldFrame) {
        this._triggerProgressEffects(idx);
      }
    }
  }

  // Advance the meter by one spin. Every _spinsPerFrame spins, advance a frame.
  // When at the max frame, keep triggering effects every multiple of _spinsPerFrame.
  tickSpin() {
    if (!this.frames || this.frames.length === 0) return;
    this._spinCounter += 1;

    const maxIndex = this.frames.length - 1;
    const newIndex = Math.min(maxIndex, Math.floor(this._spinCounter / this._spinsPerFrame));

    if (newIndex > this.currentFrameIndex) {
      this.currentFrameIndex = newIndex;
      this.sprite.texture = this.frames[this.currentFrameIndex];
      this._triggerProgressEffects(this.currentFrameIndex);
    } else if (this._spinCounter % this._spinsPerFrame === 0) {
      // At cap (or same frame), still fire effects every block of spins
      this._triggerProgressEffects(this.currentFrameIndex);
    }
  }

  setSpinsPerFrame(n) {
    const v = Math.max(1, Math.floor(n || 100));
    this._spinsPerFrame = v;
  }

  // Reset to the first frame (progress1) and clear spin counter
  resetProgress() {
    this._spinCounter = 0;
    this.currentFrameIndex = 0;
    if (this.frames && this.frames.length > 0) {
      this.sprite.texture = this.frames[0];
    }
  }

  _triggerProgressEffects(frameIndex) {
    // Get sprite center for particle effects
    const cx = (this.sprite.width / 2) | 0;
    const cy = (this.sprite.height / 2) | 0;
    
    // Sparkle effects - more intense as we progress
    const sparkCount = Math.min(8 + (frameIndex * 2), 20);
    this.spark.burst({ x: cx, y: cy, count: sparkCount });
    
    // Rumble effect - gentle shake that increases with progress
    const rumbleIntensity = Math.min(2 + frameIndex, 6);
    const rumbleDuration = 200 + (frameIndex * 50);
    this.rumble.start(rumbleIntensity, rumbleDuration);
    
    // Debug logging removed for cleanliness
  }

  triggerTransition() {
    if (!this.frames || this.frames.length <= 1) {
      return;
    }

    // Animate through all frames quickly for the transition effect
    let currentFrame = 0;
    const animSpeed = 100; // ms between frames
    
    const animate = () => {
      if (currentFrame < this.frames.length) {
        this.sprite.texture = this.frames[currentFrame];
        currentFrame++;
        setTimeout(animate, animSpeed);
      }
    };
    animate();

    // Trigger visual effects
    const cx = (this.sprite.width / 2) | 0;
    const cy = (this.sprite.height / 2) | 0;
    this.spark.burst({ x: cx, y: cy, count: 36 });

    this.rumble.start(10, 550);
    setTimeout(() => {
      this.rumble.start(6, 320);
      this.spark.burst({ x: cx, y: cy, count: 24 });
    }, 560);
  }

  destroy() {
    this.app.ticker.remove(this._boundUpdate);
    this.container.destroy({ children: true });
  }
}
