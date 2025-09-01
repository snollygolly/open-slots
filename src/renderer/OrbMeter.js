import { Container, Sprite, Texture, Graphics, Rectangle } from "pixi.js";
import { Rumble } from "./effects/Rumble.js";
import { SparkleEmitter } from "./effects/SparkleEmitter.js";
import orbSheetUrl from "../assets/orb_meter.png?url";

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
      console.log("[OrbMeter] Loading spritesheet from:", orbSheetUrl);
      console.log("[OrbMeter] Resolved URL type:", typeof orbSheetUrl, orbSheetUrl);
      
      // Use the working image element approach
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      this.ready = new Promise((resolve, reject) => {
        img.onload = () => {
          console.log("[OrbMeter] Image loaded, creating texture and frames");
          
          const tex = Texture.from(img);
          const w = tex.width;
          const h = tex.height;
          
          // Create 3x3 spritesheet frames
          const cols = 3;
          const rows = 3;
          const cellW = Math.floor(w / cols);
          const cellH = Math.floor(h / rows);

          const frames = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const rect = new Rectangle(c * cellW, r * cellH, cellW, cellH);
              const frameTexture = new Texture({
                source: tex.source,
                frame: rect
              });
              frames.push(frameTexture);
            }
          }

          this.frames = frames;
          this.sprite.texture = frames[0];
          this.sprite.visible = true;
          
          console.log(`[OrbMeter] Loaded ${frames.length} frames (${cellW}x${cellH} each)`);
          resolve();
        };
        
        img.onerror = (err) => {
          console.error("[OrbMeter] Failed to load image:", err);
          reject(err);
        };
      });
      
      img.src = orbSheetUrl;
      await this.ready;
      
    } catch (err) {
      console.error("[OrbMeter] Failed to load orb spritesheet:", err);
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
    
    console.log(`[OrbMeter] Frame ${frameIndex}: ${sparkCount} sparkles, rumble ${rumbleIntensity}/${rumbleDuration}ms`);
  }

  advanceBy(amount01) {
    this.setProgress01(this.progress01 + amount01);
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