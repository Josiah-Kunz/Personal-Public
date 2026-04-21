window.OceanRenderer = class OceanRenderer {
	constructor(config, starsConfig, resolution, horizonY) {
		this.config = config;
		this.starsConfig = starsConfig;
		this.resolution = resolution;
		this.horizonY = horizonY;
	}
	
	getWaterPalette(t, skyPalette) {
		const cfg = this.starsConfig;
		const nightA = 1 - smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t);
		const nightB = smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t);
		const night = Math.max(nightA, nightB);
		const day = 1 - night;
		
		const dawnTint = smoothstep(0.18, 0.30, t) * (1 - smoothstep(0.45, 0.55, t));
		const duskTint = smoothstep(0.55, 0.68, t) * (1 - smoothstep(0.82, 0.95, t));
		
		const baseTop = mixColor("#16314b", "#4cc9d8", day * 0.85 + dawnTint * 0.15 + duskTint * 0.10);
		const baseMid = mixColor("#10253f", "#2f9fbe", day * 0.8 + dawnTint * 0.12 + duskTint * 0.08);
		const baseBottom = mixColor("#0b1930", "#1f6f94", day * 0.75);
		
		const waterCfg = this.config;
		return {
			top: mixColor(rgbToHex(baseTop), rgbToHex(skyPalette.lower), waterCfg.ambientReflectionStrength * 0.45),
			mid: mixColor(rgbToHex(baseMid), rgbToHex(skyPalette.upper), waterCfg.ambientReflectionStrength * 0.22),
			bottom: baseBottom
		};
	}
	
	drawBase(ctx, t, skyPalette) {
		const water = this.getWaterPalette(t, skyPalette);
		const width = this.resolution.width;
		const height = this.resolution.height;
		
		for (let y = this.horizonY; y < height; y++) {
			const depthT = (y - this.horizonY) / Math.max(1, height - this.horizonY - 1);
			
			let c;
			if (depthT < 0.28) {
				c = mixColor(rgbToHex(water.top), rgbToHex(water.mid), depthT / 0.28);
			} else {
				c = mixColor(rgbToHex(water.mid), rgbToHex(water.bottom), (depthT - 0.28) / 0.72);
			}
			
			ctx.fillStyle = rgb(c);
			ctx.fillRect(0, y, width, 1);
		}
	}
	
	drawAmbientReflection(ctx, skyPalette, elapsed) {
		const width = this.resolution.width;
		const cfg = this.config;
		const topReflect = mixColor(rgbToHex(skyPalette.lower), "#ffffff", 0.06);
		const midReflect = mixColor(rgbToHex(skyPalette.upper), rgbToHex(skyPalette.lower), 0.25);
		const depth = Math.max(16, Math.round(cfg.shimmerDepth * 1.4));
		
		for (let y = this.horizonY + 1; y < this.horizonY + depth; y++) {
			const t = (y - this.horizonY) / depth;
			const fade = 1 - t;
			const lineColor = t < 0.35
				? mixColor(rgbToHex(topReflect), rgbToHex(midReflect), t / 0.35)
				: midReflect;
			
			ctx.fillStyle = rgb(lineColor, 0.10 * fade);
			ctx.fillRect(0, y, width, 1);
			
			for (let x = 0; x < width; x += 4) {
				const wave =
					Math.sin(x * 0.11 + y * 1.35 + elapsed * 0.0009) * 0.5 +
					Math.sin(x * 0.035 + elapsed * 0.0005 + 1.3) * 0.3 +
					0.5;
				
				if (wave > 0.88) {
					ctx.fillStyle = `rgba(255,255,255,${0.028 * fade})`;
					ctx.fillRect(x, y, 2, 1);
				}
			}
		}
	}
	
	drawCelestialReflection(ctx, body, options, elapsed) {
		if (!body) return;
		
		const cfg = this.config;
		const above = clamp(
			(this.horizonY - body.y + options.radius) / options.fadeHeight,
			0,
			1
		);
		if (above <= 0) return;
		
		const startY = this.horizonY + 1;
		const endY = Math.min(this.resolution.height - 1, this.horizonY + options.length);
		
		for (let y = startY; y <= endY; y += cfg.trailSegmentHeight + cfg.trailGap) {
			const ty = (y - startY) / Math.max(1, endY - startY);
			const halfWidth = Math.max(
				1,
				Math.round(
					lerp(options.widthNear, options.widthFar, Math.pow(ty, cfg.trailTaper)) * above
				)
			);
			
			const wobble =
				Math.sin(y * 0.18 + elapsed * 0.0012) * cfg.trailWobble +
				Math.sin(y * 0.05 + 1.7) * cfg.trailWobble * 0.5;
			
			const centerX = Math.round(body.x + wobble);
			
			for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 2) {
				const nx = Math.abs(x - centerX) / Math.max(1, halfWidth);
				const edge = 1 - nx;
				
				const breakup =
					Math.sin(x * options.freqA + y * options.freqB + elapsed * options.speed) * 0.5 +
					Math.sin(x * 0.11 + y * 0.035 + 2.1) * 0.35 +
					0.5;
				
				if (breakup > 1 - cfg.trailBreakup - edge * 0.28) {
					const alpha =
						options.alpha *
						(1 - ty) *
						edge *
						above *
						cfg.celestialReflectionStrength;
					
					ctx.fillStyle = `rgba(${options.color.r},${options.color.g},${options.color.b},${alpha})`;
					ctx.fillRect(x, y, 2, cfg.trailSegmentHeight);
				}
			}
		}
	}
	
	drawShimmer(ctx, elapsed) {
		const cfg = this.config;
		const width = this.resolution.width;
		const depth = Math.round(cfg.shimmerDepth * cfg.detail);
		
		for (let y = this.horizonY + 2; y < this.horizonY + depth; y++) {
			const fade = 1 - (y - (this.horizonY + 2)) / Math.max(1, depth - 2);
			
			for (let x = 0; x < width; x += 3) {
				const wave =
					Math.sin(x * 0.17 + y * 1.5 + elapsed * 0.0012 * cfg.detail) * 0.5 +
					0.5;
				
				if (wave > 0.94 - cfg.detail * 0.12) {
					ctx.fillStyle = `rgba(255,255,255,${0.03 * fade})`;
					ctx.fillRect(x, y, 2, 1);
				}
			}
		}
	}
	
	drawSurfaceLines(ctx, elapsed) {
		const cfg = this.config;
		const width = this.resolution.width;
		const maxY = this.horizonY + Math.round(28 * cfg.detail);
		
		for (let y = this.horizonY + 5; y < maxY; y += 3) {
			const fade = 1 - (y - this.horizonY) / Math.max(1, maxY - this.horizonY);
			
			for (let x = 0; x < width; x += 4) {
				const n =
					Math.sin(x * 0.1 + y * 1.2 + elapsed * 0.0009 * cfg.detail) * 0.5 +
					0.5;
				
				if (n > 0.82) {
					ctx.fillStyle = `rgba(255,255,255,${0.022 * fade})`;
					ctx.fillRect(x, y, 2, 1);
				}
			}
		}
	}
	
	draw(ctx, t, skyPalette, sun, moon, celestialConfig, elapsed) {
		this.drawBase(ctx, t, skyPalette);
		this.drawAmbientReflection(ctx, skyPalette, elapsed);
		
		const cfg = this.config;
		
		this.drawCelestialReflection(ctx, sun, {
			color: { r: 255, g: 226, b: 110 },
			radius: celestialConfig.sunRadius,
			length: cfg.reflectionLengthSun,
			widthNear: cfg.trailWidthSun,
			widthFar: cfg.trailWidthFarSun,
			alpha: cfg.sunReflectionAlpha * cfg.detail,
			freqA: 0.18,
			freqB: 0.11,
			speed: 0.0008,
			fadeHeight: 180
		}, elapsed);
		
		this.drawCelestialReflection(ctx, moon, {
			color: { r: 255, g: 255, b: 255 },
			radius: celestialConfig.moonRadius,
			length: cfg.reflectionLengthMoon,
			widthNear: cfg.trailWidthMoon,
			widthFar: cfg.trailWidthFarMoon,
			alpha: cfg.moonReflectionAlpha * cfg.detail,
			freqA: 0.16,
			freqB: 0.09,
			speed: 0.0006,
			fadeHeight: 160
		}, elapsed);
		
		this.drawShimmer(ctx, elapsed);
		this.drawSurfaceLines(ctx, elapsed);
	}
}