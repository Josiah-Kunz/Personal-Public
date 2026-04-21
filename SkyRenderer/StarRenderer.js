class StarRenderer {
	constructor(config, resolution, horizonY) {
		this.config = config;
		this.resolution = resolution;
		this.horizonY = horizonY;
		
		this.stars = [];
		this.sprites = new Map();
		
		this.buildSprites();
		this.buildStars();
	}
	
	buildSprites() {
		this.sprites.clear();
		const cfg = this.config;
		
		for (let r = cfg.minSize; r <= cfg.maxSize; r++) {
			const size = r * 2 + 3;
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d", { alpha: true });
			ctx.imageSmoothingEnabled = false;
			fillCircle(ctx, Math.floor(size / 2), Math.floor(size / 2), r, "#ffffff");
			this.sprites.set(r, canvas);
		}
	}
	
	buildStars() {
		this.stars = [];
		const cfg = this.config;
		
		for (let i = 0; i < cfg.amount; i++) {
			this.stars.push({
				x: Math.floor(rand(0, this.resolution.width)),
				y: Math.floor(rand(8, this.horizonY - 26)),
				r: Math.random() > 0.85 ? cfg.maxSize : cfg.minSize,
				base: rand(0.45, 1),
				speed: rand(0.3, 0.9),
				offset: rand(0, Math.PI * 2)
			});
		}
	}
	
	getNightFactor(t) {
		const cfg = this.config;
		const nightA = 1 - this.smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t);
		const nightB = this.smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t);
		return Math.max(nightA, nightB);
	}
	
	smoothstep(a, b, x) {
		const t = clamp((x - a) / (b - a), 0, 1);
		return t * t * (3 - 2 * t);
	}
	
	draw(ctx, t, elapsed) {
		const night = this.getNightFactor(t);
		if (night <= 0.01) return;
		
		const cfg = this.config;
		
		for (const star of this.stars) {
			const twinkle = 1 - cfg.twinkleAmount + cfg.twinkleAmount *
				(0.76 + 0.24 * Math.sin(elapsed * 0.001 * star.speed + star.offset));
			
			const alpha = clamp(star.base * twinkle * night, 0, 1);
			const sprite = this.sprites.get(star.r);
			
			ctx.globalAlpha = alpha;
			ctx.drawImage(
				sprite,
				star.x - Math.floor(sprite.width / 2),
				star.y - Math.floor(sprite.height / 2)
			);
		}
		
		ctx.globalAlpha = 1;
	}
	
	destroy() {
		this.sprites.clear();
		this.stars = [];
	}
}