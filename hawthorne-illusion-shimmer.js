// To be used with the Relic Scope for illusions
// Author: J. Kunz
// Shader magic: Claude
if (game.shimmerMap !== game.map.id) {
	game.shimmerMap = game.map.id;
	const config = {
		amplitude: 1,
		frequency: 0.5,
		speed: 2.5,
		illusionPatterns: ["illusion"],
	};

	const fragmentShader = [
		"precision highp float;",
		"varying vec2 vTextureCoord;",
		"uniform sampler2D uSampler;",
		"uniform float uTime;",
		"uniform float uAmplitude;",
		"uniform float uFrequency;",
		"uniform highp vec4 inputSize;",
		"void main(void) {",
		"    vec2 coord = vTextureCoord;",
		"    float pixelY = coord.y * inputSize.y;",
		"    coord.x += sin(pixelY * uFrequency * 0.1 + uTime) * (uAmplitude / inputSize.x);",
		"    vec4 color = texture2D(uSampler, coord);",
		"    gl_FragColor = color;",
		"}"
	].join("\n");

	game.shimmerFilter = new PIXI.Filter(undefined, fragmentShader, {
		uTime: 0,
		uAmplitude: config.amplitude,
		uFrequency: config.frequency
	});

	for (let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (!gameObject?.sprite) continue;
		
		const candidate = objName.toLowerCase();
		for (let pattern of config.illusionPatterns) {
			if (candidate.includes(pattern)) {
				gameObject.sprite.filters = [game.shimmerFilter];
				console.log("Applied shimmer to:", objName);
				break;
			}
		}
	}

	game.lastShimmerTime = performance.now();

	function updateShimmer() {
		if (game.shimmerMap !== game.map.id) return;

		const currentTime = performance.now();
		const dt = (currentTime - game.lastShimmerTime) / 1000;
		game.lastShimmerTime = currentTime;

		game.shimmerFilter.uniforms.uTime += config.speed * dt;
		
		requestAnimationFrame(updateShimmer);
	}
	updateShimmer();
}