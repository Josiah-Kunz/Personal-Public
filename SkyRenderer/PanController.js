window.PanController = class PanController {
    constructor(game, config = {}) {
        this.game = game;

        this.config = {
            triggerY: 464,         // Y position that initially triggers pan
            panAmount: 64,         // How much to pan up
            panSpeed: 10,          // Lerp speed
            ...config
        };

        this.init();
    }

    init() {
        this.pannedUp = false;
        this.transitioning = false;

        // Alias player.nextPathStep to check if we're in the pan zone
        const player = this.game.player;
        const originalNextPathStep = player.nextPathStep.bind(player);
        player.nextPathStep = (...args) => {
            originalNextPathStep(...args);
            this.update();
        };
    }

    update() {
        if (this.pannedUp && this.game.player.y > this.config.triggerY && !this.transitioning){
            this.pannedUp = false;
            this.transitioning = true;
            this.game.trigger(`lookat=%player.x%,%player.y%,1,${this.config.panSpeed}`);
            this.pollPanning();
        } else if (!this.pannedUp && this.game.player.y <= this.config.triggerY && !this.transitioning) {
            this.pannedUp = true;
            this.transitioning = true;
            this.game.trigger(`lookat=%player.x%,%player.y%-${this.config.panAmount},1,${this.config.panSpeed}`);
            this.pollPanning();
        }
    }
    
    pollPanning(){
        if (!this.transitioning) return;
        const curOffset = this.game.camera.offset.y;
        if (this.pannedUp) {
            this.transitioning = curOffset <= -this.config.panAmount;
            if (!this.transitioning) this.game.camera.offset.y = -this.config.panAmount; 
        } else {
            this.transitioning = curOffset !== 0;
            if (!this.transitioning) this.game.camera.offset.y = 0;
        }
        requestAnimationFrame(() => {this.pollPanning();});
    }
}