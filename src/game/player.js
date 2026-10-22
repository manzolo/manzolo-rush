import { CONFIG } from './config.js';
import { actor } from './models.js';
import { SPRITES, billboard } from './sprites.js';
import { poseName } from './characters.js';
export class Player {
    constructor(scene) { Object.assign(this, actor(0xff7263, true)); scene.add(this.root); this.setupSprite(); this.reset(); }
    // Con gli sprite caricati il protagonista è un piano animato (corsa, salto, scivolata, sparo)
    // leggermente ruotato verso la camera; altrimenti resta il modello a blocchi.
    // I frame visti di spalle dipendono dal personaggio scelto nel menu (characters.js).
    setupSprite(character = 'manzolo') {
        const s = CONFIG.sprites;
        this.character = character;
        this.frames = [1, 2, 3, 4].map(i => poseName(character, `back_run_${i}`)).filter(name => SPRITES.has(name));
        this.poses = { jump: poseName(character, 'back_jump'), slide: poseName(character, 'back_slide'), shoot: poseName(character, 'back_shoot'), lean: poseName(character, 'back_lean') };
        if (this.sprite) {
            this.root.remove(this.sprite);
            this.sprite.material.dispose();
            this.sprite = null;
        }
        this.body.visible = true;
        if (!s.enabled || !s.hero || !this.frames.length)
            return;
        this.frame = this.frames[0];
        this.sprite = billboard(this.frame, s.heroHeight);
        this.sprite.rotation.y = s.heroAngle;
        this.sprite.position.z = .1;
        this.root.add(this.sprite);
        this.body.visible = false;
    }
    setFrame(name, height, mirror = false) {
        if (!SPRITES.has(name))
            name = this.frames[0];
        if (this.frame !== name) {
            this.frame = name;
            this.sprite.material.map = SPRITES.texture(name);
        }
        this.sprite.scale.set(height * SPRITES.aspect(name) * (mirror ? -1 : 1), height, 1);
    }
    reset() { this.dueling = false; this.x = 0; this.y = 0; this.previousX = 0; this.previousY = 0; this.lane = 0; this.vy = 0; this.slide = 0; this.buffer = ''; this.bufferTime = 0; this.invulnerable = 0; this.lives = CONFIG.player.lives; this.recoil = 0; this.phase = 0; this.root.visible = true; }
    command(command) {
        if (command === 'left' || command === 'right')
            this.lane = Math.max(-1, Math.min(1, this.lane + (command === 'left' ? -1 : 1)));
        else if (this.y < .001 && this.slide <= 0)
            this.perform(command);
        else {
            this.buffer = command;
            this.bufferTime = CONFIG.player.inputBuffer;
        }
    }
    perform(command) {
        if (command === 'jump') {
            this.vy = CONFIG.player.jumpVelocity;
            this.onJump?.();
        }
        if (command === 'slide')
            this.slide = CONFIG.player.slideDuration;
    }
    update(dt) {
        this.previousX = this.x;
        this.previousY = this.y;
        this.phase += this.dueling ? 0 : dt * 13;
        this.x += (this.lane * CONFIG.player.laneWidth - this.x) * (1 - Math.exp(-dt * 3 / CONFIG.player.laneTime));
        this.slide = Math.max(0, this.slide - dt);
        this.invulnerable = Math.max(0, this.invulnerable - dt);
        this.recoil = Math.max(0, this.recoil - dt);
        if (this.y > 0 || this.vy > 0) {
            this.vy -= CONFIG.player.gravity * dt;
            this.y += this.vy * dt;
            if (this.y <= 0) {
                this.y = 0;
                this.vy = 0;
                this.onLand?.();
            }
        }
        if (this.bufferTime > 0 && this.y === 0 && this.slide <= 0) {
            this.perform(this.buffer);
            this.bufferTime = 0;
        }
        this.bufferTime -= dt;
    }
    render(alpha) {
        this.root.position.set(this.previousX + (this.x - this.previousX) * alpha, this.previousY + (this.y - this.previousY) * alpha, CONFIG.player.z);
        this.root.rotation.z = -(this.lane * CONFIG.player.laneWidth - this.x) * .12;
        this.root.visible = this.invulnerable <= 0 || Math.floor(this.invulnerable * 12) % 2 === 0;
        if (this.sprite) {
            const s = CONFIG.sprites, drift = this.lane * CONFIG.player.laneWidth - this.x;
            if (this.slide > 0)
                this.setFrame(this.poses.slide, s.slideHeight);
            else if (this.y > .05)
                this.setFrame(this.poses.jump, s.heroHeight);
            else if (Math.abs(drift) > s.leanThreshold && SPRITES.has(this.poses.lean))
                this.setFrame(this.poses.lean, s.heroHeight, drift < 0); // il frame piega a destra: specchiato verso sinistra
            else if (this.dueling || this.recoil > CONFIG.weapon.recoil * .5)
                this.setFrame(this.poses.shoot, s.heroHeight);
            else
                this.setFrame(this.frames[Math.floor(this.phase / 13 * s.runFps) % this.frames.length], s.heroHeight);
            // Leggero molleggio della corsa, come il modello a blocchi.
            this.sprite.position.y = this.y === 0 && this.slide <= 0 ? Math.abs(Math.sin(this.phase)) * .05 : 0;
            return;
        }
        this.body.scale.y = this.slide > 0 ? .37 : 1;
        this.body.rotation.x = this.y > 0 ? -.15 : 0;
        this.body.position.y = this.y === 0 && this.slide <= 0 ? Math.abs(Math.sin(this.phase)) * .05 : 0;
        for (let i = 0; i < 4; i++)
            this.limbs[i].rotation.x = this.slide > 0 ? -1.2 : this.y > 0 ? (i < 2 ? -.5 : -.7) : this.dueling ? 0 : Math.sin(this.phase + (i % 2) * Math.PI) * (i < 2 ? .7 : .35);
        this.gun.position.z = -.42 + this.recoil * .7;
    }
    get height() { return this.slide > 0 ? CONFIG.player.slideHeight : CONFIG.player.height; }
}
