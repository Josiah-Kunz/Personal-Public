window.StarRenderer = class StarRenderer {
	constructor(config, resolution, horizonY) {
		this.config = config;
		this.resolution = resolution;
		this.horizonY = horizonY;
		
		this.stars = null;  // Typed array for better cache locality
		this.starCount = 0;
		this.sprites = [];  // Array instead of Map (faster lookup by index)
		this.spriteOffsets = [];
		
		this.buildSprites();
		this.buildStars();
	}
	
	buildSprites() {
		const cfg = this.config;
		this.sprites = [];
		this.spriteOffsets = [];
		
		for (let r = cfg.minSize; r <= cfg.maxSize; r++) {
			const size = r * 2 + 3;
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d", { alpha: true });
			fillCircle((size / 2) | 0, (size / 2) | 0, r, "#ffffff", ctx);
			
			this.sprites[r] = canvas;
			this.spriteOffsets[r] = (size / 2) | 0;
		}
	}
	
	buildStars() {
		const cfg = this.config;
		const count = cfg.amount;
		this.starCount = count;
		
		// Flat array: [x, y, r, base, speed, offset, x, y, r, ...]
		// 6 values per star
		this.stars = new Float32Array(count * 6);
		
		const width = this.resolution.width;
		const maxY = this.horizonY - 26;
		
		for (let i = 0; i < count; i++) {
			const idx = i * 6;
			this.stars[idx]     = (Math.random() * width) | 0;           // x
			this.stars[idx + 1] = (8 + Math.random() * (maxY - 8)) | 0;  // y
			this.stars[idx + 2] = Math.random() > 0.85 ? cfg.maxSize : cfg.minSize; // r
			this.stars[idx + 3] = 0.45 + Math.random() * 0.55;           // base
			this.stars[idx + 4] = 0.3 + Math.random() * 0.6;             // speed
			this.stars[idx + 5] = Math.random() * Math.PI * 2;           // offset
		}
	}
	
	draw(ctx, t, elapsed) {
		// Early exit
		const cfg = this.config;
		const fadeOut = cfg.fadeOutStart;
		const fadeOutEnd = cfg.fadeOutEnd;
		const fadeIn = cfg.fadeInStart;
		const fadeInEnd = cfg.fadeInEnd;
		
		// Inline night factor calculation
		let nightA = 0, nightB = 0;
		
		if (t < fadeOutEnd) {
			const k = t <= fadeOut ? 0 : (t - fadeOut) / (fadeOutEnd - fadeOut);
			nightA = 1 - k * k * (3 - 2 * k);
		}
		if (t > fadeIn) {
			const k = t >= fadeInEnd ? 1 : (t - fadeIn) / (fadeInEnd - fadeIn);
			nightB = k * k * (3 - 2 * k);
		}
		
		const night = nightA > nightB ? nightA : nightB;
		if (night <= 0.01) return;
		
		// Pre-calculate twinkle constants
		const twinkleBase = 1 - cfg.twinkleAmount;
		const twinkleRange = cfg.twinkleAmount * 0.24;
		const twinkleOffset = cfg.twinkleAmount * 0.76;
		const timeScale = elapsed * 0.001;
		
		const stars = this.stars;
		const count = this.starCount;
		const sprites = this.sprites;
		const offsets = this.spriteOffsets;
		
		for (let i = 0; i < count; i++) {
			const idx = i * 6;
			const x = stars[idx];
			const y = stars[idx + 1];
			const r = stars[idx + 2];
			const base = stars[idx + 3];
			const speed = stars[idx + 4];
			const phase = stars[idx + 5];
			
			const twinkle = twinkleBase + twinkleOffset + twinkleRange * Math.sin(timeScale * speed + phase);
			const alpha = base * twinkle * night;
			
			// Skip nearly invisible stars
			if (alpha < 0.02) continue;
			
			const sprite = sprites[r];
			const offset = offsets[r];
			
			ctx.globalAlpha = alpha > 1 ? 1 : alpha;
			ctx.drawImage(sprite, x - offset, y - offset);
		}
		
		ctx.globalAlpha = 1;
	}
	
	destroy() {
		this.sprites = [];
		this.stars = null;
	}
}