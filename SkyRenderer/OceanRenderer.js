window.OceanRenderer = class OceanRenderer {
    constructor(config, starsConfig, resolution, horizonY, container, offset = {x: 0, y: 0}) {
        this.config = config;
        this.starsConfig = starsConfig;
        this.resolution = resolution;
        this.horizonY = horizonY;
        this.container = container;
        this.offset = offset;

        this.mesh = null;
        this.shader = null;

        this.buildShader();
    }

    buildShader() {
        const oceanHeight = this.resolution.height - this.horizonY;
        const width = this.resolution.width;

        const geometry = new PIXI.Geometry()
            .addAttribute('aVertexPosition', [
                0, 0,
                width, 0,
                width, oceanHeight,
                0, oceanHeight
            ], 2)
            .addAttribute('aTextureCoord', [
                0, 0,
                1, 0,
                1, 1,
                0, 1
            ], 2)
            .addIndex([0, 1, 2, 0, 2, 3]);

        const vertexShader = `
			precision mediump float;
			attribute vec2 aVertexPosition;
			attribute vec2 aTextureCoord;
			uniform mat3 projectionMatrix;
			uniform mat3 translationMatrix;
			uniform vec2 uResolution;
			
			varying vec2 vUv;
			varying vec2 vPixelCoord;
			
			void main() {
				vUv = aTextureCoord;
				vPixelCoord = aTextureCoord * uResolution;
				gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
			}
		`;

        const fragmentShader = `
			precision mediump float;
			
			varying vec2 vUv;
			varying vec2 vPixelCoord;
			
			uniform vec2 uResolution;
			uniform float uTime;
			uniform float uNight;
			uniform vec3 uSkyLower;
			uniform vec3 uSkyUpper;
			uniform float uSunX;
			uniform float uSunY;
			uniform float uSunVisible;
			uniform float uMoonX;
			uniform float uMoonY;
			uniform float uMoonVisible;
			uniform float uAmbientStrength;
			uniform float uDetail;
			uniform float uDawnTint;
			uniform float uDuskTint;
			uniform float uHorizonY;
			
			// Config uniforms
			uniform float uShimmerDepth;
			uniform float uReflectionLengthSun;
			uniform float uReflectionLengthMoon;
			uniform float uTrailWidthSun;
			uniform float uTrailWidthMoon;
			uniform float uTrailWidthFarSun;
			uniform float uTrailWidthFarMoon;
			uniform float uTrailWobble;
			uniform float uTrailSegmentHeight;
			uniform float uTrailGap;
			uniform float uTrailTaper;
			uniform float uTrailBreakup;
			uniform float uSunReflectionAlpha;
			uniform float uMoonReflectionAlpha;
			uniform float uCelestialReflectionStrength;
			uniform float uSunRadius;
			uniform float uMoonRadius;
			
			// Fog line uniforms
			uniform float uFogLine1Y;
			uniform float uFogLine1Alpha;
			uniform float uFogLine2Y;
			uniform float uFogLine2Alpha;
			
			// Water colors (RGB 0-1)
			const vec3 nightTop = vec3(0.086, 0.192, 0.294);    // #16314b
			const vec3 nightMid = vec3(0.063, 0.145, 0.243);    // #10253f
			const vec3 nightBot = vec3(0.043, 0.098, 0.188);    // #0b1930
			const vec3 dayTop = vec3(0.298, 0.788, 0.847);      // #4cc9d8
			const vec3 dayMid = vec3(0.184, 0.624, 0.745);      // #2f9fbe
			const vec3 dayBot = vec3(0.122, 0.435, 0.580);      // #1f6f94
			
			const vec3 sunColor = vec3(1.0, 0.886, 0.431);      // rgb(255, 226, 110)
			const vec3 moonColor = vec3(1.0, 1.0, 1.0);
			
			// Fog colors (matching cloud colors)
			const vec3 nightFog = vec3(0.561, 0.502, 0.557);    // mix of shadow/light
			const vec3 dayFog = vec3(0.853, 0.859, 0.780);      // mix of shadow/light
			
			void main() {
				vec2 pixel = floor(vPixelCoord);
				float y = pixel.y;
				float x = pixel.x;
				
				float oceanHeight = uResolution.y;
				float depthT = y / max(1.0, oceanHeight - 1.0);
				
				// === BASE GRADIENT ===
				float day = 1.0 - uNight;
				
				float topK = day * 0.85 + uDawnTint * 0.15 + uDuskTint * 0.10;
				float midK = day * 0.8 + uDawnTint * 0.12 + uDuskTint * 0.08;
				float botK = day * 0.75;
				
				vec3 baseTop = mix(nightTop, dayTop, topK);
				vec3 baseMid = mix(nightMid, dayMid, midK);
				vec3 baseBot = mix(nightBot, dayBot, botK);
				
				// Mix with sky reflection
				vec3 waterTop = mix(baseTop, uSkyLower, uAmbientStrength * 0.45);
				vec3 waterMid = mix(baseMid, uSkyUpper, uAmbientStrength * 0.22);
				vec3 waterBot = baseBot;
				
				vec3 col;
				if (depthT < 0.28) {
					col = mix(waterTop, waterMid, depthT / 0.28);
				} else {
					col = mix(waterMid, waterBot, (depthT - 0.28) / 0.72);
				}
				
				// === AMBIENT WATER REFLECTION ===
				float ambientDepth = max(16.0, uShimmerDepth * 1.4);
				if (y < ambientDepth) {
					float t = y / ambientDepth;
					float fade = 1.0 - t;
					
					vec3 topReflect = mix(uSkyLower, vec3(1.0), 0.06);
					vec3 midReflect = mix(uSkyUpper, uSkyLower, 0.25);
					vec3 lineColor = t < 0.35 
						? mix(topReflect, midReflect, t / 0.35)
						: midReflect;
					
					col = mix(col, lineColor, 0.10 * fade);
					
					// Wave highlights - every 4 pixels, width 2
					float pixelMod4 = mod(x, 4.0);
					if (pixelMod4 < 2.0) {
						float wave = sin(x * 0.11 + y * 1.35 + uTime * 0.9) * 0.5
						           + sin(x * 0.035 + uTime * 0.5 + 1.3) * 0.3
						           + 0.5;
						if (wave > 0.88) {
							col += vec3(1.0) * 0.028 * fade;
						}
					}
				}
				
				// === FOG LINES AT TOP ===
				vec3 fogColor = mix(nightFog, dayFog, day);
				
				if (y < uFogLine1Y + 1.0 && y >= uFogLine1Y) {
					col = mix(col, fogColor, uFogLine1Alpha);
				} else if (y < uFogLine2Y + 1.0 && y >= uFogLine2Y) {
					col = mix(col, fogColor, uFogLine2Alpha);
				}
				
				// === SUN REFLECTION ===
				if (uSunVisible > 0.0) {
					float above = clamp((uHorizonY - uSunY + uSunRadius) / 180.0, 0.0, 1.0);
					
					if (above > 0.0) {
						float startY = 1.0;
						float endY = min(oceanHeight - 1.0, uReflectionLengthSun);
						float segmentStep = uTrailSegmentHeight + uTrailGap;
						
						// Check if this y is on a segment
						if (y >= startY && y <= endY) {
    						float segmentFade = 1.0 - mod(y - startY, 2.0) * 0.15;  // subtle fade every 2px
							float ty = (y - startY) / max(1.0, endY - startY);
							float taperAmount = pow(ty, uTrailTaper);
							float halfWidth = max(1.0, floor(
								mix(uTrailWidthSun, uTrailWidthFarSun, taperAmount) * above + 0.5
							));
							
							float wobble = sin(y * 0.18 + uTime * 1.2) * uTrailWobble
							             + sin(y * 0.05 + 1.7) * uTrailWobble * 0.5;
							float centerX = floor(uSunX + wobble + 0.5);
							
							// Every 2 pixels horizontally
							float xAligned = floor(x / 2.0) * 2.0;
							float dx = abs(xAligned - centerX);
							
							if (dx <= halfWidth) {
								float nx = dx / max(1.0, halfWidth);
								float edge = 1.0 - nx;
								
								float alpha = uSunReflectionAlpha * uDetail
											* segmentFade
											* (1.0 - ty)
											* edge
											* above
											* uCelestialReflectionStrength;
								col = mix(col, vec3(1.0, 0.85, 0.3), clamp(alpha * 1.5, 0.0, 0.95));
							}
						}
					}
				}
				
				// === MOON REFLECTION ===
				if (uMoonVisible > 0.0) {
					float above = clamp((uHorizonY - uMoonY + uMoonRadius) / 160.0, 0.0, 1.0);
					
					if (above > 0.0) {
						float startY = 1.0;
						float endY = min(oceanHeight - 1.0, uReflectionLengthMoon);
						float segmentStep = uTrailSegmentHeight + uTrailGap;
						
						if (y >= startY && y <= endY) {
    						float segmentFade = 1.0 - mod(y - startY, 2.0) * 0.15;  // subtle fade every 2px
							float ty = (y - startY) / max(1.0, endY - startY);
							float taperAmount = pow(ty, uTrailTaper);
							float halfWidth = max(1.0, floor(
								mix(uTrailWidthMoon, uTrailWidthFarMoon, taperAmount) * above + 0.5
							));
							
							float wobble = sin(y * 0.18 + uTime * 1.2) * uTrailWobble
							             + sin(y * 0.05 + 1.7) * uTrailWobble * 0.5;
							float centerX = floor(uMoonX + wobble + 0.5);
							
							float xAligned = floor(x / 2.0) * 2.0;
							float dx = abs(xAligned - centerX);
							
							if (dx <= halfWidth) {
								float nx = dx / max(1.0, halfWidth);
								float edge = 1.0 - nx;
								 
								float alpha = uMoonReflectionAlpha * uDetail
											* segmentFade
											* (1.0 - ty)
											* edge
											* above
											* uCelestialReflectionStrength;
								col += moonColor * alpha;
							}
						}
					}
				}
				
				// === WATER SHIMMER ===
				float shimmerDepthPx = floor(uShimmerDepth * uDetail + 0.5);
				if (y >= 2.0 && y < shimmerDepthPx) {
					float fade = 1.0 - (y - 2.0) / max(1.0, shimmerDepthPx - 2.0);
					
					// Every 3 pixels, width 2
					float pixelMod3 = mod(x, 3.0);
					if (pixelMod3 < 2.0) {
						float wave = sin(x * 0.17 + y * 1.5 + uTime * 1.2 * uDetail) * 0.5 + 0.5;
						float threshold = 0.94 - uDetail * 0.12;
						
						if (wave > threshold) {
							col += vec3(1.0) * 0.03 * fade;
						}
					}
				}
				
				// === SURFACE LINES ===
				float lineMaxY = floor(28.0 * uDetail + 0.5);
				if (y >= 5.0 && y < lineMaxY) {
					// Every 3rd scanline
					float yMod3 = mod(y - 5.0, 3.0);
					if (yMod3 < 1.0) {
						float fade = 1.0 - y / max(1.0, lineMaxY);
						
						// Every 4 pixels, width 2
						float pixelMod4 = mod(x, 4.0);
						if (pixelMod4 < 2.0) {
							float n = sin(x * 0.1 + y * 1.2 + uTime * 0.9 * uDetail) * 0.5 + 0.5;
							
							if (n > 0.82) {
								col += vec3(1.0) * 0.022 * fade;
							}
						}
					}
				}
                
				gl_FragColor = vec4(col, 1.0);
			}
		`;

        const cfg = this.config;

        const uniforms = {
            uResolution: [width, oceanHeight],
            uTime: 0,
            uNight: 0.0,
            uSkyLower: [0.5, 0.5, 0.6],
            uSkyUpper: [0.4, 0.4, 0.5],
            uSunX: width * 0.5,
            uSunY: 0,
            uSunVisible: 0.0,
            uMoonX: width * 0.5,
            uMoonY: 0,
            uMoonVisible: 0.0,
            uAmbientStrength: cfg.ambientReflectionStrength,
            uDetail: cfg.detail,
            uDawnTint: 0.0,
            uDuskTint: 0.0,
            uHorizonY: this.horizonY,

            // Water config
            uShimmerDepth: cfg.shimmerDepth,
            uReflectionLengthSun: cfg.reflectionLengthSun,
            uReflectionLengthMoon: cfg.reflectionLengthMoon,
            uTrailWidthSun: cfg.trailWidthSun,
            uTrailWidthMoon: cfg.trailWidthMoon,
            uTrailWidthFarSun: cfg.trailWidthFarSun,
            uTrailWidthFarMoon: cfg.trailWidthFarMoon,
            uTrailWobble: cfg.trailWobble,
            uTrailSegmentHeight: cfg.trailSegmentHeight,
            uTrailGap: cfg.trailGap,
            uTrailTaper: cfg.trailTaper,
            uTrailBreakup: cfg.trailBreakup,
            uSunReflectionAlpha: cfg.sunReflectionAlpha,
            uMoonReflectionAlpha: cfg.moonReflectionAlpha,
            uCelestialReflectionStrength: cfg.celestialReflectionStrength,
            uSunRadius: 16,
            uMoonRadius: 14,

            // Fog lines
            uFogLine1Y: cfg.fogLine1Y ?? 0,
            uFogLine1Alpha: cfg.fogLine1Alpha ?? 0.3,
            uFogLine2Y: cfg.fogLine2Y ?? 2,
            uFogLine2Alpha: cfg.fogLine2Alpha ?? 0.15,
        };

        this.shader = PIXI.Shader.from(vertexShader, fragmentShader, uniforms);
        this.mesh = new PIXI.Mesh(geometry, this.shader);
        this.mesh.position.set(this.offset.x, this.offset.y + this.horizonY);

        this.container.addChild(this.mesh);
    }

    update(t, elapsed, skyPalette, sun, moon, celestialConfig) {
        const u = this.shader.uniforms;
        const horizonY = this.horizonY;

        u.uTime = elapsed * 0.001;

        // Night factor
        const cfg = this.starsConfig;
        let nightA = 0, nightB = 0;
        if (t < cfg.fadeOutEnd) {
            const k = t <= cfg.fadeOutStart ? 0 : (t - cfg.fadeOutStart) / (cfg.fadeOutEnd - cfg.fadeOutStart);
            nightA = 1 - k * k * (3 - 2 * k);
        }
        if (t > cfg.fadeInStart) {
            const k = t >= cfg.fadeInEnd ? 1 : (t - cfg.fadeInStart) / (cfg.fadeInEnd - cfg.fadeInStart);
            nightB = k * k * (3 - 2 * k);
        }
        u.uNight = Math.max(nightA, nightB);

        // Dawn/dusk tints
        let dawnTint = 0, duskTint = 0;
        if (t > 0.18 && t < 0.55) {
            const d1 = Math.min(1, Math.max(0, (t - 0.18) / 0.12));
            const d2 = Math.min(1, Math.max(0, (t - 0.45) / 0.10));
            dawnTint = (d1 * d1 * (3 - 2 * d1)) * (1 - d2 * d2 * (3 - 2 * d2));
        }
        if (t > 0.55 && t < 0.95) {
            const d1 = Math.min(1, Math.max(0, (t - 0.55) / 0.13));
            const d2 = Math.min(1, Math.max(0, (t - 0.82) / 0.13));
            duskTint = (d1 * d1 * (3 - 2 * d1)) * (1 - d2 * d2 * (3 - 2 * d2));
        }
        u.uDawnTint = dawnTint;
        u.uDuskTint = duskTint;

        // Sky colors
        u.uSkyLower = [skyPalette.lower.r / 255, skyPalette.lower.g / 255, skyPalette.lower.b / 255];
        u.uSkyUpper = [skyPalette.upper.r / 255, skyPalette.upper.g / 255, skyPalette.upper.b / 255];

        // Sun
        if (sun) {
            u.uSunX = sun.x;
            u.uSunY = sun.y;
            u.uSunVisible = sun.y < horizonY + 90 ? 1.0 : 0.0;
        } else {
            u.uSunVisible = 0;
        }

        // Moon
        if (moon) {
            u.uMoonX = moon.x;
            u.uMoonY = moon.y;
            u.uMoonVisible = moon.y < horizonY + 80 ? 1.0 : 0.0;
        } else {
            u.uMoonVisible = 0;
        }

        // Celestial config
        if (celestialConfig) {
            u.uSunRadius = celestialConfig.sunRadius;
            u.uMoonRadius = celestialConfig.moonRadius;
        }
    }

    draw(ctx, t, skyPalette, sun, moon, celestialConfig, elapsed) {
        this.update(t, elapsed, skyPalette, sun, moon, celestialConfig);
    }

    destroy() {
        if (this.mesh) {
            this.container.removeChild(this.mesh);
            this.mesh.destroy();
            this.mesh = null;
        }
        this.shader = null;
    }
}