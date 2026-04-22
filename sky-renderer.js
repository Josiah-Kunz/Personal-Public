const skyURLs = [
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/refs/heads/main/SkyRenderer/utils.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/8a897d541bc0dcdc58dd3207c5916f2f380bb972/SkyRenderer/CloudRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/07ff4baf9f4a57674e8a61fba33e7c606c2b3ba1/SkyRenderer/SkyGradient.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/094d100ff277a26992787584b8468ce31b8a270b/SkyRenderer/CelestialRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/b1b17c5b59cd8b17544f0c6a46650760b37c8c86/SkyRenderer/StarRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/8b5677f606fd8a45f3b17a4d75b472eb8ead7e5e/SkyRenderer/OceanRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/e6f853d6ee1e71e6985769716717043e1dd0f119/SkyRenderer/PanController.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/8196182d8de751154607aac1070e3362fd22e689/SkyRenderer/SkyRenderer.js",
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