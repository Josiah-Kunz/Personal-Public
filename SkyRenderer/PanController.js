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

        this.init();
    }

    init() {
        const player = this.game.player;
        const originalNextPathStep = player.nextPathStep.bind(player);
        player.nextPathStep = (...args) => {
            originalNextPathStep(...args);
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
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        const camera = this.game.camera;
        const startY = camera.offset.y;
        const startTime = performance.now();
        const duration = this.config.panDuration;

        const animate = (now) => {
            const elapsed = now - startTime;
            const t = Math.min(elapsed / duration, 1);

            const eased = 1 - (1 - t) * (1 - t);

            camera.offset.y = startY + (targetY - startY) * eased;
            camera.targetX = -1;

            if (t < 1) {
                this.animationId = requestAnimationFrame(animate);
            } else {
                camera.offset.y = targetY;
                this.animationId = null;
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