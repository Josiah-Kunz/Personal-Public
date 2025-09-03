
let targetPatterns=["vignette"];
let cutoutPatterns=["lm_circle", "night_light_excello"];
 
function findSpritesWithPattern(patterns) {
  let matches = [];
  
  for(let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		for(let pattern of patterns){
			if (gameObject.skin.includes(pattern)){
				console.log(gameObject);
				matches.push(gameObject.sprite);
				break;
			}
		}
	}
  return matches;
}

  let targetSprites = findSpritesWithPattern(targetPatterns);
  let cutoutSprites = findSpritesWithPattern(cutoutPatterns);
  
  const container = new PIXI.Container();
  container.filters = [new PIXI.Filter()];
  
  function addTarget(index){
    let targetSprite = targetSprites[index];
    targetSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
    container.addChild(targetSprite);
  }
  
  function addCutout(index){
	let cutout = cutoutSprites[index];
	cutout.blendMode = PIXI.BLEND_MODES.DST_OUT;
	container.addChild(cutout);
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
    
    if (originalParent) {
      originalParent.addChild(container);
    }
    
  }
  
applyBlend();