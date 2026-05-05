const skyURLs = [
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/refs/heads/main/SkyRenderer/utils.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/7abd666b03a084af8a32e69d4824e78925f94aa2/SkyRenderer/CloudRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/07ff4baf9f4a57674e8a61fba33e7c606c2b3ba1/SkyRenderer/SkyGradient.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/094d100ff277a26992787584b8468ce31b8a270b/SkyRenderer/CelestialRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/b1b17c5b59cd8b17544f0c6a46650760b37c8c86/SkyRenderer/StarRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/c7e594e3f77aee64b456b76166fcec2592c6284f/SkyRenderer/OceanRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/a2dbc3887dda2f7a42d7318dbf7924d61511f003/SkyRenderer/PanController.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/ae2a0e63cbae9579a932be39f3de41e4848b727c/SkyRenderer/SkyRenderer.js",
];
 
if (game.map && game.skyRenderer?.mapID !== game.map.id) {
	
	if (game.skyRenderer) game.skyRenderer.destroy();
	
	/* Check if we've loaded the scripts once */
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
			
			// Create the renderer, after scripts are loaded
			game.skyRenderer = new SkyRenderer(game, {
				offset: { x: 1008, y: 0 },
				resolution: { width: 1488, height: 1072 }
			});
		});
		
	} else if (game.map.__skyScripts && !game.map.__skyLoading) {
		/* Scripts already cached, can create immediately */
		eval(game.map.__skyScripts);
		game.skyRenderer = new SkyRenderer(game, {
			offset: { x: 1008, y: 0 },
			resolution: { width: 1488, height: 1072 }
		});
	}
}