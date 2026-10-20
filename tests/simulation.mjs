// Test d’integrazione senza GPU: usa Three reale, un DOM minimo e renderer fittizio.
// THREE_MODULE=/percorso/three.module.js node tests/simulation.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
if (!process.env.THREE_MODULE)
    throw new Error('Imposta THREE_MODULE sul modulo locale di Three.js 0.169.0.');
register('./three-loader.mjs', import.meta.url);
const THREE = await import('three');
const nodes = new Map();
class Node {
    constructor() {
        this.style = {};
        this.children = [];
        this.textContent = '';
        this.listeners = {};
        this.classes = new Set();
        this.classList = { toggle: (k, enabled) => {
                if (enabled)
                    this.classes.add(k);
                else
                    this.classes.delete(k);
            }, add: k => this.classes.add(k), remove: k => this.classes.delete(k) };
    }
    setAttribute() { }
    appendChild(child) { this.children.push(child); }
    addEventListener(type, fn) { this.listeners[type] = fn; }
    setPointerCapture() { }
    getContext() { return { fillRect() { }, createRadialGradient() { return { addColorStop() { } }; } }; }
}
const node = id => {
    if (!nodes.has(id))
        nodes.set(id, new Node());
    return nodes.get(id);
};
globalThis.document = { querySelector: id => node(id), getElementById: id => node('#' + id), body: new Node(), createElement: () => new Node(), addEventListener() { } };
globalThis.window = { addEventListener() { } };
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
globalThis.localStorage = { data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, value) { this.data[key] = value; } };
globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { Game } = await import('../src/game/game.js');
const { CONFIG } = await import('../src/game/config.js');
const { playerOverlap } = await import('../src/game/collisions.js');
const renderer = { domElement: new Node(), render(scene) { scene.updateMatrixWorld(); } };
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(58, 1.6, .1, 250), g = new Game(renderer, scene, camera);
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('OK', name); }
function ticks(n) {
    for (let i = 0; i < n; i++) {
        g.update(CONFIG.step);
        g.render(.5, CONFIG.step);
    }
}
check('creazione scena e menu', () => { assert.equal(g.state, 'menu'); assert.ok(g.world.batches.length < 15); g.render(1, 1 / 60); });
g.start();
check('cambio corsia entro 150 ms', () => { g.player.command('right'); ticks(9); assert.ok(Math.abs(g.player.x - 3) < .2); });
check('salto e input buffer all’atterraggio', () => { g.player.command('jump'); ticks(44); assert.ok(g.player.y > 0); g.player.command('jump'); ticks(5); assert.ok(g.player.vy > 0); assert.ok(g.player.y > 0); });
check('scivolata e ritorno altezza', () => { ticks(55); g.player.command('slide'); assert.ok(g.player.height < 1); ticks(43); assert.equal(g.player.height, CONFIG.player.height); });
check('pausa non avanza il tempo e azzera fuoco', () => { g.input.auto = true; g.pause(); const time = g.time; ticks(60); assert.equal(g.time, time); assert.equal(g.input.firing, false); g.resume(); assert.equal(g.state, 'play'); });
check('raffica surriscalda, blocca e recupera', () => { g.start(); g.obstacles.reset(); g.spawner.timer = 100; g.input.keys.add('KeyK'); ticks(95); assert.ok(g.weapons.overheated); g.input.clear(); ticks(240); assert.ok(!g.weapons.overheated); assert.ok(g.weapons.heat < .1); });
check('colpi distruggono soldati e casse, combo premia uccisioni', () => { g.start(); g.obstacles.reset(); g.spawner.timer = 100; g.enemies.spawn('soldier', 0, -5, 1); g.input.auto = true; ticks(35); assert.ok(g.kills >= 1); assert.ok(g.reward >= 100); const before = g.kills; g.enemies.spawn('soldier', 0, -5, 1); ticks(35); assert.ok(g.kills > before); assert.ok(g.combo >= 2); const crate = g.obstacles.spawn('crate', 0, -8); ticks(40); assert.ok(!crate.active); });
check('scudo assorbe un colpo, tre vite e retry pulito', () => {
    g.start();
    g.powerups.shield = 5;
    g.damage();
    assert.equal(g.player.lives, 3);
    assert.equal(g.powerups.shield, 0);
    for (let i = 0; i < 3; i++) {
        g.player.invulnerable = 0;
        g.damage();
    }
    assert.equal(g.state, 'over');
    g.start();
    assert.equal(g.player.lives, 3);
    assert.equal(g.time, 0);
    assert.equal(g.boss.active, false);
});
check('bonus e monete raccolti', () => { g.start(); g.pickups.reset(); g.pickups.coin(0, .8, 2.8); g.pickups.power(0, 2.8, 'triple'); g.update(CONFIG.step); assert.equal(g.coins, 1); assert.ok(g.powerups.triple > 0); });
check('boss: preavviso, corridoio libero, danno e premio', () => { g.start(); g.time = 90; g.update(CONFIG.step); assert.ok(g.boss.active); assert.equal(g.obstacles.pool.filter(o => o.active).length, 0); ticks(195); assert.ok(g.boss.warning > 0); assert.equal(g.boss.warnings.filter(m => m.visible).length, 2); g.boss.damage(g.boss.hp, g); assert.equal(g.boss.active, false); assert.ok(g.reward >= CONFIG.boss.score); });
check('salvataggio una volta sola anche passando dal game over al menu', () => { g.start(); g.coins = 11; g.score = 900; const before = g.save.coins; g.bank(); g.bank(); assert.equal(g.save.coins, before + 11); });
check('simulazione 3 minuti: pool stabili, temi, due boss, valori finiti', () => {
    g.start();
    g.input.auto = true;
    const objectCount = scene.children.length;
    const pools = [g.obstacles.pool.length, g.enemies.pool.length, g.pickups.coins.length, g.effects.pool.length];
    const themes = new Set();
    let bosses = 0, previous = false;
    for (let i = 0; i < 60 * 184; i++) {
        // Invulnerabilità solo per misurare il ciclo lungo; non dimostra la sopravvivenza.
        g.player.invulnerable = 2;
        g.update(CONFIG.step);
        if (i % 6 === 0)
            g.render(.5, .1);
        themes.add(g.world.theme);
        if (g.boss.active && !previous)
            bosses++;
        previous = g.boss.active;
        assert.ok(Number.isFinite(g.score));
        assert.ok(g.speed <= CONFIG.speed.max);
    }
    assert.equal(g.state, 'play');
    assert.equal(themes.size, 3);
    assert.equal(bosses, 2);
    assert.equal(scene.children.length, objectCount);
    assert.deepEqual([g.obstacles.pool.length, g.enemies.pool.length, g.pickups.coins.length, g.effects.pool.length], pools);
    console.log({ time: g.time, distance: Math.floor(g.distance), score: Math.floor(g.score), bosses, sceneObjects: objectCount, worldBatches: g.world.batches.length });
});
check('touch simulato: swipe, toggle fuoco e pressione prolungata', () => {
    g.start();
    const canvas = renderer.domElement, fire = node('#fire');
    const event = { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 300, preventDefault() { } };
    canvas.listeners.pointerdown(event);
    canvas.listeners.pointermove({ ...event, clientX: 130 });
    g.update(CONFIG.step);
    assert.equal(g.player.lane, -1);
    canvas.listeners.pointerdown(event);
    canvas.listeners.pointermove({ ...event, clientY: 230 });
    g.update(CONFIG.step);
    assert.ok(g.player.y > 0);
    fire.listeners.pointerdown(event);
    fire.listeners.pointerup(event);
    assert.ok(g.input.auto);
    fire.listeners.pointerdown(event);
    fire.listeners.pointerup(event);
    assert.ok(!g.input.auto);
    fire.listeners.pointerdown(event);
    g.input.update(.3);
    assert.ok(g.input.burst);
    fire.listeners.pointerup(event);
    assert.ok(!g.input.burst && !g.input.auto);
});
check('camera verticale mantiene entrambe le corsie laterali visibili', () => {
    g.start();
    camera.aspect = 390 / 844;
    camera.updateProjectionMatrix();
    for (const lane of [-1, 1]) {
        g.player.x = g.player.previousX = lane * CONFIG.player.laneWidth;
        g.player.lane = lane;
        for (let i = 0; i < 120; i++)
            g.render(1, CONFIG.step);
        camera.updateMatrixWorld();
        const position = new THREE.Vector3(g.player.x, 1, CONFIG.player.z).project(camera);
        assert.ok(Math.abs(position.x) < .9, `corsia ${lane}: ${position.x}`);
        assert.ok(Math.abs(position.y) < .9);
    }
    camera.aspect = 1.6;
    camera.updateProjectionMatrix();
});
check('tre corse da 3 minuti: il corridoio è percorribile senza invulnerabilità artificiale', () => {
    const originalRandom = Math.random;
    try {
        for (const seed of [17, 259, 4096]) {
            let randomState = seed;
            Math.random = () => { randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0; return randomState / 4294967296; };
            g.start();
            for (let tick = 0; tick < 60 * 184; tick++) {
                const blocked = new Set();
                for (const entity of [...g.obstacles.pool, ...g.enemies.pool]) {
                    if (!entity.active || entity.z < -28 || entity.z > CONFIG.player.z + entity.hd + .5)
                        continue;
                    for (const lane of [-1, 0, 1])
                        if (Math.abs(lane * CONFIG.player.laneWidth - entity.x) < entity.hw + .5)
                            blocked.add(lane);
                }
                const options = [-1, 0, 1].filter(lane => !blocked.has(lane));
                assert.ok(options.length, `nessun corridoio al tick ${tick}, seed ${seed}`);
                options.sort((a, b) => Math.abs(a - g.player.lane) - Math.abs(b - g.player.lane));
                const lane = options[0];
                if (lane !== g.player.lane)
                    g.player.command(lane < g.player.lane ? 'left' : 'right');
                // Le sfere ostili si possono sempre evitare in scivolata.
                if (g.enemies.shots.some(shot => shot.active && shot.z > -10 && shot.z < 6) && g.player.slide < CONFIG.player.inputBuffer)
                    g.player.command('slide');
                g.update(CONFIG.step);
                if (tick % 12 === 0)
                    g.render(.5, .2);
                assert.equal(g.state, 'play', `game over al tick ${tick}, seed ${seed}`);
            }
            assert.equal(g.player.lives, CONFIG.player.lives, `danno nella corsa seed ${seed}`);
        }
    }
    finally {
        Math.random = originalRandom;
    }
});
console.log(`${checks} verifiche d’integrazione passate. Three r${THREE.REVISION}; nessun rendering GPU verificato.`);
