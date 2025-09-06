game => {
	const mapUID = "080uofxj";
	
	const species = "00ygwxnf";
	const evolution = "00uli2u6";
	const evoItem = "06djykj8";
	
	const evo_location_xmin = 736;
	const evo_location_xmax = 99999;
	
	const evo_location_ymin = 0;
	const evo_location_ymax = 272;
	
	if (!game.__cachedLevels){
		game.__cachedLevels = {};
		game.__pauseEvolution = false;
	}

	if (
		game.map.id == mapUID &&
		evo_location_xmin <= game.player.x && game.player.x <= evo_location_xmax &&
		evo_location_ymin <= game.player.y && game.player.y <= evo_location_ymax){

		for(let mon of game.player.party.mons){
			if (game.__pauseEvolution) continue;
		
			if (!mon) continue;
		
			if (mon.data.uid != species) continue;
			
			if (!game.__cachedLevels[mon.uid]){
				game.__cachedLevels[mon.uid] = mon.level;
			}
			
			if (mon.level != game.__cachedLevels[mon.uid]){
				game.__cachedLevels[mon.uid] = mon.level;
				
				game.player.bag.lastUsed = evoItem;
				mon.attemptEvolution(["item"], true, false, () => {
					game.state.set("overworld");
					game.battling = false;
					game.setZoom(game.settings.zoom);
					game.__pauseEvolution = false;
				});
				game.__pauseEvolution = true;
				break;
			}
		}
	}
}