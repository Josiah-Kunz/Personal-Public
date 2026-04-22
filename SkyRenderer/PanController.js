window.PanController = class PanController {
    static State = {
        NORMAL: 0,
        TRANSITIONING_UP: 1,
        PANNED_UP: 2,
        TRANSITIONING_DOWN: 3
    };

    constructor(game, config = {}) {
        this.game = game;

        this.config = {
            triggerYUp: 464,    // pan up when player goes above this
            triggerYDown: 480,  // pan down when player goes below this
            panAmount: 64,      // px
            panDuration: 500,   // milliseconds
            ...config
        };

        this.state = PanController.State.NORMAL;
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
        const State = PanController.State;
        const playerY = this.game.player.y;

        switch (this.state) {
            case State.NORMAL:
                if (playerY <= this.config.triggerYUp) {
                    this.state = State.TRANSITIONING_UP;
                    this.panTo(-this.config.panAmount, () => {
                        this.state = State.PANNED_UP;
                    });
                }
                break;

            case State.PANNED_UP:
                if (playerY > this.config.triggerYDown) {
                    this.state = State.TRANSITIONING_DOWN;
                    this.panTo(0, () => {
                        this.state = State.NORMAL;
                    });
                }
                break;

            case State.TRANSITIONING_UP:
            case State.TRANSITIONING_DOWN:
                break;
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

            // Ease out quad
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
        this.state = PanController.State.NORMAL;
    }
}