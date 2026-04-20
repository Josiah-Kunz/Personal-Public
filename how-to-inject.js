game => {


let scriptUrls = [
"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/642baac1cd7da7f942ad54742241231eb35f4e0c/sky-renderer.js",
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