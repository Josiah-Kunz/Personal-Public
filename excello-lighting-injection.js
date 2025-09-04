if (!window.__excelloInjected) {
    let targetPatterns = ["vignette", "overlay_"];
    let cutoutPatterns = ["lm_", "-cutout"];
     
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
        console.log("Created new container");
    }
    game.excelloContainer.removeChildren();
    
    function applyBlend(){
        let targetSprites = findSpritesWithPattern(targetPatterns);
        let cutoutSprites = findSpritesWithPattern(cutoutPatterns);
        
        console.log("Found target sprites:", targetSprites.length);
        console.log("Found cutout sprites:", cutoutSprites.length);
        
        if (targetSprites.length == 0) return;
        if (cutoutSprites.length == 0) return;
        
        for (let i = 0; i < targetSprites.length; i++){
            let targetSprite = targetSprites[i];
            console.log("Adding target sprite:", i, targetSprite);
            targetSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
            game.excelloContainer.addChild(targetSprite);
        }
        
        for (let i = 0; i < cutoutSprites.length; i++){
            let cutout = cutoutSprites[i];
            console.log("Adding cutout sprite:", i, cutout);
            cutout.blendMode = PIXI.BLEND_MODES.DST_OUT;
            game.excelloContainer.addChild(cutout);
        }
        
        console.log("Container children after adding:", game.excelloContainer.children.length);
        
        const originalParent = targetSprites[0].parent;
        if (originalParent && !game.excelloContainer.parent) {
            originalParent.addChild(game.excelloContainer);
            console.log("Added container to parent");
        }
    }
    
    const cooldownMs = 5000;
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