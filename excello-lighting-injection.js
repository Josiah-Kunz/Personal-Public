if (!window.__excelloInjected) {

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

	if (!window.__excelloContainer || window.__excelloContainer.destroyed) {
		window.__excelloContainer = new PIXI.Container();
		window.__excelloContainer.filters = [new PIXI.Filter()];
	}
	window.__excelloContainer.removeChildren();

	function addTarget(index){
		let targetSprite = targetSprites[index];
		targetSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		window.__excelloContainer.addChild(targetSprite);
	}

	function addCutout(index){
		let cutout = cutoutSprites[index];
		cutout.blendMode = PIXI.BLEND_MODES.DST_OUT;
		window.__excelloContainer.addChild(cutout);
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
			originalParent.addChild(window.__excelloContainer);
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