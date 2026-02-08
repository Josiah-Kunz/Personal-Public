/*
Makes the townmap widget static (like a TV).

Author: J. Kunz
Consulting AI: Claude
*/

game => {
	if (!game.townmap.crtOverlay) {
		
		/* SETTINGS */
		/* ======== */
		
		/* Color of the background */
		const bgColor = 0x4e7673;
		
		/* CRT filter settings */
		const crtFilter = new PIXI.filters.CRTFilter({
			curvature: 1.0,          /* How curved the screen edges are (0 = flat, higher = more curved like old TVs) */
			lineWidth: 3.0,          /* Thickness of the scanlines in pixels */
			lineContrast: 0.3,       /* How dark/visible the scanlines are (0 = invisible, 1 = very dark) */
			verticalLine: false,     /* false = horizontal scanlines, true = vertical lines */
			noise: 0.3,              /* Amount of static/grain (0 = none, 1 = maximum static) */
			noiseSize: 1.0,          /* Size of individual noise pixels (lower = finer grain, higher = chunkier) */
			seed: Math.random(),     /* Random seed for noise pattern (change this to animate the static) */
			vignetting: 0.1,         /* How much the edges darken (0 = no darkening, 1 = very dark edges) */
			vignettingAlpha: 0.9,    /* Opacity of the vignette effect (0 = invisible, 1 = fully opaque) */
			vignettingBlur: 0.3,     /* How soft/blurred the vignette edge is (0 = sharp, 1 = very blurred) */
			time: 0                  /* Starting phase (doesn't affect speed) */
		});

		/* Animation settings */
		const animSpeed = 0.1;       /* How much to increment time each frame (higher = faster scanline movement) */
		const frameDelay = 16;       /* Milliseconds between updates (16 ≈ 60fps, 33 ≈ 30fps, 100 ≈ 10fps) */
		
		/* The rest of the code */
		/* ==================== */
		
		/* Create a separate PIXI app for the overlay */
		const overlayCanvas = document.createElement('canvas');
		overlayCanvas.width = game.townmap.width;
		overlayCanvas.height = game.townmap.height;
		overlayCanvas.style.position = 'absolute';
		overlayCanvas.style.left = '0';
		overlayCanvas.style.top = '0';
		overlayCanvas.style.zIndex = '1000'; /* Ensure it's on top */
		
		/* Add to the townmap body */
		game.townmap.body.style.position = 'relative'; /* Ensure positioning context */
		game.townmap.body.appendChild(overlayCanvas);
		
		/* Create PIXI app on the overlay */
		const pixiApp = new PIXI.Application({
			view: overlayCanvas,
			width: overlayCanvas.width,
			height: overlayCanvas.height,
			transparent: true,
			backgroundAlpha: 0
		});
		
		/* Create sprite for filter */
		const filterSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
		filterSprite.width = overlayCanvas.width;
		filterSprite.height = overlayCanvas.height;
		filterSprite.alpha = 1.0;
		filterSprite.tint = bgColor;
		
		filterSprite.filters = [crtFilter];
		pixiApp.stage.addChild(filterSprite);

		/* Animate the CRT effect */
		const animateStatic = () => {
			if (game.player.map !== game.townmap.staticMap) {
				pixiApp.destroy(true);
				overlayCanvas.remove();
				game.townmap.crtOverlay = null;
				game.townmap.staticMap = null;
				return;
			}
			
			crtFilter.seed = Math.random();
			crtFilter.time += animSpeed;
			
			setTimeout(animateStatic, frameDelay);
		};
		
		game.townmap.staticMap = game.player.map;
		game.townmap.crtOverlay = { app: pixiApp, canvas: overlayCanvas };
		animateStatic();
	}
}