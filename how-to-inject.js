game => {


let scriptUrls = [

	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/233dd5956a70b0a0728735514a292968a2aeee4e/hawthorne-lightmask-injection.js",
	"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/78b50c7d7c445c074a827b5b6600edf15f0ed25f/custom-boulder.js",

];



if (game.map.id != game.map.__cachedid) {
	game.map.__jsScripts = "";
	game.map.__cachedid = game.map.id;
	game.map.__scriptsLoading = true;

	Promise.all(scriptUrls.map(url => 
	  fetch(url)
		.then(response => response.text())
		.catch(e => {
			console.error(`Failed to load ${url.split('/').pop()}:`, e);
			return "";
		})
	)).then(scripts => {
		game.map.__jsScripts = scripts.join('\n');
		game.map.__scriptsLoading = false;
		eval(game.map.__jsScripts);
	});
	} else if (game.map && game.map.__jsScripts && !game.map.__scriptsLoading) {
	eval(game.map.__jsScripts);
}



}