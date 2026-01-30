/*
Roadmap:
	1. game.map.getVar("fishing")===1 (via jCoad)
	2. startFishing() called
	3. wait 2--5 seconds on a callback in startFishing()
	4. playSpotAnimation() is called in startFishing()
	5. a callback in playSpotAnimation() 
*/

/* Settings */
/* ======== */

/* Things you'll fish up! */
/* Can also add egg move mons or HA mons */
if (!game.oceanFishing){
	game.oceanFishing = {};
	game.oceanFishing.encounters = [

		/* Nothing! */
		{ difficulty: "Nothing", percentage: 5, mons: [
			{ name: "nothing", uid: "" }
		]},
		
		/* Trash */
		{ difficulty: "Garbage", percentage: 5, mons: [
			{ name: "Old Boot", uid: "06se46p3" }
		]},
		
		/* Magikarp, Slowpoke */
		{ difficulty: "Easy", percentage: 40, mons: [
			{ name: "Magikarp", uid: "00bnaubj" },
			{ name: "Slowpoke", uid: "00qecmsa" }
		]},
		
		/* Poliwag, Horsea */
		{ difficulty: "Medium", percentage: 40, mons: [
			{ name: "Poliwag", uid: "00ljsdfr" },
			{ name: "Horsea", uid: "0011h2eg" }
		]},
		
		/* Staryu, Feebas */
		{ difficulty: "Hard", percentage: 8.9, mons: [
			{ name: "Staryu", uid: "00girfz7" },
			{ name: "Feebas", uid: "00yxcpc1" }
		]},
		
		/* Dratini */
		{ difficulty: "Expert", percentage: 1, mons: [
			{ name: "Dratini", uid: "00o3rpx7" }
		]},
		
		/* Vaporeon - need to change to, like, a relic mon or something */
		{ difficulty: "Super Expert", percentage: 0.1, mons: [
			{ name: "Vaporeon", uid: "00b6z8gi" }
		]}
	];
}

/* The half-width of the ring's travel */
const RING_EXTENT = 85;

/* How fast the ring moves in pixels per second */
const RING_SPEED = 100; 

/* How far away the npc swims */
const SWIM_EXTENT = 86;

/* Function to select a mon to hook */
/* Returns {monEntry, difficulty} */
function getRandomMonEntry() {
	
	/* Percentages probably add to 100%, but can't be too sure */
	let roll = Math.random();
	let totalPercentage = 0;
	for (let encounter of game.oceanFishing.encounters) {
		totalPercentage += encounter.percentage;
	}
	roll *= totalPercentage;
	
	/* Select based on the CDF */
	let cumulative = 0;
	for (let encounter of game.oceanFishing.encounters) {
		cumulative += encounter.percentage;
		if (roll < cumulative) {
			
			/* Pick random mon from this tier */
			const randomMon = encounter.mons[Math.floor(Math.random() * encounter.mons.length)];
			return {monEntry: randomMon, difficulty: encounter.difficulty};
		}
	}
	
	/* Fallback is Nothing (shouldn't happen... right?) */
	return { difficulty: "Easy", uid: "" };
}

/* Initial casting setup (fish icon + fishing sprite) */
/* Target is the thing to start animating and tiles is the number of tiles to cast */
function startFishing(target, tiles=2){
	
	/* Set fishing icon */
	target.createIcon(10,1);
	
	/* Set up animation direction + distance */
	let x = target.x; let y = target.y;
	if (target.direction === 0) y = target.y + 16 * tiles;
	if (target.direction === 1) y = target.y - 16 * tiles;
	if (target.direction === 2) x = target.x + 16 * tiles;
	if (target.direction === 3) x = target.x - 16 * tiles;
	
	/* Add animation sprite to the game */
	game.oceanFishing.fishingSprite = target.game.objects.add({
		type: "animation",
		uid: "fishing",
		texture: {
			file: "fishing",
			width: 11,
			height: 12,
			frames: 4,
			fps: 200,
			loop: {
				times: 0,
				cb: () => {
					game.oceanFishing.fishingSprite.animation.reset(0, 12, 11, 10, 5, 6, -1);
				}
			}
		},
		depth: 5000,
		x: x,
		y: y,
		map: target.map,
		addToMap: true,
		player: target.player,
		canGrass: false
	});
	
	/* If target is the player, actually play the game */
	if (target === game.player){
		
		/* 2-5 seconds */
		const waitTime = 2000 + Math.random() * 3000;
		setTimeout(() => {
			
			/* Fish up something */
			const encounterInfo = getRandomMonEntry();
			const monEntry = encounterInfo.monEntry;
			const difficulty = encounterInfo.difficulty;
			
			/* Got nothing */
			if (difficulty === "Nothing" || monEntry.uid === ""){
				game.textbox.say("Not even a nibble...", () => stopFishing(target));
			
			/* Mon/item */
			} else {
				playSpotAnimation(target, () => {
					startEncounter(target, monEntry, difficulty);
				});
			}
		}, waitTime);
	}
}

/* Plays ! when a fish is hooked */
function playSpotAnimation(target, cb = null){
	setTimeout(() => {
		game.objects.add({
			type: "animation",
			uid: "spot-ani",
			texture: {
				file: "trainer-battle-spot",
				x: 0,
				y: 0,
				width: 356,
				height: 288,
				frames: 3,
				fps: 50,
				loop: {
					cb: obj => setTimeout(() => {
						if (cb) cb();
						obj.remove();
					}, 1200)
				}
			},
			x: -game.camera.x + 170,
			y: -game.camera.y + 272,
			depth: game.map.height,
			map: game.map.current,
			tint: 0xffffff,
			parent: game.containers.icons,
			addToMap: true
		});
	}, 100);

	game.sound.play("trainerspot.ogg");
}

/* Selects an encounter and executes */
function startEncounter(target, monEntry, difficulty, cb = null){
	
	/* Item */
	if (monEntry.uid.startsWith("06")) {
		game.trigger(`item=${monEntry.uid}`);
		stopFishing(target);
	
	/* Mon */
	} else if (monEntry.uid.startsWith("00")) {
		game.textbox.say(`Fished up ${aOrAn(monEntry.name) + " " + monEntry.name}!`, () => {
			game.oceanFishing.hookeduid = monEntry.uid;
			if (!monEntry.npc) monEntry.npc = game.objects.ids[getUID(monEntry)];
			if (monEntry.npc?.sprite){
				monEntry.npc.sprite.alpha = 1;
				game.objects.ids["hookedbg"].sprite.alpha = 1;
				game.objects.ids["hookring"].sprite.alpha = 1;
				startSwimming(monEntry, difficulty);
			} else {
				console.warn("No monEntry NPC!");
				game.textbox.say("...but it got away! [error]", () => stopFishing(target));
			}
			/*stopFishing(target);*/
		});
	
	/* Nothing or unsupported type */
	} else {
		console.warn("monEntry not supported:", monEntry);
		game.textbox.say("Not even a nibble...", () => stopFishing(target));
	}
}

/* Makes the npc associated with the monEntry swim back and forth until the action key is pressed */
function startSwimming(monEntry, difficulty){
	
	/* Establish the thing that's moving (glued to the screen) */
	let npc = monEntry.npc || game.objects.ids[getUID(monEntry)];
	if (!npc) return;
	
	/* Position npc all the way to the left */
	setNPCPos(npc, -SWIM_EXTENT);
	
	/* Cache time */
	let lastTime = Date.now();
	const startTime = Date.now();
	const gracePeriod = 500; // 0.5 seconds in milliseconds
	
	const swimLoop = () => {
		
		/* Check for action key press to stop (only after grace period) */
		if (Date.now() - startTime > gracePeriod && game.input.keyHeld("action")) {
			checkHookedResult(monEntry);
			return;
		}
		
		/* Calculate delta time */
		const now = Date.now();
		const dt = (now - lastTime) / 1000; // Convert to seconds
		lastTime = now;
		
		/* Update the fish position */
		updateVelocity(npc, difficulty, true, dt);
		
		/* Update the ring to catch it */
		updateRingPosition(dt);
		
		/* Update everything's position */
		game.camera.moveGluedObjects();
		
		/* Continue the loop */
		requestAnimationFrame(swimLoop);
	};
	
	/* Start the loop */
	requestAnimationFrame(swimLoop);
}

function updateVelocity(npc, difficulty, isSwimming, dt){

	const speed = getSpeed(difficulty, isSwimming);
	const x0 = getNPCPos(npc);

	/* Not set */
	if (!npc.velocity){
		npc.velocity = x0 > 0 ? -speed : speed;
		return;
	}

	/* Take a step in the current direction */
	setNPCPos(npc, x0 + npc.velocity * dt);

	/* Prevent overstepping */
	const x1 = getNPCPos(npc);
	if (x1 > SWIM_EXTENT || x1 < -SWIM_EXTENT){
		npc.velocity *= -1;
		setNPCPos(npc, x0 + npc.velocity * dt)
	}
	
}

function setNPCPos(npc, x){
	npc.offset.glue.x = x;
}

function changeNPCPos(npc, dx){
	npc.offset.glue.x += x;
}

function getNPCPos(npc){
	return npc.offset.glue.x;
}

/* Returns the swim or struggle speed in pixels per second based on how hard the fish is to catch */
function getSpeed(difficulty, isSwimming){
	switch(difficulty){
		case "Easy":
			return isSwimming ? 30 : 30;
		case "Medium":
			return isSwimming ? 50 : 70;
		case "Hard":
			return isSwimming ? 70 : 80;
		case "Expert":
			return isSwimming ? 80 : 100;
		case "Super Expert":
			return isSwimming ? 90 : 120;
		default:
			return isSwimming ? 1 : 1;
	}
}

/* Positions the ring depending on inputs */
function updateRingPosition(dt){
	
	const npc = game.oceanFishing.hookring;
	
	/* Get inputs */
	if (game.input.keyHeld("left")){
		changeNPCPos(npc, -RING_SPEED * dt);
	}
	if (game.input.keyHeld("right")){
		changeNPCPos(npc, RING_SPEED * dt);
	}
	
	/* Respect bounds */
	setNPCPos(npc, Math.min(RING_EXTENT, Math.max(-RING_EXTENT, getNPCPos(npc))));
	
}

function checkHookedResult(monEntry){
	
	const hookPos = getNPCPos(game.oceanFishing.hookring);
	const monPos = getNPCPos(monEntry.npc);
	const posDiff = Math.abs(hookPos - monPos);
	
	if (posDiff < 2){
		console.log("Perfect!");
		stopFishing(game.player);
	} else if (posDiff < 10){
		console.log("Excellent!");
		stopFishing(game.player);
	} else if (posDiff < 20){
		console.log("Good!");
		stopFishing(game.player);
	} else if (posDiff < 26) {
		console.log("Barely!");
		stopFishing(game.player);
	} else {
		game.textbox.say("It got away...", () => stopFishing(game.player));
	}
	
}

function getHookCoverage(monEntry){
	
	/* Geometry */
	const hookPos = getNPCPos(game.oceanFishing.hookring);
	const hookWidth = game.oceanFishing.hookring.sprite.width;
	const monPos = getNPCPos(monEntry.npc);
	const monWidth = monEntry.npc.sprite.width;
	
	/* Extents */
	const hookLeft = hookPos;
	const hookRight = hookPos + hookWidth;
	const monLeft = monPos;
	const monRight = monPos + monWidth;
	
	/* Check overlap at all */
	const overlapping = hookLeft < monRight && hookRight > monLeft;
	if (!overlapping) return 0;
	
	/* Quantify overlap amount via coverage (0 to 1) */
	const overlapLeft = Math.max(hookLeft, monLeft);
	const overlapRight = Math.min(hookRight, monRight);
	const overlapWidth = Math.max(0, overlapRight - overlapLeft);
	const coverage = overlapWidth / monWidth;
	
	return coverage;
}

function createBackground(target){
	/* Create the sprite */
	game.oceanFishing.background = game.objects.add({
		type: "sprite",
		uid: "hookedbg",
		texture: window.CDN_BASE + "images/sprites/186753/fm-background",
		x: 0,
		y: 0,
		solid: false,
		depth: 5000,
		map: game.map.current,
		addToMap: true
	});
	
	game.oceanFishing.background.sprite.alpha = 0;
	
	glueSprite(target, game.oceanFishing.background);
}

/* Creates the "npc" of the mon, or fails if the mon's sprite doesn't load after 1 second */
function createHookedmon(target, monEntry, cb = null){

	/* Create the npc */
	let hookedmon = game.objects.add({
		type: "entity",
		uid: getUID(monEntry),
		texture: monEntry.uid,
		x: 0,
		y: 0,
		direction: 3,
		solid: false,
		depth: 4500,
		map: game.map.current,
		addToMap: true
	});
	
	glueSprite(target, hookedmon, 0, 3, () => {
		game.trigger("with="+hookedmon.uid+"&animate=100");
		if (cb) cb(hookedmon);
	});
	
	return hookedmon;
}

function createHookRing(target){
	
	game.oceanFishing.hookring = game.objects.add({
		type: "sprite",
		uid: "hookring",
		texture: window.CDN_BASE + "images/sprites/186753/fm-ring",
		x: 0,
		y: 0,
		solid: false,
		depth: 4000,
		map: game.map.current,
		addToMap: true
	});
	
	game.oceanFishing.hookring.sprite.alpha = 0;
	
	glueSprite(target, game.oceanFishing.hookring, 0, -2);
}

/* Poll until sprite is ready, then glue it to the screen */
function glueSprite(target, obj, xoffset=0, yoffset=0, cb=null){
	let attemptTime = 0;
	const maxTime = 1000; /* 1 second */
	let lastTime = Date.now();
	
	const checkSprite = () => {
		const now = Date.now();
		const dt = now - lastTime;
		lastTime = now;
		attemptTime += dt;
		
		if (obj?.sprite?._texture?.baseTexture) {
			/* Stop polling */
			
			game.containers.hud.addChild(obj.sprite);
			
			obj.offset.glue = {
				active: true,
				x: 0 - xoffset,
				y: -200 - yoffset
			};
			game.camera.glueObject(obj);
			
			if (cb) cb();
			
		} else if (attemptTime >= maxTime) {
			console.warn(`Sprite ${obj.uid} failed to load after ${maxTime/1000} seconds`);
			game.textbox.say("Connection error while fishing...", () => stopFishing(target));
		} else {
			requestAnimationFrame(checkSprite); /* Check again next frame */
		}
	};
	
	requestAnimationFrame(checkSprite);
}

/* Cleans up sprites and unfreezes the player */
function stopFishing(target){
	game.oceanFishing.fishingSprite.remove();
	if (game.oceanFishing.background) game.oceanFishing.background.sprite.alpha = 0;
	if (game.oceanFishing.hookring) game.oceanFishing.hookring.sprite.alpha = 0;
	for (let entry of game.oceanFishing.encounters){
		for (let monEntry of entry.mons){
			if (monEntry.npc?.sprite) monEntry.npc.sprite.alpha = 0;
		}
	}
	game.trigger("with&unfreeze&icon&fish&mapvar[fishing]=0");
}

/* Gets the standardized UID like you'd use for an NPC (not the mon's UID) */
function getUID(monEntry){
	return "hookedmon_" + monEntry.name;
}

/* Main execution trigger */
if (game.map.getVar("fishing")===1 && game.oceanFishing){
	game.textbox.say("You used an Ocean Rod!", () => {
		startFishing(game.player);
		game.trigger("with&freeze&mapvar[fishing]=2");
	});
}

/* Initialization */
/* This is done here after all the functions are defined */
if (!game.oceanFishing.initialized){
	game.oceanFishing.initialized = true;
	createBackground(game.player);
	for (let entry of game.oceanFishing.encounters){
		for (let monEntry of entry.mons){
			monEntry.npc = createHookedmon(game.player, monEntry, (hookedmon) => {
				hookedmon.sprite.alpha = (game.oceanFishing.hookeduid === monEntry.uid ? 1 : 0);
			});
		}
	}
	createHookRing(game.player);
	game.objects.sort("hud");
	game.trigger("update");
}

/* Refreshing the map re-adds the relevant sprites */
for (let entry of game.oceanFishing.encounters){
	for (let monEntry of entry.mons){
		if (monEntry.npc){
			monEntry.npc.uid = getUID(monEntry);
			monEntry.npc.addToMap();
			monEntry.npc.sprite.alpha = (game.oceanFishing.hookeduid === monEntry.uid ? 1 : 0)
		}
	}
}
/* Refreshing also adds the background and ring */
if (game.oceanFishing?.background){
	game.oceanFishing.background.uid = "hookedbg";
	game.oceanFishing.background.addToMap();
	game.oceanFishing.background.sprite.alpha = (game.oceanFishing.hookeduid && game.oceanFishing.hookeduid !== "" ? 1 : 0);
}
if (game.oceanFishing?.hookring){
	game.oceanFishing.hookring.uid = "hookring";
	game.oceanFishing.hookring.addToMap();
	game.oceanFishing.hookring.sprite.alpha = (game.oceanFishing.hookeduid && game.oceanFishing.hookeduid !== "" ? 1 : 0);
}
