import { CONFIG } from './config.js';
export class Loop {
    constructor(update, render) { this.update = update; this.render = render; this.accumulator = 0; this.last = 0; this.tick = this.tick.bind(this); }
    start() { requestAnimationFrame(this.tick); }
    tick(now) {
        const dt = this.last ? Math.min((now - this.last) / 1000, CONFIG.maxFrame) : 0;
        this.last = now;
        this.accumulator += dt;
        while (this.accumulator >= CONFIG.step) {
            this.update(CONFIG.step);
            this.accumulator -= CONFIG.step;
        }
        this.render(this.accumulator / CONFIG.step, dt);
        requestAnimationFrame(this.tick);
    }
}
