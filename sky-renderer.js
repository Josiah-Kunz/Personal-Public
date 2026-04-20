class SkyRenderer {
	constructor(game, config = {}) {
		this.game = game;
		this.map = game.map;

		this.config = {
			offset: { x: 0, y: 0, ...config.offset },
			resolution: { width: game.width, height: game.height, ...config.resolution },
			timing: { fps: 30, overallSpeed: 1, ...config.timing },
			scene: { horizonY: 245, ...config.scene },
			stars: { amount: 40, ...config.stars }
		};

		this.container = null;
		this.layers = {};
		this.stars = [];
		this.running = false;
		this.animationId = null;
		this.lastTime = 0;
		this.elapsed = 0;

		this.init();
	}

	init() {
		/* Create main container */
		this.container = document.createElement('div');
		this.container.style.cssText = `
			position: absolute;
			left: ${this.config.offset.x}px;
			top: ${this.config.offset.y}px;
			width: ${this.config.resolution.width}px;
			height: ${this.config.resolution.height}px;
			overflow: hidden;
			pointer-events: none;
			image-rendering: pixelated;
		`;

		/* Sky gradient layer */
		this.layers.sky = this.createLayer('sky', `
			background: linear-gradient(
				to bottom,
				#4f88c7 0%,
				#8f97cb 48%,
				#e7c5a6 100%
			);
		`);
		this.layers.sky.style.height = `${this.config.scene.horizonY}px`;

		/* Night overlay */
		this.layers.night = this.createLayer('night', `
			background: linear-gradient(
				to bottom,
				#040814 0%,
				#0b1733 48%,
				#1a2950 100%
			);
			opacity: 0;
		`);
		this.layers.night.style.height = `${this.config.scene.horizonY}px`;

		/* Sun layer */
		this.layers.sun = this.createLayer('sun', `
			width: 32px;
			height: 32px;
			border-radius: 50%;
			background: radial-gradient(circle, #ffe76a 0%, #ffd23f 60%, rgba(255,210,63,0) 100%);
			box-shadow: 0 0 40px 20px rgba(255,234,122,0.3);
			opacity: 0;
		`);

		/* Moon layer */
		this.layers.moon = this.createLayer('moon', `
			width: 28px;
			height: 28px;
			border-radius: 50%;
			background: radial-gradient(circle at 30% 30%, #ffffff 0%, #f7fbff 50%, #dfe8ff 100%);
			box-shadow: 0 0 30px 15px rgba(223,232,255,0.2);
			opacity: 0;
		`);

		/* Stars container */
		this.layers.stars = this.createLayer('stars', `opacity: 0;`);
		this.layers.stars.style.height = `${this.config.scene.horizonY}px`;
		this.buildStars();

		/* Cloud band */
		this.layers.clouds = this.createLayer('clouds', `
			top: ${this.config.scene.horizonY - 15}px;
			height: 20px;
			background: linear-gradient(
				to bottom,
				rgba(241,242,221,0.9) 0%,
				rgba(224,231,202,1) 40%,
				rgba(194,205,176,1) 100%
			);
		`);

		/* Ocean layer */
		this.layers.ocean = this.createLayer('ocean', `
			top: ${this.config.scene.horizonY}px;
			height: ${this.config.resolution.height - this.config.scene.horizonY}px;
			background: linear-gradient(
				to bottom,
				#4cc9d8 0%,
				#2f9fbe 28%,
				#1f6f94 100%
			);
		`);

		/* Ocean night overlay */
		this.layers.oceanNight = this.createLayer('oceanNight', `
			top: ${this.config.scene.horizonY}px;
			height: ${this.config.resolution.height - this.config.scene.horizonY}px;
			background: linear-gradient(
				to bottom,
				#16314b 0%,
				#10253f 28%,
				#0b1930 100%
			);
			opacity: 0;
		`);

		/* Water reflection */
		this.layers.reflection = this.createLayer('reflection', `
			top: ${this.config.scene.horizonY}px;
			height: 120px;
			background: linear-gradient(
				to bottom,
				rgba(255,226,110,0.4) 0%,
				rgba(255,226,110,0) 100%
			);
			opacity: 0;
		`);

		/* Add to game - need to convert to PIXI or add to DOM */
		this.addToGame();

		this.start();
		console.log("SkyRenderer initialized!");
	}

	createLayer(name, css) {
		const layer = document.createElement('div');
		layer.className = `sky-layer sky-${name}`;
		layer.style.cssText = `
			position: absolute;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			${css}
		`;
		this.container.appendChild(layer);
		return layer;
	}

	buildStars() {
		const horizonY = this.config.scene.horizonY;
		const width = this.config.resolution.width;

		for (let i = 0; i < this.config.stars.amount; i++) {
			const star = document.createElement('div');
			const size = Math.random() > 0.85 ? 3 : 2;
			star.style.cssText = `
				position: absolute;
				left: ${Math.floor(Math.random() * width)}px;
				top: ${Math.floor(Math.random() * (horizonY - 30) + 8)}px;
				width: ${size}px;
				height: ${size}px;
				background: white;
				border-radius: 50%;
				animation: twinkle ${1 + Math.random() * 2}s ease-in-out infinite;
				animation-delay: ${Math.random() * 2}s;
			`;
			this.layers.stars.appendChild(star);
			this.stars.push(star);
		}

		/* Add twinkle animation */
		if (!document.getElementById('sky-renderer-styles')) {
			const style = document.createElement('style');
			style.id = 'sky-renderer-styles';
			style.textContent = `
				@keyframes twinkle {
					0%, 100% { opacity: 0.3; }
					50% { opacity: 1; }
				}
			`;
			document.head.appendChild(style);
		}
	}

	addToGame() {
		/* Option 1: Add as DOM element over the canvas */
		const gameCanvas = this.game.app.view;
		const parent = gameCanvas.parentElement;
		parent.style.position = 'relative';
		this.container.style.zIndex = '-1'; /* Behind game canvas if canvas has transparency */
		parent.insertBefore(this.container, gameCanvas);

		/* Option 2: If you need it IN the PIXI scene, render to canvas */
		// This would require html2canvas or similar, losing the performance benefit
	}

	destroy() {
		this.stop();
		if (this.container && this.container.parentElement) {
			this.container.parentElement.removeChild(this.container);
		}
		this.container = null;
		this.layers = {};
		this.stars = [];
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.animationId = requestAnimationFrame(ts => this.update(ts));
	}

	stop() {
		this.running = false;
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}

	getGameTimeNormalized() {
		const hour = this.game.time.hour || 0;
		const minute = this.game.time.minute || 0;
		const second = this.game.time.second || 0;
		return (hour + minute / 60 + second / 3600) / 24;
	}

	getArcPosition(progress) {
		const horizonY = this.config.scene.horizonY;
		const width = this.config.resolution.width;
		const angle = Math.PI * progress;
		
		return {
			x: width / 2 + Math.cos(angle) * (width * 0.42),
			y: horizonY + 18 - Math.sin(angle) * 150
		};
	}

	update(ts) {
		if (!this.running) return;

		const t = this.getGameTimeNormalized();

		/* Night factor (0 = day, 1 = night) */
		const nightFactor = t < 0.25 
			? 1 - t / 0.25
			: t > 0.75 
				? (t - 0.75) / 0.25
				: 0;

		/* Update sky/ocean darkness */
		this.layers.night.style.opacity = nightFactor;
		this.layers.oceanNight.style.opacity = nightFactor;
		this.layers.stars.style.opacity = Math.max(0, nightFactor - 0.3);

		/* Sun position & visibility */
		if (t >= 0.20 && t <= 0.80) {
			const sunProgress = (t - 0.20) / 0.60;
			const sunPos = this.getArcPosition(sunProgress);
			this.layers.sun.style.transform = `translate(${sunPos.x - 16}px, ${sunPos.y - 16}px)`;
			this.layers.sun.style.opacity = sunPos.y < this.config.scene.horizonY ? 1 : 0;
			
			/* Reflection follows sun */
			this.layers.reflection.style.opacity = sunPos.y < this.config.scene.horizonY + 50 ? 0.5 : 0;
			this.layers.reflection.style.left = `${sunPos.x - 100}px`;
			this.layers.reflection.style.width = '200px';
		} else {
			this.layers.sun.style.opacity = 0;
			this.layers.reflection.style.opacity = 0;
		}

		/* Moon position & visibility */
		if (t <= 0.30 || t >= 0.70) {
			const moonT = t <= 0.30 ? t + 0.30 : t - 0.70;
			const moonProgress = moonT / 0.60;
			const moonPos = this.getArcPosition(moonProgress);
			this.layers.moon.style.transform = `translate(${moonPos.x - 14}px, ${moonPos.y - 14}px)`;
			this.layers.moon.style.opacity = moonPos.y < this.config.scene.horizonY ? 0.9 : 0;
		} else {
			this.layers.moon.style.opacity = 0;
		}

		this.animationId = requestAnimationFrame(ts => this.update(ts));
	}
}