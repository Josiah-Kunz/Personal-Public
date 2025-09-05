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
//		= If the sprite's filename contains a plusPattern key string, it will 
//			render above the overlay and not get cut.
//			-- Example: lm+_town_banner.png
// 
// Author: J. Kunz
// Direction: Gav
// AI consultant: Claude
// ============================================================================

// Settings
// =========

// The things we're cutting out of
let targetPatterns=["overlay_", "vignette"];

// The things doing the cutting
let cutoutPatterns=["lm_", "-cutout"];

// These are above the cutouts, so they neither get cut nor get overlaid
let plusPatterns=["lm+_", "banner_"];
 
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


if (!game.excelloContainer || game.excelloContainer.destroyed) {
	game.excelloContainer = new PIXI.Container();
	game.excelloContainer.filters = [new PIXI.Filter()];
}

const parentContainer = game.stage.children.find(child => child.name === "overlay");
if (parentContainer && game.excelloContainer.parent !== parentContainer) {
    parentContainer.addChild(game.excelloContainer);
}

let targetSprites = findSpritesWithPattern(targetPatterns);
let cutoutSprites = findSpritesWithPattern(cutoutPatterns);

function addTarget(index){
	let targetSprite = targetSprites[index];
	if (!game.excelloContainer.children.includes(targetSprite)) {
		targetSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		game.excelloContainer.addChild(targetSprite);
	}
}

function addCutout(index){
	let cutout = cutoutSprites[index];
	if (!game.excelloContainer.children.includes(cutout)) {
		cutout.blendMode = PIXI.BLEND_MODES.DST_OUT;
		game.excelloContainer.addChild(cutout);
	}
}



function sortContainerChildren() {
    if (!game.excelloContainer || game.excelloContainer.children.length === 0) return;
    
    const children = [...game.excelloContainer.children];
    
    // Sort function: lower numbers render first (bottom)
    children.sort((a, b) => {
        const aGameObj = findGameObjectForSprite(a);
        const bGameObj = findGameObjectForSprite(b);
        
        const aCategory = getCategory(aGameObj);
        const bCategory = getCategory(bGameObj);
        
        return aCategory - bCategory;
    });
    
    // Re-add children in sorted order
    game.excelloContainer.removeChildren();
    children.forEach(child => game.excelloContainer.addChild(child));
}

function findGameObjectForSprite(sprite) {
    for (let objName in game.objects["ids"]) {
        let gameObject = game.objects["ids"][objName];
        if (gameObject && gameObject.sprite === sprite) {
            return gameObject;
        }
    }
    return null;
}

function getCategory(gameObject) {
    if (!gameObject || !gameObject.skin) return 999; // Unknown, put at end
    
    const skin = gameObject.skin.toLowerCase();
    
    // Category 1: overlay + vignette (bottom layer)
    if (skin.includes('overlay') && skin.includes('vignette')) {
        return 1;
    }
    
    // Category 2: other targets (overlay OR vignette, but not both)
    if (skin.includes('overlay') || skin.includes('vignette')) {
        return 2;
    }
    
    // Category 3: cutouts (top layer)
    if (skin.includes('lm_') || skin.includes('-cutout')) {
        return 3;
    }
    
    return 999; // Shouldn't happen, but just in case
}


function applyBlend(){
	if (targetSprites.length==0) return;
	if (cutoutSprites.length==0) return;
	for (let i = 0; i < targetSprites.length; i++){
		addTarget(i);
	}
	for (let i = 0; i < cutoutSprites.length; i++){
		addCutout(i);
	}
	sortContainerChildren();
}

applyBlend();

if (!game._renderHooked) {
    game._renderHooked = true;
    const originalRender = game.renderer.render;
    game.renderer.render = function(...args) {
        // Fix container right before rendering
        applyBlend();
        
        const result = originalRender.apply(this, args);
        return result;
    };
}