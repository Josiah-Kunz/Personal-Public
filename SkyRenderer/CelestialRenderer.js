class CelestialRenderer {
	constructor(config, arcConfig, resolution, horizonY) {
		this.config = config;
		this.arcConfig = arcConfig;
		this.resolution = resolution;
		this.horizonY = horizonY;
	}
	
	getArcPoint(progress01) {
		const cfg = this.arcConfig;
		const start = degToRad(cfg.sunriseDeg);
		const end = degToRad(cfg.sunsetDeg);
		const angle = lerp(start, end, progress01);
		
		const centerX = this.resolution.width / 2;
		const centerY = this.horizonY + cfg.centerYOffset;
		const radiusX = this.resolution.width * cfg.widthFactor;
		const radiusY = cfg.peakHeight;
		
		return {
			x: Math.round(centerX + Math.cos(angle) * radiusX),
			y: Math.round(centerY - Math.sin(angle) * radiusY)
		};
	}
	
	getState(t) {
		const pad = this.arcConfig.phasePadding;
		const sunStart = 0.25 - pad;
		const sunEnd = 0.75 + pad;
		const moonStartA = 0.75 - pad;
		const moonEndA = 1.0;
		const moonStartB = 0.0;
		const moonEndB = 0.25 + pad;
		
		let sun = null;
		let moon = null;
		
		if (t >= sunStart && t <= sunEnd) {
			sun = this.getArcPoint((t - sunStart) / (sunEnd - sunStart));
		}
		
		if (t >= moonStartA && t <= moonEndA) {
			moon = this.getArcPoint(
				(t - moonStartA) / ((moonEndA - moonStartA) + (moonEndB - moonStartB))
			);
		} else if (t >= moonStartB && t <= moonEndB) {
			moon = this.getArcPoint(
				((t - moonStartB) + (moonEndA - moonStartA)) /
				((moonEndA - moonStartA) + (moonEndB - moonStartB))
			);
		}
		
		return { sun, moon };
	}
	
	shouldDraw(body, radius, cloudThickness = 0) {
		if (!body) return false;
		return body.y < this.horizonY + this.arcConfig.visibilityBelowHorizon + radius + cloudThickness;
	}
	
	drawSun(ctx, x, y) {
		const cfg = this.config;
		const r = cfg.sunRadius;
		
		fillGlow(ctx, x, y, r, cfg.sunGlowRadius, "#ffd23f", cfg.sunGlowAlpha * 0.55);
		fillGlow(ctx, x, y, r, Math.round(cfg.sunGlowRadius * 0.72), "#ffea7a", cfg.sunGlowAlpha);
		
		fillCircle(ctx, x, y, r, "#ffd23f");
		fillCircle(ctx, x, y, r - 1, "#ffe76a");
		fillCircle(ctx, x - 4, y - 4, 2, "rgba(255,255,255,0.18)");
	}
	
	drawMoon(ctx, x, y) {
		const cfg = this.config;
		const r = cfg.moonRadius;
		
		fillGlow(ctx, x, y, r, cfg.moonGlowRadius, "#dfe8ff", cfg.moonGlowAlpha * 0.65);
		fillGlow(ctx, x, y, r, Math.round(cfg.moonGlowRadius * 0.72), "#ffffff", cfg.moonGlowAlpha);
		
		fillCircle(ctx, x, y, r, "#f7fbff");
		fillCircle(ctx, x, y, r - 1, "#ffffff");
		
		fillCircle(
			ctx,
			x + cfg.moonCrescentOffsetX,
			y + cfg.moonCrescentOffsetY,
			Math.max(2, r - cfg.moonCrescentRadiusOffset),
			"rgba(180,195,230,0.30)"
		);
		
		fillCircle(ctx, x - 2, y - 2, 1, "rgba(255,255,255,0.16)");
	}
	
	draw(ctx, t, cloudThickness = 0) {
		const { sun, moon } = this.getState(t);
		
		if (sun && this.shouldDraw(sun, this.config.sunRadius, cloudThickness)) {
			this.drawSun(ctx, sun.x, sun.y);
		}
		if (moon && this.shouldDraw(moon, this.config.moonRadius, cloudThickness)) {
			this.drawMoon(ctx, moon.x, moon.y);
		}
		
		return { sun, moon };
	}
}