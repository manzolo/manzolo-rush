import * as THREE from 'three';
import { CONFIG } from './config.js';
import { POWER_LABELS } from './powerups.js';
import { SPRITES } from './sprites.js';
export class UI {
    constructor() {
        this.nodes = {};
        for (const id of ['score', 'coins', 'distance', 'lives', 'combo', 'heat-fill', 'heat-value', 'weapon-label', 'powerups', 'tutorial', 'announcement', 'boss-hud', 'boss-fill', 'boss-percent', 'boss-label', 'boss-icon', 'time-hud', 'time-fill', 'time-value', 'zone', 'damage-flash', 'next-life'])
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
        this.shown = this.heat = this.bump = 0;
        this.lastGlow = this.lastScale = -1;
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
    // style: '' uccisione, 'move' salto/scivolata, 'big' boss e duelli (combo = uccisioni in serie).
    scorePop(text, x, y, z, camera, combo = false, style = '') {
        const p = this.popPool[this.popIndex++ % this.popPool.length];
        if (!p || !camera)
            return;
        this.popVector.set(x, y, z).project(camera);
        p.el.textContent = text;
        if (p.el.dataset)
            p.el.dataset.text = text; // copia per il bagliore nel ::after
        // Riassegnare la classe dopo un reflow fa ripartire l'esplosione di raggi del ::before.
        p.el.className = 'score-pop';
        void p.el.offsetWidth;
        p.el.className = `score-pop${combo ? ' combo' : ''}${style ? ` ${style}` : ''}`;
        p.tilt = (this.popIndex % 2 ? -1 : 1) * (6 + (this.popIndex * 7) % 5);
        // Più punti = scritta più grande; ogni uccisione alimenta il bagliore del punteggio.
        const points = parseInt(text.replace(/\D/g, ''), 10) || 0;
        p.size = Math.min(2.2, (style === 'big' ? 1.3 : .9) + points / 600);
        this.heat = Math.min(10, this.heat + .6 + points / 250);
        this.bump = Math.min(.5, this.bump + .14 + points / 4000);
        p.el.style.left = `${(this.popVector.x * .5 + .5) * innerWidth}px`;
        p.el.style.top = `${(-this.popVector.y * .5 + .5) * innerHeight}px`;
        p.time = .9;
        p.el.style.display = 'block';
    }
    // Punteggio "vivo": il numero rincorre il valore reale, pulsa a ogni guadagno e si accende
    // con un bagliore che cresce con le uccisioni ravvicinate (verde → oro → arancio) e poi si spegne.
    updateScore(dt, g) {
        const target = Math.floor(g.score);
        if (target < this.shown)
            this.shown = target;
        this.shown += (target - this.shown) * (1 - Math.exp(-dt * 9));
        if (target - this.shown < 1)
            this.shown = target;
        this.text('score', Math.floor(this.shown).toString().padStart(6, '0'));
        this.heat *= Math.exp(-dt * .45);
        this.bump *= Math.exp(-dt * 7);
        const el = this.nodes.score;
        if (!el?.style)
            return;
        const h = Math.min(1, this.heat / 6), glow = Math.round(h * 100) / 100, scale = Math.round((1 + this.bump * .45) * 1000) / 1000;
        if (glow !== this.lastGlow) {
            this.lastGlow = glow;
            const color = h < .5 ? `rgba(139,255,209,${.35 + h})` : h < .85 ? `rgba(255,211,109,${.4 + h * .6})` : `rgba(255,140,60,${.5 + h * .5})`;
            el.style.textShadow = glow > .02 ? `0 2px 0 #0009, 0 0 ${8 + h * 26}px ${color}, 0 0 ${h * 60}px ${color}` : '';
            el.style.color = h > .85 ? '#ffd9a0' : h > .5 ? '#ffeec2' : '';
        }
        if (scale !== this.lastScale) {
            this.lastScale = scale;
            el.style.transform = scale > 1.001 ? `scale(${scale})` : '';
        }
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
        this.updateScore(dt, g);
        this.announcementTimer -= dt;
        if (this.announcementTimer <= 0)
            this.nodes.announcement.textContent = '';
        for (const p of this.popPool)
            if (p.time > 0) {
                p.time -= dt;
                const t = 1 - p.time / .9;
                // Entrata "a schiaffo" con rimbalzo (easeOutBack), poi sale e si dissolve.
                const k = Math.min(1, t * 5), back = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
                const scale = (p.size || 1) * (.3 + .9 * back) * (1 - .12 * t);
                p.el.style.transform = `translate(-50%,-50%) translateY(${-80 * t * t - 18 * t}px) rotate(${(p.tilt || 0) * (1 - k)}deg) scale(${scale})`;
                p.el.style.opacity = t < .72 ? 1 : 1 - (t - .72) / .28;
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
        for (const key in this.powerNodes) {
            const el = this.powerNodes[key], time = g.powerups[key];
            el.style.display = time > 0 ? 'block' : 'none';
            if (time > 0)
                el.textContent = `${POWER_LABELS[key]} ${Math.ceil(time)}s`;
        }
        const touch = matchMedia('(pointer:coarse)').matches;
        const t = g.time;
        this.text('tutorial', g.save?.hints === false ? '' : g.encounter?.active ? (touch ? 'SCHIVA, SALTA, SCIVOLA · INSEGUI IL RIVALE E SPARA' : '← → ↑ ↓ SCHIVA · CTRL / J SPARA NELLA SUA CORSIA') : t < 4 ? (touch ? 'SWIPE ← → · Cambia corsia' : '← → / A D · Cambia corsia') : t < 8 ? (touch ? 'SWIPE ↑ · Salta le barriere' : '↑ / SPAZIO · Salta le barriere') : t < 12 ? (touch ? 'SWIPE ↓ · Scivola sotto le barre' : '↓ / S · Scivola sotto le barre') : t < 16 ? (touch ? 'TIENI IL DITO SULLO SCHERMO · Spara' : 'CTRL · Tieni premuto per sparare (anche J o click)') : t < 20 ? (touch ? 'DUE DITA TENUTE · Raffica (occhio al calore)' : 'SHIFT · Raffica! Occhio al calore (anche K)') : '');
        // Tempo: barra in alto al centro, nascosta (e ferma) durante boss e duelli.
        const timer = this.nodes['time-hud'];
        if (timer) {
            const battle = g.boss?.active || g.encounter?.active, left = Math.max(0, g.timeLeft ?? 0);
            timer.classList.toggle('hidden', !!battle);
            timer.classList.toggle('low', left < CONFIG.timer.warn);
            if (left > (this.lastTimeLeft ?? left) + .01) {
                // Moneta presa: la barra si illumina per un attimo.
                timer.classList.remove('gain');
                void timer.offsetWidth;
                timer.classList.add('gain');
            }
            this.lastTimeLeft = left;
            this.nodes['time-fill'].style.width = `${left / CONFIG.timer.max * 100}%`;
            this.text('time-value', left < 10 ? left.toFixed(1) : String(Math.ceil(left)));
        }
        const boss = g.encounter?.active ? g.encounter : g.boss;
        this.nodes['boss-hud'].classList.toggle('hidden', !boss?.active);
        if (boss?.active) {
            this.text('boss-label', boss.label);
            const iconName = g.encounter?.active ? boss.enemy.spriteName : boss.icon;
            if (this.lastBossIcon !== iconName) {
                this.lastBossIcon = iconName;
                const url = SPRITES.url(iconName, true);
                this.nodes['boss-icon'].style.display = url ? '' : 'none';
                if (url) this.nodes['boss-icon'].src = url;
            }
            this.nodes['boss-fill'].style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
            this.text('boss-percent', `${Math.ceil(Math.max(0, boss.hp / boss.maxHp) * 100)}%`);
        }
    }
    reset() {
        this.last = {};
        this.shown = this.heat = this.bump = 0;
        this.lastGlow = this.lastScale = -1;
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
