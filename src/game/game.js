import * as THREE from 'three';
import { CONFIG, THEMES } from './config.js';
import { STATES } from './states.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Obstacles } from './obstacles.js';
import { Spawner } from './spawner.js';
import { Pickups } from './powerups.js';
import { readSave, writeSave } from './storage.js';
import { UI } from './ui.js';
import { Weapons } from './weapons.js';
import { Enemies } from './enemies.js';
import { Boss } from './boss.js';
import { Audio } from './audio.js';
import { Effects } from './effects.js';
import { CHARACTERS, characterById, characterReady, poseName } from './characters.js';
import { SPRITES } from './sprites.js';
import { playerOverlap, bulletOverlap, obstaclePassBonus } from './collisions.js';
import { difficultyById } from './difficulty.js';
import { Encounter } from './encounter.js';
export class Game {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.world = new World(scene);
        this.player = new Player(scene);
        this.obstacles = new Obstacles(scene);
        this.spawner = new Spawner(this);
        this.weapons = new Weapons(scene);
        this.enemies = new Enemies(scene);
        this.pickups = new Pickups(scene);
        this.boss = new Boss(scene);
        this.encounter = new Encounter(scene);
        this.ui = new UI();
        this.powerups = { triple: 0, shield: 0, magnet: 0, double: 0 };
        this.effects = new Effects(scene, this.player);
        try {
            this.storage = localStorage;
        }
        catch {
            this.storage = null;
        }
        this.save = readSave(this.storage);
        this.difficulty = difficultyById(this.save.difficulty);
        this.audio = new Audio(this.save.audio, this.save.music, this.save.soundVolume, this.save.musicVolume);
        this.input = new Input(renderer.domElement, document.querySelector('#fire'), () => this.pause());
        this.state = STATES.MENU;
        this.audio.music('menu');
        this.time = this.distance = this.score = this.reward = this.coins = this.kills = 0;
        this.combo = this.comboTimer = this.shake = this.hitStop = this.damageFlash = 0;
        this.speed = CONFIG.speed.initial;
        this.cameraX = -5.3;
        this.lightColor = new THREE.Color();
        this.refreshSave();
        this.buildCharacterPicker();
        this.setCharacter(characterReady(this.save.character) ? this.save.character : 'manzolo', false);
        this.setDifficulty(this.save.difficulty, false);
        for (const radio of document.querySelectorAll?.('input[name="difficulty"]') || [])
            radio.onchange = () => this.setDifficulty(radio.value);
        this.player.onJump = () => this.audio.play('jump');
        this.player.onLand = () => {
            this.audio.play('land');
            this.effects.emit(this.player.x, .08, CONFIG.player.z, 0xc8b4a1, CONFIG.juice.landingParticles);
        };
        document.querySelector('#play').onclick = () => this.start();
        document.querySelector('#retry').onclick = () => this.start();
        document.querySelector('#resume').onclick = () => this.resume();
        document.querySelector('#pause-button').onclick = () => this.pause();
        for (const id of ['pause-menu', 'result-menu'])
            document.getElementById(id).onclick = () => this.menu();
        document.querySelector('#sound').onclick = () => {
            this.save.audio = !this.save.audio;
            if (this.save.audio && this.save.soundVolume === 0) {
                this.save.soundVolume = 1;
                this.audio.setVolume('sound', 1);
            }
            this.audio.setEnabled(this.save.audio);
            writeSave(this.storage, this.save);
            this.refreshSave();
        };
        document.querySelector('#music').onclick = () => {
            this.save.music = !this.save.music;
            if (this.save.music && this.save.musicVolume === 0) {
                this.save.musicVolume = 1;
                this.audio.setVolume('music', 1);
            }
            this.audio.setMusic(this.save.music);
            writeSave(this.storage, this.save);
            this.refreshSave();
        };
        for (const channel of ['music', 'sound']) {
            document.getElementById(`${channel}-volume`).oninput = event => {
                const volume = Number(event.target.value) / 100;
                this.save[`${channel}Volume`] = volume;
                // Alzare un cursore riattiva il canale, anche dopo il mute.
                const key = channel === 'music' ? 'music' : 'audio';
                this.save[key] = volume > 0;
                if (channel === 'music')
                    this.audio.setMusic(this.save[key]);
                else
                    this.audio.setEnabled(this.save[key]);
                this.audio.setVolume(channel, volume);
                writeSave(this.storage, this.save);
                this.refreshSave();
            };
        }
        const audioSettings = document.getElementById('audio-settings');
        document.addEventListener('pointerdown', event => {
            if (audioSettings.open && !audioSettings.contains(event.target))
                audioSettings.open = false;
        });
        audioSettings.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                audioSettings.open = false;
                audioSettings.querySelector('summary').focus();
            }
        });
        document.querySelector('#play').disabled = false;
        document.querySelector('#play-label').textContent = 'INIZIA LA CORSA';
        document.addEventListener('visibilitychange', () => {
            if (document.hidden)
                this.pause(true);
        });
        window.addEventListener('blur', () => this.pause(true));
    }
    setState(state) {
        this.state = state;
        this.input.clear();
        if (state === STATES.PLAY)
            document.activeElement?.blur?.();
        this.audio.music({ menu: 'menu', over: 'menu', play: 'run', pause: 'pause' }[state]);
        const panel = { menu: 'menu', pause: 'pause', over: 'gameover' }[state];
        for (const id of ['menu', 'pause', 'gameover', 'hud']) {
            document.getElementById(id).classList.toggle('hidden', id === 'hud' ? state !== STATES.PLAY : id !== panel);
        }
        document.querySelector('#pause-button').classList.toggle('hidden', state !== STATES.PLAY);
        document.body.classList.toggle('playing', state !== STATES.MENU);
        for (const fly of this.ui.flyPool)
            fly.el.style.display = 'none';
    }
    start() {
        this.encounter.reset();
        this.audio.unlock();
        this.runCharacter = this.player.character;
        this.difficulty = difficultyById(this.save.difficulty);
        this.player.reset();
        this.obstacles.reset();
        this.spawner.reset();
        this.weapons.reset();
        this.enemies.reset();
        this.pickups.reset();
        this.boss.reset();
        this.effects.reset();
        this.world.setTheme(0, true);
        this.ui.reset();
        this.time = this.distance = this.score = this.reward = this.coins = this.kills = 0;
        this.combo = this.comboTimer = this.shake = this.hitStop = this.damageFlash = 0;
        this.speed = CONFIG.speed.initial * this.difficulty.speed;
        this.banked = false;
        this.nextLifeAt = CONFIG.player.extraLifeEvery;
        for (const key in this.powerups)
            this.powerups[key] = 0;
        // Intro leggibile: monete subito, prima barriera dopo circa 4 secondi.
        for (let i = 0; i < CONFIG.intro.coinCount; i++)
            this.pickups.coin(0, .85, CONFIG.intro.firstCoinZ - i * CONFIG.spawn.coinSpacing);
        this.obstacles.spawn('barrier', 0, CONFIG.intro.barrierZ);
        this.obstacles.spawn('bar', -1, CONFIG.intro.barZ);
        this.setState(STATES.PLAY);
        this.ui.update(0, this);
    }
    menu() {
        this.bank();
        this.encounter.reset();
        this.setState(STATES.MENU);
        this.obstacles.reset();
        this.enemies.reset();
        this.weapons.reset();
        this.pickups.reset();
        this.boss.reset();
        this.player.reset();
        this.effects.reset();
        this.ui.reset();
        this.world.setTheme(0, true);
        this.ui.text('zone', '01 / SUNSET CITY');
    }
    pause(force = false) {
        if (this.state === STATES.PLAY)
            this.setState(STATES.PAUSE);
        else if (!force && this.state === STATES.PAUSE)
            this.resume();
    }
    resume() {
        if (this.state !== STATES.PAUSE)
            return;
        this.audio.unlock();
        this.setState(STATES.PLAY);
    }
    damage() {
        if (this.state !== STATES.PLAY || this.player.invulnerable > 0)
            return;
        if (this.powerups.shield > 0) {
            this.powerups.shield = 0;
            this.player.invulnerable = CONFIG.player.invulnerability;
            this.effects.emit(this.player.x, 1, CONFIG.player.z, 0x8bffd1, 20);
            this.effects.shieldPulse(true);
            this.audio.play('power');
            this.announce('SCUDO ASSORBITO');
            return;
        }
        this.player.lives--;
        this.player.invulnerable = CONFIG.player.invulnerability;
        this.combo = 0;
        this.shake = .28;
        this.damageFlash = .3;
        this.effects.burst(this.player.x, 1, CONFIG.player.z - .4, 1.7);
        this.audio.play('hurt');
        if (this.player.lives <= 0)
            this.gameOver();
    }
    gameOver() {
        this.encounter.reset();
        this.player.dueling = false;
        this.score = this.distance * CONFIG.bonuses.distanceScore + this.reward;
        this.bank();
        this.audio.play('over');
        document.querySelector('#final-score').textContent = Math.floor(this.score);
        document.querySelector('#final-distance').textContent = `${Math.floor(this.distance)} m`;
        document.querySelector('#final-coins').textContent = this.coins;
        document.querySelector('#final-kills').textContent = this.kills;
        this.setState(STATES.OVER);
    }
    update(dt) {
        if (this.state !== STATES.PLAY) {
            if (this.state === STATES.MENU) {
                this.world.update(dt, 3);
                this.player.update(dt);
            }
            return;
        }
        this.input.update(dt);
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            return;
        }
        while (this.input.queue.length)
            this.player.command(this.input.queue.shift());
        if (!this.encounter.active)
            this.time += dt;
        this.speed = this.encounter.active ? 0 : Math.min(CONFIG.speed.max, CONFIG.speed.initial + this.time * CONFIG.speed.acceleration) * this.difficulty.speed;
        this.distance += this.speed * dt;
        if (this.powerups.double > 0)
            this.reward += this.speed * dt * CONFIG.bonuses.distanceScore;
        this.comboTimer -= dt;
        if (this.comboTimer <= 0)
            this.combo = 0;
        for (const key in this.powerups)
            this.powerups[key] = Math.max(0, this.powerups[key] - dt);
        this.player.update(dt);
        this.world.update(dt, this.speed, this.encounter.active || this.boss.active);
        const theme = Math.floor(this.time / CONFIG.world.themeSeconds) % THEMES.length;
        if (this.world.theme !== theme) {
            this.world.setTheme(theme);
            this.announce(THEMES[theme].name);
        }
        this.ui.text('zone', `${String(theme + 1).padStart(2, '0')} / ${THEMES[theme].name} · ${this.difficulty.name.toUpperCase()}`);
        if (!this.encounter.active)
            this.boss.update(dt, this);
        this.encounter.update(dt, this);
        this.spawner.update(dt);
        this.obstacles.update(dt, this.speed);
        this.enemies.update(dt, this);
        this.weapons.update(dt, this);
        this.pickups.update(dt, this);
        this.combat();
        if (this.state !== STATES.PLAY)
            return;
        for (const obstacle of this.obstacles.pool) {
            if (obstacle.active && playerOverlap(this.player, obstacle)) {
                this.damage();
                this.obstacles.remove(obstacle);
                if (this.state !== STATES.PLAY)
                    return;
            }
            const bonus = obstaclePassBonus(this.player, obstacle) * this.multiplier;
            if (bonus > 0) {
                this.reward += bonus;
                this.announce(`${obstacle.passAction === 'jump' ? 'SALTO' : 'SCIVOLATA'} +${bonus}`);
                this.audio.play('coin');
                this.effects.emit(this.player.x, .4, CONFIG.player.z, 0x8bffd1, 6);
            }
        }
        this.effects.update(dt, this.speed);
        this.audio.update(dt, true);
        this.shake = Math.max(0, this.shake - dt * .9);
        this.damageFlash = Math.max(0, this.damageFlash - dt);
        this.score = this.distance * CONFIG.bonuses.distanceScore + this.reward;
        this.checkExtraLife();
        this.ui.update(dt, this);
    }
    combat() {
        for (const bullet of this.weapons.pool) {
            if (!bullet.active)
                continue;
            // Segmento spazzato, primo impatto: impedisce tunneling e colpi attraverso treni.
            let target = null, kind = '', nearest = -Infinity;
            for (const enemy of this.enemies.pool) {
                if (enemy.active && !bullet.hits.includes(enemy) && bulletOverlap(bullet, enemy) && enemy.z > nearest) {
                    target = enemy;
                    kind = 'enemy';
                    nearest = enemy.z;
                }
            }
            for (const obstacle of this.obstacles.pool) {
                if (obstacle.active && !bullet.hits.includes(obstacle) && bulletOverlap(bullet, obstacle) && obstacle.z > nearest) {
                    target = obstacle;
                    kind = 'obstacle';
                    nearest = obstacle.z;
                }
            }
            if (this.boss.active && !bullet.hits.includes(this.boss) && bulletOverlap(bullet, this.boss) && this.boss.z > nearest) {
                target = this.boss;
                kind = 'boss';
            }
            if (this.encounter.active && bulletOverlap(bullet, this.encounter)) {
                target = this.encounter;
                kind = 'encounter';
            }
            if (!target)
                continue;
            // Perforazione: plasma e laser attraversano nemici e casse, mai treni, barriere o boss.
            const solid = kind === 'boss' || kind === 'encounter' || (kind === 'obstacle' && target.type !== 'crate');
            if (bullet.pierce > 0 && !solid) {
                bullet.pierce--;
                bullet.hits.push(target);
            }
            else
                bullet.active = false;
            const damage = bullet.damage ?? CONFIG.weapon.damage;
            this.effects.emit(bullet.x, bullet.y, bullet.z, bullet.kind === 'blaster' ? 0xffdfa1 : bullet.color, bullet.kind === 'blaster' ? 3 : 6);
            this.shake = Math.max(this.shake, bullet.splash ? .12 : .025);
            if (bullet.kind !== 'blaster' && !bullet.splash)
                this.effects.burst(bullet.x, bullet.y, bullet.z, bullet.kind === 'plasma' ? 1.6 : bullet.kind === 'laser' ? 1.1 : .8, `impact_${bullet.kind}`);
            if (bullet.splash) {
                // Razzo: esplosione ad area su tutti i nemici e le casse vicini.
                this.effects.burst(bullet.x, bullet.y, bullet.z, bullet.splash * .9, 'impact_rocket');
                this.audio.play('explosion');
                const r2 = bullet.splash ** 2;
                for (const enemy of this.enemies.pool)
                    if (enemy.active && enemy !== target && (enemy.x - bullet.x) ** 2 + (enemy.z - bullet.z) ** 2 < r2)
                        this.hitEnemy(enemy, damage * .6);
                for (const obstacle of this.obstacles.pool)
                    if (obstacle.active && obstacle !== target && obstacle.type === 'crate' && (obstacle.x - bullet.x) ** 2 + (obstacle.z - bullet.z) ** 2 < r2)
                        this.hitCrate(obstacle, damage);
            }
            if (kind === 'encounter')
                this.encounter.damage(damage, this);
            else if (kind === 'boss')
                this.boss.damage(damage, this);
            else if (kind === 'enemy')
                this.hitEnemy(target, damage);
            else if (target.type === 'crate')
                this.hitCrate(target, damage);
        }
        for (const enemy of this.enemies.pool) {
            if (enemy.active && playerOverlap(this.player, enemy)) {
                this.encounter.start(enemy, this);
                if (this.encounter.active)
                    return;
            }
        }
        for (const bullet of this.enemies.shots) {
            if (bullet.active && bullet.delay <= 0 && playerOverlap(this.player, bullet)) {
                bullet.active = false;
                this.damage();
                if (this.state !== STATES.PLAY)
                    return;
            }
        }
    }
    hitEnemy(enemy, damage) {
        if (this.enemies.damage(enemy, damage)) {
            this.onKill(enemy);
            this.enemies.kill(enemy);
        }
    }
    hitCrate(crate, damage) {
        crate.hp -= damage;
        if (crate.hp > 0)
            return;
        this.obstacles.remove(crate);
        this.effects.emit(crate.x, .7, crate.z, 0xdba66e, 12);
        this.effects.burst(crate.x, .8, crate.z, 1.9);
        this.audio.play('explosion');
        // Le casse lasciano un'arma o un bonus.
        const roll = Math.random();
        if (roll < CONFIG.guns.crateDrop)
            this.pickups.gun(crate.x, crate.z);
        else if (roll < CONFIG.guns.crateDrop + CONFIG.spawn.crateDropChance)
            this.pickups.power(crate.x, crate.z);
    }
    get multiplier() { return this.powerups.double > 0 ? 2 : 1; }
    onKill(enemy) {
        this.kills++;
        this.combo = Math.min(CONFIG.bonuses.maxCombo, this.combo + 1);
        this.comboTimer = CONFIG.bonuses.comboWindow;
        const points = CONFIG.enemies[enemy.type].score * Math.max(1, this.combo) * this.multiplier;
        this.reward += points;
        this.ui.scorePop(`+${points}`, enemy.x, enemy.type === 'drone' ? 2.6 : enemy.type === 'tank' ? 2.9 : 2.4, enemy.z, this.camera, this.combo > 1);
        this.effects.emit(enemy.x, 1, enemy.z, 0xffa46e, CONFIG.juice.killParticles);
        this.effects.burst(enemy.x, enemy.type === 'drone' ? 1.5 : 1, enemy.z, enemy.type === 'tank' ? 3.2 : 2.3);
        this.shake = CONFIG.juice.shake;
        this.hitStop = CONFIG.juice.hitStop;
        this.audio.play('explosion');
    }
    // Traguardi di punteggio: ogni CONFIG.player.extraLifeEvery punti un cuore in più (oltre i 3 iniziali).
    checkExtraLife() {
        while (this.score >= this.nextLifeAt) {
            this.nextLifeAt += CONFIG.player.extraLifeEvery;
            if (this.player.lives < CONFIG.player.maxLives) {
                this.player.lives++;
                this.announce('♥ VITA EXTRA!');
                this.audio.play('power');
                this.effects.emit(this.player.x, 1.4, CONFIG.player.z, 0xff7263, 18);
            }
            else
                this.announce(`TRAGUARDO ${Math.floor(this.nextLifeAt - CONFIG.player.extraLifeEvery)}`);
        }
    }
    // Schede del menu: ritratto + nome; quelle senza sprite restano disattivate ("presto").
    buildCharacterPicker() {
        const box = document.getElementById('characters');
        if (!box?.appendChild || !document.createElement)
            return;
        this.characterButtons = {};
        for (const c of CHARACTERS) {
            const ready = characterReady(c.id);
            const button = document.createElement('button');
            button.className = 'character';
            button.disabled = !ready;
            button.setAttribute?.('role', 'radio');
            button.title = ready ? c.name : `${c.name} · presto`;
            const url = SPRITES.url(poseName(c.id, 'portrait'), true);
            button.innerHTML = `${url ? `<img src="${url}" alt="">` : '<i>?</i>'}<span>${c.name}</span>${ready ? '' : '<small>presto</small>'}`;
            button.onclick = () => this.setCharacter(c.id);
            box.appendChild(button);
            this.characterButtons[c.id] = button;
        }
    }
    setCharacter(id, save = true) {
        const c = characterById(id);
        this.player.setupSprite(c.id);
        this.save.character = c.id;
        if (save)
            writeSave(this.storage, this.save);
        const name = document.getElementById('hero-name');
        if (name)
            name.textContent = c.name.toUpperCase();
        for (const img of document.querySelectorAll?.('[data-pose]') || []) {
            const url = SPRITES.url(poseName(c.id, img.dataset.pose), 'small' in img.dataset);
            if (url) {
                img.src = url;
                img.style.visibility = '';
            }
        }
        for (const [cid, button] of Object.entries(this.characterButtons || {})) {
            button.classList.toggle('selected', cid === c.id);
            button.setAttribute?.('aria-checked', String(cid === c.id));
        }
    }
    setDifficulty(id, save = true) {
        if (this.state !== STATES.MENU)
            return;
        this.difficulty = difficultyById(id);
        this.save.difficulty = this.difficulty.id;
        for (const radio of document.querySelectorAll?.('input[name="difficulty"]') || [])
            radio.checked = radio.value === this.difficulty.id;
        document.getElementById('difficulty-hint').textContent = this.difficulty.hint;
        if (save)
            writeSave(this.storage, this.save);
    }
    announce(text) { this.ui.announce(text); }
    refreshSave() {
        document.querySelector('#menu-best').textContent = Math.floor(this.save.best).toString().padStart(6, '0');
        const holder = CHARACTERS.find(c => c.id === this.save.bestCharacter);
        const level = this.save.bestDifficulty ? ` · ${difficultyById(this.save.bestDifficulty).name.toUpperCase()}` : '';
        document.querySelector('#menu-best-character').textContent = this.save.best > 0 ? (holder ? `${holder.name.toUpperCase()}${level}` : 'PERSONAGGIO NON REGISTRATO') : 'LA PROSSIMA CORSA È TUA';
        document.querySelector('#menu-coins').textContent = this.save.coins;
        const toggle = (id, on, onIcon, offIcon, label) => {
            const button = document.querySelector(id);
            button.textContent = on ? onIcon : offIcon;
            button.style.opacity = on ? 1 : .45;
            button.setAttribute('aria-pressed', String(on));
            button.title = `${label} ${on ? 'attiva' : 'disattivata'}`;
        };
        toggle('#sound', this.save.audio, '🔊', '🔇', 'Effetti:');
        toggle('#music', this.save.music, '♫', '♪', 'Musica:');
        for (const channel of ['music', 'sound']) {
            const volume = Math.round(this.save[`${channel}Volume`] * 100);
            const on = channel === 'music' ? this.save.music : this.save.audio;
            document.getElementById(`${channel}-volume`).value = volume;
            document.getElementById(`${channel}-volume-value`).textContent = on ? `${volume}%` : 'Muto';
        }
    }
    bank() {
        if (this.banked)
            return;
        this.banked = true;
        const best = Math.floor(this.score) > this.save.best;
        this.save.best = Math.max(this.save.best, Math.floor(this.score));
        if (best) {
            this.save.bestCharacter = this.runCharacter || this.player.character;
            this.save.bestDifficulty = this.difficulty.id;
        }
        this.save.coins += this.coins;
        writeSave(this.storage, this.save);
        this.refreshSave();
        document.querySelector('#result-label').textContent = best ? `NUOVO RECORD CON ${characterById(this.save.bestCharacter).name.toUpperCase()}!` : 'UNA CORSA. UN’ALTRA STORIA.';
    }
    render(alpha, dt) {
        // In pausa conserva esattamente l'ultimo fotogramma, incluse camera e luci.
        // Ridisegna solo per mantenere valido il canvas anche dopo un resize.
        if (this.state === STATES.PAUSE) {
            this.ui.nodes['damage-flash'].style.opacity = 0;
            this.renderer.render(this.scene, this.camera);
            return;
        }
        if (this.state === STATES.PAUSE || this.state === STATES.OVER || this.hitStop > 0)
            alpha = 1;
        this.player.render(alpha);
        // Nel menu il protagonista è già in primo piano nell'interfaccia: niente doppione sulla strada.
        if (this.state === STATES.MENU)
            this.player.root.visible = false;
        this.weapons.render(alpha);
        this.enemies.render(alpha);
        this.encounter.render();
        this.boss.render(alpha);
        this.pickups.render(alpha, this.speed);
        this.effects.render(this);
        const menu = this.state === STATES.MENU;
        const offset = (alpha - 1) * (menu ? 3 : this.speed) * CONFIG.step;
        this.world.render(alpha, menu ? 3 : this.speed);
        for (const obstacle of this.obstacles.pool)
            if (obstacle.active)
                obstacle.mesh.position.z = obstacle.z + offset;
        const portrait = this.camera.aspect < .85;
        const targetX = menu ? (portrait ? -4 : -5.3) : this.player.x * .28;
        this.cameraX += (targetX - this.cameraX) * (1 - Math.exp(-dt * 3));
        const shake = this.state === STATES.PLAY ? this.shake : 0;
        const cameraHeight = menu ? (portrait ? 6 : 5.2) : (portrait ? 7.4 : 5.6);
        const cameraDepth = menu ? (portrait ? 14 : 11) : (portrait ? 18 : 13);
        this.camera.position.set(this.cameraX + (Math.random() - .5) * shake, cameraHeight + (Math.random() - .5) * shake, cameraDepth);
        this.camera.lookAt(menu ? 1.8 : this.player.x * .2, 1, -23);
        const fov = menu ? 57 : (portrait ? 62 : 58) + (this.encounter.active ? 0 : this.speed - CONFIG.speed.initial) * .65;
        if (Math.abs(this.camera.fov - fov) > .01) {
            this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 3));
            this.camera.updateProjectionMatrix();
        }
        const heat = this.world.inferno.strength;
        if (this.sunlight)
            this.sunlight.color.lerp(this.lightColor.set(THEMES[this.world.theme].sun).lerp(this.world.inferno.palette.sun, heat), 1 - Math.exp(-dt * 2));
        if (this.ambientLight) {
            this.ambientLight.intensity = 2 - heat * .9;
            this.ambientLight.color.set(0xffffff).lerp(this.world.inferno.palette.building, heat * .45);
        }
        this.ui.nodes['damage-flash'].style.opacity = this.state === STATES.PLAY ? this.damageFlash * 2 : 0;
        this.renderer.render(this.scene, this.camera);
    }
}
