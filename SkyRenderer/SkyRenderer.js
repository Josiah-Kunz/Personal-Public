window.SkyRenderer = class SkyRenderer {
	constructor(game, config = {}) {
		this.game = game;
		this.map = game.map;
		
		this.config = {
			offset: { x: 0, y: 0, ...config.offset },
			resolution: { width: game.width, height: game.height, ...config.resolution },
			timing: { fps: 30, overallSpeed: 1, ...config.timing },
			scene: { horizonY: 245, ...config.scene },
			
			// Toggle each sub-renderer on/off
			enabled: {
				sky: true,
				stars: true,
				celestials: true,
				clouds: true,
				ocean: true,
				panController: true,
				...config.enabled
			},
			
			arc: {
				widthFactor: 0.35,
				peakHeight: 100,
				centerYOffset: 18,
				sunriseDeg: 4,
				sunsetDeg: 176,
				phasePadding: 0.06,
				visibilityBelowHorizon: 40,
				sunHours: [5, 19],    // 5am to 7pm
				moonHours: [18, 6],   // 6pm to 6am (wraps midnight)
				...config.arc
			},
			celestials: {
				sunRadius: 19,
				moonRadius: 17,
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
				driftSpeed: 1e-6,
				layerOffset: 31,
				backSpeed: 0.65,
				backVerticalOffset: 4,
				backAlphaDay: 0.05,
				backAlphaNight: 0.5,
				backFadeStartMorning: 3,
				backFadeEndMorning: 4,
				backFadeStartEvening: 19,
				backFadeEndEvening: 21,
				fogLine1Offset: 0,
				fogLine1Alpha: 0.3,
				fogLine2Offset: 2,
				fogLine2Alpha: 0.15,
				...config.clouds
			},
			stars: {
				amount: 80,
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
				ambientReflectionStrength: 0.6,
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
			},
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
		
		/* Canvases */
		this.canvas = null;
		this.ctx = null;
		this.staticCanvas = null;
		this.staticCtx = null;
		this.texture = null;
		this.sprite = null;
		this.container = null;
		
		/* Sub-renderers */
		this.clouds = null;
		this.stars = null;
		this.celestials = null;
		this.skyGradient = null;
		this.ocean = null;
		
		/* Logic controllers (non-visual) */
		this.panController = null;
		
		/* Debugging */
		this.timeScale = 1;
		this.debugTime = null;
		
		this.init();
	}
	
	horizonY() {
		return this.config.scene.horizonY;
	}
	
	init() {
		const { width, height } = this.config.resolution;
		const enabled = this.config.enabled;
		
		/* Main canvas */
		this.canvas = document.createElement("canvas");
		this.canvas.width = width;
		this.canvas.height = height;
		this.ctx = this.canvas.getContext("2d", { alpha: false });
		this.ctx.imageSmoothingEnabled = false;
		
		/* Static layer canvas */
		this.staticCanvas = document.createElement("canvas");
		this.staticCanvas.width = width;
		this.staticCanvas.height = height;
		this.staticCtx = this.staticCanvas.getContext("2d", { alpha: false });
		this.staticCtx.imageSmoothingEnabled = false;
		
		/* PIXI texture and sprite */
		this.texture = PIXI.Texture.from(this.canvas);
		this.sprite = new PIXI.Sprite(this.texture);
		this.sprite.x = this.config.offset.x;
		this.sprite.y = this.config.offset.y;
		
		/* Container */
		this.container = new PIXI.Container();
		this.container.addChild(this.sprite);
		
		/* Initialize sub-renderers (only if enabled and class exists) */
		if (enabled.sky && typeof SkyGradient !== 'undefined') {
			this.skyGradient = new SkyGradient(
				this.config.sky,
				this.config.stars,
				this.config.resolution,
				this.horizonY()
			);
		}
		
		if (enabled.celestials && typeof CelestialRenderer !== 'undefined') {
			this.celestials = new CelestialRenderer(
				this.config.celestials,
				this.config.arc,
				this.config.resolution,
				this.horizonY()
			);
		}
		
		if (enabled.stars && typeof StarRenderer !== 'undefined') {
			this.stars = new StarRenderer(
				this.config.stars,
				this.config.resolution,
				this.horizonY()
			);
		}
		
		if (enabled.ocean && typeof OceanRenderer !== 'undefined') {
			this.ocean = new OceanRenderer(
				this.config.water,
				this.config.stars,
				this.config.resolution,
				this.horizonY(),
				this.container,
				this.config.offset
			);
		}
		
		if (enabled.clouds && typeof CloudRenderer !== 'undefined') {
			this.clouds = new CloudRenderer(
				{
					...this.config.clouds,
					worldWidth: width,
					offsetX: this.config.offset.x,
					offsetY: this.config.offset.y
				},
				this.container,
				this.horizonY()
			);
		}

		if (enabled.panController && typeof PanController !== 'undefined') {
			this.panController = new PanController(
				this.game,
				{
					...this.config.pan,
				},
			);
		}
		
		/* Add to game */
		this.game.containers.voidSprites.addChild(this.container);
		
		this.start();
		console.log("SkyRenderer initialized!", { enabled });
	}

	debug(enabled=null, timeScale = 10) {
		
		// By default, we toggle the enabled state
		if (enabled === null) {
			const currentlyEnabled = this.timeScale !== 1;
			enabled = !currentlyEnabled;
		}
		
		if (enabled) {
			this.timeScale = timeScale;
			this.debugTime = this.getGameTimeNormalized();
		} else {
			this.timeScale = 1;
			this.debugTime = null;
		}
	}

	getGameTimeNormalized() {
		if (this.debugTime !== null) {
			this.debugTime = (this.debugTime + this.timeScale * 0.0001) % 1;
			return this.debugTime;
		}

		const hour = this.game.time.hour || 0;
		const minute = this.game.time.minute || 0;
		const second = this.game.time.second || 0;
		return (hour + minute / 60 + second / 3600) / 24;
	}
	
	getDayness(t) {
		return clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
	}
	
	needsStaticRedraw(t) {
		if (!this.cachedPalette && this.skyGradient) return true;
		const now = performance.now();
		const timeDelta = now - this.lastStaticRedraw;
		const gameTimeChanged = Math.abs(t - this.lastGameTime) > 0.001;
		return timeDelta > this.staticRedrawInterval || gameTimeChanged;
	}
	
	drawStaticLayer(t) {
		const ctx = this.staticCtx;
		
		// Clear if no sky gradient
		if (!this.skyGradient) {
			ctx.fillStyle = '#000';
			ctx.fillRect(0, 0, this.config.resolution.width, this.config.resolution.height);
		} else {
			this.cachedPalette = this.skyGradient.draw(ctx, t);
			this.skyGradient.drawAtmosphericHaze(ctx, t);
		}
		
		if (this.celestials) {
			const { sun, moon } = this.celestials.draw(ctx, t, this.config.clouds.thickness);
			this.cachedSun = sun;
			this.cachedMoon = moon;
			
			if (this.skyGradient) {
				this.skyGradient.drawHorizonGlow(ctx, sun, moon);
			}
		}
		
		this.lastStaticRedraw = performance.now();
		this.lastGameTime = t;
	}
	
	drawAnimatedLayer(t) {
		const ctx = this.ctx;
		
		ctx.drawImage(this.staticCanvas, 0, 0);
		
		if (this.stars) {
			this.stars.draw(ctx, t, this.elapsed);
		}
		
		if (this.ocean) {
			this.ocean.draw(ctx, t, this.cachedPalette, this.cachedSun, this.cachedMoon, this.config.celestials, this.elapsed);
		}
		
		/* Update cloud shader */
		if (this.clouds) {
			const dayness = this.getDayness(t);
			this.clouds.update(this.elapsed, dayness, t);
		}
	}
	
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
	
	destroy() {
		this.stop();
		
		if (this.clouds) {
			this.clouds.destroy();
			this.clouds = null;
		}
		if (this.stars) {
			this.stars.destroy();
			this.stars = null;
		}
		if (this.container && this.container.parent) {
			this.container.parent.removeChild(this.container);
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
		
		this.canvas = null;
		this.ctx = null;
		this.staticCanvas = null;
		this.staticCtx = null;
		this.celestials = null;
		this.skyGradient = null;
		this.ocean = null;
	}
}