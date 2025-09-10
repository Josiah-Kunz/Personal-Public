// ============================================================================
// Standalone Chromatic Aberration Effect Script for jCoad
//
// Usage: 
//	- Define a sprite in jCoad like normal 
//		= If the sprite's filename contains one of the key strings in 
//			chromaticPatterns, it will apply chromatic aberration and noise effects.
//			-- Example: chromatic_overlay.png or tv_static_aberration.png
//
// Inside the JS Raw (inside Mapbuilder's Settings):
/*

game => {

  const scriptUrl = "https://raw.githubusercontent.com/your-repo/chromatic-aberration.js";
  const scriptName = scriptUrl.split('/').pop().split('.')[0];
  
  fetch(scriptUrl)
    .then(response => response.text())
    .then(scriptText => {
      eval(scriptText);
    }) 
    .catch(error => console.error(`Failed to load ${scriptName}:`, error));

}

*/
// 
// Author: J. Kunz
// Direction: Gav
// AI consultant: Claude
// ============================================================================

// ============================================================================
// Chromatic Aberration Settings
// ============================================================================

// Sprites that match these patterns will get chromatic aberration effects
let chromaticPatterns = ["chromatic_", "_chromatic", "aberration_", "_aberration", "tv_", "_tv"];

// The layer to store the chromatic container in
let gameLayer = "overlay";

// Chromatic aberration effect settings
let chromaticSettings = {
  rOffset: { x: -1, y: -1 },
  gOffset: { x: 0, y: 0 },
  bOffset: { x: 1, y: 1 },
  noiseAmount: 8,
  fps: 24,
  enabled: true
};

// ============================================================================
// Debug Settings
// ============================================================================

// If true, logs chromatic aberration processing
let debugChromatic = false;

// ============================================================================
// Utility Functions
// ============================================================================

// Gets all sprites whose filenames match the given array of patterns
function findSpritesWithPattern(patterns, reference="skin") {
	let matches = [];
	for(let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (!gameObject || !gameObject.skin) continue;
		for(let pattern of patterns){
			let candidate = gameObject.skin;
			if (reference == "uid") candidate = gameObject.uid;
			if (candidate.includes(pattern)){
				if (reference == "uid") gameObject.sprite.uid = gameObject.uid;
				matches.push(gameObject.sprite);
				break;
			}
		}
	}
	return matches;
}

// Gets the given sprite's gameObject
function findGameObjectForSprite(sprite) {
    for (let objName in game.objects["ids"]) {
        let gameObject = game.objects["ids"][objName];
        if (gameObject && gameObject.sprite === sprite) {
            return gameObject;
        }
    }
    return null;
}

// ============================================================================
// Chromatic Aberration Functions
// ============================================================================

function applyChromaticAberration(sprite) {
    if (!sprite || !sprite.texture || !sprite.texture.baseTexture) return;
    
    if (debugChromatic) {
        console.log("Applying chromatic aberration to sprite:", sprite);
    }
    
    // Get the original texture data
    const baseTexture = sprite.texture.baseTexture;
    if (!baseTexture.resource || !baseTexture.resource.source) return;
    
    const img = baseTexture.resource.source;
    
    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = img.width || baseTexture.width;
    canvas.height = img.height || baseTexture.height;
    
    // Draw the original image
    ctx.drawImage(img, 0, 0);
    
    // Get the image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    
    // Create new image data for the effect
    const newImageData = ctx.createImageData(width, height);
    const newData = newImageData.data;
    
    // Apply chromatic aberration
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            
            // Calculate offset positions for each channel
            const rx = Math.max(0, Math.min(width - 1, x + chromaticSettings.rOffset.x));
            const ry = Math.max(0, Math.min(height - 1, y + chromaticSettings.rOffset.y));
            const ri = (ry * width + rx) * 4;
            
            const gx = Math.max(0, Math.min(width - 1, x + chromaticSettings.gOffset.x));
            const gy = Math.max(0, Math.min(height - 1, y + chromaticSettings.gOffset.y));
            const gi = (gy * width + gx) * 4;
            
            const bx = Math.max(0, Math.min(width - 1, x + chromaticSettings.bOffset.x));
            const by = Math.max(0, Math.min(height - 1, y + chromaticSettings.bOffset.y));
            const bi = (by * width + bx) * 4;
            
            // Apply the offset channels
            newData[i]     = data[ri];     // Red from offset position
            newData[i + 1] = data[gi + 1]; // Green from offset position  
            newData[i + 2] = data[bi + 2]; // Blue from offset position
            newData[i + 3] = data[gi + 3]; // Alpha from green position
        }
    }
    
    // Store the base data for animation
    if (!sprite._chromaticBaseData) {
        sprite._chromaticBaseData = new ImageData(
            new Uint8ClampedArray(newData),
            width,
            height
        );
        sprite._chromaticCanvas = canvas;
        sprite._chromaticCtx = ctx;
        sprite._chromaticAnimationData = ctx.createImageData(width, height);
    }
    
    // Put the initial processed data
    ctx.putImageData(newImageData, 0, 0);
    
    // Create a new texture from the processed canvas
    const newTexture = PIXI.Texture.from(canvas);
    sprite.texture = newTexture;
    
    // Start the noise animation
    startNoiseAnimation(sprite);
}

function startNoiseAnimation(sprite) {
    if (!sprite._chromaticBaseData || sprite._noiseAnimationActive) return;
    
    sprite._noiseAnimationActive = true;
    
    let lastTime = 0;
    const delay = 1000 / chromaticSettings.fps;
    const baseData = sprite._chromaticBaseData.data;
    const animData = sprite._chromaticAnimationData.data;
    const ctx = sprite._chromaticCtx;
    const noiseAmount = chromaticSettings.noiseAmount;
    
    function animateNoise(currentTime) {
        if (!sprite._noiseAnimationActive || !sprite.parent) {
            // Stop animation if sprite is removed or animation disabled
            return;
        }
        
        if (currentTime - lastTime >= delay) {
            // Apply noise to each pixel
            for (let i = 0; i < baseData.length; i += 4) {
                animData[i]     = Math.max(0, Math.min(255, baseData[i]     + (Math.random() * 2 - 1) * noiseAmount));
                animData[i + 1] = Math.max(0, Math.min(255, baseData[i + 1] + (Math.random() * 2 - 1) * noiseAmount));
                animData[i + 2] = Math.max(0, Math.min(255, baseData[i + 2] + (Math.random() * 2 - 1) * noiseAmount));
                animData[i + 3] = baseData[i + 3]; // Keep original alpha
            }
            
            // Update the canvas
            ctx.putImageData(sprite._chromaticAnimationData, 0, 0);
            
            // Update the texture
            sprite.texture.baseTexture.update();
            
            lastTime = currentTime;
        }
        
        requestAnimationFrame(animateNoise);
    }
    
    requestAnimationFrame(animateNoise);
}

// ============================================================================
// Main Execution
// ============================================================================

// Create the chromatic container if it doesn't exist
if (!game.chromaticContainer || game.chromaticContainer.destroyed) {
	game.chromaticContainer = new PIXI.Container();
}

// Set the container in the correct layer
const parentContainer = game.stage.children.find(child => child.name === gameLayer);
if (parentContainer && game.chromaticContainer.parent !== parentContainer) {
    parentContainer.addChild(game.chromaticContainer);
}

// Apply chromatic aberration to matching sprites
function applyChromaticEffects() {
    if (!chromaticSettings.enabled) return;
    
    const chromaticSprites = findSpritesWithPattern(chromaticPatterns);
    
    chromaticSprites.forEach(sprite => {
        // Only apply if not already processed
        if (!sprite._chromaticProcessed) {
            applyChromaticAberration(sprite);
            sprite._chromaticProcessed = true;
            
            // Add to our container for management
            if (!game.chromaticContainer.children.includes(sprite)) {
                game.chromaticContainer.addChild(sprite);
            }
        }
    });
}

// Initial application
applyChromaticEffects();

// Hook into the render loop to catch new sprites
if (!game._chromaticRenderHooked) {
    game._chromaticRenderHooked = true;
    const originalRender = game.renderer.render;
    game.renderer.render = function(...args) {
        const result = originalRender.apply(this, args);
        applyChromaticEffects();
        return result;
    };
}

// ============================================================================
// Settings Control Functions (Optional)
// ============================================================================

// Function to update chromatic settings on the fly
function updateChromaticSettings(newSettings) {
    Object.assign(chromaticSettings, newSettings);
    
    if (debugChromatic) {
        console.log("Updated chromatic settings:", chromaticSettings);
    }
}

// Function to toggle the effect on/off
function toggleChromaticEffect(enabled = !chromaticSettings.enabled) {
    chromaticSettings.enabled = enabled;
    
    if (!enabled) {
        // Stop all animations
        const chromaticSprites = findSpritesWithPattern(chromaticPatterns);
        chromaticSprites.forEach(sprite => {
            sprite._noiseAnimationActive = false;
        });
    } else {
        applyChromaticEffects();
    }
    
    if (debugChromatic) {
        console.log("Chromatic effect", enabled ? "enabled" : "disabled");
    }
}

// Make these functions globally accessible for debugging/tweaking
if (typeof window !== 'undefined') {
    window.updateChromaticSettings = updateChromaticSettings;
    window.toggleChromaticEffect = toggleChromaticEffect;
}

if (debugChromatic) {
    console.log("Chromatic aberration script loaded. Found patterns:", chromaticPatterns);
    console.log("Settings:", chromaticSettings);
}