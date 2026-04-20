class SkyRenderer {
	constructor(game, config = {}) {
		this.game = game;
		this.map = game.map;

		/* ===== CONFIG ===== */
		this.config = {
			offset: { x: 0, y: 0, ...config.offset },
			resolution: { width: game.width, height: game.height, ...config.resolution },
			timing: { fps: 30, overallSpeed: 1, ...config.timing },
			scene: { horizonY: 245, ...config.scene },
			arc: {
				widthFactor: 0.42,
				peakHeight: 150,
				centerYOffset: 18,
				sunriseDeg: 4,
				sunsetDeg: 176,
				phasePadding: 0.06,
				visibilityBelowHorizon: 40,
				...config.arc
			},
			celestials: {
				sunRadius: 16,
				moonRadius: 14,
				sunGlowRadius: 46,
				moonGlowRadius: 34,
				sunGlowAlpha: 0.18,
				moonGlowAlpha: 0.12,
				moonCrescentOffsetX: 5,
				moonCrescentOffsetY: -1,
				moonCrescentRadiusOffset: 1,
				...config.celestials
			},
			clouds: {
				height: 15,
				thickness: 2,
				detail: 0.5,
				driftSpeed: 0.0028,
				...config.clouds
			},
			stars: {
				amount: 40,
				twinkleSpeed: 0.001,
				minSize: 1,
				maxSize: 2,
				fadeInStart: 0.80,
				fadeInEnd: 0.94,
				fadeOutStart: 0.06,
				fadeOutEnd: 0.18,
				...config.stars
			},
			water: {
				detail: 0.28,
				shimmerDepth: 30,
				ambientReflectionStrength: 0.45,
				reflectionLengthSun: 120,
				reflectionLengthMoon: 105,
				trailWidthSun: 100,
				trailWidthMoon: 60,
				...config.water
			},
			sky: {
				nightDarkness: 1.15,
				nightWarmth: 0.0,
				...config.sky
			}
		};

		/* ===== STATE ===== */
		this.running = false;
		this.animationId = null;
		this.lastTime = 0;
		this.elapsed = 0;
		this.accumulator = 0;
		this.frameDuration = 1000 / this.config.timing.fps;

		/* ===== CACHING ===== */
		this.cachedPalette = null;
		this.cachedSun = null;
		this.cachedMoon = null;
		this.lastStaticRedraw = 0;
		this.staticRedrawInterval = 5000;
		this.lastGameTime = -1;

		/* ===== ASSETS ===== */
		this.stars = [];
		this.canvas = null;
		this.ctx = null;
		this.staticCanvas = null;
		this.staticCtx = null;

		this.init();
	}

	init() {
		/* Main canvas (visible) */
		this.canvas = document.createElement("canvas");
		this.canvas.id = "game-sky";
		this.canvas.width = this.config.resolution.width;
		this.canvas.height = this.config.resolution.height;

		this.ctx = this.canvas.getContext("2d", { alpha: false });
		this.ctx.imageSmoothingEnabled = false;

		Object.assign(this.canvas.style, {
			position: "absolute",
			top: `${this.config.offset.y}px`,
			left: `${this.config.offset.x}px`,
			width: `${this.config.resolution.width}px`,
			height: `${this.config.resolution.height}px`,
			imageRendering: "pixelated",
			pointerEvents: "none",
			zIndex: "-1"
		});

		/* Static layer canvas (offscreen) */
		this.staticCanvas = document.createElement("canvas");
		this.staticCanvas.width = this.config.resolution.width;
		this.staticCanvas.height = this.config.resolution.height;
		this.staticCtx = this.staticCanvas.getContext("2d", { alpha: false });
		this.staticCtx.imageSmoothingEnabled = false;

		/* Build stars */
		this.buildStars();

		/* Append to DOM */
		this.appendToDOM();

		/* Start render loop */
		this.start();

		console.log("SkyRenderer initialized!");
	}

	appendToDOM() {
		const gameCanvas = document.getElementById("game-canvas");
		if (gameCanvas && gameCanvas.parentNode) {
			gameCanvas.parentNode.insertBefore(this.canvas, gameCanvas);
		} else {
			requestAnimationFrame(() => this.appendToDOM());
		}
	}

	destroy() {
		this.stop();

		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}

		this.canvas = null;
		this.ctx = null;
		this.staticCanvas = null;
		this.staticCtx = null;
		this.stars = [];
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.lastTime = 0;
		this.animationId = requestAnimationFrame(ts => this.render(ts));
	}

	stop() {
		this.running = false;
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}

	/* ===== UTILITY FUNCTIONS ===== */

	clamp(v, min, max) {
		return Math.max(min, Math.min(max, v));
	}

	lerp(a, b, t) {
		return a + (b - a) * t;
	}

	smoothstep(a, b, x) {
		const t = this.clamp((x - a) / (b - a), 0, 1);
		return t * t * (3 - 2 * t);
	}

	rand(min, max) {
		return Math.random() * (max - min) + min;
	}

	degToRad(deg) {
		return (deg * Math.PI) / 180;
	}

	hexToRgb(hex) {
		const clean = hex.replace("#", "");
		const n = parseInt(clean, 16);
		return {
			r: (n >> 16) & 255,
			g: (n >> 8) & 255,
			b: n & 255
		};
	}

	mixColor(a, b, t) {
		const c1 = typeof a === "string" ? this.hexToRgb(a) : a;
		const c2 = typeof b === "string" ? this.hexToRgb(b) : b;
		return {
			r: Math.round(this.lerp(c1.r, c2.r, t)),
			g: Math.round(this.lerp(c1.g, c2.g, t)),
			b: Math.round(this.lerp(c1.b, c2.b, t))
		};
	}

	rgb(c, a = 1) {
		if (a === 1) return `rgb(${c.r},${c.g},${c.b})`;
		return `rgba(${c.r},${c.g},${c.b},${a})`;
	}

	/* ===== TIME ===== */

	getGameTimeNormalized() {
		const hour = this.game.time.hour || 0;
		const minute = this.game.time.minute || 0;
		const second = this.game.time.second || 0;
		return (hour + minute / 60 + second / 3600) / 24;
	}

	/* ===== STARS ===== */

	buildStars() {
		this.stars = [];
		const cfg = this.config.stars;
		const horizonY = this.config.scene.horizonY;

		for (let i = 0; i < cfg.amount; i++) {
			this.stars.push({
				x: Math.floor(this.rand(0, this.config.resolution.width)),
				y: Math.floor(this.rand(8, horizonY - 26)),
				r: Math.random() > 0.85 ? cfg.maxSize : cfg.minSize,
				base: this.rand(0.45, 1),
				speed: this.rand(0.3, 0.9),
				offset: this.rand(0, Math.PI * 2)
			});
		}
	}

	/* ===== SKY PALETTE ===== */

	getSkyPalette(t) {
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

		const nightLower = this.mixColor(trueNightLower, nightLowerBase, this.config.sky.nightWarmth);

		let top, upper, lower;

		if (t < 0.25) {
			const k = this.smoothstep(0.0, 0.25, t);
			top = this.mixColor(nightTop, dawnTop, k);
			upper = this.mixColor(nightUpper, dawnUpper, k);
			lower = this.mixColor(nightLower, dawnLower, k);
		} else if (t < 0.5) {
			const k = this.smoothstep(0.25, 0.5, t);
			top = this.mixColor(dawnTop, dayTop, k);
			upper = this.mixColor(dawnUpper, dayUpper, k);
			lower = this.mixColor(dawnLower, dayLower, k);
		} else if (t < 0.75) {
			const k = this.smoothstep(0.5, 0.75, t);
			top = this.mixColor(dayTop, duskTop, k);
			upper = this.mixColor(dayUpper, duskUpper, k);
			lower = this.mixColor(dayLower, duskLower, k);
		} else {
			const k = this.smoothstep(0.75, 1.0, t);
			top = this.mixColor(duskTop, nightTop, k);
			upper = this.mixColor(duskUpper, nightUpper, k);
			lower = this.mixColor(duskLower, nightLower, k);
		}

		return { top, upper, lower };
	}

	/* ===== DRAWING - NATIVE CANVAS (FAST!) ===== */

	drawSkyGradient(ctx, palette) {
		const horizonY = this.config.scene.horizonY;
		const width = this.config.resolution.width;

		const gradient = ctx.createLinearGradient(0, 0, 0, horizonY);
		gradient.addColorStop(0, this.rgb(palette.top));
		gradient.addColorStop(0.48, this.rgb(palette.upper));
		gradient.addColorStop(1, this.rgb(palette.lower));

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, horizonY);
	}

	drawOceanBase(ctx, t, skyPalette) {
		const horizonY = this.config.scene.horizonY;
		const width = this.config.resolution.width;
		const height = this.config.resolution.height;

		const water = this.getWaterPalette(t, skyPalette);

		const gradient = ctx.createLinearGradient(0, horizonY, 0, height);
		gradient.addColorStop(0, this.rgb(water.top));
		gradient.addColorStop(0.28, this.rgb(water.mid));
		gradient.addColorStop(1, this.rgb(water.bottom));

		ctx.fillStyle = gradient;
		ctx.fillRect(0, horizonY, width, height - horizonY);
	}

	getWaterPalette(t, skyPalette) {
		const cfg = this.config.stars;
		const nightA = 1 - this.smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t);
		const nightB = this.smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t);
		const night = Math.max(nightA, nightB);
		const day = 1 - night;

		const baseTop = this.mixColor("#16314b", "#4cc9d8", day * 0.85);
		const baseMid = this.mixColor("#10253f", "#2f9fbe", day * 0.8);
		const baseBottom = this.mixColor("#0b1930", "#1f6f94", day * 0.75);

		const waterCfg = this.config.water;
		return {
			top: this.mixColor(baseTop, skyPalette.lower, waterCfg.ambientReflectionStrength * 0.45),
			mid: this.mixColor(baseMid, skyPalette.upper, waterCfg.ambientReflectionStrength * 0.22),
			bottom: baseBottom
		};
	}

	drawCloudBand(ctx, t) {
		const cfg = this.config.clouds;
		const horizonY = this.config.scene.horizonY;
		const width = this.config.resolution.width;
		const dayness = this.clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);

		const gradient = ctx.createLinearGradient(0, horizonY - cfg.height, 0, horizonY + cfg.thickness);

		const light = `rgb(${Math.round(this.lerp(196, 241, dayness))},${Math.round(this.lerp(208, 242, dayness))},${Math.round(this.lerp(220, 221, dayness))})`;
		const mid = `rgb(${Math.round(this.lerp(166, 224, dayness))},${Math.round(this.lerp(176, 231, dayness))},${Math.round(this.lerp(190, 202, dayness))})`;
		const shadow = `rgb(${Math.round(this.lerp(120, 194, dayness))},${Math.round(this.lerp(128, 205, dayness))},${Math.round(this.lerp(142, 176, dayness))})`;

		gradient.addColorStop(0, light);
		gradient.addColorStop(0.3, mid);
		gradient.addColorStop(1, shadow);

		ctx.fillStyle = gradient;
		ctx.fillRect(0, horizonY - cfg.height, width, cfg.height + cfg.thickness);
	}

	drawSun(ctx, x, y) {
		const cfg = this.config.celestials;
		const r = cfg.sunRadius;

		/* Outer glow */
		const outerGlow = ctx.createRadialGradient(x, y, r, x, y, cfg.sunGlowRadius);
		outerGlow.addColorStop(0, `rgba(255,234,122,${cfg.sunGlowAlpha})`);
		outerGlow.addColorStop(1, "rgba(255,234,122,0)");
		ctx.fillStyle = outerGlow;
		ctx.beginPath();
		ctx.arc(x, y, cfg.sunGlowRadius, 0, Math.PI * 2);
		ctx.fill();

		/* Inner glow */
		const innerGlow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.5);
		innerGlow.addColorStop(0, "rgba(255,231,106,0.9)");
		innerGlow.addColorStop(1, "rgba(255,210,63,0)");
		ctx.fillStyle = innerGlow;
		ctx.beginPath();
		ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
		ctx.fill();

		/* Sun body */
		const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
		body.addColorStop(0, "#fff8e0");
		body.addColorStop(0.5, "#ffe76a");
		body.addColorStop(1, "#ffd23f");
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();
	}

	drawMoon(ctx, x, y) {
		const cfg = this.config.celestials;
		const r = cfg.moonRadius;

		/* Outer glow */
		const outerGlow = ctx.createRadialGradient(x, y, r, x, y, cfg.moonGlowRadius);
		outerGlow.addColorStop(0, `rgba(223,232,255,${cfg.moonGlowAlpha})`);
		outerGlow.addColorStop(1, "rgba(223,232,255,0)");
		ctx.fillStyle = outerGlow;
		ctx.beginPath();
		ctx.arc(x, y, cfg.moonGlowRadius, 0, Math.PI * 2);
		ctx.fill();

		/* Moon body */
		const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
		body.addColorStop(0, "#ffffff");
		body.addColorStop(0.7, "#f7fbff");
		body.addColorStop(1, "#dfe8ff");
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, Math.PI * 2);
		ctx.fill();

		/* Crescent shadow */
		ctx.fillStyle = "rgba(180,195,230,0.3)";
		ctx.beginPath();
		ctx.arc(
			x + cfg.moonCrescentOffsetX,
			y + cfg.moonCrescentOffsetY,
			r - cfg.moonCrescentRadiusOffset,
			0,
			Math.PI * 2
		);
		ctx.fill();
	}

	drawHorizonGlow(ctx, sun, moon) {
		const horizonY = this.config.scene.horizonY;
		const width = this.config.resolution.width;

		if (sun && sun.y < horizonY + 50) {
			const strength = this.clamp(1 - Math.abs(horizonY - sun.y) / 90, 0, 1);
			const gradient = ctx.createLinearGradient(0, horizonY - 20, 0, horizonY + 20);
			gradient.addColorStop(0, `rgba(255,218,100,0)`);
			gradient.addColorStop(0.5, `rgba(255,218,100,${0.15 * strength})`);
			gradient.addColorStop(1, `rgba(255,218,100,0)`);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, horizonY - 20, width, 40);
		}

		if (moon && moon.y < horizonY + 50) {
			const strength = this.clamp(1 - Math.abs(horizonY - moon.y) / 90, 0, 1) * 0.3;
			const gradient = ctx.createLinearGradient(0, horizonY - 15, 0, horizonY + 15);
			gradient.addColorStop(0, `rgba(232,240,255,0)`);
			gradient.addColorStop(0.5, `rgba(232,240,255,${0.08 * strength})`);
			gradient.addColorStop(1, `rgba(232,240,255,0)`);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, horizonY - 15, width, 30);
		}
	}

	/* ===== CELESTIAL POSITIONS ===== */

	getArcPoint(progress01) {
		const cfg = this.config.arc;
		const start = this.degToRad(cfg.sunriseDeg);
		const end = this.degToRad(cfg.sunsetDeg);
		const angle = this.lerp(start, end, progress01);

		const centerX = this.config.resolution.width / 2;
		const centerY = this.config.scene.horizonY + cfg.centerYOffset;
		const radiusX = this.config.resolution.width * cfg.widthFactor;
		const radiusY = cfg.peakHeight;

		return {
			x: Math.round(centerX + Math.cos(angle) * radiusX),
			y: Math.round(centerY - Math.sin(angle) * radiusY)
		};
	}

	getCelestialState(t) {
		const pad = this.config.arc.phasePadding;
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
			moon = this.getArcPoint((t - moonStartA) / ((moonEndA - moonStartA) + (moonEndB - moonStartB)));
		} else if (t >= moonStartB && t <= moonEndB) {
			moon = this.getArcPoint(((t - moonStartB) + (moonEndA - moonStartA)) / ((moonEndA - moonStartA) + (moonEndB - moonStartB)));
		}

		return { sun, moon };
	}

	shouldDrawBody(body, radius) {
		if (!body) return false;
		const horizonY = this.config.scene.horizonY;
		return body.y < horizonY + this.config.arc.visibilityBelowHorizon + radius;
	}

	/* ===== ANIMATED ELEMENTS ===== */

	drawStars(ctx, t) {
		const cfg = this.config.stars;
		const nightA = 1 - this.smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t);
		const nightB = this.smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t);
		const night = Math.max(nightA, nightB);

		if (night <= 0.01) return;

		for (const star of this.stars) {
			const twinkle = 0.7 + 0.3 * Math.sin(this.elapsed * cfg.twinkleSpeed * star.speed + star.offset);
			const alpha = this.clamp(star.base * twinkle * night, 0, 1);

			ctx.fillStyle = `rgba(255,255,255,${alpha})`;
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	drawWaterReflection(ctx, body, color, length, width) {
		if (!body) return;

		const horizonY = this.config.scene.horizonY;
		if (body.y > horizonY + 30) return;

		const startY = horizonY + 2;
		const endY = Math.min(this.config.resolution.height, startY + length);
		const strength = this.clamp(1 - (body.y - horizonY + 50) / 100, 0, 1);

		const gradient = ctx.createLinearGradient(0, startY, 0, endY);
		gradient.addColorStop(0, `rgba(${color},${0.4 * strength})`);
		gradient.addColorStop(0.3, `rgba(${color},${0.2 * strength})`);
		gradient.addColorStop(1, `rgba(${color},0)`);

		/* Wobble effect */
		const wobble = Math.sin(this.elapsed * 0.001) * 5;

		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(body.x - width / 2 + wobble, startY);
		ctx.lineTo(body.x + width / 2 + wobble, startY);
		ctx.lineTo(body.x + 10 + wobble * 0.5, endY);
		ctx.lineTo(body.x - 10 + wobble * 0.5, endY);
		ctx.closePath();
		ctx.fill();
	}

	drawWaterShimmer(ctx) {
		const cfg = this.config.water;
		const horizonY = this.config.scene.horizonY;
		const width = this.config.resolution.width;
		const depth = cfg.shimmerDepth;

		ctx.fillStyle = "rgba(255,255,255,0.03)";

		for (let y = horizonY + 2; y < horizonY + depth; y += 4) {
			for (let x = 0; x < width; x += 8) {
				const wave = Math.sin(x * 0.15 + y * 1.2 + this.elapsed * 0.001) * 0.5 + 0.5;
				if (wave > 0.8) {
					ctx.fillRect(x, y, 4, 1);
				}
			}
		}
	}

	/* ===== LAYER RENDERING ===== */

	needsStaticRedraw(t) {
		if (!this.cachedPalette) return true;

		const now = performance.now();
		const timeDelta = now - this.lastStaticRedraw;
		const gameTimeChanged = Math.abs(t - this.lastGameTime) > 0.001;

		return timeDelta > this.staticRedrawInterval || gameTimeChanged;
	}

	drawStaticLayer(t) {
		const ctx = this.staticCtx;

		ctx.clearRect(0, 0, this.config.resolution.width, this.config.resolution.height);

		const palette = this.getSkyPalette(t);
		const { sun, moon } = this.getCelestialState(t);

		/* Sky */
		this.drawSkyGradient(ctx, palette);
		this.drawHorizonGlow(ctx, sun, moon);

		/* Celestials */
		if (sun && this.shouldDrawBody(sun, this.config.celestials.sunRadius)) {
			this.drawSun(ctx, sun.x, sun.y);
		}
		if (moon && this.shouldDrawBody(moon, this.config.celestials.moonRadius)) {
			this.drawMoon(ctx, moon.x, moon.y);
		}

		/* Clouds */
		this.drawCloudBand(ctx, t);

		/* Ocean */
		this.drawOceanBase(ctx, t, palette);

		/* Cache for animated layer */
		this.cachedPalette = palette;
		this.cachedSun = sun;
		this.cachedMoon = moon;
		this.lastStaticRedraw = performance.now();
		this.lastGameTime = t;
	}

	drawAnimatedLayer(t) {
		const ctx = this.ctx;

		/* Start with static layer */
		ctx.drawImage(this.staticCanvas, 0, 0);

		/* Stars */
		this.drawStars(ctx, t);

		/* Water reflections */
		this.drawWaterReflection(ctx, this.cachedSun, "255,226,110", this.config.water.reflectionLengthSun, this.config.water.trailWidthSun);
		this.drawWaterReflection(ctx, this.cachedMoon, "255,255,255", this.config.water.reflectionLengthMoon, this.config.water.trailWidthMoon);

		/* Water shimmer */
		this.drawWaterShimmer(ctx);
	}

	/* ===== RENDER LOOP ===== */

	render(ts) {
		if (!this.running) return;

		if (!this.lastTime) this.lastTime = ts;
		const rawDt = ts - this.lastTime;
		this.lastTime = ts;

		this.accumulator += rawDt;

		if (this.accumulator < this.frameDuration) {
			this.animationId = requestAnimationFrame(ts => this.render(ts));
			return;
		}

		const dt = this.accumulator;
		this.accumulator = 0;

		this.elapsed += dt * this.config.timing.overallSpeed;
		const t = this.getGameTimeNormalized();

		/* Redraw static layer if needed */
		if (this.needsStaticRedraw(t)) {
			this.drawStaticLayer(t);
		}

		/* Always draw animated layer */
		this.drawAnimatedLayer(t);

		this.animationId = requestAnimationFrame(ts => this.render(ts));
	}
}

/* Create and store the renderer */
if (game.skyRenderer?.map !== game.map) {
	if (game.skyRenderer) game.skyRenderer.destroy();
	game.skyRenderer = new SkyRenderer(game, {
		offset: { x: 864, y: 0 },
		resolution: { width: 1120, height: 1072 }
	});
}