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
            triggerY: 464,
            panAmount: 64,
            panSpeed: 10,
            ...config
        };

        this.state = PanController.State.NORMAL;

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
        const inZone = playerY <= this.config.triggerY;

        switch (this.state) {
            case State.NORMAL:
                if (inZone) {
                    this.state = State.TRANSITIONING_UP;
                    this.game.trigger(`lookat=%player.x%,%player.y%-${this.config.panAmount},1,${this.config.panSpeed}`);
                    this.pollPanning();
                }
                break;

            case State.PANNED_UP:
                if (!inZone) {
                    this.state = State.TRANSITIONING_DOWN;
                    this.game.trigger(`lookat=%player.x%,%player.y%,1,${this.config.panSpeed}`);
                    this.pollPanning();
                }
                break;

            // Ignore input during transitions
            case State.TRANSITIONING_UP:
            case State.TRANSITIONING_DOWN:
                break;
        }
    }

    pollPanning() {
        if (this.destroyed) return;
        
        const State = PanController.State;
        const curOffset = this.game.camera.offset.y;

        let done = false;
        let target = 0;

        if (this.state === State.TRANSITIONING_UP) {
            target = -this.config.panAmount;
            done = curOffset <= target;
        } else if (this.state === State.TRANSITIONING_DOWN) {
            target = 0;
            done = curOffset >= target;
        }

        if (done) {
            this.game.camera.offset.y = target;
            this.state = this.state === State.TRANSITIONING_UP
                ? State.PANNED_UP
                : State.NORMAL;
        } else {
            requestAnimationFrame(() => this.pollPanning());
        }
    }

    destroy() {
        this.destroyed = true;
        if (this.state !== PanController.State.NORMAL) {
            this.state = PanController.State.NORMAL;
            this.game.trigger(`lookat=%player.x%,%player.y%,1,${this.config.panSpeed}`);
        }
    }
}