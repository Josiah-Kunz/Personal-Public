if (!window.__excelloInjected) {
   let targetPatterns = ["vignette", "overlay_"];
   let cutoutPatterns = ["lm_", "-cutout"];
   const cooldownMs = 5000;
   
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
   
   function createContainer() {
       const container = new PIXI.Container();
       container.filters = [new PIXI.Filter()];
       return container;
   }
   
   function applyBlend(){
       let targetSprites = findSpritesWithPattern(targetPatterns);
       let cutoutSprites = findSpritesWithPattern(cutoutPatterns);
       
       if (targetSprites.length == 0) return;
       if (cutoutSprites.length == 0) return;
       
       if (!window.__excelloContainer || window.__excelloContainer.destroyed || !window.__excelloContainer.parent) {
           window.__excelloContainer = createContainer();
       }
       
       window.__excelloContainer.removeChildren();
       
       for (let i = 0; i < targetSprites.length; i++){
           let targetSprite = targetSprites[i];
           targetSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
           window.__excelloContainer.addChild(targetSprite);
       }
       
       for (let i = 0; i < cutoutSprites.length; i++){
           let cutout = cutoutSprites[i];
           cutout.blendMode = PIXI.BLEND_MODES.DST_OUT;
           window.__excelloContainer.addChild(cutout);
       }
       
       const originalParent = targetSprites[0].parent;
       if (originalParent && !window.__excelloContainer.parent) {
           originalParent.addChild(window.__excelloContainer);
       }
   }

   const now = Date.now();
   if (!window.__excelloLastLoaded) window.__excelloLastLoaded = now;
   const deltaTime = now - window.__excelloLastLoaded;
   
   if (deltaTime < cooldownMs){
       console.log(`Loaded script after ${deltaTime} ms.`)
       applyBlend();
   } else {
       console.log(`Tried to reload script after ${deltaTime} ms but the cooldown has expired!`);
       window.__excelloInjected = true;
   }
}