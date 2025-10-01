/* ============================================================================
Custom boulders!

 - Automatically finds "boulders" based on the boulderPatterns (such as 
	"boulder" and "temple-sphere"). These are the skin (file) name, not uid 
	(variable name).
 - Players can push custom boulders without the need for strength HM flag.
 - When pushed, sets mapvar[boulder_uid_moved] to the direction:
	(2, 4, 6, 8) -> (down, left, right, up)

Example jCoad where the spritesheet is a 4x5 animation sheet.
Setting the direction sets the row.

	// Set up base animation
	%random%=animation(186753/temple-sphere,map,0,0,16,16,5,100,loop)

	// Animate and change the direction
	if !mapvar[boulder_%random%_moved]
	  execute(with=%random%&animate=0&mapvar[boulder_block_sfx]=0)
	else if mapvar[boulder_%random%_moved]=8
	  execute(with=%random%&animate=100&direction=u&freeze-direction)
	else if mapvar[boulder_%random%_moved]=2
	  execute(with=%random%&animate=100&direction=d&freeze-direction)
	else if mapvar[boulder_%random%_moved]=6
	  execute(with=%random%&animate=100&direction=r&freeze-direction)
	else if mapvar[boulder_%random%_moved]=4
	  execute(with=%random%&animate=100&direction=l&freeze-direction)

Usage in the JS injector:

game => {
  if (game.map.id != game.map.__cachedid) {
    game.map.__jsScripts = "";
    game.map.__cachedid = game.map.id;
    game.map.__scriptsLoading = true;
    
    let scriptUrls = [
      "https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/2543ab7da634c4a2c494df998823c2de8c72eeec/custom-boulder.js",
    ];
    
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

Author: J. Kunz
*/

let boulderPatterns = ["boulder", "temple_sphere", "temple-sphere"];

function findObjectsWithPattern(patterns, reference="skin") {
	let matches = [];
	for (let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (!gameObject) continue;

		let candidate = String(reference === "uid" ? gameObject.uid : gameObject.skin);

		for (let pattern of patterns) {
			if (candidate.includes(pattern)) {
				if (reference === "uid" && gameObject.sprite) {
					gameObject.sprite.uid = gameObject.uid;
				}
				if (gameObject.sprite) matches.push(gameObject);
				break;
			}
		}
	}
	return matches;
}

function checkPlayerPush(){
	for(let boulder of game.map.__boulders){
		
		// Guard null
		if (!boulder) continue;
		
		// Guard invisible
		let fadingOut = boulder.fade > 0;
		let invisible = boulder.sprite.alpha <= 0.01;
		console.log(boulder);
		console.log(`Alpha is ${boulder.sprite.alpha}`);
		if (fadingOut || invisible) continue;
		console.log(`Oh, we're continuing with ${boulder.uid}?`);
		
		let xDiff = game.player.x - boulder.nextX;
		let yDiff = game.player.y - boulder.nextY;
		
		let playerDir = game.player.tmp[5][3];
		
		boulder.__pushed = 0;
		
		if (playerDir == 2 && yDiff == 0 && -16 <= xDiff && xDiff <= 0){
			if (!game.map.checkNextTile(boulder.nextX+16, boulder.nextY, boulder)){
				boulder.setPath("1r");
				boulder.__pushed = 6;
			}
		}
		
		if (playerDir == 3 && yDiff == 0 && 0 <= xDiff && xDiff <= 16){
			if (!game.map.checkNextTile(boulder.nextX-16, boulder.nextY, boulder)){
				boulder.setPath("1l");
				boulder.__pushed = 4;
			}
		}
		
		if (playerDir == 0 && xDiff == 0 && -16 <= yDiff && yDiff <= 0){
			if (!game.map.checkNextTile(boulder.nextX, boulder.nextY+16, boulder)){
				boulder.setPath("1d");
				boulder.__pushed = 2;
			}
		}
		
		if (playerDir == 1 && xDiff == 0 && 0 <= yDiff && yDiff <= 16){
			if (!game.map.checkNextTile(boulder.nextX, boulder.nextY-16, boulder)){
				boulder.setPath("1u");
				boulder.__pushed = 8;
			}
		}
		
		
		if (boulder.__pushed > 0){
			game.player.__canPush = false;
			game.player.canMove = false;
		}
	}
}

function checkPlayerMovedLoop(){
	
	// Exit condition
	if (!game || !game.player || !game.map) return;
	
	for(let boulder of game.map.__boulders){
		if (!boulder) continue;
		if (boulder.tmp[5] != null){
			game.__playerMovedFrameID = requestAnimationFrame(checkPlayerMovedLoop);
			return;
		}
	}
	
	let moving = game.player.__cachedX != game.player.x || game.player.__cachedY != game.player.y;
	let attemptingMovement = game.player.tmp[5] != null;
	if (!moving && attemptingMovement && game.player.__canPush){
		checkPlayerPush();
	}
	
	game.player.__cachedX = game.player.x;
	game.player.__cachedY = game.player.y;
	
	game.__playerMovedFrameID = requestAnimationFrame(checkPlayerMovedLoop);
}

function checkBouldersMovedLoop(){
	
	game.player.__canPush = true;
	for(let boulder of game.map.__boulders){
		
		// Guard sillyness
		if (!boulder) continue;
		if (!boulder.uid) continue;
		
		// Guard invisible
		let fadingOut = boulder.fade > 0;
		let invisible = boulder.sprite.alpha <= 0;
		if (fadingOut || invisible) continue;
		
		// Move check
		let moved = boulder.x != boulder.nextX || boulder.y != boulder.nextY;
		
		// Update mapvars as necessary
		if (!boulder.__moving && moved){
			game.trigger(`mapvar[${boulder.uid}_moved]=${boulder.__pushed}`);
			console.log(`Boulder \"${boulder.uid}\" started moving`);
			game.player.__canPush = false;
			game.player.canMove = false;
			boulder.__moving = true;
		} else if (boulder.__moving && !moved) {
			game.trigger(`mapvar[${boulder.uid}_moved]=${0}`);
			console.log(`Boulder \"${boulder.uid}\" stopped moving`);
			game.player.canMove = true;
			boulder.__moving = false;
		}
	}
	
	game.__boulderMovedFrameID = requestAnimationFrame(checkBouldersMovedLoop);
}

// Check change of map
let changedMap = game.map.__boulderMapID != game.map.id;

// Check if boulder count changed (only if we have previous data)
let currentBoulders = findObjectsWithPattern(boulderPatterns);
let changedBoulders = false;
if (game.map.__boulders) {
	changedBoulders = currentBoulders.length !== game.map.__boulders.length;
}

if (game && game.objects && (changedBoulders || changedMap)){
	
	// Flag
	game.map.__boulderMapID = game.map.id;
	
	// Reset array
	game.map.__boulders = [];
	
	// Cancel previous loops
	if (game.__boulderMovedFrameID){
		cancelAnimationFrame(game.__boulderMovedFrameID);
	}
	if (game.__playerMovedFrameID){
		cancelAnimationFrame(game.__playerMovedFrameID);
	}
	
	// Set up boulders
	game.map.__boulders = currentBoulders;
	for (let boulder of game.map.__boulders){
		boulder.solid = true;
		boulder.__cachedX = boulder.x;
		boulder.__cachedY = boulder.y;
	}
	
	// Set up player
	game.player.__canPush = true;
	game.player.__cachedX = game.player.x;
	game.player.__cachedY = game.player.y;
	
	// Start looping young man!
	game.__boulderMovedFrameID = requestAnimationFrame(checkBouldersMovedLoop);
	game.__playerMovedFrameID = requestAnimationFrame(checkPlayerMovedLoop);
}