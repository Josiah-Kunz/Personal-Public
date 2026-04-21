const skyURLs = [
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/refs/heads/main/SkyRenderer/utils.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/115d25036366ec39cc36259510c6292a3f9f4d53/SkyRenderer/CloudRenderer.js",
	/*
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/115d25036366ec39cc36259510c6292a3f9f4d53/SkyRenderer/StarRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/115d25036366ec39cc36259510c6292a3f9f4d53/SkyRenderer/CelestialRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/115d25036366ec39cc36259510c6292a3f9f4d53/SkyRenderer/SkyGradient.js",
	*/
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/115d25036366ec39cc36259510c6292a3f9f4d53/SkyRenderer/OceanRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/00e6cf3747a0dc3b8330b50886e1e3d2492c241e/SkyRenderer/SkyRenderer.js",
];
 
if (game.skyRenderer?.map !== game.map) {
	
	if (game.skyRenderer) game.skyRenderer.destroy();
	
	if (game.map.id != game.map.__skyCachedId) {
		game.map.__skyScripts = "";
		game.map.__skyCachedId = game.map.id;
		game.map.__skyLoading = true;

		Promise.all(skyURLs.map(url => 
			fetch(url)
				.then(response => response.text())
				.catch(e => {
					console.error(`Failed to load ${url.split('/').pop()}:`, e);
					return "";
				})
		)).then(scripts => {
			game.map.__skyScripts = scripts.join('\n');
			game.map.__skyLoading = false;
			eval(game.map.__skyScripts);
			
			// NOW create the renderer, after scripts are loaded
			game.skyRenderer = new SkyRenderer(game, {
				offset: { x: 864, y: 0 },
				resolution: { width: 1120, height: 1072 }
			});
		});
		
	} else if (game.map.__skyScripts && !game.map.__skyLoading) {
		// Scripts already cached, can create immediately
		eval(game.map.__skyScripts);
		game.skyRenderer = new SkyRenderer(game, {
			offset: { x: 864, y: 0 },
			resolution: { width: 1120, height: 1072 }
		});
	}
}