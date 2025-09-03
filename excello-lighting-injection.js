
let targetPattern="LMT";
let cutoutPattern="LMC";
 
function findSpritesWithPattern(pattern) {
  let matches = [];
  
  for(let objName in game.objects["ids"]) {
		if (objName.includes(pattern)){
			console.log(objName);
			console.log(game.objects["ids"][objName].uid);
			matches.push(game.objects["ids"][objName].sprite);
		}
	}
  return matches;
}

  let targetSprites = findSpritesWithPattern(targetPattern);
  let cutoutSprites = findSpritesWithPattern(cutoutPattern);
  
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