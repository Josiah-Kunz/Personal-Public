// ============================================================================
// Efficient Chromatic Aberration Effect Script for jCoad (Using PIXI Filters)
//
// Usage: 
//	- Define a sprite in jCoad like normal 
//		= If the sprite's filename contains one of the key strings in 
//			chromaticPatterns, it will apply chromatic aberration effects.
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
  offsetX: 2.0,     // Red channel X offset (pixels)
  offsetY: 1.0,     // Red channel Y offset (pixels)
  blueOffsetX: -2.0, // Blue channel X offset (pixels)
  blueOffsetY: -1.0, // Blue channel Y offset (pixels)
  noiseIntensity: 0.25, // Noise strength (0-1)
  flickerSpeed: 0.1,    // How fast the effect changes
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

// ============================================================================
// Chromatic Aberration Filter
// ============================================================================

// Custom PIXI filter for chromatic aberration
class ChromaticAberrationFilter extends PIXI.Filter {
    constructor() {
        const vertexShader = `
            attribute vec2 aVertexPosition;
            attribute vec2 aTextureCoord;
            
            uniform mat3 projectionMatrix;
            
            varying vec2 vTextureCoord;
            
            void main(void) {
                gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
                vTextureCoord = aTextureCoord;
            }
        `;
        
        const fragmentShader = `
            varying vec2 vTextureCoord;
            uniform sampler2D uSampler;
            uniform vec2 uOffset;
            uniform vec2 uBlueOffset;
            uniform float uNoise;
            uniform float uTime;
            
            // Simple random function
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }
            
            void main(void) {
                vec2 coord = vTextureCoord;
                
                // Add some time-based variation to the noise
                float timeNoise = uTime * 0.1;
                
                // Sample each color channel with different offsets
                float r = texture2D(uSampler, coord + uOffset / 512.0).r;
                float g = texture2D(uSampler, coord).g;
                float b = texture2D(uSampler, coord + uBlueOffset / 512.0).b;
                float a = texture2D(uSampler, coord).a;
                
                // Add noise
                float noise = (random(coord + timeNoise) - 0.5) * uNoise;
                r = clamp(r + noise, 0.0, 1.0);
                g = clamp(g + noise, 0.0, 1.0);
                b = clamp(b + noise, 0.0, 1.0);
                
                gl_FragColor = vec4(r, g, b, a);
            }
        `;
        
        super(vertexShader, fragmentShader);
        
        this.uniforms.uOffset = [chromaticSettings.offsetX, chromaticSettings.offsetY];
        this.uniforms.uBlueOffset = [chromaticSettings.blueOffsetX, chromaticSettings.blueOffsetY];
        this.uniforms.uNoise = chromaticSettings.noiseIntensity;
        this.uniforms.uTime = 0.0;
    }
    
    updateTime(deltaTime) {
        this.uniforms.uTime += deltaTime * chromaticSettings.flickerSpeed;
    }
    
    updateSettings() {
        this.uniforms.uOffset = [chromaticSettings.offsetX, chromaticSettings.offsetY];
        this.uniforms.uBlueOffset = [chromaticSettings.blueOffsetX, chromaticSettings.blueOffsetY];
        this.uniforms.uNoise = chromaticSettings.noiseIntensity;
    }
}

// ============================================================================
// Simple Noise Filter (Fallback)
// ============================================================================

// If the custom filter doesn't work, we can use PIXI's built-in noise filter
function createSimpleNoiseFilter() {
    // Use PIXI's built-in noise filter if available
    if (PIXI.filters && PIXI.filters.NoiseFilter) {
        const noiseFilter = new PIXI.filters.NoiseFilter();
        noiseFilter.noise = chromaticSettings.noiseIntensity;
        return noiseFilter;
    }
    
    // Fallback: create a basic tint-based effect
    return null;
}

// ============================================================================
// Effect Application
// ============================================================================

function applyChromaticEffect(sprite) {
    if (!sprite || sprite._chromaticProcessed) return;
    
    if (debugChromatic) {
        console.log("Applying chromatic effect to sprite:", sprite);
    }
    
    try {
        // Try to use the custom filter first
        const filter = new ChromaticAberrationFilter();
        sprite.filters = sprite.filters || [];
        sprite.filters.push(filter);
        
        // Store the filter reference for updates
        sprite._chromaticFilter = filter;
        sprite._chromaticProcessed = true;
        
        if (debugChromatic) {
            console.log("Applied custom chromatic filter to sprite");
        }
        
    } catch (error) {
        if (debugChromatic) {
            console.warn("Custom filter failed, trying fallback:", error);
        }
        
        // Fallback: use simple effects
        const noiseFilter = createSimpleNoiseFilter();
        if (noiseFilter) {
            sprite.filters = sprite.filters || [];
            sprite.filters.push(noiseFilter);
            sprite._chromaticFilter = noiseFilter;
            sprite._chromaticProcessed = true;
            
            if (debugChromatic) {
                console.log("Applied fallback noise filter");
            }
        } else {
            // Final fallback: just add a subtle tint effect
            sprite.tint = 0xFFEEEE; // Slight red tint
            sprite._chromaticProcessed = true;
            
            if (debugChromatic) {
                console.log("Applied tint fallback effect");
            }
        }
    }
}

function updateChromaticFilters() {
    const chromaticSprites = findSpritesWithPattern(chromaticPatterns);
    
    chromaticSprites.forEach(sprite => {
        if (sprite._chromaticFilter && sprite._chromaticFilter.updateSettings) {
            sprite._chromaticFilter.updateSettings();
        }
    });
}

// ============================================================================
// Animation Loop
// ============================================================================

let lastTime = 0;

function animateChromaticEffects(currentTime) {
    if (!chromaticSettings.enabled) {
        requestAnimationFrame(animateChromaticEffects);
        return;
    }
    
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    const chromaticSprites = findSpritesWithPattern(chromaticPatterns);
    
    chromaticSprites.forEach(sprite => {
        if (sprite._chromaticFilter && sprite._chromaticFilter.updateTime) {
            sprite._chromaticFilter.updateTime(deltaTime * 0.001); // Convert to seconds
        }
    });
    
    requestAnimationFrame(animateChromaticEffects);
}

// ============================================================================
// Main Execution
// ============================================================================

// Apply chromatic aberration to matching sprites
function applyChromaticEffects() {
    if (!chromaticSettings.enabled) return;
    
    const chromaticSprites = findSpritesWithPattern(chromaticPatterns);
    
    if (debugChromatic && chromaticSprites.length > 0) {
        console.log(`Found ${chromaticSprites.length} sprites for chromatic effects`);
    }
    
    chromaticSprites.forEach(sprite => {
        applyChromaticEffect(sprite);
    });
}

// Initial application
applyChromaticEffects();

// Start animation loop
requestAnimationFrame(animateChromaticEffects);

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
// Settings Control Functions
// ============================================================================

// Function to update chromatic settings on the fly
function updateChromaticSettings(newSettings) {
    Object.assign(chromaticSettings, newSettings);
    updateChromaticFilters();
    
    if (debugChromatic) {
        console.log("Updated chromatic settings:", chromaticSettings);
    }
}

// Function to toggle the effect on/off
function toggleChromaticEffect(enabled = !chromaticSettings.enabled) {
    chromaticSettings.enabled = enabled;
    
    const chromaticSprites = findSpritesWithPattern(chromaticPatterns);
    
    chromaticSprites.forEach(sprite => {
        if (sprite.filters && sprite._chromaticFilter) {
            if (enabled) {
                if (!sprite.filters.includes(sprite._chromaticFilter)) {
                    sprite.filters.push(sprite._chromaticFilter);
                }
            } else {
                const filterIndex = sprite.filters.indexOf(sprite._chromaticFilter);
                if (filterIndex > -1) {
                    sprite.filters.splice(filterIndex, 1);
                }
            }
        }
    });
    
    if (debugChromatic) {
        console.log("Chromatic effect", enabled ? "enabled" : "disabled");
    }
}

// Make these functions globally accessible
if (typeof window !== 'undefined') {
    window.updateChromaticSettings = updateChromaticSettings;
    window.toggleChromaticEffect = toggleChromaticEffect;
}

if (debugChromatic) {
    console.log("Efficient chromatic aberration script loaded.");
    console.log("Patterns:", chromaticPatterns);
    console.log("Settings:", chromaticSettings);
}