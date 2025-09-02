  let targetNames = ["vignette_medium_overlay"];
  let cutoutNames = ["spotlight_1", "spotlight_2", "spotlight_3", "spotlight_4", "spotlight_5", "spotlight_6", "spotlight_7", "spotlight_8", "pc_light_front", "pc_window_l", "pc_window_r", "pc_window_r_bleed","pc_window_l_bleed", "mart_window", "mart_light_front","mart_window_bleed","house_entrance_1", "house_entrance_2", "house_entrance_3"];
  
  const container = new PIXI.Container();
  container.filters = [new PIXI.Filter()];
  let applied = false;
  
  function addTarget(index){
    let targetSprite = game.objects.get(targetNames[index]).sprite;
    targetSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
    container.addChild(targetSprite);
  }
  
  function addCutout(index){
	let cutout = game.objects.get(cutoutNames[index]).sprite;  
	cutout.blendMode = PIXI.BLEND_MODES.DST_OUT;
	container.addChild(cutout);
  }
  
  function loopTryApplyBlend(){
    if (applied) return;
    
    for (let i = 0; i < targetNames.length; i++) {
      let targetObj = game.objects.get(targetNames[i]);
      
      
      if (!targetObj || !targetObj.sprite) {
        requestAnimationFrame(loopTryApplyBlend);
		console.log(`No object named ${targetNames[i]}`);
        return;
      }
      
      if (!targetObj.sprite._texture.baseTexture.valid) {
		console.log(`Object named ${targetNames[i]} has no valid sprite texture`);
        requestAnimationFrame(loopTryApplyBlend);
        return;
      }
    }
	
	for (let i = 0; i < cutoutNames.length; i++) {
		let cutoutObj = game.objects.get(cutoutNames[i]);
		if (!cutoutObj || !cutoutObj.sprite) {
		console.log(`No object named ${cutoutNames[i]}`);
        requestAnimationFrame(loopTryApplyBlend);
        return;
      }
      
      if (!cutoutObj.sprite._texture.baseTexture.valid) {
		console.log(`Object named ${cutoutNames[i]} has no valid sprite texture`);
        requestAnimationFrame(loopTryApplyBlend);
        return;
      }
	}
    
    const originalParent = game.objects.get(targetNames[0]).sprite.parent;
    
    for (let i = 0; i < targetNames.length; i++){
      addTarget(i);
    }
	
	for (let i = 0; i < cutoutNames.length; i++){
      addCutout(i);
    }
    
    if (originalParent) {
      originalParent.addChild(container);
    }
    
    applied = true;
	console.log(`Added ${targetNames.length} targets and ${cutoutNames.length} cutouts`);
  }
  
  loopTryApplyBlend();