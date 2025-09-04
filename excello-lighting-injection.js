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















function wrapRemoveFromMap() {
    for (let objName in game.objects["ids"]) {
        let gameObject = game.objects["ids"][objName];
        if (gameObject && gameObject.removeFromMap && !gameObject._removeFromMapWrapped) {
            gameObject._removeFromMapWrapped = true;
            const originalRemoveFromMap = gameObject.removeFromMap;
            
            gameObject.removeFromMap = function() {
                const result = originalRemoveFromMap.call(this);
                
                setTimeout(() => {
                    if (this.sprite && this.skin) {
                        let shouldBeInContainer = false;
                        
                        for (let pattern of [...targetPatterns, ...cutoutPatterns]) {
                            if (this.skin.includes(pattern)) {
                                shouldBeInContainer = true;
                                break;
                            }
                        }
                        
                        if (shouldBeInContainer && game.excelloContainer) {
                            applyBlend();
                        }
                    }
                }, 0);
                
                return result;
            };
        }
    }
}

applyBlend();
wrapRemoveFromMap();

setInterval(wrapRemoveFromMap, 5000);