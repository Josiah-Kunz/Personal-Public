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
                driftSpeed: 0.0028,
                layerOffset: 31,
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
        this.canvas = null;
        this.ctx = null;
        this.staticCanvas = null;
        this.staticCtx = null;
        this.texture = null;
        this.sprite = null;

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

        /* PIXI texture and sprite */
        this.texture = PIXI.Texture.from(this.canvas);
        this.sprite = new PIXI.Sprite(this.texture);
        this.sprite.x = this.config.offset.x;
        this.sprite.y = this.config.offset.y;

        /* Add to voidSprites */
        this.game.containers.voidSprites.addChild(this.sprite);

        this.buildStars();
        this.start();

        console.log("SkyRenderer initialized!");
    }

    destroy() {
        this.stop();

        if (this.sprite && this.sprite.parent) {
            this.sprite.parent.removeChild(this.sprite);
        }
        if (this.texture) {
            this.texture.destroy(true);
            this.texture = null;
        }
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
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

    /* ===== UTILITIES ===== */

    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    lerp(a, b, t) { return a + (b - a) * t; }
    smoothstep(a, b, x) {
        const t = this.clamp((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
    }
    rand(min, max) { return Math.random() * (max - min) + min; }
    degToRad(deg) { return (deg * Math.PI) / 180; }

    hexToRgb(hex) {
        const n = parseInt(hex.replace("#", ""), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
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

    /* Pixelated circle - keeps the retro look */
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

    /* Pixelated glow - keeps retro look but fewer iterations */
    fillGlow(ctx, cx, cy, innerR, outerR, color, alphaMax) {
        const c = typeof color === "string" ? this.hexToRgb(color) : color;
        for (let r = outerR; r > innerR; r -= 3) { // Step by 3 instead of 2
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

        let sun = null, moon = null;

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
        return body.y < this.config.scene.horizonY + this.config.arc.visibilityBelowHorizon + radius;
    }

    /* ===== DRAWING - OPTIMIZED BUT PIXELATED ===== */

    drawSkyGradient(ctx, palette) {
        const horizonY = this.config.scene.horizonY;
        const width = this.config.resolution.width;

        /* Use gradient but draw in bands for slight pixelation */
        const bandHeight = 4;
        for (let y = 0; y < horizonY; y += bandHeight) {
            const t = y / Math.max(1, horizonY - 1);
            const c = t < 0.48
                ? this.mixColor(palette.top, palette.upper, t / 0.48)
                : this.mixColor(palette.upper, palette.lower, (t - 0.48) / 0.52);

            ctx.fillStyle = this.rgb(c);
            ctx.fillRect(0, y, width, bandHeight);
        }
    }

    drawOceanBase(ctx, t, skyPalette) {
        const water = this.getWaterPalette(t, skyPalette);
        const horizonY = this.config.scene.horizonY;
        const width = this.config.resolution.width;
        const height = this.config.resolution.height;

        const bandHeight = 4;
        for (let y = horizonY; y < height; y += bandHeight) {
            const depthT = (y - horizonY) / Math.max(1, height - horizonY - 1);
            const c = depthT < 0.28
                ? this.mixColor(water.top, water.mid, depthT / 0.28)
                : this.mixColor(water.mid, water.bottom, (depthT - 0.28) / 0.72);

            ctx.fillStyle = this.rgb(c);
            ctx.fillRect(0, y, width, bandHeight);
        }
    }

    drawCloudBand(ctx, t) {
        const cfg = this.config.clouds;
        const horizonY = this.config.scene.horizonY;
        const width = this.config.resolution.width;
        const dayness = this.clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);

        const shadow = {
            r: Math.round(this.lerp(120, 194, dayness)),
            g: Math.round(this.lerp(128, 205, dayness)),
            b: Math.round(this.lerp(142, 176, dayness))
        };
        const mid = {
            r: Math.round(this.lerp(166, 224, dayness)),
            g: Math.round(this.lerp(176, 231, dayness)),
            b: Math.round(this.lerp(190, 202, dayness))
        };
        const light = {
            r: Math.round(this.lerp(196, 241, dayness)),
            g: Math.round(this.lerp(208, 242, dayness)),
            b: Math.round(this.lerp(220, 221, dayness))
        };

        /* Simple gradient band */
        const startY = horizonY - cfg.height;
        const endY = horizonY + cfg.thickness;
        const totalHeight = endY - startY;

        for (let y = startY; y < endY; y += 2) {
            const d = (y - startY) / totalHeight;
            let c = d < 0.18 ? light : d < 0.6 ? mid : shadow;
            ctx.fillStyle = this.rgb(c);
            ctx.fillRect(0, y, width, 2);
        }
    }

    drawSun(ctx, x, y) {
        const cfg = this.config.celestials;
        this.fillGlow(ctx, x, y, cfg.sunRadius, cfg.sunGlowRadius, "#ffd23f", cfg.sunGlowAlpha * 0.55);
        this.fillGlow(ctx, x, y, cfg.sunRadius, Math.round(cfg.sunGlowRadius * 0.72), "#ffea7a", cfg.sunGlowAlpha);
        this.fillCircle(ctx, x, y, cfg.sunRadius, "#ffd23f");
        this.fillCircle(ctx, x, y, cfg.sunRadius - 1, "#ffe76a");
        this.fillCircle(ctx, x - 4, y - 4, 2, "rgba(255,255,255,0.18)");
    }

    drawMoon(ctx, x, y) {
        const cfg = this.config.celestials;
        const r = cfg.moonRadius;
        this.fillGlow(ctx, x, y, r, cfg.moonGlowRadius, "#dfe8ff", cfg.moonGlowAlpha * 0.65);
        this.fillGlow(ctx, x, y, r, Math.round(cfg.moonGlowRadius * 0.72), "#ffffff", cfg.moonGlowAlpha);
        this.fillCircle(ctx, x, y, r, "#f7fbff");
        this.fillCircle(ctx, x, y, r - 1, "#ffffff");
        this.fillCircle(ctx, x + cfg.moonCrescentOffsetX, y + cfg.moonCrescentOffsetY, Math.max(2, r - cfg.moonCrescentRadiusOffset), "rgba(180,195,230,0.30)");
        this.fillCircle(ctx, x - 2, y - 2, 1, "rgba(255,255,255,0.16)");
    }

    drawHorizonGlow(ctx, sun, moon) {
        const horizonY = this.config.scene.horizonY;
        const width = this.config.resolution.width;

        if (sun && sun.y < horizonY + 50) {
            const strength = this.clamp(1 - Math.abs(horizonY - sun.y) / 90, 0, 1);
            ctx.fillStyle = `rgba(255,218,100,${0.08 * strength})`;
            ctx.fillRect(0, horizonY - 15, width, 30);
        }

        if (moon && moon.y < horizonY + 50) {
            const strength = this.clamp(1 - Math.abs(horizonY - moon.y) / 90, 0, 1) * 0.3;
            ctx.fillStyle = `rgba(232,240,255,${0.04 * strength})`;
            ctx.fillRect(0, horizonY - 10, width, 20);
        }
    }

    drawStars(ctx, t) {
        const cfg = this.config.stars;
        const nightA = 1 - this.smoothstep(cfg.fadeOutStart, cfg.fadeOutEnd, t);
        const nightB = this.smoothstep(cfg.fadeInStart, cfg.fadeInEnd, t);
        const night = Math.max(nightA, nightB);

        if (night <= 0.01) return;

        for (const star of this.stars) {
            const twinkle = 0.7 + 0.3 * Math.sin(this.elapsed * cfg.twinkleSpeed * star.speed + star.offset);
            const alpha = this.clamp(star.base * twinkle * night, 0, 1);
            this.fillCircle(ctx, star.x, star.y, star.r, `rgba(255,255,255,${alpha})`);
        }
    }

    drawWaterReflection(ctx, body, color, length, width) {
        if (!body) return;

        const horizonY = this.config.scene.horizonY;
        if (body.y > horizonY + 30) return;

        const startY = horizonY + 2;
        const endY = Math.min(this.config.resolution.height, startY + length);
        const strength = this.clamp(1 - (body.y - horizonY + 50) / 100, 0, 1);
        const wobble = Math.sin(this.elapsed * 0.001) * 5;

        for (let y = startY; y < endY; y += 3) {
            const t = (y - startY) / (endY - startY);
            const alpha = (1 - t) * 0.3 * strength;
            const w = this.lerp(width, 10, t);

            ctx.fillStyle = `rgba(${color},${alpha})`;
            ctx.fillRect(body.x - w / 2 + wobble * (1 - t), y, w, 2);
        }
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
        const palette = this.getSkyPalette(t);
        const { sun, moon } = this.getCelestialState(t);

        this.drawSkyGradient(ctx, palette);
        this.drawHorizonGlow(ctx, sun, moon);

        if (sun && this.shouldDrawBody(sun, this.config.celestials.sunRadius)) {
            this.drawSun(ctx, sun.x, sun.y);
        }
        if (moon && this.shouldDrawBody(moon, this.config.celestials.moonRadius)) {
            this.drawMoon(ctx, moon.x, moon.y);
        }

        this.drawCloudBand(ctx, t);
        this.drawOceanBase(ctx, t, palette);

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

        this.drawWaterReflection(ctx, this.cachedSun, "255,226,110", this.config.water.reflectionLengthSun, this.config.water.trailWidthSun);
        this.drawWaterReflection(ctx, this.cachedMoon, "255,255,255", this.config.water.reflectionLengthMoon, this.config.water.trailWidthMoon);

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