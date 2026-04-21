const skyURLs = [
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/refs/heads/main/SkyRenderer/utils.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/f472725919c9b48b83db96daa21443d3930a32f7/SkyRenderer/CloudRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/07ff4baf9f4a57674e8a61fba33e7c606c2b3ba1/SkyRenderer/SkyGradient.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/bdbbe10deaccee7794602b98c79525a939f3dc65/SkyRenderer/CelestialRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/b1b17c5b59cd8b17544f0c6a46650760b37c8c86/SkyRenderer/StarRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/7fc1fc2aa29ff25b624e4e7348a4409891591c31/SkyRenderer/OceanRenderer.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/8437cebb351e95f4254af21a581917940c9ece01/SkyRenderer/SkyRenderer.js",
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