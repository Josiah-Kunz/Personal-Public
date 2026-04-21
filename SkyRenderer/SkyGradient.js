window.SkyGradient = class SkyGradient {
	constructor(config, starsConfig, resolution, horizonY) {
		this.config = config;
		this.starsConfig = starsConfig;
		this.resolution = resolution;
		this.horizonY = horizonY;
		
		// Cache
		this.cachedT = -1;
		this.cachedPalette = null;
		this.gradientImageData = null;
	}
	
	getPalette(t) {
		// Pre-computed RGB values instead of hex strings
		const palettes = {
			night: { top: {r:4,g:8,b:20}, upper: {r:11,g:23,b:51}, lowerBase: {r:26,g:41,b:80}, trueLower: {r:14,g:24,b:48} },
			dawn:  { top: {r:78,g:136,b:198}, upper: {r:139,g:153,b:201}, lower: {r:230,g:193,b:162} },
			day:   { top: {r:79,g:136,b:199}, upper: {r:143,g:151,b:203}, lower: {r:231,g:197,b:166} },
			dusk:  { top: {r:67,g:125,b:184}, upper: {r:131,g:141,b:200}, lower: {r:221,g:181,b:152} }
		};
		
		const p = palettes;
		const nightLower = mixColor(p.night.trueLower, p.night.lowerBase, this.config.nightWarmth);
		
		let top, upper, lower;
		
		if (t < 0.25) {
			const k = smoothstep(0.0, 0.25, t);
			top = mixColor(p.night.top, p.dawn.top, k);
			upper = mixColor(p.night.upper, p.dawn.upper, k);
			lower = mixColor(nightLower, p.dawn.lower, k);
		} else if (t < 0.5) {
			const k = smoothstep(0.25, 0.5, t);
			top = mixColor(p.dawn.top, p.day.top, k);
			upper = mixColor(p.dawn.upper, p.day.upper, k);
			lower = mixColor(p.dawn.lower, p.day.lower, k);
		} else if (t < 0.75) {
			const k = smoothstep(0.5, 0.75, t);
			top = mixColor(p.day.top, p.dusk.top, k);
			upper = mixColor(p.day.upper, p.dusk.upper, k);
			lower = mixColor(p.day.lower, p.dusk.lower, k);
		} else {
			const k = smoothstep(0.75, 1.0, t);
			top = mixColor(p.dusk.top, p.night.top, k);
			upper = mixColor(p.dusk.upper, p.night.upper, k);
			lower = mixColor(p.dusk.lower, nightLower, k);
		}
		
		const cfg = this.starsConfig;
		const nightFactor = Math.max(
			1 - smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t),
			smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t)
		) * this.config.nightDarkness;
		
		if (nightFactor > 0) {
			const darkTop = {r:4,g:9,b:21};
			const darkUpper = {r:12,g:22,b:49};
			const darkLower = {r:18,g:26,b:51};
			top = mixColor(top, darkTop, nightFactor * 0.45);
			upper = mixColor(upper, darkUpper, nightFactor * 0.45);
			lower = mixColor(lower, darkLower, nightFactor * 0.5);
		}
		
		return { top, upper, lower };
	}
	
	buildGradient(ctx, palette) {
		const width = this.resolution.width;
		const height = this.horizonY;
		
		if (!this.gradientImageData || this.gradientImageData.width !== width) {
			this.gradientImageData = ctx.createImageData(width, height);
		}
		
		const data = this.gradientImageData.data;
		const top = palette.top;
		const upper = palette.upper;
		const lower = palette.lower;
		const hm1 = Math.max(1, height - 1);
		
		for (let y = 0; y < height; y++) {
			const k = y / hm1;
			
			let r, g, b;
			if (k < 0.48) {
				const t = k / 0.48;
				r = top.r + (upper.r - top.r) * t;
				g = top.g + (upper.g - top.g) * t;
				b = top.b + (upper.b - top.b) * t;
			} else {
				const t = (k - 0.48) / 0.52;
				r = upper.r + (lower.r - upper.r) * t;
				g = upper.g + (lower.g - upper.g) * t;
				b = upper.b + (lower.b - upper.b) * t;
			}
			
			// Round once
			const ri = (r + 0.5) | 0;
			const gi = (g + 0.5) | 0;
			const bi = (b + 0.5) | 0;
			
			// Fill entire row
			const rowStart = y * width * 4;
			for (let x = 0; x < width; x++) {
				const i = rowStart + x * 4;
				data[i] = ri;
				data[i + 1] = gi;
				data[i + 2] = bi;
				data[i + 3] = 255;
			}
		}
		
		return this.gradientImageData;
	}
	
	draw(ctx, t) {
		const palette = this.getPalette(t);
		const imageData = this.buildGradient(ctx, palette);
		ctx.putImageData(imageData, 0, 0);
		return palette;
	}
	
	drawAtmosphericHaze(ctx, t) {
		const width = this.resolution.width;
		const dayness = clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
		const baseAlpha = 0.02 + 0.06 * dayness;
		
		for (let y = this.horizonY - 18; y < this.horizonY + 8; y++) {
			const d = Math.abs(y - this.horizonY) / 26;
			const alpha = (1 - d) * baseAlpha;
			if (alpha < 0.001) continue;
			ctx.fillStyle = `rgba(255,235,200,${alpha})`;
			ctx.fillRect(0, y, width, 1);
		}
	}
	
	drawHorizonGlow(ctx, sun, moon) {
		const width = this.resolution.width;
		const sunStrength = sun ? clamp(1 - Math.abs(this.horizonY - sun.y) / 90, 0, 1) : 0;
		const moonStrength = moon ? clamp(1 - Math.abs(this.horizonY - moon.y) / 90, 0, 1) * 0.28 : 0;
		
		if (sunStrength < 0.001 && moonStrength < 0.001) return;
		
		for (let y = -18; y <= 18; y++) {
			const yy = this.horizonY + y;
			if (yy < 0 || yy >= this.resolution.height) continue;
			
			const absY = Math.abs(y);
			
			if (sunStrength > 0) {
				const sAlpha = Math.max(0, 0.12 - absY * 0.0055) * sunStrength;
				if (sAlpha > 0.001) {
					ctx.fillStyle = `rgba(255,218,100,${sAlpha})`;
					ctx.fillRect(0, yy, width, 1);
				}
			}
			
			if (moonStrength > 0) {
				const mAlpha = Math.max(0, 0.04 - absY * 0.0022) * moonStrength;
				if (mAlpha > 0.001) {
					ctx.fillStyle = `rgba(232,240,255,${mAlpha})`;
					ctx.fillRect(0, yy, width, 1);
				}
			}
		}
	}
}