let targetPatterns=["vignette", "overlay_"];
let cutoutPatterns=["lm_", "-cutout"];
 
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
let targetSprites = findSpritesWithPattern(targetPatterns);
let cutoutSprites = findSpritesWithPattern(cutoutPatterns);
if (!game.excelloContainer || game.excelloContainer.destroyed) {
	game.excelloContainer = new PIXI.Container();
	game.excelloContainer.filters = [new PIXI.Filter()];
	if (targetSprites.length > 0) {
        game.excelloOriginalParent = targetSprites[0].parent;
    }
}

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
function applyBlend(){
	if (targetSprites.length==0) return;
	if (cutoutSprites.length==0) return;
	const originalParent = targetSprites[0].parent;
	for (let i = 0; i < targetSprites.length; i++){
		addTarget(i);
	}
	for (let i = 0; i < cutoutSprites.length; i++){
		addCutout(i);
	}
	if (game.excelloOriginalParent && game.excelloContainer.parent !== game.excelloOriginalParent) {
        game.excelloOriginalParent.addChild(game.excelloContainer);
    }
}

applyBlend();

function hookRemoveFromMapForSprites(sprites) {
    for (let sprite of sprites) {
        for (let objName in game.objects["ids"]) {
            let gameObject = game.objects["ids"][objName];
            if (gameObject && gameObject.sprite === sprite && !gameObject._removeFromMapHooked) {
                gameObject._removeFromMapHooked = true;
                gameObject._originalRemoveFromMap = gameObject.removeFromMap;
                gameObject.removeFromMap = function() {
                    const ogParent = this.sprite.parent;
                    const result = gameObject._originalRemoveFromMap.apply(this);
                    console.log(`${gameObject.skin} | ${gameObject.uid}`);
                    if (ogParent === game.excelloContainer) {
                        this.sprite.parent = ogParent;
                    }
                    applyBlend();
                    return result;
                };
                break;
            }
        }
    }
}

hookRemoveFromMapForSprites([...targetSprites, ...cutoutSprites]);