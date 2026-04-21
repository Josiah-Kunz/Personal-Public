window.OceanRenderer = class OceanRenderer {
	constructor(config, starsConfig, resolution, horizonY, container) {
		this.config = config;
		this.starsConfig = starsConfig;
		this.resolution = resolution;
		this.horizonY = horizonY;
		this.container = container;
		
		this.sprite = null;
		this.shader = null;
		
		this.buildShader();
	}
	
	buildShader() {
		const oceanHeight = this.resolution.height - this.horizonY;
		
		const geometry = new PIXI.Geometry()
			.addAttribute('aVertexPosition', [
				0, 0,
				this.resolution.width, 0,
				this.resolution.width, oceanHeight,
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
			attribute vec2 aVertexPosition;
			attribute vec2 aTextureCoord;
			uniform mat3 projectionMatrix;
			varying vec2 vUv;
			
			void main() {
				vUv = aTextureCoord;
				gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
			}
		`;
		
		const fragmentShader = `
			precision mediump float;
			
			varying vec2 vUv;
			
			uniform float uTime;
			uniform float uDayness;
			uniform vec3 uSkyLower;
			uniform vec3 uSkyUpper;
			uniform vec2 uSunPos;      // normalized 0-1
			uniform vec2 uMoonPos;     // normalized 0-1
			uniform float uSunVisible;
			uniform float uMoonVisible;
			uniform float uAmbientStrength;
			uniform float uDetail;
			uniform vec2 uResolution;
			
			// Day/night water colors
			const vec3 dayTop = vec3(0.298, 0.788, 0.847);     // #4cc9d8
			const vec3 dayMid = vec3(0.184, 0.624, 0.745);     // #2f9fbe
			const vec3 dayBot = vec3(0.122, 0.435, 0.580);     // #1f6f94
			const vec3 nightTop = vec3(0.086, 0.192, 0.294);   // #16314b
			const vec3 nightMid = vec3(0.063, 0.145, 0.243);   // #10253f
			const vec3 nightBot = vec3(0.043, 0.098, 0.188);   // #0b1930
			
			// Sun/moon reflection colors
			const vec3 sunColor = vec3(1.0, 0.886, 0.431);     // #ffe26e
			const vec3 moonColor = vec3(1.0, 1.0, 1.0);
			
			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
			}
			
			void main() {
				vec2 uv = vUv;
				float depth = uv.y;
				
				// Base gradient
				vec3 topCol = mix(nightTop, dayTop, uDayness * 0.85);
				vec3 midCol = mix(nightMid, dayMid, uDayness * 0.8);
				vec3 botCol = mix(nightBot, dayBot, uDayness * 0.75);
				
				// Mix with sky reflection
				topCol = mix(topCol, uSkyLower, uAmbientStrength * 0.45);
				midCol = mix(midCol, uSkyUpper, uAmbientStrength * 0.22);
				
				// Depth gradient
				vec3 col;
				if (depth < 0.28) {
					col = mix(topCol, midCol, depth / 0.28);
				} else {
					col = mix(midCol, botCol, (depth - 0.28) / 0.72);
				}
				
				// Animated waves / shimmer
				float wave1 = sin(uv.x * 40.0 + uv.y * 50.0 + uTime * 0.9) * 0.5 + 0.5;
				float wave2 = sin(uv.x * 15.0 + uTime * 0.5 + 1.3) * 0.5 + 0.5;
				float shimmer = wave1 * wave2;
				
				float shimmerFade = 1.0 - smoothstep(0.0, 0.15, depth);
				if (shimmer > 0.85 && shimmerFade > 0.0) {
					col += vec3(1.0) * 0.03 * shimmerFade * uDetail;
				}
				
				// Sun reflection
				if (uSunVisible > 0.0) {
					float sunDist = abs(uv.x - uSunPos.x);
					float trailWidth = mix(0.15, 0.01, pow(depth, 0.8));
					float sunTrail = smoothstep(trailWidth, 0.0, sunDist);
					
					float wobble = sin(depth * 30.0 + uTime * 1.2) * 0.02;
					sunTrail *= step(abs(uv.x - uSunPos.x - wobble), trailWidth);
					
					float breakup = sin(uv.x * 70.0 + depth * 40.0 + uTime * 0.8) * 0.5 + 0.5;
					sunTrail *= step(0.3, breakup);
					
					float sunFade = (1.0 - depth) * uSunVisible;
					col += sunColor * sunTrail * sunFade * 0.6;
				}
				
				// Moon reflection
				if (uMoonVisible > 0.0) {
					float moonDist = abs(uv.x - uMoonPos.x);
					float trailWidth = mix(0.10, 0.008, pow(depth, 0.8));
					float moonTrail = smoothstep(trailWidth, 0.0, moonDist);
					
					float wobble = sin(depth * 25.0 + uTime * 1.0) * 0.015;
					moonTrail *= step(abs(uv.x - uMoonPos.x - wobble), trailWidth);
					
					float breakup = sin(uv.x * 60.0 + depth * 35.0 + uTime * 0.6) * 0.5 + 0.5;
					moonTrail *= step(0.35, breakup);
					
					float moonFade = (1.0 - depth) * uMoonVisible;
					col += moonColor * moonTrail * moonFade * 0.3;
				}
				
				// Surface line highlights
				float surfaceLine = sin(uv.x * 35.0 + depth * 45.0 + uTime * 0.9) * 0.5 + 0.5;
				float lineFade = 1.0 - smoothstep(0.0, 0.12, depth);
				if (surfaceLine > 0.82 && lineFade > 0.0) {
					col += vec3(1.0) * 0.02 * lineFade * uDetail;
				}
				
				gl_FragColor = vec4(col, 1.0);
			}
		`;
		
		const uniforms = {
			uTime: 0,
			uDayness: 0.5,
			uSkyLower: [0.5, 0.5, 0.6],
			uSkyUpper: [0.4, 0.4, 0.5],
			uSunPos: [0.5, 0.0],
			uMoonPos: [0.5, 0.0],
			uSunVisible: 0.0,
			uMoonVisible: 0.0,
			uAmbientStrength: this.config.ambientReflectionStrength,
			uDetail: this.config.detail,
			uResolution: [this.resolution.width, this.resolution.height - this.horizonY]
		};
		
		this.shader = PIXI.Shader.from(vertexShader, fragmentShader, uniforms);
		this.mesh = new PIXI.Mesh(geometry, this.shader);
		this.mesh.position.set(0, this.horizonY);
		
		this.container.addChild(this.mesh);
	}
	
	update(t, elapsed, skyPalette, sun, moon) {
		const uniforms = this.shader.uniforms;
		const width = this.resolution.width;
		const horizonY = this.horizonY;
		
		// Time
		uniforms.uTime = elapsed * 0.001;
		
		// Dayness
		uniforms.uDayness = clamp(Math.sin(t * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
		
		// Sky colors (normalized 0-1)
		uniforms.uSkyLower = [skyPalette.lower.r / 255, skyPalette.lower.g / 255, skyPalette.lower.b / 255];
		uniforms.uSkyUpper = [skyPalette.upper.r / 255, skyPalette.upper.g / 255, skyPalette.upper.b / 255];
		
		// Sun position and visibility
		if (sun && sun.y < horizonY + 50) {
			uniforms.uSunPos = [sun.x / width, 0];
			uniforms.uSunVisible = clamp((horizonY + 50 - sun.y) / 100, 0, 1);
		} else {
			uniforms.uSunVisible = 0;
		}
		
		// Moon position and visibility
		if (moon && moon.y < horizonY + 50) {
			uniforms.uMoonPos = [moon.x / width, 0];
			uniforms.uMoonVisible = clamp((horizonY + 50 - moon.y) / 100, 0, 1);
		} else {
			uniforms.uMoonVisible = 0;
		}
	}
	
	// Legacy draw method - now just updates uniforms
	draw(ctx, t, skyPalette, sun, moon, celestialConfig, elapsed) {
		this.update(t, elapsed, skyPalette, sun, moon);
	}
	
	destroy() {
		if (this.mesh) {
			this.mesh.destroy();
			this.mesh = null;
		}
		this.shader = null;
	}
}