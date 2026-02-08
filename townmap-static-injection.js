/*
Makes the townmap widget static (like a TV).

Author: J. Kunz
Consulting AI: Claude
*/

game => {
	if (!game.townmap.crtcontainer) {
		
		/* Create CRT filter */
		game.townmap.crtFilter = new PIXI.filters.CRTFilter({
			curvature: 1.0,
			lineWidth: 3.0,
			lineContrast: 0.3,
			verticalLine: true,
			noise: 0.3,
			noiseSize: 1.0,
			seed: Math.random(),
			vignetting: 0.3,
			vignettingAlpha: 0.9,
			vignettingBlur: 0.3,
			time: 0
		});
		
		game.townmap.crtcontainer = new PIXI.Container();
		game.townmap.crtcontainer.filters = [game.townmap.crtFilter];
		game.stage.addChild(game.townmap.crtcontainer);
		
		game.townmap.filterSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
		game.townmap.filterSprite.width = game.townmap.width;
		game.townmap.filterSprite.height = game.townmap.height;
		game.townmap.crtcontainer.addChild(game.townmap.filterSprite);
		
		
		/* Animate the CRT effect */
		const animateStatic = () => {
			if (game.player.map !== game.townmap.staticMap) {
				game.townmap.crtcontainer.destroy({ children: true });
				game.townmap.crtcontainer = null;
				return;
			}
			
			game.townmap.crtFilter.seed = Math.random();
			game.townmap.crtFilter.time += 0.01;
			
			requestAnimationFrame(animateStatic);
		};
		
		game.townmap.staticMap = game.player.map;
		animateStatic();
	}
}