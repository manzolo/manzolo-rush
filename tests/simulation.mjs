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
check('raccolta reale: corsia propria e solo adiacenti con magnete', () => {
    for (const lane of [-1, 0, 1])
        for (const magnet of [false, true]) {
            g.start();
            g.pickups.reset();
            g.speed = 0;
            g.player.x = lane * CONFIG.player.laneWidth;
            g.powerups.magnet = magnet ? 10 : 0;
            for (const coinLane of [-1, 0, 1])
                g.pickups.coin(coinLane * CONFIG.player.laneWidth, .85, CONFIG.player.z);
            for (let i = 0; i < 60; i++)
                g.pickups.update(CONFIG.step, g);
            assert.equal(g.coins, magnet ? (lane === 0 ? 3 : 2) : 1);
            for (const c of g.pickups.coins.filter(c => c.active))
                assert.equal(c.x, c.lane * CONFIG.player.laneWidth, 'monete fuori portata non attirate');
        }
    g.start();
    g.pickups.reset();
    g.pickups.coin(0, .85, CONFIG.player.z);
    g.player.y = 2;
    g.pickups.update(0, g);
    assert.equal(g.coins, 0, 'saltare sopra una moneta non la raccoglie');
});
check('pausa: camera, scena, tempo e pannello restano fermi fino alla ripresa', () => {
    g.start();
    g.player.command('right');
    ticks(2);
    g.pause();
    const before = { camera: camera.position.toArray(), fov: camera.fov, player: g.player.root.position.toArray(), time: g.time };
    for (let i = 0; i < 90; i++) {
        g.update(CONFIG.step);
        g.render((i % 7) / 7, CONFIG.step);
        g.pause(true); // blur/visibility ripetuti non devono mai riattivare il gioco.
        assert.equal(g.state, 'pause');
        assert.ok(!node('#pause').classes.has('hidden'));
    }
    assert.deepEqual({ camera: camera.position.toArray(), fov: camera.fov, player: g.player.root.position.toArray(), time: g.time }, before);
    g.resume();
    ticks(1);
    assert.ok(g.time > before.time);
});
check('boss: preavviso (2 muri + corsia da saltare/scivolare), danno e premio', () => { g.start(); g.time = 90; g.update(CONFIG.step); assert.ok(g.boss.active); assert.equal(g.obstacles.pool.filter(o => o.active).length, 0); ticks(195); assert.ok(g.boss.warning > 0); assert.equal(g.boss.warnings.filter(m => m.visible).length, 3); assert.equal(g.boss.warnings.filter(m => m.material.color.getHex() === 0xff695c).length, 2); assert.ok(['low', 'high'].includes(g.boss.safeMove)); g.boss.damage(g.boss.hp, g); assert.equal(g.boss.active, false); assert.ok(g.reward >= CONFIG.boss.score); });
check('punti salto/scivolata solo dopo il passaggio, una volta, mai con urto o corsia diversa', () => {
    for (const [type, action, lane, double, expected] of [
        ['barrier', 'jump', 0, false, 15], ['bar', 'slide', 0, false, 10],
        ['barrier', 'jump', 0, true, 30], ['bar', 'slide', 0, true, 20],
        ['barrier', 'jump', 1, false, 0], ['bar', 'slide', 1, false, 0],
        ['barrier', null, 0, false, 0], ['bar', null, 0, false, 0],
    ]) {
        g.start();
        g.obstacles.reset();
        g.pickups.reset();
        g.spawner.timer = 100;
        g.powerups.double = double ? 10 : 0;
        const obstacle = g.obstacles.spawn(type, lane, -3);
        if (action)
            g.player.command(action);
        // Il bonus distanza ×2 è indipendente dal premio per l'ostacolo.
        ticks(8);
        assert.equal(Math.round(g.reward - (double ? g.distance : 0)), 0, 'premio anticipato');
        ticks(37);
        assert.equal(Math.round(g.reward - (double ? g.distance : 0)), expected, `${type}/${action}/${lane}`);
        ticks(20);
        assert.equal(Math.round(g.reward - (double ? g.distance : 0)), expected, 'premio duplicato');
        if (expected) {
            assert.equal(g.player.lives, 3);
            assert.ok(obstacle.passScored);
        }
        g.obstacles.remove(obstacle);
        const reused = g.obstacles.spawn(type, lane, -3);
        assert.equal(reused.passScored, false);
        assert.equal(reused.passAction, null);
    }
});
check('nemici mobili: nessun salto laterale, via di fuga libera, render interpolato', () => {
    g.start();
    g.enemies.reset();
    for (const type of ['soldier', 'runner', 'drone', 'tank'])
        for (const safeLane of [-1, 0, 1]) {
            const lane = safeLane === -1 ? 0 : -1;
            const e = g.enemies.spawn(type, lane, -60, safeLane);
            let moved = false;
            for (let i = 0; i < 360; i++) {
                const before = e.x;
                g.enemies.update(CONFIG.step, { speed: 0 });
                moved ||= Math.abs(e.x - lane * CONFIG.player.laneWidth) > .1;
                assert.ok(Math.abs(e.x - before) < .3, 'spostamento improvviso');
                assert.ok(Math.abs(e.x - safeLane * CONFIG.player.laneWidth) > e.hw + CONFIG.player.halfWidth, 'corsia libera invasa');
                g.enemies.render(.5);
                assert.ok(Math.abs(e.mesh.position.x - (e.previousX + e.x) / 2) < 1e-8);
            }
            if (type === 'drone' || ((type === 'soldier' || type === 'runner') && safeLane !== 0))
                assert.ok(moved, `${type} immobile`);
            e.z = -10;
            const lastLane = e.lane;
            for (let i = 0; i < 180; i++)
                g.enemies.update(CONFIG.step, { speed: 0 });
            assert.equal(e.lane, lastLane, 'cambio corsia troppo vicino al giocatore');
            g.enemies.reset();
        }
});
check('salvataggio una volta sola anche passando dal game over al menu', () => { g.start(); g.coins = 11; g.score = 900; const before = g.save.coins; g.bank(); g.bank(); assert.equal(g.save.coins, before + 11); });
check('plasma: core/scia/archi in pool, stessa potenza e pulizia dopo reset', () => {
    g.start();
    const w = g.weapons;
    w.equip('plasma', g);
    const count = scene.children.length;
    for (const x of [-3, 0, 3])
        w.fire(x, 1, -5, w.spec);
    w.render(.5);
    assert.equal(w.plasmaCore.count, 3);
    assert.equal(w.plasmaTrail.count, 3);
    assert.equal(w.plasmaArcs.count, 6);
    assert.equal(w.ballMesh.count, 0);
    assert.ok(w.pool.filter(b => b.active).every(b => b.damage === 3 && b.radius === .5 && b.pierce === 2));
    w.reset();
    w.render(1);
    assert.equal(w.plasmaCore.count + w.plasmaTrail.count + w.plasmaArcs.count, 0);
    assert.equal(scene.children.length, count);
});
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
                // I muri del boss bloccano la corsia come gli ostacoli; durante il preavviso il bot
                // va nella corsia libera appena i muri della salva precedente lo permettono.
                for (const entity of [...g.obstacles.pool, ...g.enemies.pool, ...g.enemies.shots.filter(shot => shot.wallKind === 'full')]) {
                    if (!entity.active || entity.z < -28 || entity.z > CONFIG.player.z + entity.hd + .5)
                        continue;
                    for (const lane of [-1, 0, 1])
                        if (Math.abs(lane * CONFIG.player.laneWidth - entity.x) < entity.hw + .5)
                            blocked.add(lane);
                }
                let options = [-1, 0, 1].filter(lane => !blocked.has(lane));
                if (g.boss.active && g.boss.warning > 0 && options.includes(g.boss.safeLane))
                    options = [g.boss.safeLane];
                assert.ok(options.length, `nessun corridoio al tick ${tick}, seed ${seed}`);
                options.sort((a, b) => Math.abs(a - g.player.lane) - Math.abs(b - g.player.lane));
                const lane = options[0];
                if (lane !== g.player.lane)
                    g.player.command(lane < g.player.lane ? 'left' : 'right');
                // Le sfere dei droni si possono sempre evitare in scivolata (i muri del boss no).
                // Barre arancioni del boss nella propria corsia: si salta la bassa, si scivola sotto l'alta.
                const bar = g.enemies.shots.find(shot => shot.active && (shot.wallKind === 'low' || shot.wallKind === 'high') && Math.abs(shot.x - g.player.x) < shot.hw + CONFIG.player.halfWidth && shot.z > -9 && shot.z < 1);
                if (bar?.wallKind === 'low' && g.player.y === 0 && g.player.slide <= 0)
                    g.player.command('jump');
                else if (bar?.wallKind === 'high' && g.player.slide < CONFIG.player.inputBuffer)
                    g.player.command('slide');
                else if (g.enemies.shots.some(shot => shot.active && !shot.wall && shot.z > -10 && shot.z < 6) && g.player.slide < CONFIG.player.inputBuffer)
                    g.player.command('slide');
                g.update(CONFIG.step);
                if (tick % 12 === 0)
                    g.render(.5, .2);
                assert.equal(g.state, 'play', `game over al tick ${tick}, seed ${seed}`);
            }
            // Senza danni le vite sono le 3 iniziali più quelle dei traguardi di punteggio.
            const expected = Math.min(CONFIG.player.maxLives, CONFIG.player.lives + Math.floor(g.score / CONFIG.player.extraLifeEvery));
            assert.equal(g.player.lives, expected, `danno nella corsa seed ${seed}`);
        }
    }
    finally {
        Math.random = originalRandom;
    }
});
console.log(`${checks} verifiche d’integrazione passate. Three r${THREE.REVISION}; nessun rendering GPU verificato.`);
