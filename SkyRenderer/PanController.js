window.PanController = class PanController {
    
    static GAME_BASE_HEIGHT = 288;
    
    constructor(game, config = {}) {
        this.game = game;

        this.config = {
            zoneTop: 464,
            zoneBottom: 592,
            panAmount: 96,
            heightWhenPanned: 356,
            destroyDuration: 200,
            ...config
        };

        this.currentTarget = null;

        this.init();
    }

    init() {
        const player = this.game.player;
        const originalSetSpritePosition = player.setSpritePosition.bind(player);
        player.setSpritePosition = (...args) => {
            originalSetSpritePosition(...args);
            this.update();
        };
    }

    update() {
        const playerY = this.game.player.y;
        const { zoneTop, zoneBottom, panAmount } = this.config;

        if (playerY <= zoneBottom) {
            // In zone or above - interpolate
            const clampedY = Math.max(zoneTop, playerY);
            const t = 1 - (clampedY - zoneTop) / (zoneBottom - zoneTop);
            this.panTo(-panAmount * t);
        } else {
            // Below zone
            this.panTo(0);
        }
    }

    panTo(targetY) {
        if (this.currentTarget === targetY) return;
        this.currentTarget = targetY;

        const camera = this.game.camera;
        camera.offset.y = targetY;
        camera.targetX = -1;

        const panRatio = Math.abs(targetY) / this.config.panAmount;
        const h0 = PanController.GAME_BASE_HEIGHT;
        const dh = this.config.heightWhenPanned - h0;
        this.setScreenSize(h0 + Math.round(dh * panRatio));
    }
    
    setScreenSize(height){
        this.game.widgets.list.game.canSave = false;
        this.game.height = height;
        this.game.setZoom(this.game.settings.zoom);
    }

    destroy() {
        const camera = this.game.camera;
        const startOffsetY = camera.offset.y;
        const startHeight = this.game.height;
        const targetHeight = PanController.GAME_BASE_HEIGHT;
        const duration = this.config.destroyDuration;
        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);

            camera.offset.y = startOffsetY * (1 - t);
            camera.targetX = -1;
            this.setScreenSize(Math.round(startHeight + (targetHeight - startHeight) * t)); 

            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }
}