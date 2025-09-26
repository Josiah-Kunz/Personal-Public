// ============================================================================
// Custom lighting overlay and cutout script.
//
// Usage: 
//	- Define a sprite in jCoad like normal 
//		= If the sprite's filename contains one of the key strings in 
//			targetPatterns, it will overlay the game and have cutouts.
//			-- Example: overlay_1_woods.png
//		= If the sprite's filename contains a cutout key string, it will do
//			the cutting. Its color will be invisible, but the cut is 
//			proportional to the sprite's alpha.
//			-- Example: lm_circle_large.png
//		= If the sprite's filename contains a forePattern key string, it will 
//			render above the overlay and not get cut.
//			-- Example: fore+_town_banner.png
//
// Inside the JS Raw (inside Mapbuilder's Settings):
/*

game => {

  let scriptUrl = "https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/6aa90e562f82ced27d79155d45889ace5182fb38/hawthorne-lightmask-injection.js";
  let scriptName = scriptUrl.split('/').pop().split('.')[0];
  
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
// Layer Settings
// ============================================================================

// The things we're cutting out of (targets - bottom layer)
const targetPatterns = ["overlay_", "_overlay", "vignette"];

// The things doing the cutting (middle layer)
const cutoutPatterns = ["lm_", "-cutout"];

// These are above the cutouts, so they neither get cut nor get overlaid (fore layer)
const forePatterns = ["fore+_", "banner_", "_banner"];

// The layer to store the container in. 
// This layer should already be defined within the game.
const gameLayer = "overlay";

// ============================================================================
// Flicker settings 
// ============================================================================

const flickerPatterns = ["flicker_", "_flicker"]

// Times are in ms 
// Times are set on a per-sprite basis and can be overidden by 
const defaultMinOnTime = 50;
const defaultMaxOnTime = 5000;
const defaultMinOffTime = 50;
const defaultMaxOffTime = 100;

// Initial visibility
const defaultInitialOpacity = 100;

// Separates keys from values
// Example: lamp_minOnTime_35 would override the sprite's defaultMinOnTime to 
// be 35 ms instead of the default of 50.
const keyParseToken = "_";

// Otherwise, all the flickering starts at once!
const desyncDelay = 1000;

// ============================================================================
// Debug Settings
// ============================================================================

// If true, prints the hierarchy when pressing F12 in game
const debugHierarchy = false;

// If true, says how many flickers were found, and then announces on/off states
const debugFlicker = false;

// ============================================================================
// Light Mask Function Delcarations
// ============================================================================
 
// Gets all sprites whose filenames match the given array of patterns
function findSpritesWithPattern(patterns, reference="skin") {
	let matches = [];
	for (let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (!gameObject) continue;

		// Convert candidate to string to safely call includes
		let candidate = String(reference === "uid" ? gameObject.uid : gameObject.skin);

		for (let pattern of patterns) {
			if (candidate.includes(pattern)) {
				if (reference === "uid" && gameObject.sprite) {
					gameObject.sprite.uid = gameObject.uid;
				}
				if (gameObject.sprite) matches.push(gameObject.sprite);
				break;
			}
		}
	}
	return matches;
}


// Add the sprite to the targets (having the lowest priority)
function addTarget(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		game.excelloContainer.addChild(sprite);
	}
}

// Add the sprite to the cutouts (having a blend mode of DST_OUT; has priority 
// over targets)
function addCutout(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.DST_OUT;
		game.excelloContainer.addChild(sprite);
	}
}

// Add the sprite to the foreground (fore+; has priority over cutouts)
function addFore(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		game.excelloContainer.addChild(sprite);
	}
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

// Determines if the given sprite's skin matches any pattern in the given 
// pattern pool. If so, return its priority. For example:
//		pool = ["A", "B"]
//	spriteA would have priority 1 and spriteB would have priority 2. 
//  spriteA2 would also have priority 1, and so its order in the container with
//	respect to spriteA would not be guaranteed.
function getPriorityFromPool(gameObject, patternPool, startingPriority) {
	if (!gameObject || !gameObject.skin) return -1;
	let priority = startingPriority;
	const skin = gameObject.skin.toLowerCase();

	for (let i = 0; i < patternPool.length; i++){
		if (skin.includes(patternPool[i])){
			return priority;
		}
		priority++;
	}

	return -1;
}

// Gets the given sprite's priority based on its pool (target, cutout, etc.)
function getPriority(gameObject){
	
	// Initialize
	let priority = 1;
	let allPools = [targetPatterns, cutoutPatterns, forePatterns];
	
	for (let i = 0; i < allPools.length; i++){
		let pool = allPools[i];
		let result = getPriorityFromPool(gameObject, pool, priority);
		
		// Failed search; try next pool
		if (result < 0){
			priority += pool.length;
		} else {
			// Success!
			return result;
		}
	}
	
	// Total failure
	return -1;
}

// Main function that applies the blend properties to sprites
function applyBlend(){
	
	// Add sprites to the container based on pattern
	let targetSprites = findSpritesWithPattern(targetPatterns);
	let cutoutSprites = findSpritesWithPattern(cutoutPatterns);
	let foreSprites = findSpritesWithPattern(forePatterns);
	
	// Guard nothing to blend
	if (targetSprites.length === 0 && cutoutSprites.length === 0) return;

	// Collect all sprites with their priorities
	let allSprites = [];

	targetSprites.forEach(sprite => {
		let gameObj = findGameObjectForSprite(sprite);
		allSprites.push({sprite, priority: getPriority(gameObj), type: 'target'});
	});

	cutoutSprites.forEach(sprite => {
		let gameObj = findGameObjectForSprite(sprite);
		allSprites.push({sprite, priority: getPriority(gameObj), type: 'cutout'});
	});

	foreSprites.forEach(sprite => {
		let gameObj = findGameObjectForSprite(sprite);
		allSprites.push({sprite, priority: getPriority(gameObj), type: 'fore'});
	});

	// Sort by priority
	allSprites.sort((a, b) => a.priority - b.priority);

	// Clear container and add sprites in order
	game.excelloContainer.removeChildren();

	allSprites.forEach(item => {
		if (item.type === 'target') {
			addTarget(item.sprite);
		} else if (item.type === 'cutout') {
			addCutout(item.sprite);
		} else if (item.type === 'fore') {
			addFore(item.sprite);
		}
	});
}

// ============================================================================
// Layer Execution
// ============================================================================

// Create the container if it doesn't exist yet
if (!game.excelloContainer || game.excelloContainer.destroyed) {
	game.excelloContainer = new PIXI.Container();
	game.excelloContainer.filters = [new PIXI.Filter()];
}

// Set the container in the correct layer (defined as "gameLayer" in the settings)
const parentContainer = game.stage.children.find(child => child.name === gameLayer);
if (parentContainer && game.excelloContainer.parent !== parentContainer) {
	parentContainer.addChild(game.excelloContainer);
}

// Hook into refresh (e.g., when mapvars update or the player takes a step)
// Otherwise, the sprites automatically re-parent based on their depth
// We don't want that since they should only be blending with each other
if (!game.__lmMap || game.__lmMap != game.map.uid) {
	game.__lmMap = game.map.uid;
	const originalUpdate = game.map.update;
	game.map.update = function(...args) {

		const result = originalUpdate.apply(this, args);
		
		targetSprites = findSpritesWithPattern(targetPatterns);
		cutoutSprites = findSpritesWithPattern(cutoutPatterns);
		foreSprites = findSpritesWithPattern(forePatterns);
		applyBlend();
		
		
		return result;
	};
}

// ============================================================================
// Flicker Function Definitions
// ============================================================================

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function flickerImage(sprite) {
	if (!sprite) return;

	if (sprite.alpha < 0.5) {
		sprite.alpha = 1;
		const offTime = getRandomInt(game.map.__minOnTimes[sprite.uid], game.map.__maxOnTimes[sprite.uid]);
		
		// Store the timer ID so we can clear it later if needed
		const timerId = setTimeout(() => flickerImage(sprite), offTime);
		game.map.__flickerTimers.set(sprite.uid, timerId);
		if (debugFlicker){
			console.log(`Flickered ${sprite.uid} on for another ${offTime} ms.`)
		}
	} else {
		sprite.alpha = 0;
		const onTime = getRandomInt(game.map.__minOffTimes[sprite.uid], game.map.__maxOffTimes[sprite.uid]);
		
		// Store the timer ID so we can clear it later if needed
		const timerId = setTimeout(() => flickerImage(sprite), onTime);
		game.map.__flickerTimers.set(sprite.uid, timerId);
		if (debugFlicker){
			console.log(`Flickered ${sprite.uid} off for another ${onTime} ms.`)
		}
	}
}

function parseCustomSettings(varName) {
	const parts = varName.split(keyParseToken);
	const settings = {};

	for (let i = 0; i < parts.length - 1; i++) {
		const key = parts[i];
		const value = parseInt(parts[i + 1]);

		if (!isNaN(value)) {
			if (key.includes('minOnTime')) {
				settings.minOnTime = value;
			} else if (key.includes('maxOnTime')) {
				settings.maxOnTime = value;
			} else if (key.includes('minOffTime')) {
				settings.minOffTime = value;
			} else if (key.includes('maxOffTime')) {
				settings.maxOffTime = value;
			} else if (key.includes('initialOpacity')) {
				settings.initialOpacity = value > 50 ? 100 : 0;
			}
		}
	}

	return settings;
}

function setFlickerSettings() {

	if (debugFlicker){
		console.log(`found ${game.map.__flickerSprites.length} flicker sprites`);
	}

	for (let flickerSprite of game.map.__flickerSprites) {
		let varName = flickerSprite.uid;

		// Set defaults
		game.map.__minOnTimes[varName] = defaultMinOnTime;
		game.map.__maxOnTimes[varName] = defaultMaxOnTime;
		game.map.__minOffTimes[varName] = defaultMinOffTime;
		game.map.__maxOffTimes[varName] = defaultMaxOffTime;
		game.map.__initialOpacities[varName] = defaultInitialOpacity;

		// Parse custom settings from the sprite name/id
		const customSettings = parseCustomSettings(varName);

		// Override defaults with custom settings if they exist
		if (customSettings.minOnTime !== undefined) {
			game.map.__minOnTimes[varName] = customSettings.minOnTime;
		}
		if (customSettings.maxOnTime !== undefined) {
			game.map.__maxOnTimes[varName] = customSettings.maxOnTime;
		}
		if (customSettings.minOffTime !== undefined) {
			game.map.__minOffTimes[varName] = customSettings.minOffTime;
		}
		if (customSettings.maxOffTime !== undefined) {
			game.map.__maxOffTimes[varName] = customSettings.maxOffTime;
		}
		if (customSettings.initialOpacity !== undefined) {
			game.map.__initialOpacities[varName] = customSettings.initialOpacity;
		}
	}
}

// ============================================================================
// Flicker Execution
// ============================================================================

// Global var declaration
if (!game.map.__flickerSprites) {
	game.map.__flickerSprites = [];
	game.map.__minOnTimes = {};
	game.map.__minOffTimes = {};
	game.map.__maxOnTimes = {};
	game.map.__maxOffTimes = {};
	game.map.__initialOpacities = {};
}

// Initialize timer tracking map to prevent memory leaks on window resize
if (!game.map.__flickerTimers) {
	game.map.__flickerTimers = new Map();
}

let currentFlickerSprites = findSpritesWithPattern(flickerPatterns, "uid");

if (!game.map.__numFlickerSprites) {
	game.map.__numFlickerSprites = 0;
	game.map.__flickerMap = "";
}

if (game.map.__numFlickerSprites != currentFlickerSprites.length || game.map.__flickerMap != game.map.uid) {

	// Clear all existing timers before creating new ones (prevents multiple timers per sprite)
	if (game.map.__flickerTimers && game.map.__flickerTimers.size > 0) {
		for (let timerId of game.map.__flickerTimers.values()) {
			clearTimeout(timerId);
		}
		game.map.__flickerTimers.clear();
	}

	game.map.__flickerSprites = currentFlickerSprites;
	game.map.__numFlickerSprites = currentFlickerSprites.length;
	game.map.__flickerMap = game.map.uid;
	
	setFlickerSettings();

	// Initialize each flicker sprite and start the flicker effect
	for (let flickerSprite of game.map.__flickerSprites) {
		const uid = flickerSprite.uid;

		// Set initial visibility
		flickerSprite.alpha = game.map.__initialOpacities[uid]/100;

		// Start flickering after a small random delay to avoid synchronized flickering
		let startDelay = getRandomInt(0, 1000);
		// Store the initial timer ID for cleanup purposes
		const timerId = setTimeout(() => flickerImage(flickerSprite), startDelay);
		game.map.__flickerTimers.set(uid, timerId);
	}
}

// ============================================================================
// Hierarchy Debug 
// ============================================================================

function detailedHierarchy(container, prefix = '', isLast = true) {
	const connector = isLast ? '└── ' : '├── ';
	const name = container.constructor.name;

	// Add useful identifying info
	let info = '';
	if (container.name) info += ` "${container.name}"`;
	if (container.label) info += ` label:"${container.label}"`;
	if (container.id) info += ` id:${container.id}`;
	if (container === game.excelloContainer) info += ' ⭐ YOUR CONTAINER';
	if (container.texture && container.texture.baseTexture 
		&& container.texture.baseTexture.resource 
		&& container.texture.baseTexture.resource.url) {
		const url = container.texture.baseTexture.resource.url;
		const filename = url.split('/').pop();
		info += ` img:"${filename}"`;
	}
	if (container.blendMode && container.blendMode !== 0){
		info += ` blend:${container.blendMode}`;
	}
	if (container.children && container.children.length > 0){
		info += ` (${container.children.length})`;
	}
	if (container.x !== 0 || container.y !== 0){
		info += ` pos:(${container.x.toFixed(0)},${container.y.toFixed(0)})`;
	}

	for (let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (gameObject && gameObject.sprite === container) {
			info += ` 🎮 "${objName}"`;
			if (gameObject.skin) info += ` skin:"${gameObject.skin}"`;
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

if (debugHierarchy){
	detailedHierarchy(game.stage);
}