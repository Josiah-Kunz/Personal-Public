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
	const scripts = [
		"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/becac3cea737fc5823310d63e4740bd8f0e40123/custom-boulder.js"
	];
	
	scripts.forEach(url => 
		fetch(url)
		.then(r => r.text())
		.then(eval)
		.catch(e => console.error(`Failed to load ${url.split('/').pop()}:`, e))
	);
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
	for(let boulder of boulders){
		
		let xDiff = game.player.x - boulder.nextX;
		let yDiff = game.player.y - boulder.nextY;
		boulder.__pushed = 0;
		
		if (yDiff == 0 && -16 <= xDiff && xDiff <= 0){
			if (!game.map.checkNextTile(boulder.nextX+16, boulder.nextY, boulder)){
				boulder.setPath("1r");
				boulder.__pushed = 6;
			}
		}
		
		if (yDiff == 0 && 0 <= xDiff && xDiff <= 16){
			if (!game.map.checkNextTile(boulder.nextX-16, boulder.nextY, boulder)){
				boulder.setPath("1l");
				boulder.__pushed = 4;
			}
		}
		
		if (xDiff == 0 && -16 <= yDiff && yDiff <= 0){
			if (!game.map.checkNextTile(boulder.nextX, boulder.nextY+16, boulder)){
				boulder.setPath("1d");
				boulder.__pushed = 2;
			}
		}
		
		if (xDiff == 0 && 0 <= yDiff && yDiff <= 16){
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

game.player.__canPush = true;
game.player.__cachedX = game.player.x;
game.player.__cachedY = game.player.y;
function checkPlayerMovedLoop(){
	
	for(let boulder of boulders){
		if (!boulder) continue;
		if (boulder.tmp[5] != null){
			requestAnimationFrame(checkPlayerMovedLoop);
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
	
	requestAnimationFrame(checkPlayerMovedLoop);
}

function checkBouldersMovedLoop(){
	
	game.player.__canPush = true;
	for(let boulder of boulders){
		if (!boulder) continue;
		let moved = boulder.x != boulder.nextX || boulder.y != boulder.nextY;
		if (!boulder.__moving && moved){
			game.trigger(`mapvar[boulder_${boulder.uid}_moved]=${boulder.__pushed}`);
			console.log(`Boulder ${boulder.uid} started moving`);
			game.player.__canPush = false;
			game.player.canMove = false;
			boulder.__moving = true;
		} else if (boulder.__moving && !moved) {
			game.trigger(`mapvar[boulder_${boulder.uid}_moved]=${0}`);
			console.log(`Boulder ${boulder.uid} stopped moving`);
			game.player.canMove = true;
			boulder.__moving = false;
		}
	}
	
	requestAnimationFrame(checkBouldersMovedLoop);
}

if (game && game.objects && game.objects.length > 0 && !game.__requestedBoulderLoops){
	
	// Flag
	game.__requestedBoulderLoops = true;
	
	// Set up boulders
	let boulders = findObjectsWithPattern(boulderPatterns);
	for (let boulder of boulders){
		boulder.solid = true;
		boulder.__cachedX = boulder.x;
		boulder.__cachedY = boulder.y;
	}
	
	// Start looping young man!
	requestAnimationFrame(checkBouldersMovedLoop);
	requestAnimationFrame(checkPlayerMovedLoop);
}