export class Input {
    constructor(canvas, fire, onPause) {
        this.queue = [];
        this.keys = new Set();
        this.mouse = false;
        this.auto = false;
        this.touchHeld = false;
        this.holdTime = 0;
        this.padFire = false;
        this.padBurst = false;
        this.padLatch = {};
        const action = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'slide', KeyS: 'slide' };
        window.addEventListener('keydown', e => {
            if (action[e.code] || ['KeyJ', 'KeyK', 'KeyP', 'Escape'].includes(e.code)) {
                e.preventDefault();
                if (!e.repeat) {
                    if (action[e.code])
                        this.queue.push(action[e.code]);
                    if (e.code === 'KeyP' || e.code === 'Escape')
                        onPause();
                }
                this.keys.add(e.code);
            }
        });
        window.addEventListener('keyup', e => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('pointerdown', e => {
            if (e.pointerType === 'mouse')
                this.mouse = e.button === 0;
            else {
                this.gesture = { id: e.pointerId, x: e.clientX, y: e.clientY };
                canvas.setPointerCapture(e.pointerId);
            }
        });
        canvas.addEventListener('pointermove', e => {
            const g = this.gesture;
            if (!g || g.id !== e.pointerId)
                return;
            const dx = e.clientX - g.x, dy = e.clientY - g.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) > 32) {
                this.queue.push(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'jump' : 'slide'));
                this.gesture = null;
            }
        });
        window.addEventListener('pointerup', e => {
            if (e.pointerType === 'mouse')
                this.mouse = false;
            if (this.gesture?.id === e.pointerId)
                this.gesture = null;
        });
        canvas.addEventListener('pointercancel', () => { this.mouse = false; this.gesture = null; });
        fire.addEventListener('pointerdown', e => { e.preventDefault(); fire.setPointerCapture(e.pointerId); this.touchHeld = true; this.holdTime = 0; });
        fire.addEventListener('pointerup', e => {
            e.preventDefault();
            if (this.holdTime < .28)
                this.auto = !this.auto;
            this.touchHeld = false;
        });
        fire.addEventListener('pointercancel', () => { this.touchHeld = false; });
    }
    clear() { this.keys.clear(); this.queue.length = 0; this.mouse = false; this.auto = false; this.touchHeld = false; this.padFire = false; this.padBurst = false; this.gesture = null; }
    update(dt) {
        if (this.touchHeld)
            this.holdTime += dt;
        const pad = navigator.getGamepads?.()[0];
        this.padFire = false;
        this.padBurst = false;
        if (!pad)
            return;
        const commands = { left: pad.axes[0] < -.5 || pad.buttons[14]?.pressed, right: pad.axes[0] > .5 || pad.buttons[15]?.pressed, jump: pad.buttons[0]?.pressed, slide: pad.buttons[1]?.pressed };
        for (const k in commands) {
            if (commands[k] && !this.padLatch[k])
                this.queue.push(k);
            this.padLatch[k] = commands[k];
        }
        this.padFire = pad.buttons[7]?.pressed;
        this.padBurst = pad.buttons[5]?.pressed;
    }
    get firing() { return this.mouse || this.keys.has('KeyJ') || this.keys.has('KeyK') || this.auto || this.touchHeld || this.padFire || this.padBurst; }
    get burst() { return this.keys.has('KeyK') || (this.touchHeld && this.holdTime > .28) || this.padBurst; }
}
