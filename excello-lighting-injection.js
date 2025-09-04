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

function setupExcelloContainer() {
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
       }
   }
   
   function addCutout(index){
       let cutout = cutoutSprites[index];
       if (!game.excelloContainer.children.includes(cutout)) {
           cutout.blendMode = PIXI.BLEND_MODES.SRC_IN;
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
   
   if (!game._cutoutMaintainerHooked) {
       game._cutoutMaintainerHooked = true;
       const originalUpdater = game.updater;
       game.updater = function(...args) {
           const result = originalUpdater.apply(this, args);
           setTimeout(() => {
               if (game.excelloContainer && !game.excelloContainer.destroyed) {
                   targetSprites = findSpritesWithPattern(targetPatterns);
                   cutoutSprites = findSpritesWithPattern(cutoutPatterns);
                   applyBlend();
               }
           }, 0);
           return result;
       };
   }
}

function waitForGame() {
   if (typeof game !== 'undefined' && game.updater && game.objects && game.objects.ids) {
       setupExcelloContainer();
   } else {
       setTimeout(waitForGame, 100);
   }
}

waitForGame();