class SkyRenderer {
	constructor(game, config = {}) {
		this.game = game;
		this.map = game.map;

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
				driftSpeed: 5e-4,
				layerOffset: 31,
				...config.clouds
			},
			stars: {
				amount: 40,
				twinkleAmount: 30,
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
				celestialReflectionStrength: 1.4,
				reflectionLengthSun: 120,
				reflectionLengthMoon: 105,
				trailWidthSun: 204,
				trailWidthMoon: 152,
				trailWidthFarSun: 5,
				trailWidthFarMoon: 4,
				trailWobble: 5,
				trailSegmentHeight: 2,
				trailGap: 0.3,
				trailTaper: 0.82,
				trailBreakup: 2.22,
				sunReflectionAlpha: 3.00,
				moonReflectionAlpha: 0.84,
				...config.water
			},
			sky: {
				nightDarkness: 1.15,
				nightWarmth: 0.0,
				...config.sky
			}
		};

		this.running = false;
		this.animationId = null;
		this.lastTime = 0;
		this.elapsed = 0;
		this.accumulator = 0;
		this.frameDuration = 1000 / this.config.timing.fps;

		this.cachedPalette = null;
		this.cachedSun = null;
		this.cachedMoon = null;
		this.lastStaticRedraw = 0;
		this.staticRedrawInterval = 5000;
		this.lastGameTime = -1;

		this.stars = [];
		this.starSprites = new Map();

		this.canvas = null;
		this.ctx = null;
		this.staticCanvas = null;
		this.staticCtx = null;
		this.texture = null;
		this.sprite = null;

		/* Cloud system */
		this.cloudCanvas = null;
		this.cloudTexture = null;
		this.cloudSprite = null;
		this.cloudShader = null;
		this.cloudContainer = null;

		this.init();
	}

	init() {
		/* Main canvas */
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.config.resolution.width;
		this.canvas.height = this.config.resolution.height;
		this.ctx = this.canvas.getContext("2d", { alpha: false });
		this.ctx.imageSmoothingEnabled = false;

		/* Static layer canvas */
		this.staticCanvas = document.createElement("canvas");
		this.staticCanvas.width = this.config.resolution.width;
		this.staticCanvas.height = this.config.resolution.height;
		this.staticCtx = this.staticCanvas.getContext("2d", { alpha: false });
		this.staticCtx.imageSmoothingEnabled = false;

		/* PIXI texture and sprite for main sky */
		this.texture = PIXI.Texture.from(this.canvas);
		this.sprite = new PIXI.Sprite(this.texture);
		this.sprite.x = this.config.offset.x;
		this.sprite.y = this.config.offset.y;

		/* Container to hold sky + clouds */
		this.container = new PIXI.Container();
		this.container.addChild(this.sprite);

		/* Build cloud system */
		this.buildCloudSystem();

		/* Add container to voidSprites */
		this.game.containers.voidSprites.addChild(this.container);

		this.buildStarSprites();
		this.buildStars();
		this.start();

		console.log("SkyRenderer initialized!");
	}

	/* ===== CLOUD SYSTEM ===== */

	buildCloudSystem() {
		const cfg = this.config.clouds;
		const width = this.config.resolution.width;
		const maxOffset = this.getCloudMaxOffset();
		const cloudHeight = cfg.height + cfg.thickness + maxOffset * 2;

		this.cloudCanvas = document.createElement("canvas");
		this.cloudCanvas.width = width * 2;
		this.cloudCanvas.height = cloudHeight;
		const ctx = this.cloudCanvas.getContext("2d", { alpha: true });
		ctx.imageSmoothingEnabled = false;

		this.renderCloudDepthMap(ctx, 0, width * 2, cloudHeight, maxOffset);

		const baseTexture = new PIXI.BaseTexture(this.cloudCanvas, {
			scaleMode: PIXI.SCALE_MODES.LINEAR,
			wrapMode: PIXI.WRAP_MODES.REPEAT
		});
		this.cloudTexture = new PIXI.Texture(baseTexture);

		const cloudShader = PIXI.Shader.from(
			`
			attribute vec2 aVertexPosition;
			attribute vec2 aTextureCoord;
			uniform mat3 projectionMatrix;
			uniform mat3 translationMatrix;
			varying vec2 vTextureCoord;
			
			void main() {
				vTextureCoord = aTextureCoord;
				gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
			}
			`,
			`
			precision mediump float;
			varying vec2 vTextureCoord;
			uniform sampler2D uSampler;
			uniform float uDayness;
			uniform float uScroll;
			uniform vec2 uTexSize;

			void main() {
				vec2 uv = vTextureCoord;
				uv.x += uScroll;
				
				/* LINEAR filtering interpolates the depth values smoothly */
				vec4 texel = texture2D(uSampler, uv);
				
				if (texel.a < 0.01) {
					discard;
				}
				
				/* Quantize depth to get crisp color bands */
				float depth = texel.r;
				
				vec3 nightLight  = vec3(196.0, 208.0, 220.0) / 255.0;
				vec3 nightMid    = vec3(166.0, 176.0, 190.0) / 255.0;
				vec3 nightShadow = vec3(120.0, 128.0, 142.0) / 255.0;
				
				vec3 dayLight  = vec3(241.0, 242.0, 221.0) / 255.0;
				vec3 dayMid    = vec3(224.0, 231.0, 202.0) / 255.0;
				vec3 dayShadow = vec3(194.0, 205.0, 176.0) / 255.0;
				
				vec3 light  = mix(nightLight,  dayLight,  uDayness);
				vec3 mid    = mix(nightMid,    dayMid,    uDayness);
				vec3 shadow = mix(nightShadow, dayShadow, uDayness);
				
				vec3 color;
				if (depth < 0.18) {
					color = light;
				} else if (depth < 0.6) {
					color = mid;
				} else {
					color = shadow;
				}
				
				gl_FragColor = vec4(color, texel.a);
			}`,
			{
				uSampler: this.cloudTexture,
				uDayness: 1.0,
				uTexSize: [this.cloudCanvas.width, this.cloudCanvas.height]
			}
		);

		const geometry = new PIXI.Geometry()
			.addAttribute('aVertexPosition', [0, 0, width, 0, width, cloudHeight, 0, cloudHeight], 2)
			.addAttribute('aTextureCoord', [0, 0, 0.5, 0, 0.5, 1, 0, 1], 2)
			.addIndex([0, 1, 2, 0, 2, 3]);

		this.cloudMesh = new PIXI.Mesh(geometry, cloudShader);
		this.cloudMesh.x = this.config.offset.x;
		this.cloudMesh.y = this.config.offset.y + this.horizonY() - cfg.height - maxOffset;
		this.cloudShader = cloudShader;

		this.container.addChild(this.cloudMesh);
	}

	updateCloudUniforms(t) {
		if (!this.cloudShader) return;

		const dayness = this.clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
		this.cloudShader.uniforms.uDayness = dayness;

		const scrollNormalized = (this.elapsed * this.config.clouds.driftSpeed) % 1.0;
		this.cloudShader.uniforms.uScroll = scrollNormalized;
	}

	renderCloudDepthMap(ctx, startX, endX, height, maxOffset) {
		const cfg = this.config.clouds;
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		const baseY = maxOffset;

		/* Main cloud layer - encode depth in red channel */
		for (let x = startX; x < endX; x += 2) {
			const top = baseY + this.getCloudTopOffset(x);

			for (let y = top; y < height; y++) {
				const d = (y - top) / Math.max(1, height - top);
				const depthByte = Math.round(d * 255);
				
				ctx.fillStyle = `rgba(${depthByte}, 0, 0, 255)`;
				ctx.fillRect(x, y, 2, 1);
			}
		}

		/* Shadow overlay - darken by increasing depth value */
		for (let x = startX; x < endX; x += 2) {
			const top = baseY + this.getCloudTopOffset(x + cfg.layerOffset, 0.65) + 1;

			for (let y = top; y < height - cfg.thickness; y++) {
				const d = (y - top) / Math.max(1, height - cfg.thickness - top);
				const darken = (1 - d) * 0.15;
				if (darken > 0.03) {
					/* Read existing, blend darker */
					ctx.fillStyle = `rgba(255, 0, 0, ${darken})`;
					ctx.fillRect(x, y, 2, 1);
				}
			}
		}
	}
	
	getCloudMaxOffset() {
		const cfg = this.config.clouds;
		/* Sum of all amplitudes from getCloudTopOffset */
		return Math.ceil(
			8 * cfg.detail +
			6 * cfg.detail +
			4 * cfg.detail +
			2 * cfg.detail +
			1.5 * cfg.detail
		);
	}

	getCloudTopOffset(x, speedMult = 1) {
		const cfg = this.config.clouds; 
		const sx = x * speedMult;
		const n1 = Math.sin(sx * 0.022 + 0.5) * 8 * cfg.detail;
		const n2 = Math.sin(sx * 0.061 + 1.4) * 6 * cfg.detail;
		const n3 = Math.sin(sx * 0.18 + 1.3) * 4 * cfg.detail;
		const n4 = Math.sin(sx * 0.43 + 2.2) * 2 * cfg.detail;
		const n5 = Math.sin(sx * 0.93 + 0.4) * 1.5 * cfg.detail;
		return Math.round(n1 + n2 + n3 + n4 + n5);
	}

	destroy() {
		this.stop();

		if (this.container && this.container.parent) {
			this.container.parent.removeChild(this.container);
		}
		if (this.cloudMesh) {
			this.cloudMesh.destroy();
			this.cloudMesh = null;
		}
		if (this.cloudTexture) {
			this.cloudTexture.destroy(true);
			this.cloudTexture = null;
		}
		if (this.texture) {
			this.texture.destroy(true);
			this.texture = null;
		}
		if (this.sprite) {
			this.sprite.destroy();
			this.sprite = null;
		}
		if (this.container) {
			this.container.destroy();
			this.container = null;
		}

		this.starSprites.clear();
		this.canvas = null;
		this.ctx = null;
		this.staticCanvas = null;
		this.staticCtx = null;
		this.cloudCanvas = null;
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

	/* ===== UTILITIES ===== */

	horizonY() {
		return this.config.scene.horizonY;
	}

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

	rgbToHex(c) {
		const toHex = (n) => n.toString(16).padStart(2, "0");
		return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
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

	fillCircle(ctx, cx, cy, r, color) {
		ctx.fillStyle = color;
		for (let y = -r; y <= r; y++) {
			for (let x = -r; x <= r; x++) {
				if (x * x + y * y <= r * r) {
					ctx.fillRect(cx + x, cy + y, 1, 1);
				}
			}
		}
	}

	fillGlow(ctx, cx, cy, innerR, outerR, color, alphaMax) {
		const c = typeof color === "string" ? this.hexToRgb(color) : color;
		for (let r = outerR; r > innerR; r -= 2) {
			const t = 1 - (r - innerR) / Math.max(1, outerR - innerR);
			this.fillCircle(ctx, cx, cy, r, `rgba(${c.r},${c.g},${c.b},${alphaMax * t * t})`);
		}
	}

	/* ===== TIME ===== */

	getGameTimeNormalized() {
		const hour = this.game.time.hour || 0;
		const minute = this.game.time.minute || 0;
		const second = this.game.time.second || 0;
		return (hour + minute / 60 + second / 3600) / 24;
	}

	/* ===== STARS ===== */

	buildStarSprites() {
		this.starSprites.clear();
		const cfg = this.config.stars;

		for (let r = cfg.minSize; r <= cfg.maxSize; r++) {
			const size = r * 2 + 3;
			const off = document.createElement("canvas");
			off.width = size;
			off.height = size;
			const offCtx = off.getContext("2d", { alpha: true });
			offCtx.imageSmoothingEnabled = false;
			this.fillCircle(offCtx, Math.floor(size / 2), Math.floor(size / 2), r, "#ffffff");
			this.starSprites.set(r, off);
		}
	}

	buildStars() {
		this.stars = [];
		const cfg = this.config.stars;

		for (let i = 0; i < cfg.amount; i++) {
			this.stars.push({
				x: Math.floor(this.rand(0, this.config.resolution.width)),
				y: Math.floor(this.rand(8, this.horizonY() - 26)),
				r: Math.random() > 0.85 ? cfg.maxSize : cfg.minSize,
				base: this.rand(0.45, 1),
				speed: this.rand(0.3, 0.9),
				offset: this.rand(0, Math.PI * 2)
			});
		}
	}

	/* ===== PALETTES ===== */

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
			lower = this.mixColor(this.rgbToHex(nightLower), dawnLower, k);
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
			lower = this.mixColor(duskLower, this.rgbToHex(nightLower), k);
		}

		const cfg = this.config.stars;
		const nightFactor =
			Math.max(
				1 - this.smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t),
				this.smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t)
			) * this.config.sky.nightDarkness;

		if (nightFactor > 0) {
			top = this.mixColor(this.rgbToHex(top), "#040915", nightFactor * 0.45);
			upper = this.mixColor(this.rgbToHex(upper), "#0c1631", nightFactor * 0.45);
			lower = this.mixColor(this.rgbToHex(lower), "#121a33", nightFactor * 0.5);
		}

		return { top, upper, lower };
	}

	getWaterPalette(t, skyPalette) {
		const cfg = this.config.stars;
		const nightA = 1 - this.smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t);
		const nightB = this.smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t);
		const night = Math.max(nightA, nightB);
		const day = 1 - night;

		const dawnTint = this.smoothstep(0.18, 0.30, t) * (1 - this.smoothstep(0.45, 0.55, t));
		const duskTint = this.smoothstep(0.55, 0.68, t) * (1 - this.smoothstep(0.82, 0.95, t));

		const baseTop = this.mixColor("#16314b", "#4cc9d8", day * 0.85 + dawnTint * 0.15 + duskTint * 0.10);
		const baseMid = this.mixColor("#10253f", "#2f9fbe", day * 0.8 + dawnTint * 0.12 + duskTint * 0.08);
		const baseBottom = this.mixColor("#0b1930", "#1f6f94", day * 0.75);

		const waterCfg = this.config.water;
		return {
			top: this.mixColor(this.rgbToHex(baseTop), this.rgbToHex(skyPalette.lower), waterCfg.ambientReflectionStrength * 0.45),
			mid: this.mixColor(this.rgbToHex(baseMid), this.rgbToHex(skyPalette.upper), waterCfg.ambientReflectionStrength * 0.22),
			bottom: baseBottom
		};
	}

	/* ===== CELESTIAL POSITIONS ===== */

	getArcPoint(progress01) {
		const cfg = this.config.arc;
		const start = this.degToRad(cfg.sunriseDeg);
		const end = this.degToRad(cfg.sunsetDeg);
		const angle = this.lerp(start, end, progress01);

		const centerX = this.config.resolution.width / 2;
		const centerY = this.horizonY() + cfg.centerYOffset;
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

	shouldDrawBody(body, radius) {
		if (!body) return false;
		return body.y < this.horizonY() + this.config.arc.visibilityBelowHorizon + radius + this.config.clouds.thickness;
	}

	/* ===== DRAWING - SKY ===== */

	drawSkyGradient(ctx, palette) {
		const width = this.config.resolution.width;

		for (let y = 0; y < this.horizonY(); y++) {
			const t = y / Math.max(1, this.horizonY() - 1);
			const c = t < 0.48
				? this.mixColor(this.rgbToHex(palette.top), this.rgbToHex(palette.upper), t / 0.48)
				: this.mixColor(this.rgbToHex(palette.upper), this.rgbToHex(palette.lower), (t - 0.48) / 0.52);

			ctx.fillStyle = this.rgb(c);
			ctx.fillRect(0, y, width, 1);
		}
	}

	drawAtmosphericHaze(ctx, t) {
		const width = this.config.resolution.width;
		const dayness = this.clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);

		for (let y = this.horizonY() - 18; y < this.horizonY() + 8; y++) {
			const d = Math.abs(y - this.horizonY()) / 26;
			ctx.fillStyle = `rgba(255,235,200,${(1 - d) * this.lerp(0.02, 0.08, dayness)})`;
			ctx.fillRect(0, y, width, 1);
		}
	}

	drawHorizonGlow(ctx, sun, moon) {
		const width = this.config.resolution.width;
		const sunStrength = sun ? this.clamp(1 - Math.abs(this.horizonY() - sun.y) / 90, 0, 1) : 0;
		const moonStrength = moon ? this.clamp(1 - Math.abs(this.horizonY() - moon.y) / 90, 0, 1) * 0.28 : 0;

		for (let y = -18; y <= 18; y++) {
			const yy = this.horizonY() + y;
			if (yy < 0 || yy >= this.config.resolution.height) continue;

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

	/* ===== DRAWING - STARS ===== */

	drawStars(ctx, t) {
		const cfg = this.config.stars;
		const nightA = 1 - this.smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t);
		const nightB = this.smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t);
		const night = Math.max(nightA, nightB);

		if (night <= 0.01) return;

		for (const star of this.stars) {
			const twinkle =
				1 -
				cfg.twinkleAmount +
				cfg.twinkleAmount *
					(0.76 + 0.24 * Math.sin(this.elapsed * 0.001 * star.speed + star.offset));

			const alpha = this.clamp(star.base * twinkle * night, 0, 1);
			const sprite = this.starSprites.get(star.r);

			ctx.globalAlpha = alpha;
			ctx.drawImage(
				sprite,
				star.x - Math.floor(sprite.width / 2),
				star.y - Math.floor(sprite.height / 2)
			);
		}

		ctx.globalAlpha = 1;
	}

	/* ===== DRAWING - CELESTIALS ===== */

	drawSun(ctx, x, y) {
		const cfg = this.config.celestials;
		const r = cfg.sunRadius;

		this.fillGlow(ctx, x, y, r, cfg.sunGlowRadius, "#ffd23f", cfg.sunGlowAlpha * 0.55);
		this.fillGlow(ctx, x, y, r, Math.round(cfg.sunGlowRadius * 0.72), "#ffea7a", cfg.sunGlowAlpha);

		this.fillCircle(ctx, x, y, r, "#ffd23f");
		this.fillCircle(ctx, x, y, r - 1, "#ffe76a");
		this.fillCircle(ctx, x - 4, y - 4, 2, "rgba(255,255,255,0.18)");
	}

	drawMoon(ctx, x, y) {
		const cfg = this.config.celestials;
		const r = cfg.moonRadius;

		this.fillGlow(ctx, x, y, r, cfg.moonGlowRadius, "#dfe8ff", cfg.moonGlowAlpha * 0.65);
		this.fillGlow(ctx, x, y, r, Math.round(cfg.moonGlowRadius * 0.72), "#ffffff", cfg.moonGlowAlpha);

		this.fillCircle(ctx, x, y, r, "#f7fbff");
		this.fillCircle(ctx, x, y, r - 1, "#ffffff");

		this.fillCircle(
			ctx,
			x + cfg.moonCrescentOffsetX,
			y + cfg.moonCrescentOffsetY,
			Math.max(2, r - cfg.moonCrescentRadiusOffset),
			"rgba(180,195,230,0.30)"
		);

		this.fillCircle(ctx, x - 2, y - 2, 1, "rgba(255,255,255,0.16)");
	}

	/* ===== DRAWING - OCEAN ===== */

	drawOceanBase(ctx, t, skyPalette) {
		const water = this.getWaterPalette(t, skyPalette);
		const width = this.config.resolution.width;
		const height = this.config.resolution.height;

		for (let y = this.horizonY(); y < height; y++) {
			const depthT = (y - this.horizonY()) / Math.max(1, height - this.horizonY() - 1);

			let c;
			if (depthT < 0.28) {
				c = this.mixColor(this.rgbToHex(water.top), this.rgbToHex(water.mid), depthT / 0.28);
			} else {
				c = this.mixColor(this.rgbToHex(water.mid), this.rgbToHex(water.bottom), (depthT - 0.28) / 0.72);
			}

			ctx.fillStyle = this.rgb(c);
			ctx.fillRect(0, y, width, 1);
		}
	}

	drawAmbientWaterReflection(ctx, skyPalette) {
		const width = this.config.resolution.width;
		const cfg = this.config.water;
		const topReflect = this.mixColor(this.rgbToHex(skyPalette.lower), "#ffffff", 0.06);
		const midReflect = this.mixColor(this.rgbToHex(skyPalette.upper), this.rgbToHex(skyPalette.lower), 0.25);
		const depth = Math.max(16, Math.round(cfg.shimmerDepth * 1.4));

		for (let y = this.horizonY() + 1; y < this.horizonY() + depth; y++) {
			const t = (y - this.horizonY()) / depth;
			const fade = 1 - t;
			const lineColor = t < 0.35
				? this.mixColor(this.rgbToHex(topReflect), this.rgbToHex(midReflect), t / 0.35)
				: midReflect;

			ctx.fillStyle = this.rgb(lineColor, 0.10 * fade);
			ctx.fillRect(0, y, width, 1);

			for (let x = 0; x < width; x += 4) {
				const wave =
					Math.sin(x * 0.11 + y * 1.35 + this.elapsed * 0.0009) * 0.5 +
					Math.sin(x * 0.035 + this.elapsed * 0.0005 + 1.3) * 0.3 +
					0.5;

				if (wave > 0.88) {
					ctx.fillStyle = `rgba(255,255,255,${0.028 * fade})`;
					ctx.fillRect(x, y, 2, 1);
				}
			}
		}
	}

	drawWaterReflection(ctx, body, options) {
		if (!body) return;

		const cfg = this.config.water;
		const above = this.clamp(
			(this.horizonY() - body.y + options.radius) / options.fadeHeight,
			0,
			1
		);
		if (above <= 0) return;

		const startY = this.horizonY() + 1;
		const endY = Math.min(this.config.resolution.height - 1, this.horizonY() + options.length);

		for (let y = startY; y <= endY; y += cfg.trailSegmentHeight + cfg.trailGap) {
			const ty = (y - startY) / Math.max(1, endY - startY);
			const halfWidth = Math.max(
				1,
				Math.round(
					this.lerp(options.widthNear, options.widthFar, Math.pow(ty, cfg.trailTaper)) * above
				)
			);

			const wobble =
				Math.sin(y * 0.18 + this.elapsed * 0.0012) * cfg.trailWobble +
				Math.sin(y * 0.05 + 1.7) * cfg.trailWobble * 0.5;

			const centerX = Math.round(body.x + wobble);

			for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 2) {
				const nx = Math.abs(x - centerX) / Math.max(1, halfWidth);
				const edge = 1 - nx;

				const breakup =
					Math.sin(x * options.freqA + y * options.freqB + this.elapsed * options.speed) * 0.5 +
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

	drawWaterShimmer(ctx) {
		const cfg = this.config.water;
		const width = this.config.resolution.width;
		const depth = Math.round(cfg.shimmerDepth * cfg.detail);

		for (let y = this.horizonY() + 2; y < this.horizonY() + depth; y++) {
			const fade = 1 - (y - (this.horizonY() + 2)) / Math.max(1, depth - 2);

			for (let x = 0; x < width; x += 3) {
				const wave =
					Math.sin(x * 0.17 + y * 1.5 + this.elapsed * 0.0012 * cfg.detail) * 0.5 +
					0.5;

				if (wave > 0.94 - cfg.detail * 0.12) {
					ctx.fillStyle = `rgba(255,255,255,${0.03 * fade})`;
					ctx.fillRect(x, y, 2, 1);
				}
			}
		}
	}

	drawOceanSurfaceLines(ctx) {
		const cfg = this.config.water;
		const width = this.config.resolution.width;
		const maxY = this.horizonY() + Math.round(28 * cfg.detail);

		for (let y = this.horizonY() + 5; y < maxY; y += 3) {
			const fade = 1 - (y - this.horizonY()) / Math.max(1, maxY - this.horizonY());

			for (let x = 0; x < width; x += 4) {
				const n =
					Math.sin(x * 0.1 + y * 1.2 + this.elapsed * 0.0009 * cfg.detail) * 0.5 +
					0.5;

				if (n > 0.82) {
					ctx.fillStyle = `rgba(255,255,255,${0.022 * fade})`;
					ctx.fillRect(x, y, 2, 1);
				}
			}
		}
	}

	drawOceanDetail(ctx, t, skyPalette, sun, moon) {
		const cfg = this.config.water;

		this.drawOceanBase(ctx, t, skyPalette);
		this.drawAmbientWaterReflection(ctx, skyPalette);

		this.drawWaterReflection(ctx, sun, {
			color: { r: 255, g: 226, b: 110 },
			radius: this.config.celestials.sunRadius,
			length: cfg.reflectionLengthSun,
			widthNear: cfg.trailWidthSun,
			widthFar: cfg.trailWidthFarSun,
			alpha: cfg.sunReflectionAlpha * cfg.detail,
			freqA: 0.18,
			freqB: 0.11,
			speed: 0.0008,
			fadeHeight: 180
		});

		this.drawWaterReflection(ctx, moon, {
			color: { r: 255, g: 255, b: 255 },
			radius: this.config.celestials.moonRadius,
			length: cfg.reflectionLengthMoon,
			widthNear: cfg.trailWidthMoon,
			widthFar: cfg.trailWidthFarMoon,
			alpha: cfg.moonReflectionAlpha * cfg.detail,
			freqA: 0.16,
			freqB: 0.09,
			speed: 0.0006,
			fadeHeight: 160
		});

		this.drawWaterShimmer(ctx);
		this.drawOceanSurfaceLines(ctx);
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
		const palette = this.getSkyPalette(t);
		const { sun, moon } = this.getCelestialState(t);

		this.drawSkyGradient(ctx, palette);
		this.drawAtmosphericHaze(ctx, t);
		this.drawHorizonGlow(ctx, sun, moon);

		if (sun && this.shouldDrawBody(sun, this.config.celestials.sunRadius)) {
			this.drawSun(ctx, sun.x, sun.y);
		}
		if (moon && this.shouldDrawBody(moon, this.config.celestials.moonRadius)) {
			this.drawMoon(ctx, moon.x, moon.y);
		}

		/* Clouds are now handled by the shader - no drawing here */

		this.cachedPalette = palette;
		this.cachedSun = sun;
		this.cachedMoon = moon;
		this.lastStaticRedraw = performance.now();
		this.lastGameTime = t;
	}

	drawAnimatedLayer(t) {
		const ctx = this.ctx;

		ctx.drawImage(this.staticCanvas, 0, 0);

		this.drawStars(ctx, t);
		this.drawOceanDetail(ctx, t, this.cachedPalette, this.cachedSun, this.cachedMoon);

		/* Update cloud shader uniforms */
		this.updateCloudUniforms(t);
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

		this.accumulator = 0;
		this.elapsed += this.frameDuration * this.config.timing.overallSpeed;

		const t = this.getGameTimeNormalized();

		if (this.needsStaticRedraw(t)) {
			this.drawStaticLayer(t);
		}

		this.drawAnimatedLayer(t);
		this.texture.update();

		this.animationId = requestAnimationFrame(ts => this.render(ts));
	}
}

/* Create and store the renderer */
if (GAME.skyRenderer?.map !== GAME.map) {
	if (GAME.skyRenderer) GAME.skyRenderer.destroy();
	GAME.skyRenderer = new SkyRenderer(GAME, {
		offset: { x: 864, y: 0 },
		resolution: { width: 1120, height: 1072 }
	});
}