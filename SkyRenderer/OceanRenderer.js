window.OceanRenderer = class OceanRenderer {
	constructor(config, starsConfig, resolution, horizonY, container) {
		this.config = config;
		this.starsConfig = starsConfig;
		this.resolution = resolution;
		this.horizonY = horizonY;
		this.container = container;
		
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
			varying vec2 vUv;
			varying vec2 vPixelCoord;
			
			uniform vec2 uResolution;
			
			void main() {
				vUv = aTextureCoord;
				vPixelCoord = aTextureCoord * uResolution;
				gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
			}
		`;
		
		const fragmentShader = `
			precision mediump float;
			
			varying vec2 vUv;
			varying vec2 vPixelCoord;
			
			uniform float uTime;
			uniform float uDayness;
			uniform float uNight;
			uniform vec3 uSkyLower;
			uniform vec3 uSkyUpper;
			uniform float uSunX;
			uniform float uSunVisible;
			uniform float uMoonX;
			uniform float uMoonVisible;
			uniform float uAmbientStrength;
			uniform float uDetail;
			uniform vec2 uResolution;
			uniform float uDawnTint;
			uniform float uDuskTint;
			
			// Water colors (RGB 0-1)
			const vec3 dayTop = vec3(0.298, 0.788, 0.847);
			const vec3 dayMid = vec3(0.184, 0.624, 0.745);
			const vec3 dayBot = vec3(0.122, 0.435, 0.580);
			const vec3 nightTop = vec3(0.086, 0.192, 0.294);
			const vec3 nightMid = vec3(0.063, 0.145, 0.243);
			const vec3 nightBot = vec3(0.043, 0.098, 0.188);
			
			const vec3 sunColor = vec3(1.0, 0.886, 0.431);
			const vec3 moonColor = vec3(1.0, 1.0, 1.0);
			
			// Hash for pseudo-random pixel noise
			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
			}
			
			void main() {
				// Quantize to pixel grid for pixel-art look
				vec2 pixel = floor(vPixelCoord);
				float depth = pixel.y / uResolution.y;
				float depthQuantized = floor(depth * 100.0) / 100.0;
				
				// === BASE GRADIENT (3-band system) ===
				float day = 1.0 - uNight;
				
				float topK = day * 0.85 + uDawnTint * 0.15 + uDuskTint * 0.10;
				float midK = day * 0.8 + uDawnTint * 0.12 + uDuskTint * 0.08;
				float botK = day * 0.75;
				
				vec3 waterTop = mix(nightTop, dayTop, topK);
				vec3 waterMid = mix(nightMid, dayMid, midK);
				vec3 waterBot = mix(nightBot, dayBot, botK);
				
				// Sky reflection into water
				waterTop = mix(waterTop, uSkyLower, uAmbientStrength * 0.45);
				waterMid = mix(waterMid, uSkyUpper, uAmbientStrength * 0.22);
				
				// Depth gradient with hard band transition
				vec3 col;
				if (depthQuantized < 0.28) {
					col = mix(waterTop, waterMid, depthQuantized / 0.28);
				} else {
					col = mix(waterMid, waterBot, (depthQuantized - 0.28) / 0.72);
				}
				
				// === AMBIENT REFLECTION (near surface glow) ===
				float ambientDepth = 16.0 * 1.4 / uResolution.y;
				if (depth < ambientDepth) {
					float ambientFade = 1.0 - depth / ambientDepth;
					vec3 topReflect = mix(uSkyLower, vec3(1.0), 0.06);
					vec3 midReflect = mix(uSkyUpper, uSkyLower, 0.25);
					vec3 ambientCol = depth < ambientDepth * 0.35 
						? mix(topReflect, midReflect, depth / (ambientDepth * 0.35))
						: midReflect;
					col = mix(col, ambientCol, 0.10 * ambientFade);
					
					// Sparse wave highlights
					float wave = sin(pixel.x * 0.11 + pixel.y * 1.35 + uTime * 0.9) * 0.5
					           + sin(pixel.x * 0.035 + uTime * 0.5 + 1.3) * 0.3 + 0.5;
					float sparseMask = step(0.88, wave);
					float pixelSparse = step(0.75, fract(pixel.x / 4.0));  // every 4th pixel
					col += vec3(1.0) * 0.028 * ambientFade * sparseMask * pixelSparse;
				}
				
				// === SUN REFLECTION ===
				if (uSunVisible > 0.01) {
					float sunNormX = uSunX / uResolution.x;
					
					// Wobble per scanline
					float wobble = sin(pixel.y * 0.18 + uTime * 1.2) * 8.0
					             + sin(pixel.y * 0.05 + 1.7) * 4.0;
					float centerX = uSunX + wobble;
					
					// Width tapers with depth
					float trailLength = 140.0 / uResolution.y;
					float ty = min(depth / trailLength, 1.0);
					float halfWidth = mix(12.0, 3.0, pow(ty, 0.7)) * uSunVisible;
					
					float dx = abs(pixel.x - centerX);
					
					if (dx < halfWidth && depth < trailLength) {
						float edge = 1.0 - dx / halfWidth;
						
						// Breakup noise
						float breakup = sin(pixel.x * 0.18 + pixel.y * 0.11 + uTime * 0.8) * 0.5
						              + sin(pixel.x * 0.11 + pixel.y * 0.035 + 2.1) * 0.35 + 0.5;
						float breakThreshold = 0.35 + edge * 0.28;
						
						// Segment gaps (every few pixels vertically)
						float segmentMask = step(0.3, fract(pixel.y / 5.0));
						
						if (breakup > (1.0 - breakThreshold) && segmentMask > 0.5) {
							float alpha = 0.5 * (1.0 - ty) * edge * uSunVisible;
							col += sunColor * alpha;
						}
					}
				}
				
				// === MOON REFLECTION ===
				if (uMoonVisible > 0.01) {
					float wobble = sin(pixel.y * 0.15 + uTime * 1.0) * 6.0
					             + sin(pixel.y * 0.04 + 1.5) * 3.0;
					float centerX = uMoonX + wobble;
					
					float trailLength = 120.0 / uResolution.y;
					float ty = min(depth / trailLength, 1.0);
					float halfWidth = mix(8.0, 2.0, pow(ty, 0.7)) * uMoonVisible;
					
					float dx = abs(pixel.x - centerX);
					
					if (dx < halfWidth && depth < trailLength) {
						float edge = 1.0 - dx / halfWidth;
						
						float breakup = sin(pixel.x * 0.16 + pixel.y * 0.09 + uTime * 0.6) * 0.5
						              + sin(pixel.x * 0.09 + pixel.y * 0.03 + 1.8) * 0.35 + 0.5;
						float breakThreshold = 0.38 + edge * 0.25;
						
						float segmentMask = step(0.35, fract(pixel.y / 4.0));
						
						if (breakup > (1.0 - breakThreshold) && segmentMask > 0.5) {
							float alpha = 0.3 * (1.0 - ty) * edge * uMoonVisible;
							col += moonColor * alpha;
						}
					}
				}
				
				// === SHIMMER (sparse pixel sparkles) ===
				float shimmerDepth = 45.0 * uDetail / uResolution.y;
				if (depth < shimmerDepth) {
					float shimmerFade = 1.0 - depth / shimmerDepth;
					float wave = sin(pixel.x * 0.17 + pixel.y * 1.5 + uTime * 1.2 * uDetail) * 0.5 + 0.5;
					float threshold = 0.94 - uDetail * 0.12;
					
					// Sparse: every 3rd pixel
					float sparse = step(0.6, fract(pixel.x / 3.0));
					
					if (wave > threshold && sparse > 0.5) {
						col += vec3(1.0) * 0.03 * shimmerFade;
					}
				}
				
				// === SURFACE LINES ===
				float lineMaxDepth = 28.0 * uDetail / uResolution.y;
				float lineStartDepth = 5.0 / uResolution.y;
				if (depth > lineStartDepth && depth < lineMaxDepth) {
					// Every 3rd scanline
					float lineMask = step(0.6, fract(pixel.y / 3.0));
					
					if (lineMask > 0.5) {
						float lineFade = 1.0 - (depth - lineStartDepth) / (lineMaxDepth - lineStartDepth);
						float n = sin(pixel.x * 0.1 + pixel.y * 1.2 + uTime * 0.9 * uDetail) * 0.5 + 0.5;
						
						// Sparse: every 4th pixel
						float sparse = step(0.7, fract(pixel.x / 4.0));
						
						if (n > 0.82 && sparse > 0.5) {
							col += vec3(1.0) * 0.022 * lineFade;
						}
					}
				}
				
				gl_FragColor = vec4(col, 1.0);
			}
		`;
		
		const uniforms = {
			uTime: 0,
			uDayness: 0.5,
			uNight: 0.0,
			uSkyLower: [0.5, 0.5, 0.6],
			uSkyUpper: [0.4, 0.4, 0.5],
			uSunX: this.resolution.width * 0.5,
			uSunVisible: 0.0,
			uMoonX: this.resolution.width * 0.5,
			uMoonVisible: 0.0,
			uAmbientStrength: this.config.ambientReflectionStrength,
			uDetail: this.config.detail,
			uResolution: [this.resolution.width, this.resolution.height - this.horizonY],
			uDawnTint: 0.0,
			uDuskTint: 0.0
		};
		
		this.shader = PIXI.Shader.from(vertexShader, fragmentShader, uniforms);
		this.mesh = new PIXI.Mesh(geometry, this.shader);
		this.mesh.position.set(0, this.horizonY);
		
		this.container.addChild(this.mesh);
	}
	
	update(t, elapsed, skyPalette, sun, moon) {
		const u = this.shader.uniforms;
		const width = this.resolution.width;
		const horizonY = this.horizonY;
		
		u.uTime = elapsed * 0.001;
		
		// Night factor (matches CPU logic)
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
		if (sun && sun.y < horizonY + 90) {
			u.uSunX = sun.x;
			u.uSunVisible = Math.min(1, Math.max(0, (horizonY - sun.y + 90) / 180));
		} else {
			u.uSunVisible = 0;
		}
		
		// Moon
		if (moon && moon.y < horizonY + 80) {
			u.uMoonX = moon.x;
			u.uMoonVisible = Math.min(1, Math.max(0, (horizonY - moon.y + 80) / 160));
		} else {
			u.uMoonVisible = 0;
		}
	}
	
	draw(ctx, t, skyPalette, sun, moon, celestialConfig, elapsed) {
		this.update(t, elapsed, skyPalette, sun, moon);
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