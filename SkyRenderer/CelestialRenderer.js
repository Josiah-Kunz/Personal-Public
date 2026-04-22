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
		const cfg = this.arcConfig;

		const sunStart = cfg.sunHours[0] / 24;
		const sunEnd = cfg.sunHours[1] / 24;
		const sunRange = sunEnd - sunStart;

		const moonStart = cfg.moonHours[0] / 24;
		const moonEnd = cfg.moonHours[1] / 24;
		const moonWraps = moonEnd < moonStart;
		const moonRange = moonWraps ? (1.0 - moonStart) + moonEnd : moonEnd - moonStart;

		let sun = null;
		let moon = null;

		// Sun
		if (t >= sunStart && t <= sunEnd) {
			sun = this.getArcPoint((t - sunStart) / sunRange);
		}

		// Moon (handles midnight wrap)
		if (moonWraps) {
			if (t >= moonStart) {
				moon = this.getArcPoint((t - moonStart) / moonRange);
			} else if (t <= moonEnd) {
				moon = this.getArcPoint((t + (1.0 - moonStart)) / moonRange);
			}
		} else {
			if (t >= moonStart && t <= moonEnd) {
				moon = this.getArcPoint((t - moonStart) / moonRange);
			}
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