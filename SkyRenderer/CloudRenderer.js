window.CloudRenderer = class CloudRenderer {
	constructor(config, container, horizonY) {
		this.config = config;
		this.container = container;
		this.horizonY = horizonY;
		
		this.mesh = null;
		this.shader = null;
		
		this.build();
	}
	
	build() {
		const cfg = this.config;
		const width = cfg.worldWidth;
		const maxOffset = Math.ceil(21.5 * cfg.detail);
		const meshHeight = cfg.height + cfg.thickness + maxOffset * 2;
		
		this.shader = PIXI.Shader.from(
			/* Vertex shader */
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
			/* Fragment shader */
			`
			precision mediump float;
			varying vec2 vTextureCoord;
			uniform float uDayness;
			uniform float uScroll;
			uniform float uDetail;
			uniform float uMeshHeight;
			uniform float uLayerOffset;
			uniform float uWorldWidth;
			uniform float uBackSpeed;
			uniform float uBackVerticalOffset;
			
			float getCloudTop(float x, float seed) {
				float n1 = sin(x * 0.022 + 0.5 + seed) * 8.0 * uDetail;
				float n2 = sin(x * 0.061 + 1.4 + seed) * 6.0 * uDetail;
				float n3 = sin(x * 0.18  + 1.3 + seed) * 4.0 * uDetail;
				float n4 = sin(x * 0.43  + 2.2 + seed) * 2.0 * uDetail;
				float n5 = sin(x * 0.93  + 0.4 + seed) * 1.5 * uDetail;
				return floor(n1 + n2 + n3 + n4 + n5 + 0.5);
			}
			
			void main() {
				float localY = vTextureCoord.y * uMeshHeight;
				float maxOffset = ceil(21.5 * uDetail);
				float baseY = maxOffset;
				
				/* Front layer - full speed */
				float worldXFront = vTextureCoord.x * uWorldWidth + uScroll;
				float top1 = baseY + getCloudTop(worldXFront, 0.0);
				
				/* Back layer - slower speed, different pattern */
				float worldXBack = vTextureCoord.x * uWorldWidth + uScroll * uBackSpeed;
				float top2 = baseY + getCloudTop(worldXBack + uLayerOffset, 2.5) - uBackVerticalOffset;
				
				/* Day/night colors */
				vec3 nightLight  = vec3(196.0, 208.0, 220.0) / 255.0;
				vec3 nightMid    = vec3(166.0, 176.0, 190.0) / 255.0;
				vec3 nightShadow = vec3(120.0, 128.0, 142.0) / 255.0;
				
				vec3 dayLight  = vec3(241.0, 242.0, 221.0) / 255.0;
				vec3 dayMid    = vec3(224.0, 231.0, 202.0) / 255.0;
				vec3 dayShadow = vec3(194.0, 205.0, 176.0) / 255.0;
				
				vec3 light  = mix(nightLight,  dayLight,  uDayness);
				vec3 mid    = mix(nightMid,    dayMid,    uDayness);
				vec3 shadow = mix(nightShadow, dayShadow, uDayness);
				
				vec3 color = vec3(0.0);
				float alpha = 0.0;
				
				/* Back layer (behind, semi-transparent shadow only) */
				if (localY >= top2 && localY < top1) {
					float d = (localY - top2) / max(1.0, uMeshHeight - top2);
					
					color = shadow;
					alpha = (1.0 - d) * uBackAlpha;
				}
				
				/* Front layer (on top, fully opaque) */
				if (localY >= top1) {
					float d = (localY - top1) / max(1.0, uMeshHeight - top1);
					
					if (d < 0.18) {
						color = light;
					} else if (d < 0.6) {
						color = mid;
					} else {
						color = shadow;
					}
					alpha = 1.0;
				}
				
				if (alpha < 0.01) {
					discard;
				}
				
				gl_FragColor = vec4(color, alpha);
			}
			`,
			{
				uDayness: 1.0,
				uScroll: 0.0,
				uDetail: cfg.detail,
				uMeshHeight: meshHeight,
				uLayerOffset: cfg.layerOffset,
				uWorldWidth: width,
				uBackSpeed: cfg.backSpeed,
				uBackVerticalOffset: cfg.backVerticalOffset || 4.0,
				uBackAlpha: cfg.backAlpha || 0.1
			}
		);
		
		const geometry = new PIXI.Geometry()
			.addAttribute('aVertexPosition', [0, 0, width, 0, width, meshHeight, 0, meshHeight], 2)
			.addAttribute('aTextureCoord', [0, 0, 1, 0, 1, 1, 0, 1], 2)
			.addIndex([0, 1, 2, 0, 2, 3]);
		
		this.mesh = new PIXI.Mesh(geometry, this.shader);
		this.mesh.x = cfg.offsetX || 0;
		this.mesh.y = (cfg.offsetY || 0) + this.horizonY - cfg.height - maxOffset;
		
		this.container.addChild(this.mesh);
	}
	
	update(elapsed, dayness) {
		if (!this.shader) return;
		
		this.shader.uniforms.uDayness = dayness;
		this.shader.uniforms.uScroll = elapsed * this.config.driftSpeed * this.config.worldWidth;
	}
	
	destroy() {
		if (this.mesh) {
			this.mesh.destroy();
			this.mesh = null;
		}
		this.shader = null;
	}
}