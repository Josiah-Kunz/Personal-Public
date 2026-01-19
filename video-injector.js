game => {
	
	/**
	===========================================================================
		Injection script to play a movie. Important variables:
			
			mapvar[play_video]=1		starts playing the video 
			mapvar[video_has_played]	video has started playing
			mapvar[video_ended]			video has finished playing
			
		Example jCoad usage:
		--------------------
		
			npc1=npc(01b35iep)

			npc1.msg(Wanna start the video?)&answers=Yes,No
			Yes=npc1.answer()&freeze&mapvar[play_video]=1

			if mapvar[video_ended]
			  execute(pause=500&textbox=Now wasn't that a nice video?&unfreeze&mapvar[video_ended]=0)
	
	===========================================================================
	*/
	
	if (!game.__video){
		
		game.__video = document.createElement("video");
		game.__video.src = "https://www.dropbox.com/scl/fi/gjt0jd9wjrcbpndrm1sm5/Intro_Test4.mov?rlkey=3w3m998pt8i33tti1pn73vowb&st=s8v8h59u&raw=1";
		
		/* Preload the video */
		game.__video.playsInline = true;
		game.__video.volume = 1.0;
		game.__video.loop = false;
		game.__video.preload = "auto";
		game.__video.style.display = "none";
		document.body.appendChild(game.__video);
		game.__video.load();
		
		/* When the video ends, restore the audio */
		game.__video.addEventListener('ended', () => {
			game.__videoPlaying = false;
			
			if (game.__cachedMapAudio) {
				game.map.audio = game.__cachedMapAudio;
				game.__cachedMapAudio = null;
			}
			
			if (game.__cachedURL){
				game.sound.playTrack(game.__cachedURL, true, 1000);
				game.__cachedURL = null;
			}
			
			game.trigger("mapvar[video_has_played]=0&mapvar[video_ended]=1");
		});
		
		/* Alias to block audio as long as the video is playing */
		if (!game.__originalPlayTrack) {
			game.__originalPlayTrack = game.sound.playTrack.bind(game.sound);
			game.sound.playTrack = function(file, loop, fadeDuration) {
				if (game.__videoPlaying) {
					return;
				}
				return game.__originalPlayTrack(file, loop, fadeDuration);
			};
		}
		
		/* Alias to intercept volume changes in the settings and apply them to the video's volume */
		if (!game.__originalStore) {
			game.__originalStore = game.settings.store.bind(game.settings);
			game.settings.store = function(key, value) {
				if (key === "musVolume" && game.__videoPlaying) {
					game.__video.volume = value / 100.0;
				}
				return game.__originalStore(key, value);
			};
		}
	}
	
	/* Main execution */
	if (game.map.getVar("play_video") && !game.map.getVar("video_has_played")){
		
		game.trigger("mapvar[play_video]=0&mapvar[video_has_played]=1&mapvar[video_ended]=0");
		
		/* Cache BGM */
		if (game.sound.playing){
			game.__cachedURL = game.sound.filePlaying;
			game.sound.playing.stop();
			game.sound.playing = null;
			game.sound.filePlaying = "";
		}
		
		/* Cache default map audio */
		if (game.map.audio) {
			game.__cachedMapAudio = game.map.audio;
			game.map.audio = null;
		}
		
		/* Play the video */
		game.__video.muted = false;
		game.__video.volume = game.settings.musVolume/100.0;
		game.__video.play().catch(err => {
			console.error("Unmuted play failed, trying muted:", err);
			game.__video.muted = true;
			game.__video.play();
		});
		game.__videoPlaying = true;
		
		/* Draw the video onto the HUD container (so it's above weather and stuff) */
		const drawVideo = () => {
			if (!game.__videoPlaying) return;
			
			const hud = game.hud;
			const ctx = hud.ctx;
			const width = hud.canvas.width;
			const height = hud.canvas.height;
			
			ctx.drawImage(game.__video, 0, 0, width, height);
			requestAnimationFrame(drawVideo);
		};
		drawVideo();
	}
}