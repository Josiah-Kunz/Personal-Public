window.PanController = class PanController {
    constructor(game, config = {}) {
        this.game = game;

        this.config = {
            zoneTop: 464,
            zoneBottom: 544,
            panAmount: 96,
            panDuration: 100,
            ...config
        };

        this.animationId = null;
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

    panTo(targetY, onComplete) {
        // Skip if already animating to this target
        if (this.currentTarget === targetY && this.animationId) {
            return;
        }
        this.currentTarget = targetY;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        const camera = this.game.camera;
        const startY = camera.offset.y;

        // Skip if already there
        if (Math.abs(startY - targetY) < 0.5) {
            camera.offset.y = targetY;
            camera.targetX = -1;
            if (onComplete) onComplete();
            return;
        }

        const startTime = performance.now();
        const duration = this.config.panDuration;

        const animate = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);

            camera.offset.y = startY + (targetY - startY) * t;
            camera.targetX = -1;

            if (t < 1) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                camera.offset.y = targetY;
                this.animationId = null;
                this.currentTarget = null;
                if (onComplete) onComplete();
            }
        };

        this.animationId = requestAnimationFrame(animate);
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        this.game.camera.offset.y = 0;
        this.game.camera.targetX = -1;
    }
}