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

/* Function to select a mon to hook */
/* Returns a structure with {difficulty: string, name: string, uid: string} */
function getRandomEncounter() {
	
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
			return {
				difficulty: encounter.difficulty,
				name: randomMon.name,
				uid: randomMon.uid
			};
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
			const encounter = getRandomEncounter();
			
			/* Got nothing */
			if (encounter.difficulty === "Nothing" || encounter.uid === ""){
				game.textbox.say("Not even a nibble...", () => stopFishing(target));
			
			/* Mon/item */
			} else {
				playSpotAnimation(target, () => {
					tryHookFish(target, encounter);
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

/* Starts the minigame to hook the fish */
function tryHookFish(target, encounter, cb = null){
	
	/* Item */
	if (encounter.uid.startsWith("06")) {
		game.textbox.say(`Fished up ${aOrAn(encounter.name) + " " + encounter.name}!`, () => {
			game.trigger(`item=${encounter.uid}`);
			stopFishing(target);
		});
	
	/* Mon */
	} else if (encounter.uid.startsWith("00")) {
		game.textbox.say(`Fished up ${aOrAn(encounter.name) + " " + encounter.name}!`, () => {
			showBackground(target);
			game.oceanFishing.hookeduid = encounter.uid;
			if (!encounter.npc) encounter.npc = game.objects.ids[getUID(encounter)];
			if (encounter.npc?.sprite){
				game.objects.sort("hud");
				encounter.npc.sprite.alpha = 1;
				game.trigger("update");
			} else {
				console.log("No encounter NPC!");
			}
			/*stopFishing(target);*/
		});
	
	/* Nothing or unsupported type */
	} else {
		console.warn("Encounter not supported:", encounter);
		game.textbox.say("Not even a nibble...", () => stopFishing(target));
	}
}

function showBackground(target){
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
	
	glueSprite(target, hookedmon, () => {
		game.trigger("with="+hookedmon.uid+"&animate=100");
		if (cb) cb(hookedmon);
	});
	
	return hookedmon;
}

/* Poll until sprite is ready, then glue it to the screen */
function glueSprite(target, obj, cb){
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
				x: 0,
				y: -200 - obj.sprite.height/2
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
	if (game.oceanFishing.background) game.oceanFishing.background.remove();
	for (let entry of game.oceanFishing.encounters){
		for (let monEntry of entry.mons){
			if (monEntry.npc?.sprite) monEntry.npc.sprite.alpha = 0;
		}
	}
	game.trigger("with&unfreeze&icon&fish&mapvar[fishing]=0");
}

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
	for (let entry of game.oceanFishing.encounters){
		for (let monEntry of entry.mons){
			monEntry.npc = createHookedmon(game.player, monEntry, (hookedmon) => {
				hookedmon.sprite.alpha = (game.oceanFishing.hookeduid === monEntry.uid ? 1 : 0);
			});
		}
	}
}

/* Refreshing the map re-adds the relevant sprites */
for (let entry of game.oceanFishing.encounters){
	for (let monEntry of entry.mons){
		if (monEntry.npc){
			monEntry.npc.uid = getUID(monEntry);
			monEntry.npc.addToMap();
		}
	}
}
/* Refreshing also adds the background */
if (game.oceanFishing?.background){
	game.oceanFishing.background.uid = "hookedbg";
	game.oceanFishing.background.addToMap();
}
