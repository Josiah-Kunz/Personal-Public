class SkyGradient {
	constructor(config, starsConfig, resolution, horizonY) {
		this.config = config;
		this.starsConfig = starsConfig;
		this.resolution = resolution;
		this.horizonY = horizonY;
	}
	
	getPalette(t) {
		const nightTop = "#040814";
		const nightUpper = "#0b1733";
		const nightLowerBase = "#1a2950";
		const trueNightLower = "#0e1830";
		
		const dawnTop = "#4e88c6";
		const dawnUpper = "#8b99c9";
		const dawnLower = "#e6c1a2";
		
		const dayTop = "#4f88c7";
		const dayUpper = "#8f97cb";
		const dayLower = "#e7c5a6";
		
		const duskTop = "#437db8";
		const duskUpper = "#838dc8";
		const duskLower = "#ddb598";
		
		const nightLower = mixColor(trueNightLower, nightLowerBase, this.config.nightWarmth);
		
		let top, upper, lower;
		
		if (t < 0.25) {
			const k = smoothstep(0.0, 0.25, t);
			top = mixColor(nightTop, dawnTop, k);
			upper = mixColor(nightUpper, dawnUpper, k);
			lower = mixColor(rgbToHex(nightLower), dawnLower, k);
		} else if (t < 0.5) {
			const k = smoothstep(0.25, 0.5, t);
			top = mixColor(dawnTop, dayTop, k);
			upper = mixColor(dawnUpper, dayUpper, k);
			lower = mixColor(dawnLower, dayLower, k);
		} else if (t < 0.75) {
			const k = smoothstep(0.5, 0.75, t);
			top = mixColor(dayTop, duskTop, k);
			upper = mixColor(dayUpper, duskUpper, k);
			lower = mixColor(dayLower, duskLower, k);
		} else {
			const k = smoothstep(0.75, 1.0, t);
			top = mixColor(duskTop, nightTop, k);
			upper = mixColor(duskUpper, nightUpper, k);
			lower = mixColor(duskLower, rgbToHex(nightLower), k);
		}
		
		const cfg = this.starsConfig;
		const nightFactor = Math.max(
			1 - smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t),
			smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t)
		) * this.config.nightDarkness;
		
		if (nightFactor > 0) {
			top = mixColor(rgbToHex(top), "#040915", nightFactor * 0.45);
			upper = mixColor(rgbToHex(upper), "#0c1631", nightFactor * 0.45);
			lower = mixColor(rgbToHex(lower), "#121a33", nightFactor * 0.5);
		}
		
		return { top, upper, lower };
	}
	
	draw(ctx, t) {
		const palette = this.getPalette(t);
		const width = this.resolution.width;
		
		for (let y = 0; y < this.horizonY; y++) {
			const k = y / Math.max(1, this.horizonY - 1);
			const c = k < 0.48
				? mixColor(rgbToHex(palette.top), rgbToHex(palette.upper), k / 0.48)
				: mixColor(rgbToHex(palette.upper), rgbToHex(palette.lower), (k - 0.48) / 0.52);
			
			ctx.fillStyle = rgb(c);
			ctx.fillRect(0, y, width, 1);
		}
		
		return palette;
	}
	
	drawAtmosphericHaze(ctx, t) {
		const width = this.resolution.width;
		const dayness = clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
		
		for (let y = this.horizonY - 18; y < this.horizonY + 8; y++) {
			const d = Math.abs(y - this.horizonY) / 26;
			ctx.fillStyle = `rgba(255,235,200,${(1 - d) * (0.02 + 0.06 * dayness)})`;
			ctx.fillRect(0, y, width, 1);
		}
	}
	
	drawHorizonGlow(ctx, sun, moon) {
		const width = this.resolution.width;
		const sunStrength = sun ? clamp(1 - Math.abs(this.horizonY - sun.y) / 90, 0, 1) : 0;
		const moonStrength = moon ? clamp(1 - Math.abs(this.horizonY - moon.y) / 90, 0, 1) * 0.28 : 0;
		
		for (let y = -18; y <= 18; y++) {
			const yy = this.horizonY + y;
			if (yy < 0 || yy >= this.resolution.height) continue;
			
			const sAlpha = Math.max(0, 0.12 - Math.abs(y) * 0.0055) * sunStrength;
			const mAlpha = Math.max(0, 0.04 - Math.abs(y) * 0.0022) * moonStrength;
			
			if (sAlpha > 0) {
				ctx.fillStyle = `rgba(255,218,100,${sAlpha})`;
				ctx.fillRect(0, yy, width, 1);
			}
			if (mAlpha > 0) {
				ctx.fillStyle = `rgba(232,240,255,${mAlpha})`;
				ctx.fillRect(0, yy, width, 1);
			}
		}
	}
}