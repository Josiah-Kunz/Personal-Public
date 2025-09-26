// ============================================================================
// Custom lighting overlay and cutout script.
// Version: Sep 25 2025
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
	if (!window.__jsScripts) {
		window.__jsScripts = "";
		let scriptUrls = [
			"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/05bc2af2d464544b56592dabeb70510e6eebbb46/hawthorne-lightmask-injection.js",
		];
		scriptUrls.forEach(url => 
			fetch(url)
			.then(response => response.text())
			.then(scriptText => {
				window.__jsScripts += scriptText;
			})
			.catch(e => console.error(`Failed to load ${url.split('/').pop()}:`, e))
		);
	}
	eval(window.__jsScripts);
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

const targetPatterns = ["overlay_", "_overlay", "vignette"];
const cutoutPatterns = ["lm_", "-cutout"];
const forePatterns = ["fore+_", "banner_", "_banner"];
const gameLayer = "overlay";

// ============================================================================
// Flicker settings 
// ============================================================================

const flickerPatterns = ["flicker_", "_flicker"]
const defaultMinOnTime = 50;
const defaultMaxOnTime = 5000;
const defaultMinOffTime = 50;
const defaultMaxOffTime = 100;
const defaultInitialOpacity = 100;
const keyParseToken = "_";
const desyncDelay = 1000;

// ============================================================================
// Debug Settings
// ============================================================================

const debugHierarchy = false;
const debugFlicker = false;

// ============================================================================
// Performance Optimization: Caching and Change Detection
// ============================================================================

// Add these global tracking variables
if (!game.__lightMaskCache) {
	game.__lightMaskCache = {
		lastMapUid: null,
		lastObjectCount: 0,
		cachedSprites: {
			targets: [],
			cutouts: [],
			fores: [],
			flickers: []
		},
		objectsHash: ""
	};
}

function shouldUpdate() {
	const currentObjectCount = Object.keys(game.objects["ids"]).length;
	const mapChanged = game.__lightMaskCache.lastMapUid !== game.map.uid;
	const objectCountChanged = game.__lightMaskCache.lastObjectCount !== currentObjectCount;
	
	// Create a simple hash of object names to detect changes
	const objectNames = Object.keys(game.objects["ids"]).sort().join(',');
	const objectsChanged = game.__lightMaskCache.objectsHash !== objectNames;
	
	if (mapChanged || objectCountChanged || objectsChanged) {
		game.__lightMaskCache.lastMapUid = game.map.uid;
		game.__lightMaskCache.lastObjectCount = currentObjectCount;
		game.__lightMaskCache.objectsHash = objectNames;
		return true;
	}
	
	return false;
}

// ============================================================================
// Optimized Light Mask Functions
// ============================================================================
 
function findSpritesWithPattern(patterns, reference="skin") {
	let matches = [];
	for (let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (!gameObject) continue;

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

function addTarget(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		game.excelloContainer.addChild(sprite);
	}
}

function addCutout(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.DST_OUT;
		game.excelloContainer.addChild(sprite);
	}
}

function addFore(sprite){
	if (!game.excelloContainer.children.includes(sprite)) {
		sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
		game.excelloContainer.addChild(sprite);
	}
}

function findGameObjectForSprite(sprite) {
	for (let objName in game.objects["ids"]) {
		let gameObject = game.objects["ids"][objName];
		if (gameObject && gameObject.sprite === sprite) {
			return gameObject;
		}
	}
	return null;
}

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

function getPriority(gameObject){
	let priority = 1;
	let allPools = [targetPatterns, cutoutPatterns, forePatterns];
	
	for (let i = 0; i < allPools.length; i++){
		let pool = allPools[i];
		let result = getPriorityFromPool(gameObject, pool, priority);
		
		if (result < 0){
			priority += pool.length;
		} else {
			return result;
		}
	}
	
	return -1;
}

function applyBlend(){
	// Use cached sprites if available and nothing has changed
	let targetSprites, cutoutSprites, foreSprites;
	
	if (shouldUpdate()) {
		targetSprites = findSpritesWithPattern(targetPatterns);
		cutoutSprites = findSpritesWithPattern(cutoutPatterns);
		foreSprites = findSpritesWithPattern(forePatterns);
		
		// Cache the results
		game.__lightMaskCache.cachedSprites.targets = targetSprites;
		game.__lightMaskCache.cachedSprites.cutouts = cutoutSprites;
		game.__lightMaskCache.cachedSprites.fores = foreSprites;
	} else {
		// Use cached results
		targetSprites = game.__lightMaskCache.cachedSprites.targets;
		cutoutSprites = game.__lightMaskCache.cachedSprites.cutouts;
		foreSprites = game.__lightMaskCache.cachedSprites.fores;
	}
	
	if (targetSprites.length === 0 && cutoutSprites.length === 0) return;

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

	allSprites.sort((a, b) => a.priority - b.priority);

	// Always rebuild container (engine requirement)
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

if (!game.excelloContainer || game.excelloContainer.destroyed) {
	game.excelloContainer = new PIXI.Container();
	game.excelloContainer.filters = [new PIXI.Filter()];
}

const parentContainer = game.stage.children.find(child => child.name === gameLayer);
if (parentContainer && game.excelloContainer.parent !== parentContainer) {
	parentContainer.addChild(game.excelloContainer);
}

// Prevent multiple hook installations
if (!game.__lmMap || game.__lmMap !== game.map.uid) {
	game.__lmMap = game.map.uid;
	
	// Store original update if not already stored
	if (!game.map.__originalUpdate) {
		game.map.__originalUpdate = game.map.update;
	}
	
	game.map.update = function(...args) {
		const result = game.map.__originalUpdate.apply(this, args);
		applyBlend();
		return result;
	};
}

// ============================================================================
// Flicker Functions (Optimized)
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
		
		const timerId = setTimeout(() => flickerImage(sprite), offTime);
		game.map.__flickerTimers.set(sprite.uid, timerId);
		if (debugFlicker){
			console.log(`Flickered ${sprite.uid} on for another ${offTime} ms.`)
		}
	} else {
		sprite.alpha = 0;
		const onTime = getRandomInt(game.map.__minOffTimes[sprite.uid], game.map.__maxOffTimes[sprite.uid]);
		
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

		game.map.__minOnTimes[varName] = defaultMinOnTime;
		game.map.__maxOnTimes[varName] = defaultMaxOnTime;
		game.map.__minOffTimes[varName] = defaultMinOffTime;
		game.map.__maxOffTimes[varName] = defaultMaxOffTime;
		game.map.__initialOpacities[varName] = defaultInitialOpacity;

		const customSettings = parseCustomSettings(varName);

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

if (!game.map.__flickerSprites) {
	game.map.__flickerSprites = [];
	game.map.__minOnTimes = {};
	game.map.__minOffTimes = {};
	game.map.__maxOnTimes = {};
	game.map.__maxOffTimes = {};
	game.map.__initialOpacities = {};
}

if (!game.map.__flickerTimers) {
	game.map.__flickerTimers = new Map();
}

let currentFlickerSprites = findSpritesWithPattern(flickerPatterns, "uid");

if (!game.map.__numFlickerSprites) {
	game.map.__numFlickerSprites = 0;
	game.map.__flickerMapUid = "";
}

// See if anything we care about changed
const mapChanged = game.map.__flickerMapUid !== game.map.uid;
const spriteCountChanged = game.map.__numFlickerSprites !== currentFlickerSprites.length;

if (mapChanged || spriteCountChanged) {
	
	// Clear existing timers
	if (game.map.__flickerTimers && game.map.__flickerTimers.size > 0) {
		for (let timerId of game.map.__flickerTimers.values()) {
			clearTimeout(timerId);
		}
		game.map.__flickerTimers.clear();
	}

	game.map.__flickerSprites = currentFlickerSprites;
	game.map.__numFlickerSprites = currentFlickerSprites.length;
	game.map.__flickerMapUid = game.map.uid;
	
	setFlickerSettings();

	for (let flickerSprite of game.map.__flickerSprites) {
		const uid = flickerSprite.uid;
		flickerSprite.alpha = game.map.__initialOpacities[uid]/100;

		let startDelay = getRandomInt(0, 1000);
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