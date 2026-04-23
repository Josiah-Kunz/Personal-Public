window.PanController = class PanController {

    constructor(game, config = {}) {
        this.game = game;

        this.config = {
            zoneTop: 464,
            zoneBottom: 592,
            panAmount: 96,
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
            const clampedY = Math.max(zoneTop, playerY);
            const t = 1 - (clampedY - zoneTop) / (zoneBottom - zoneTop);
            this.panTo(-panAmount * t);
        } else {
            this.panTo(0);
        }
    }

    panTo(targetY) {
        if (this.currentTarget === targetY) return;
        this.currentTarget = targetY;

        const camera = this.game.camera;
        camera.offset.y = targetY;
        camera.targetX = -1;
    }

    destroy() {
        this.game.camera.offset.y = 0;
        this.game.camera.targetX = -1;
    }
}