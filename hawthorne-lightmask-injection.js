// ============================================================================
// Custom lighting overlay and cutout script.
//
// Usage: 
//	- Define a sprite in jCoad like normal 
//		= If the sprite's filename contains one of the key strings in 
//			targetPatterns, it will overlay the game and have cutouts.
//			-- Example: overlay_1_woods.png
//		= If the sprite's filename contains a cutout key string, it will do
//			the cutting. Its color will be invisible, but the cut is 
//			proportional to the sprite's alpha.
//			-- Example: lm_circle_large.png
//		= If the sprite's filename contains a forePattern key string, it will 
//			render above the overlay and not get cut.
//			-- Example: fore+_town_banner.png
//
// Inside the JS Raw (inside Mapbuilder's Settings):
/*

game => {

  const scriptUrl = "https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/1bf1556c583eadbf31c4a8ffb299fd5216c455a5/excello-lighting-injection.js";
  const scriptName = scriptUrl.split('/').pop().split('.')[0];
  
  fetch(scriptUrl)
    .then(response => response.text())
    .then(scriptText => {
      eval(scriptText);
    }) 
    .catch(error => console.error(`Failed to load ${scriptName}:`, error));

}

*/
// 
// Author: J. Kunz
// Direction: Gav
// AI consultant: Claude
// ============================================================================

// ============================================================================
// Settings - Layers
// ============================================================================

// The things we're cutting out of (targets - bottom layer)
let targetPatterns=["overlay_", "vignette"];

// The things doing the cutting (middle layer)
let cutoutPatterns=["lm_", "-cutout"];

// These are above the cutouts, so they neither get cut nor get overlaid (fore layer)
let forePatterns=["fore+_", "banner_"];

// The layer to store the container in. 
// This layer should already be defined within the game.
let gameLayer = "overlay";

// ============================================================================
// Function Delcarations
// ============================================================================
 
// Gets all sprites whose filenames match the given array of patterns
function findSpritesWithPattern(patterns) {
	let matches = [];
	for(let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (!gameObject || !gameObject.skin) continue;
		for(let pattern of patterns){
			if (gameObject.skin.includes(pattern)){
				matches.push(gameObject.sprite);
				break;
			}
		}
	}
	return matches;
}


// Add the sprite to the targets (having the lowest priority)
function addTarget(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		game.excelloContainer.addChild(sprite);
	}
}

// Add the sprite to the cutouts (having a blend mode of DST_OUT; has priority 
// over targets)
function addCutout(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.DST_OUT;
		game.excelloContainer.addChild(sprite);
	}
}

// Add the sprite to the foreground (fore+; has priority over cutouts)
function addFore(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		game.excelloContainer.addChild(sprite);
	}
}

// Gets the given sprite's gameObject
function findGameObjectForSprite(sprite) {
    for (let objName in game.objects["ids"]) {
        let gameObject = game.objects["ids"][objName];
        if (gameObject && gameObject.sprite === sprite) {
            return gameObject;
        }
    }
    return null;
}

// Determines if the given sprite's skin matches any pattern in the given 
// pattern pool. If so, return its priority. For example:
//		pool = ["A", "B"]
//	spriteA would have priority 1 and spriteB would have priority 2. 
//  spriteA2 would also have priority 1, and so its order in the container with
//	respect to spriteA would not be guaranteed.
function getPriorityFromPool(gameObject, patternPool, startingPriority) {
    if (!gameObject || !gameObject.skin) return -1;
	let priority = startingPriority;
    const skin = gameObject.skin.toLowerCase();
    
	for (let i = 0; i < patternPool.length; i++){
		if (skin.includes(patternPool[i])){
			return priority;
		}
		priority++;
	}
    
    return -1;
}

// Gets the given sprite's priority based on its pool (target, cutout, etc.)
function getPriority(gameObject){
	
	// Initialize
	let priority = 1;
	let allPools = [targetPatterns, cutoutPatterns, forePatterns];
	
	for (let i = 0; i < allPools.length; i++){
		let pool = allPools[i];
		let result = getPriorityFromPool(gameObject, pool, priority);
		
		// Failed search; try next pool
		if (result < 0){
			priority += pool.length;
		} else {
			// Success!
			return result;
		}
	}
	
	// Total failure
	return -1;
}

// Main function that applies the blend properties to sprites
function applyBlend(){
	
	// Add sprites to the container based on pattern
	let targetSprites = findSpritesWithPattern(targetPatterns);
	let cutoutSprites = findSpritesWithPattern(cutoutPatterns);
	let foreSprites = findSpritesWithPattern(forePatterns);
	
	// Guard nothing to blend
    if (targetSprites.length === 0 && cutoutSprites.length === 0) return;
    
    // Collect all sprites with their priorities
    let allSprites = [];
    
    targetSprites.forEach(sprite => {
        let gameObj = findGameObjectForSprite(sprite);
        allSprites.push({sprite, priority: getPriority(gameObj), type: 'target'});
    });
    
    cutoutSprites.forEach(sprite => {
        let gameObj = findGameObjectForSprite(sprite);
        allSprites.push({sprite, priority: getPriority(gameObj), type: 'cutout'});
    });
    
    foreSprites.forEach(sprite => {
        let gameObj = findGameObjectForSprite(sprite);
        allSprites.push({sprite, priority: getPriority(gameObj), type: 'fore'});
    });
    
    // Sort by priority
    allSprites.sort((a, b) => a.priority - b.priority);
    
    // Clear container and add sprites in order
    game.excelloContainer.removeChildren();
    
    allSprites.forEach(item => {
        if (item.type === 'target') {
            addTarget(item.sprite);
        } else if (item.type === 'cutout') {
            addCutout(item.sprite);
        } else if (item.type === 'fore') {
            addFore(item.sprite);
        }
    });
}

// ============================================================================
// Main Execution
// ============================================================================

// Create the container if it doesn't exist yet
if (!game.excelloContainer || game.excelloContainer.destroyed) {
	game.excelloContainer = new PIXI.Container();
	game.excelloContainer.filters = [new PIXI.Filter()];
}

// Set the container in the correct layer (defined as "gameLayer" in the settings)
const parentContainer = game.stage.children.find(child => child.name === gameLayer);
if (parentContainer && game.excelloContainer.parent !== parentContainer) {
    parentContainer.addChild(game.excelloContainer);
}

// Ensure they're all blended correctly
applyBlend();

// Hook into refresh (e.g., when mapvars update or the player takes a step)
// Otherwise, the sprites automatically re-parent based on their depth
// We don't want that since they should only be blending with each other
if (!game._renderHooked) {
    game._renderHooked = true;
    const originalRender = game.renderer.render;
    game.renderer.render = function(...args) {
        const result = originalRender.apply(this, args);
		targetSprites = findSpritesWithPattern(targetPatterns);
        cutoutSprites = findSpritesWithPattern(cutoutPatterns);
        foreSprites = findSpritesWithPattern(forePatterns);
        applyBlend();
        return result;
    };
}