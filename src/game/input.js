// Fuoco: J o Ctrl; raffica: K o Shift (la raffica spara anche da sola).
// Touch: un dito tenuto fermo sullo schermo spara, come il click tenuto col mouse.
const FIRE_KEYS = ['KeyJ', 'ControlLeft', 'ControlRight'];
const BURST_KEYS = ['KeyK', 'ShiftLeft', 'ShiftRight'];
const HOLD_FIRE = .18;
export class Input {
    constructor(canvas, fire, onPause) {
        this.queue = [];
        this.keys = new Set();
        this.mouse = false;
        this.auto = false;
        this.touchHeld = false;
        this.holdTime = 0;
        this.screenHolds = new Map();
        this.padFire = false;
        this.padBurst = false;
        this.padLatch = {};
        const action = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'slide', KeyS: 'slide' };
        window.addEventListener('keydown', e => {
            if (action[e.code] || FIRE_KEYS.includes(e.code) || BURST_KEYS.includes(e.code) || ['KeyP', 'Escape'].includes(e.code)) {
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
                this.screenHolds.set(e.pointerId, 0);
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
            this.screenHolds.delete(e.pointerId);
        });
        canvas.addEventListener('pointercancel', e => { this.mouse = false; this.gesture = null; this.screenHolds.delete(e.pointerId); });
        fire.addEventListener('pointerdown', e => { e.preventDefault(); fire.setPointerCapture(e.pointerId); this.touchHeld = true; this.holdTime = 0; });
        fire.addEventListener('pointerup', e => {
            e.preventDefault();
            if (this.holdTime < .28)
                this.auto = !this.auto;
            this.touchHeld = false;
        });
        fire.addEventListener('pointercancel', () => { this.touchHeld = false; });
    }
    clear() { this.keys.clear(); this.queue.length = 0; this.mouse = false; this.auto = false; this.touchHeld = false; this.padFire = false; this.padBurst = false; this.gesture = null; this.screenHolds.clear(); }
    update(dt) {
        if (this.touchHeld)
            this.holdTime += dt;
        for (const [id, time] of this.screenHolds)
            this.screenHolds.set(id, time + dt);
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
    get firing() { return this.mouse || FIRE_KEYS.some(k => this.keys.has(k)) || this.burstKey || this.auto || this.touchHeld || this.screenHeld || this.padFire || this.padBurst; }
    get screenHeld() { for (const time of this.screenHolds.values()) if (time >= HOLD_FIRE) return true; return false; }
    get burst() { return this.burstKey || (this.touchHeld && this.holdTime > .28) || this.padBurst; }
    get burstKey() { return BURST_KEYS.some(k => this.keys.has(k)); }
}
