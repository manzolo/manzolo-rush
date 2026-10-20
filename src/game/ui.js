import * as THREE from 'three';
import { CONFIG } from './config.js';
import { POWER_LABELS } from './powerups.js';
import { SPRITES } from './sprites.js';
export class UI {
    constructor() {
        this.nodes = {};
        for (const id of ['score', 'coins', 'distance', 'lives', 'combo', 'heat-fill', 'heat-value', 'weapon-label', 'powerups', 'tutorial', 'announcement', 'fire', 'boss-hud', 'boss-fill', 'boss-percent', 'zone', 'damage-flash', 'next-life'])
            this.nodes[id] = document.getElementById(id);
        this.last = {};
        this.timer = 0;
        this.announcementTimer = 0;
        this.flyPool = [];
        for (let i = 0; i < 10; i++) {
            const el = document.createElement('span');
            el.className = 'coin-fly';
            el.textContent = '◈';
            document.body.appendChild(el);
            this.flyPool.push({ el, time: 0 });
        }
        this.popPool = [];
        this.popIndex = 0;
        this.popVector = new THREE.Vector3();
        for (let i = 0; i < 8; i++) {
            const el = document.createElement('span');
            el.className = 'score-pop';
            document.body.appendChild(el);
            this.popPool.push({ el, time: 0 });
        }
        this.powerNodes = {};
        for (const key in POWER_LABELS) {
            const el = document.createElement('span');
            if (el.dataset)
                el.dataset.power = key; // icona via CSS (assets/sprites/128)
            this.nodes.powerups.appendChild(el);
            this.powerNodes[key] = el;
        }
    }
    text(id, value) {
        if (this.last[id] !== value) {
            this.nodes[id].textContent = value;
            this.last[id] = value;
        }
    }
    // Punti che salgono dal nemico abbattuto: posizione 3D proiettata sullo schermo.
    scorePop(text, x, y, z, camera, combo = false) {
        const p = this.popPool[this.popIndex++ % this.popPool.length];
        if (!p || !camera)
            return;
        this.popVector.set(x, y, z).project(camera);
        p.el.textContent = text;
        p.el.className = combo ? 'score-pop combo' : 'score-pop';
        p.el.style.left = `${(this.popVector.x * .5 + .5) * innerWidth}px`;
        p.el.style.top = `${(-this.popVector.y * .5 + .5) * innerHeight}px`;
        p.time = .9;
        p.el.style.display = 'block';
    }
    announce(text) { this.nodes.announcement.textContent = text; this.announcementTimer = 2.1; }
    coinFly() {
        const f = this.flyPool.find(f => f.time <= 0);
        if (f) {
            f.time = .6;
            f.el.style.display = 'block';
        }
    }
    update(dt, g) {
        this.announcementTimer -= dt;
        if (this.announcementTimer <= 0)
            this.nodes.announcement.textContent = '';
        for (const p of this.popPool)
            if (p.time > 0) {
                p.time -= dt;
                const t = 1 - p.time / .9;
                p.el.style.transform = `translate(-50%,${-60 * t}px) scale(${1 + .25 * Math.min(1, t * 4) - .15 * t})`;
                p.el.style.opacity = t < .7 ? 1 : 1 - (t - .7) / .3;
                if (p.time <= 0)
                    p.el.style.display = 'none';
            }
        for (const f of this.flyPool)
            if (f.time > 0) {
                f.time -= dt;
                const t = 1 - f.time / .6;
                f.el.style.transform = `translate(${innerWidth * (.5 - .455 * t)}px,${innerHeight * .55 * (1 - t) + 155 * t}px) scale(${1 - t * .5})`;
                f.el.style.opacity = 1 - t * .7;
                if (f.time <= 0)
                    f.el.style.display = 'none';
            }
        this.timer -= dt;
        if (this.timer > 0)
            return;
        this.timer = .08;
        this.text('score', Math.floor(g.score).toString().padStart(6, '0'));
        this.text('coins', g.coins);
        this.text('distance', `${Math.floor(g.distance)} m`);
        this.text('lives', '♥ '.repeat(Math.max(0, g.player.lives)) + '♡ '.repeat(Math.max(0, CONFIG.player.lives - g.player.lives)));
        this.text('next-life', g.player.lives < CONFIG.player.maxLives && g.nextLifeAt ? `♥+ a ${g.nextLifeAt}` : '');
        this.text('combo', g.combo > 1 ? `COMBO ×${g.combo}` : '');
        this.nodes['heat-fill'].style.width = `${g.weapons.heat * 100}%`;
        this.nodes['heat-fill'].classList.toggle('hot', g.weapons.overheated);
        this.text('heat-value', `${Math.round(g.weapons.heat * 100)}%`);
        const w = g.weapons, spec = w.spec, gun = w.kind !== 'blaster';
        const mode = w.overheated ? 'RAFFREDDAMENTO…' : g.input.burst ? 'RAFFICA' : g.powerups.triple > 0 ? 'TRIPLO' : gun ? `${Math.ceil(w.gunTime)}s` : 'PRONTO';
        this.text('weapon-label', w.overheated ? mode : `${spec.label} / ${mode}`);
        if (this.lastGun !== w.kind) {
            this.lastGun = w.kind;
            const icon = document.getElementById('weapon-icon');
            if (icon) {
                const name = SPRITES.has(`weapon_${w.kind}`) ? `weapon_${w.kind}` : 'weapon_blaster';
                icon.src = SPRITES.url(name, true) || icon.src;
                icon.style.filter = gun && name === 'weapon_blaster' ? `drop-shadow(0 0 6px #${spec.color.toString(16).padStart(6, '0')})` : '';
            }
            icon?.parentNode?.classList?.toggle('gun', gun);
            this.nodes['heat-fill'].style.background = gun ? `#${spec.color.toString(16).padStart(6, '0')}` : '';
        }
        this.nodes.fire.classList.toggle('active', Boolean(g.input.firing));
        this.nodes.fire.classList.toggle('burst', Boolean(g.input.burst));
        for (const key in this.powerNodes) {
            const el = this.powerNodes[key], time = g.powerups[key];
            el.style.display = time > 0 ? 'block' : 'none';
            if (time > 0)
                el.textContent = `${POWER_LABELS[key]} ${Math.ceil(time)}s`;
        }
        const touch = matchMedia('(pointer:coarse)').matches;
        const t = g.time;
        this.text('tutorial', t < 4 ? (touch ? 'SWIPE ← → · Cambia corsia' : '← → / A D · Cambia corsia') : t < 8 ? (touch ? 'SWIPE ↑ · Salta le barriere' : '↑ / SPAZIO · Salta le barriere') : t < 12 ? (touch ? 'SWIPE ↓ · Scivola sotto le barre' : '↓ / S · Scivola sotto le barre') : t < 16 ? (touch ? 'TOCCA FUOCO · Fuoco automatico' : 'CTRL / J / CLICK · Tieni premuto per sparare') : t < 20 ? (touch ? 'TIENI FUOCO · Raffica, occhio al calore' : 'SHIFT / K · Raffica! Controlla il calore') : '');
        const boss = g.boss;
        this.nodes['boss-hud'].classList.toggle('hidden', !boss?.active);
        if (boss?.active) {
            this.nodes['boss-fill'].style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
            this.text('boss-percent', `${Math.ceil(Math.max(0, boss.hp / boss.maxHp) * 100)}%`);
        }
    }
    reset() {
        this.last = {};
        this.lastGun = null;
        this.timer = 0;
        this.announcementTimer = 0;
        this.nodes.announcement.textContent = '';
        for (const f of this.flyPool) {
            f.time = 0;
            f.el.style.display = 'none';
        }
        for (const p of this.popPool) {
            p.time = 0;
            p.el.style.display = 'none';
        }
    }
}
