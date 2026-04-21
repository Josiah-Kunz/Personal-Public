window.CelestialRenderer = class CelestialRenderer {
	constructor(config, arcConfig, resolution, horizonY) {
		this.config = config;
		this.arcConfig = arcConfig;
		this.resolution = resolution;
		this.horizonY = horizonY;
		
		// Pre-rendered sprites
		this.sunSprite = null;
		this.moonSprite = null;
		this.sunOffset = { x: 0, y: 0 };
		this.moonOffset = { x: 0, y: 0 };
		
		this.buildSprites();
	}
	
	buildSprites() {
		this.sunSprite = this.buildSunSprite();
		this.moonSprite = this.buildMoonSprite();
	}
	
	buildSunSprite() {
		const cfg = this.config;
		const r = cfg.sunRadius;
		const glowR = cfg.sunGlowRadius;
		const size = glowR * 2 + 4;
		const center = Math.floor(size / 2);
		
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d", { alpha: true });
		ctx.imageSmoothingEnabled = false;
		
		// Outer glow
		fillGlow(ctx, center, center, r, glowR, "#ffd23f", cfg.sunGlowAlpha * 0.55);
		// Inner glow
		fillGlow(ctx, center, center, r, Math.round(glowR * 0.72), "#ffea7a", cfg.sunGlowAlpha);
		// Sun body
		fillCircle(ctx, center, center, r, "#ffd23f");
		fillCircle(ctx, center, center, r - 1, "#ffe76a");
		// Highlight
		fillCircle(ctx, center - 4, center - 4, 2, "rgba(255,255,255,0.18)");
		
		this.sunOffset = { x: center, y: center };
		return canvas;
	}
	
	buildMoonSprite() {
		const cfg = this.config;
		const r = cfg.moonRadius;
		const glowR = cfg.moonGlowRadius;
		const size = glowR * 2 + 4;
		const center = Math.floor(size / 2);
		
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d", { alpha: true });
		ctx.imageSmoothingEnabled = false;
		
		// Outer glow
		fillGlow(ctx, center, center, r, glowR, "#dfe8ff", cfg.moonGlowAlpha * 0.65);
		// Inner glow
		fillGlow(ctx, center, center, r, Math.round(glowR * 0.72), "#ffffff", cfg.moonGlowAlpha);
		// Moon body
		fillCircle(ctx, center, center, r, "#f7fbff");
		fillCircle(ctx, center, center, r - 1, "#ffffff");
		// Crescent shadow
		fillCircle(
			ctx,
			center + cfg.moonCrescentOffsetX,
			center + cfg.moonCrescentOffsetY,
			Math.max(2, r - cfg.moonCrescentRadiusOffset),
			"rgba(180,195,230,0.30)"
		);
		// Highlight
		fillCircle(ctx, center - 2, center - 2, 1, "rgba(255,255,255,0.16)");
		
		this.moonOffset = { x: center, y: center };
		return canvas;
	}
	
	getArcPoint(progress01) {
		const cfg = this.arcConfig;
		const start = degToRad(cfg.sunriseDeg);
		const end = degToRad(cfg.sunsetDeg);
		const angle = start + (end - start) * progress01;
		
		const centerX = this.resolution.width * 0.5;
		const centerY = this.horizonY + cfg.centerYOffset;
		const radiusX = this.resolution.width * cfg.widthFactor;
		const radiusY = cfg.peakHeight;
		
		return {
			x: (centerX + Math.cos(angle) * radiusX + 0.5) | 0,
			y: (centerY - Math.sin(angle) * radiusY + 0.5) | 0
		};
	}
	
	getState(t) {
		const pad = this.arcConfig.phasePadding;
		const sunStart = 0.25 - pad;
		const sunEnd = 0.75 + pad;
		const sunRange = sunEnd - sunStart;
		
		const moonStartA = 0.75 - pad;
		const moonRange = (1.0 - moonStartA) + (0.25 + pad);
		
		let sun = null;
		let moon = null;
		
		if (t >= sunStart && t <= sunEnd) {
			sun = this.getArcPoint((t - sunStart) / sunRange);
		}
		
		if (t >= moonStartA) {
			moon = this.getArcPoint((t - moonStartA) / moonRange);
		} else if (t <= 0.25 + pad) {
			moon = this.getArcPoint((t + (1.0 - moonStartA)) / moonRange);
		}
		
		return { sun, moon };
	}
	
	shouldDraw(body, radius, cloudThickness) {
		if (!body) return false;
		return body.y < this.horizonY + this.arcConfig.visibilityBelowHorizon + radius + cloudThickness;
	}
	
	draw(ctx, t, cloudThickness = 0) {
		const { sun, moon } = this.getState(t);
		
		if (sun && this.shouldDraw(sun, this.config.sunRadius, cloudThickness)) {
			ctx.drawImage(
				this.sunSprite,
				sun.x - this.sunOffset.x,
				sun.y - this.sunOffset.y
			);
		}
		
		if (moon && this.shouldDraw(moon, this.config.moonRadius, cloudThickness)) {
			ctx.drawImage(
				this.moonSprite,
				moon.x - this.moonOffset.x,
				moon.y - this.moonOffset.y
			);
		}
		
		return { sun, moon };
	}
	
	destroy() {
		this.sunSprite = null;
		this.moonSprite = null;
	}
}