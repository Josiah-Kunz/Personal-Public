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
    
    // Add depth info
    if (container.depth !== undefined) info += ` depth:${container.depth}`;
    
    // For sprites, try to find their game object and show its depth too
    for (let objName in game.objects["ids"]) {
        let gameObject = game.objects["ids"][objName];
        if (gameObject && gameObject.sprite === container) {
            info += ` 🎮 "${objName}"`;
            if (gameObject.skin) info += ` skin:"${gameObject.skin}"`;
            if (gameObject.depth !== undefined && gameObject.depth !== container.depth) {
                info += ` gameObj.depth:${gameObject.depth}`;
            }
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