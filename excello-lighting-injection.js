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
}

const parentContainer = game.stage.children.find(child => child.name === "overlay");
if (parentContainer && game.excelloContainer.parent !== parentContainer) {
    parentContainer.addChild(game.excelloContainer);
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
	for (let i = 0; i < targetSprites.length; i++){
		addTarget(i);
	}
	for (let i = 0; i < cutoutSprites.length; i++){
		addCutout(i);
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













function detailedHierarchy(container, prefix = '', isLast = true) {
    const connector = isLast ? '└── ' : '├── ';
    const name = container.constructor.name;
    
    // Add useful identifying info
    let info = '';
    if (container.name) info += ` "${container.name}"`;
    if (container.label) info += ` label:"${container.label}"`;
    if (container.id) info += ` id:${container.id}`;
    if (container === game.excelloContainer) info += ' ⭐ YOUR CONTAINER';
    if (container.texture && container.texture.baseTexture && container.texture.baseTexture.resource && container.texture.baseTexture.resource.url) {
        const url = container.texture.baseTexture.resource.url;
        const filename = url.split('/').pop();
        info += ` img:"${filename}"`;
    }
    if (container.blendMode && container.blendMode !== 0) info += ` blend:${container.blendMode}`;
    if (container.children && container.children.length > 0) info += ` (${container.children.length})`;
    if (container.x !== 0 || container.y !== 0) info += ` pos:(${container.x.toFixed(0)},${container.y.toFixed(0)})`;
    
    // For sprites, try to find their game object
    for (let objName in game.objects["ids"]) {
        let gameObject = game.objects["ids"][objName];
        if (gameObject && gameObject.sprite === container) {
            info += ` 🎮 "${objName}"`;
            if (gameObject.skin) info += ` skin:"${gameObject.skin}"`;
            break;
        }
    }
    
    console.log(prefix + connector + name + info);
    
    if (container.children) {
        container.children.forEach((child, index) => {
            const isLastChild = index === container.children.length - 1;
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            detailedHierarchy(child, newPrefix, isLastChild);
        });
    }
}

detailedHierarchy(game.stage);