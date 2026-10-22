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
    getContext() { return { fillRect() { }, beginPath() { }, closePath() { }, arc() { }, stroke() { }, fillText() { }, moveTo() { }, lineTo() { }, fill() { }, createRadialGradient() { return { addColorStop() { } }; }, createLinearGradient() { return { addColorStop() { } }; } }; }
}
const node = id => {
    if (!nodes.has(id))
        nodes.set(id, new Node());
    return nodes.get(id);
};
globalThis.document = { querySelector: id => node(id), getElementById: id => node('#' + id), body: new Node(), createElement: () => new Node(), addEventListener() { } };
globalThis.window = { listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } };
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
globalThis.localStorage = { data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, value) { this.data[key] = value; } };
globalThis.matchMedia = () => ({ matches: false });
globalThis.innerWidth = 1440;
globalThis.innerHeight = 900;
const { Game } = await import('../src/game/game.js');
const { CONFIG } = await import('../src/game/config.js');
const { THEMES, SCENERY_ROUTE } = await import('../src/game/scenery.js');
const { World } = await import('../src/game/world.js');
const { BOSSES, bossFrames } = await import('../src/game/bosses.js');
const { SPRITES } = await import('../src/game/sprites.js');
const { playerOverlap } = await import('../src/game/collisions.js');
const renderer = { domElement: new Node(), calls: 0, render(scene) { this.calls++; scene.updateMatrixWorld(); } };
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
check('sei scenari: rotazione ripetibile, sagome naturali, ritorno alla città e pool stabili', () => {
    g.start();
    g.boss.nextTime = Infinity;
    g.spawner.timer = Infinity;
    g.obstacles.reset();
    const objectCount = scene.children.length;
    for (let step = 0; step < 12; step++) {
        g.time = step * CONFIG.world.themeSeconds;
        g.timeLeft = CONFIG.timer.max;
        g.update(CONFIG.step);
        const theme = THEMES[SCENERY_ROUTE[step % 6]];
        assert.equal(g.world.target, theme);
        assert.equal(scene.children.length, objectCount);
        const visible = g.world.landscape.layers.filter(l => l.mesh.visible);
        assert.equal(visible.length, theme.natural ? 2 : 0);
        assert.ok(visible.every(l => l.theme === theme.id));
        for (const batch of g.world.batches)
            for (const item of batch.items) {
                assert.ok(item.matrix.elements.every(Number.isFinite));
                if (item.role === 'streetlight') assert.equal(item.matrix.elements[5] > 0, theme.streetlights);
                if (item.building) assert.equal(item.matrix.elements[5] > 0, theme.buildings);
            }
        g.world.render(.5, g.speed);
        assert.equal(g.world.landscape.layers[0].mesh.position.z, g.world.batches[0].mesh.position.z);
    }
    g.start();
    g.update(CONFIG.step);
    assert.equal(g.world.target.id, 'city');
    assert.ok(g.world.landscape.layers.every(l => !l.mesh.visible));
    g.menu();
});
check('scenari: texture mancanti isolate al tema, props naturali fuori strada e nessuna crescita', () => {
    const original = SPRITES.textures;
    const names = THEMES.filter(t => t.natural).flatMap(t => [...t.textures, ...t.props.map(([name]) => name)]);
    SPRITES.textures = new Map(names.filter(name => name !== 'volcano_ground').map(name => [name, new THREE.Texture()]));
    try {
        const localScene = new THREE.Scene(), world = new World(localScene);
        const objects = localScene.children.length;
        for (let cycle = 0; cycle < 3; cycle++)
            for (const index of [3, 4, 5, 0]) {
                world.setTheme(index, true);
                world.update(CONFIG.step, 15);
                assert.equal(world.textured, index === 3 || index === 5);
                assert.equal(Boolean(world.roadMaterial.map), world.textured);
                assert.equal(localScene.children.length, objects);
                const active = world.props.filter(p => p.spriteName);
                assert.equal(active.length, index === 0 ? 0 : CONFIG.world.chunks * 4);
                for (const p of active) {
                    assert.ok(world.target.props.some(([name]) => name === p.spriteName));
                    assert.ok(Math.abs(p.mesh.position.x) - p.mesh.scale.x / 2 >= 5.5);
                }
                assert.equal([...world.propBatches.values()].reduce((n, m) => n + m.count, 0), active.length);
            }
    } finally {
        for (const texture of SPRITES.textures.values()) texture.dispose();
        SPRITES.textures = original;
    }
});
check('scenario: matrici aggiornate solo al riciclo, scorrimento e interpolazione allineati in tutti i temi', () => {
    const original = SPRITES.textures;
    const names = THEMES.flatMap(t => t.props.map(([name]) => name));
    SPRITES.textures = new Map(names.map(name => [name, new THREE.Texture()]));
    try {
        const world = new World(new THREE.Scene()), matrix = new THREE.Matrix4();
        for (let theme = 0; theme < THEMES.length; theme++) {
            world.setTheme(theme, true);
            const batch = world.batches[0], version = batch.mesh.instanceMatrix.version;
            for (let step = 0; step < 300; step++) {
                const speed = step < 120 ? 45 : step < 180 ? 0 : 18;
                const before = batch.mesh.instanceMatrix.version;
                world.update(CONFIG.step, speed);
                if (speed === 0) assert.equal(batch.mesh.instanceMatrix.version, before);
                for (const alpha of [0, .5, 1]) {
                    world.render(alpha, speed);
                    const offset = (alpha - 1) * speed * CONFIG.step;
                    const near = (a, b) => assert.ok(Math.abs(a - b) < .0001, `${a} != ${b}`);
                    for (const b of world.batches)
                        b.items.forEach((item, i) => {
                            b.mesh.getMatrixAt(i, matrix);
                            near(matrix.elements[14] + b.mesh.position.z, item.local.z + item.chunk.position.z + offset);
                        });
                    const indices = new Map();
                    for (const p of world.props) {
                        if (!p.spriteName) continue;
                        const mesh = world.propBatches.get(p.spriteName), i = indices.get(mesh) || 0;
                        mesh.getMatrixAt(i, matrix);
                        indices.set(mesh, i + 1);
                        near(matrix.elements[14] + mesh.position.z, p.localZ + p.chunk.position.z + offset);
                        near(matrix.elements[12], p.mesh.position.x);
                    }
                    for (const layer of world.landscape.layers) {
                        if (!layer.mesh.visible) continue;
                        layer.items.forEach((item, i) => {
                            layer.mesh.getMatrixAt(i, matrix);
                            near(matrix.elements[14] + layer.mesh.position.z, item.localZ + item.chunk.position.z + offset);
                        });
                    }
                }
            }
            const uploads = batch.mesh.instanceMatrix.version - version;
            assert.ok(uploads > 0 && uploads < 10, `${uploads} upload in 300 passi`);
        }
    } finally {
        for (const texture of SPRITES.textures.values()) texture.dispose();
        SPRITES.textures = original;
    }
});
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
    const calls = renderer.calls;
    for (let i = 0; i < 90; i++) {
        g.update(CONFIG.step);
        g.render((i % 7) / 7, CONFIG.step);
        g.pause(true); // blur/visibility ripetuti non devono mai riattivare il gioco.
        assert.equal(g.state, 'pause');
        assert.ok(!node('#pause').classes.has('hidden'));
    }
    assert.deepEqual({ camera: camera.position.toArray(), fov: camera.fov, player: g.player.root.position.toArray(), time: g.time }, before);
    assert.equal(renderer.calls, calls, 'nessun rendering WebGL durante i frame in pausa');
    camera.aspect = .5;
    camera.updateProjectionMatrix();
    g.render(1, 0, true); // ridimensionamento del canvas: un solo ridisegno esplicito.
    assert.equal(renderer.calls, calls + 1);
    assert.deepEqual(camera.position.toArray(), before.camera);
    assert.deepEqual(g.player.root.position.toArray(), before.player);
    camera.aspect = 1.6;
    camera.updateProjectionMatrix();
    g.resume();
    ticks(1);
    assert.ok(g.time > before.time);
    assert.equal(renderer.calls, calls + 2);
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
check('scudo: raccolta, bagliore, impatto, scadenza e reset', () => {
    g.start();
    g.pickups.reset();
    g.pickups.power(0, CONFIG.player.z, 'shield');
    g.pickups.update(0, g);
    g.render(1, 0);
    assert.ok(g.effects.shield.visible);
    assert.ok(g.effects.shieldWave.visible);
    assert.equal(g.effects.shieldFlash, 1);
    g.damage();
    g.render(1, 0);
    assert.ok(!g.effects.shield.visible);
    assert.ok(g.effects.shieldWave.visible);
    assert.equal(g.player.lives, CONFIG.player.lives);
    g.effects.update(1, 0);
    g.render(1, 0);
    assert.ok(!g.effects.shieldWave.visible);
    g.powerups.shield = .01;
    g.update(CONFIG.step);
    g.render(1, 0);
    assert.ok(!g.effects.shield.visible);
    g.effects.shieldPulse();
    g.menu();
    g.render(1, 0);
    assert.ok(!g.effects.shield.visible && !g.effects.shieldWave.visible);
});
check('record conserva personaggio e livello anche dopo cambio selezione e pareggio', () => {
    g.menu();
    g.setCharacter('erika');
    g.setDifficulty('hard');
    g.start();
    g.score = g.save.best + 1000;
    g.bank();
    const record = g.save.best;
    assert.equal(g.save.bestCharacter, 'erika');
    assert.equal(g.save.bestDifficulty, 'hard');
    g.menu();
    g.setCharacter('linda');
    g.setDifficulty('easy');
    g.start();
    g.score = record;
    g.bank();
    assert.equal(g.save.bestCharacter, 'erika');
    assert.equal(g.save.bestDifficulty, 'hard');
    g.menu();
    g.setCharacter('manzolo');
    g.setDifficulty('medium');
});
check('difficoltà applicata a velocità e spawn, bloccata durante la corsa', () => {
    for (const [id, speed, interval] of [['easy', 1, 1.45], ['medium', 1.25, 1], ['hard', 1.5, .8]]) {
        g.menu();
        g.setDifficulty(id);
        g.start();
        assert.equal(g.speed, CONFIG.speed.initial * speed);
        g.spawner.timer = 0;
        g.update(CONFIG.step);
        assert.ok(Math.abs(g.spawner.timer - (CONFIG.spawn.intervalStart - g.time * CONFIG.spawn.intervalDecay) * interval) < .001);
        assert.ok(g.speed > CONFIG.speed.initial * speed);
        g.setDifficulty('invalid');
        assert.equal(g.difficulty.id, id);
        g.pause();
        g.resume();
        assert.equal(g.difficulty.id, id);
    }
    g.menu();
    g.setDifficulty('medium');
});
check('livelli: Facile ha una corsia occupata, Medio e Difficile due', () => {
    for (const id of ['easy', 'medium', 'hard']) {
        g.menu(); g.setDifficulty(id); g.start();
        g.obstacles.reset(); g.enemies.reset(); g.pickups.reset();
        g.spawner.timer = 0;
        g.spawner.update(0);
        const entities = [...g.obstacles.pool, ...g.enemies.pool].filter(e => e.active);
        assert.equal(entities.length, id === 'easy' ? 1 : 2);
    }
    g.menu(); g.setDifficulty('medium');
});
check('contatto: tutti i nemici avviano il duello senza danno e fermano corsa e spawn', () => {
    const count = scene.children.length;
    for (const type of ['soldier', 'runner', 'drone', 'tank', 'stalker']) {
        g.start();
        const e = g.enemies.spawn(type, 0, CONFIG.player.z, 1);
        g.powerups.shield = 5;
        g.combat();
        assert.ok(g.encounter.active);
        assert.equal(g.encounter.enemy, e);
        assert.equal(g.player.lives, CONFIG.player.lives);
        assert.equal(g.powerups.shield, 5);
        assert.ok(!g.boss.active);
        const distance = g.distance, time = g.time;
        ticks(60);
        assert.equal(g.distance, distance);
        assert.equal(g.time, time);
        assert.equal(g.speed, 0);
        assert.ok(!g.obstacles.pool.some(e => e.active));
        assert.ok(!g.enemies.pool.some(e => e.active));
        assert.ok(e.mesh.visible);
        assert.equal(node('#boss-label').textContent, g.encounter.label);
        g.pause();
        const age = g.encounter.age;
        ticks(20);
        assert.equal(g.encounter.age, age);
        g.resume();
        g.menu();
        assert.ok(!g.encounter.active && !e.mesh.visible && !g.player.dueling);
    }
    assert.equal(scene.children.length, count);
});
check('duello: salve anticipate, difficoltà e danno reale dei proiettili', () => {
    const health = [];
    for (const id of ['easy', 'medium', 'hard']) {
        g.menu(); g.setDifficulty(id); g.start();
        g.enemies.spawn('soldier', 0, CONFIG.player.z, 1);
        g.combat();
        health.push(g.encounter.maxHp);
        g.encounter.attackTimer = 0;
        g.encounter.update(CONFIG.step, g);
        assert.equal(g.encounter.warnings.filter(m => m.visible).length, id === 'hard' ? 2 : 1);
        assert.equal(g.enemies.shots.filter(s => s.active).length, 0);
        const warning = g.encounter.warning;
        g.encounter.update(warning + .01, g);
        assert.equal(g.enemies.shots.filter(s => s.active).length, id === 'hard' ? 2 : 1);
        const shot = g.enemies.shots.find(s => s.active);
        shot.x = 0; shot.z = CONFIG.player.z;
        g.player.invulnerable = 0;
        g.combat();
        assert.equal(g.player.lives, CONFIG.player.lives - 1);
    }
    assert.ok(health[0] < health[1] && health[1] < health[2]);
    g.menu(); g.setDifficulty('medium');
});
check('duello vinto con il blaster: premio singolo, proiettili rimossi e ripartenza', () => {
    g.start();
    g.enemies.spawn('soldier', 0, CONFIG.player.z, 1);
    g.combat();
    g.input.auto = true;
    // In questo test si misura la vittoria, non l'abilità di schivata: si insegue solo il rivale.
    g.player.invulnerable = 30;
    for (let i = 0; i < 900 && g.encounter.active; i++) {
        if (g.encounter.lane !== g.player.lane) g.player.command(g.encounter.lane < g.player.lane ? 'left' : 'right');
        g.update(CONFIG.step);
    }
    assert.ok(!g.encounter.active);
    assert.equal(g.kills, 1);
    assert.equal(g.reward, CONFIG.enemies.soldier.score * 4);
    assert.ok(!g.enemies.shots.some(s => s.active));
    assert.ok(!g.player.dueling);
    const distance = g.distance;
    g.update(CONFIG.step);
    assert.ok(g.speed > 0 && g.distance > distance);
    g.encounter.damage(99, g);
    assert.equal(g.kills, 1);
});
check('duello: game over e retry rimuovono rivale e segnali', () => {
    g.start();
    const e = g.enemies.spawn('tank', 0, CONFIG.player.z, 1);
    g.combat();
    g.encounter.attackTimer = 0;
    g.encounter.update(CONFIG.step, g);
    g.player.lives = 1; g.player.invulnerable = 0;
    g.damage();
    assert.equal(g.state, 'over');
    assert.ok(!g.encounter.active && !e.mesh.visible);
    assert.ok(g.encounter.warnings.every(m => !m.visible));
    g.start();
    assert.ok(!g.encounter.active && !g.player.dueling);
    assert.equal(g.player.lives, CONFIG.player.lives);
});
check('15 duelli: ogni rivale si può sconfiggere schivando, nelle tre difficoltà', () => {
    for (const level of ['easy', 'medium', 'hard'])
        for (const type of ['soldier', 'runner', 'drone', 'tank', 'stalker']) {
            g.menu(); g.setDifficulty(level); g.start();
            g.enemies.spawn(type, 0, CONFIG.player.z, 1);
            g.combat();
            g.input.auto = true;
            const lanes = new Set();
            for (let tick = 0; tick < 60 * 60 && g.encounter.active; tick++) {
                // Controller: evita i muri pieni cambiando corsia, salta le barre basse,
                // scivola sotto quelle alte e torna nella corsia del rivale per colpirlo.
                const e = g.encounter, p = g.player;
                lanes.add(e.lane);
                const blocked = new Set(e.warning > 0 && e.wall === 'full' ? e.lanes : []);
                for (const shot of g.enemies.shots) {
                    if (!shot.active || shot.z < -16 || shot.z > CONFIG.player.z + 1)
                        continue;
                    const eta = (CONFIG.player.z - shot.z) / shot.speed;
                    if (shot.wallKind === 'full')
                        blocked.add(Math.round(shot.x / CONFIG.player.laneWidth));
                    else if (shot.wallKind === 'low' && eta < .3 && p.y === 0)
                        p.command('jump');
                    else if (shot.wallKind === 'high' && eta < .3 && p.slide <= 0)
                        p.command('slide');
                }
                const options = [e.lane, p.lane, -1, 0, 1].filter(lane => !blocked.has(lane));
                const target = options[0] ?? p.lane;
                if (target !== p.lane)
                    p.command(target < p.lane ? 'left' : 'right');
                g.update(CONFIG.step);
                if (tick % 12 === 0) g.render(1, .2);
                assert.equal(g.state, 'play', `${type}/${level}: game over`);
            }
            assert.ok(lanes.size > 1, `${type}/${level}: il rivale non si muove`);
            assert.ok(!g.encounter.active, `${type}/${level}: duello troppo lungo`);
            assert.equal(g.kills, 1);
            assert.equal(g.player.lives, CONFIG.player.lives, `${type}/${level}: danno evitabile`);
        }
    g.menu(); g.setDifficulty('medium');
});
check('duello: il rivale cambia corsia, raffiche alte e basse casuali e muri mirati', () => {
    const shotsOf = () => g.enemies.shots.filter(s => s.active);
    const seen = new Set(), positions = new Set();
    g.menu(); g.start();
    g.enemies.spawn('soldier', 0, CONFIG.player.z, 1);
    g.combat();
    let previous = g.encounter.lane;
    for (let salvo = 0; salvo < 40; salvo++) {
        g.encounter.attackTimer = 0;
        g.encounter.update(CONFIG.step, g);
        assert.notEqual(g.encounter.lane, previous);
        previous = g.encounter.lane;
        positions.add(previous);
        g.encounter.update(g.encounter.warning + .01, g);
        const kind = [...new Set(shotsOf().map(s => s.wallKind))];
        assert.equal(kind.length, 1);
        if (salvo === 0) assert.equal(kind[0], 'full');
        seen.add(kind[0]);
        const lanes = new Set(shotsOf().map(s => Math.round(s.x / CONFIG.player.laneWidth)));
        assert.equal(lanes.size, kind[0] === 'full' ? 1 : 3);
        for (const s of shotsOf()) s.active = false;
    }
    assert.deepEqual([...seen].sort(), ['full', 'high', 'low']);
    assert.equal(positions.size, 3);
    // Un muro pieno colpisce anche chi salta: serve cambiare corsia.
    const wall = g.enemies.shoot(0, CONFIG.player.z, 1, 0, 'full');
    g.player.y = 2; g.player.invulnerable = 0;
    g.combat();
    assert.equal(g.player.lives, CONFIG.player.lives - 1);
    assert.ok(!wall.active);
    g.menu();
});
check('stagioni: tempesta nel livello 1, ritorno al tema, poi livello 2 e stagione infernale', () => {
    for (const duel of [false, true]) {
        g.start();
        const sky = scene.background.clone();
        if (duel) {
            g.enemies.spawn('soldier', 0, CONFIG.player.z, 1);
            g.combat();
        } else g.boss.start(g);
        ticks(150);
        const air = g.world.atmosphere;
        assert.equal(air.season, 'storm');
        assert.ok(air.strength > .98 && air.group.visible);
        assert.ok(scene.fog.far < 100);
        assert.ok(scene.background.r < sky.r);
        g.pause();
        const phase = air.time, color = scene.background.clone();
        ticks(30);
        assert.equal(air.time, phase);
        assert.ok(scene.background.equals(color));
        g.resume();
        if (duel) g.encounter.damage(g.encounter.hp, g);
        else g.boss.damage(g.boss.hp, g);
        // Il duello non cambia livello; il boss sconfitto porta al livello 2 con i suoi colori.
        assert.equal(g.level, duel ? 0 : 1);
        for (let i = 0; i < 600; i++) g.world.update(CONFIG.step, 0, false);
        assert.ok(air.strength < .001 && !air.group.visible);
        assert.ok(Math.abs(scene.fog.far - 160) < .001);
        if (duel)
            assert.ok(Math.abs(scene.background.r - sky.r) < .001);
        else {
            assert.ok(scene.background.distanceTo?.(sky) > .02 || Math.abs(scene.background.r - sky.r) > .01);
            assert.equal(g.timeLeft, CONFIG.timer.max);
            // Secondo boss: magma, e la stagione diventa estate infernale.
            g.boss.start(g);
            assert.ok(g.boss.label.includes(g.boss.name));
            ticks(150);
            assert.equal(air.season, 'inferno');
        }
        g.menu();
        assert.equal(air.strength, 0);
        assert.ok(!air.group.visible);
        assert.equal(g.level, 0);
    }
});
check('boss: più giri completi, livelli e potenza crescenti, stagioni e reset', () => {
    // Texture vuote: esercita anche la scelta degli sprite, oltre al ripiego procedurale.
    const textures = SPRITES.textures;
    SPRITES.textures = new Map(Object.values(BOSSES).flatMap(bossFrames).map(name => [name, new THREE.Texture()]));
    try {
        g.start();
        let previousHp = 0, previousSpeed = 0, previousInterval = Infinity;
        const seasons = ['storm', 'inferno', 'winter'];
        for (let level = 0; level < 10; level++) {
            g.boss.start(g);
            assert.equal(g.boss.beast, BOSSES[['storm', 'magma', 'ice'][level % 3]]);
            assert.ok(g.boss.label.endsWith(`LV ${level + 1}`));
            assert.ok(g.boss.hp > previousHp);
            previousHp = g.boss.hp;
            g.boss.attackTimer = 0;
            g.update(CONFIG.step);
            assert.equal(g.world.atmosphere.season, seasons[level % 3]);
            assert.ok(g.boss.shotSpeed >= previousSpeed);
            assert.ok(g.boss.shotSpeed <= CONFIG.boss.projectileSpeed * CONFIG.boss.progression.maxSpeed);
            assert.ok(g.boss.attackTimer <= previousInterval);
            assert.equal(g.boss.warning, CONFIG.boss.warning);
            previousSpeed = g.boss.shotSpeed;
            previousInterval = g.boss.attackTimer;
            g.boss.update(CONFIG.boss.warning, g);
            const shots = g.enemies.shots.filter(shot => shot.active);
            assert.equal(shots.length, 3);
            for (const shot of shots) {
                assert.equal(shot.speed, g.boss.shotSpeed * g.difficulty.projectileSpeed);
                assert.ok(bossFrames(g.boss.beast).includes(shot.skin));
            }
            g.timeLeft = 1;
            g.boss.damage(g.boss.hp, g);
            assert.equal(g.level, level + 1);
            assert.equal(g.timeLeft, CONFIG.timer.max);
            if (g.level % 3 === 0) assert.equal(g.world.levelTint, null);
            // Tra due boss la stagione sfuma durante la corsa (almeno 45 s nel gioco).
            g.world.update(5, 0, false);
        }
        assert.ok(previousSpeed > CONFIG.boss.projectileSpeed);
        assert.ok(previousInterval < CONFIG.boss.attackInterval * g.difficulty.attackInterval);
        g.start();
        g.boss.start(g);
        assert.equal(g.level, 0);
        assert.equal(g.boss.hp, CONFIG.boss.hp);
        assert.equal(g.boss.shotSpeed, CONFIG.boss.projectileSpeed);
        assert.equal(g.boss.attackRate, 1);
        g.menu();
    } finally {
        for (const texture of SPRITES.textures.values()) texture.dispose();
        SPRITES.textures = textures;
    }
});
check('boss: preavviso e recupero garantiti anche in furia ai livelli avanzati', () => {
    g.start();
    g.level = 99;
    g.boss.number = 99;
    g.boss.start(g);
    g.boss.hp = g.boss.maxHp * .3;
    g.boss.attackTimer = 0;
    g.boss.update(CONFIG.step, { ...g, difficulty: { attackInterval: .8 }, announce() {} });
    assert.ok(g.boss.enraged);
    assert.ok(g.boss.attackTimer >= CONFIG.boss.warning + CONFIG.boss.progression.minRecovery);
    assert.equal(g.boss.warning, CONFIG.boss.warning);
    g.menu();
});
check('effetti: elettricità dello scudo, vampa per arma e scia dei razzi', () => {
    g.start();
    g.powerups.shield = 5;
    g.render(1, .1);
    const arc = g.effects.shieldArc.material.uniforms;
    const before = arc.time.value;
    g.update(CONFIG.step);
    g.render(1, .1);
    assert.ok(g.effects.shield.visible && arc.strength.value > 0 && arc.time.value > before);
    g.pause();
    const frozen = arc.time.value;
    ticks(10);
    g.render(1, .1);
    assert.equal(arc.time.value, frozen);
    g.resume();
    g.powerups.shield = 0;
    for (const kind of ['blaster', 'scatter', 'rocket']) {
        g.weapons.reset();
        if (kind !== 'blaster') g.weapons.equip(kind, g);
        g.input.auto = true;
        g.update(CONFIG.step);
        g.input.auto = false;
        assert.ok(g.weapons.flash.visible, kind);
        g.weapons.render(1);
        assert.ok(g.weapons.glowBox.count + g.weapons.glowBall.count > 0, kind);
    }
    const sparks = () => g.effects.pool.filter(p => p.life > 0).length;
    g.effects.reset();
    g.update(CONFIG.step);
    assert.ok(sparks() > 0, 'scia del razzo');
    g.menu();
    g.render(1, .1);
    assert.ok(!g.effects.shield.visible);
});
check('tempo: monete lo ricaricano, tic negli ultimi secondi, a zero si perde', () => {
    g.start();
    g.obstacles.reset(); g.enemies.reset(); g.pickups.reset(); g.spawner.timer = 99;
    const played = [], play = g.audio.play.bind(g.audio);
    g.audio.play = (name, variant) => { played.push(variant === undefined ? name : `${name}:${variant}`); play(name, variant); };
    g.timeLeft = 10;
    g.addTime(CONFIG.timer.coin);
    assert.equal(g.timeLeft, 10 + CONFIG.timer.coin);
    g.addTime(99);
    assert.equal(g.timeLeft, CONFIG.timer.max);
    // Fermo durante il boss.
    g.boss.start(g);
    ticks(60);
    assert.equal(g.timeLeft, CONFIG.timer.max);
    g.boss.end(g, false);
    g.timeLeft = 5.5;
    ticks(60 * 8);
    g.audio.play = play;
    assert.deepEqual(played.filter(n => n.startsWith('tick')), ['tick:false', 'tick:false', 'tick:true', 'tick:true', 'tick:true']);
    assert.ok(played.includes('timeup'));
    assert.equal(g.state, 'over');
    assert.ok(node('#result-label').textContent.includes('TEMPO SCADUTO'));
    g.menu();
});
check('pulsante suggerimenti: spegne la barra degli aiuti (anche nei duelli) e resta salvato', () => {
    g.start();
    ticks(30);
    assert.notEqual(node('#tutorial').textContent, '');
    node('#hints').onclick();
    assert.equal(g.save.hints, false);
    ticks(30);
    assert.equal(node('#tutorial').textContent, '');
    g.enemies.spawn('soldier', 0, CONFIG.player.z, 1);
    g.combat();
    ticks(30);
    assert.equal(node('#tutorial').textContent, '');
    assert.equal(node('#hints').getAttribute?.('aria-pressed') ?? 'false', 'false');
    node('#hints').onclick();
    assert.equal(g.save.hints, true);
    ticks(30);
    assert.notEqual(node('#tutorial').textContent, '');
    g.menu();
});
check('boss: corsia di riparo verde (salta) o azzurra (scivola), colpo basso a terra e alto sospeso', () => {
    for (const move of ['low', 'high']) {
        g.start();
        g.boss.start(g);
        g.boss.attackTimer = 0;
        g.boss.update(CONFIG.step, g);
        g.boss.safeMove = move;
        g.boss.update(CONFIG.step, g);
        const lane = g.boss.safeLane;
        assert.equal(g.boss.warnings[lane + 1].material.color.getHex(), move === 'low' ? 0x5dff8a : 0x5ac8ff);
        assert.equal(g.boss.warnings[(lane + 2) % 3].material.color.getHex(), 0xff695c);
        g.boss.update(CONFIG.boss.warning, g);
        const shot = g.enemies.shots.find(s => s.active && s.wallKind === move);
        assert.ok(shot);
        // Basso: da terra a meno di un metro; alto: spazio libero sotto per la scivolata.
        if (move === 'low')
            assert.ok(shot.bottom === 0 && shot.top < 1);
        else
            assert.ok(shot.bottom > CONFIG.player.slideHeight && shot.top > CONFIG.player.height);
        g.menu();
    }
});
check('musica: brano del livello, tema del boss durante lo scontro, poi il livello successivo', () => {
    g.start();
    assert.equal(g.audio.wanted, 'level1');
    g.boss.start(g);
    g.update(CONFIG.step);
    assert.equal(g.audio.wanted, 'boss');
    g.pause();
    assert.equal(g.audio.wanted, 'pause');
    g.resume();
    assert.equal(g.audio.wanted, 'boss');
    g.boss.damage(g.boss.hp, g);
    g.update(CONFIG.step);
    assert.equal(g.audio.wanted, 'level2');
    g.levelUp();
    g.update(CONFIG.step);
    assert.equal(g.audio.wanted, 'level3');
    g.levelUp();
    g.update(CONFIG.step);
    assert.equal(g.audio.wanted, 'level1');
    g.menu();
    assert.equal(g.audio.wanted, 'menu');
});
check('simulazione 3 minuti: pool stabili, temi, due boss, valori finiti', () => {
    g.start();
    g.input.auto = true;
    const objectCount = scene.children.length;
    const pools = [g.obstacles.pool.length, g.enemies.pool.length, g.pickups.coins.length, g.effects.pool.length];
    const themes = new Set();
    let bosses = 0, previous = false;
    for (let i = 0; i < 60 * 184; i++) {
        // Invulnerabilità e tempo pieno solo per misurare il ciclo lungo; non dimostrano la sopravvivenza.
        g.player.invulnerable = 2;
        g.timeLeft = CONFIG.timer.max;
        if (g.encounter.active) g.encounter.damage(g.encounter.hp, g);
        g.update(CONFIG.step);
        if (i % 6 === 0)
            g.render(.5, .1);
        themes.add(g.world.theme);
        if (g.boss.active && !previous)
            bosses++;
        previous = g.boss.active;
        assert.ok(Number.isFinite(g.score));
        assert.ok(g.speed <= CONFIG.speed.max * g.difficulty.speed);
    }
    assert.equal(g.state, 'play');
    assert.equal(themes.size, 5);
    assert.equal(bosses, 2);
    assert.equal(scene.children.length, objectCount);
    assert.deepEqual([g.obstacles.pool.length, g.enemies.pool.length, g.pickups.coins.length, g.effects.pool.length], pools);
    console.log({ time: g.time, distance: Math.floor(g.distance), score: Math.floor(g.score), bosses, sceneObjects: objectCount, worldBatches: g.world.batches.length });
});
check('sinistra/destra tenuti: continua a cambiare corsia finché non si rilascia', () => {
    g.start();
    const key = (type, code) => window.listeners[type]({ code, repeat: false, preventDefault() { }, target: null });
    g.player.command('right');
    ticks(20);
    assert.equal(g.player.lane, 1);
    key('keydown', 'ArrowLeft');
    ticks(20); // un terzo di secondo tenuto: una sola corsia, la ripetizione aspetta 0,45 s
    assert.equal(g.player.lane, 0);
    ticks(15); // passata l'attesa: la seconda corsia, fino al bordo
    assert.equal(g.player.lane, -1);
    key('keyup', 'ArrowLeft');
    // Tocco breve: una sola corsia.
    key('keydown', 'KeyD');
    ticks(2);
    key('keyup', 'KeyD');
    ticks(30);
    assert.equal(g.player.lane, 0);
    // Swipe con il dito che resta giù: stessa ripetizione.
    const canvas = renderer.domElement, finger = { pointerId: 7, pointerType: 'touch', clientX: 200, clientY: 300, preventDefault() { } };
    canvas.listeners.pointerdown(finger);
    canvas.listeners.pointermove({ ...finger, clientX: 140 });
    ticks(70);
    assert.equal(g.player.lane, -1);
    window.listeners.pointerup(finger);
    g.menu();
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
check('touch simulato: dito tenuto sullo schermo spara, swipe e tocco breve no', () => {
    g.start();
    const canvas = renderer.domElement;
    const event = { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 300, preventDefault() { } };
    const up = () => window.listeners.pointerup(event);
    canvas.listeners.pointerdown(event);
    g.input.update(.1);
    assert.ok(!g.input.firing, 'un tocco breve non spara');
    up();
    g.input.update(.3);
    assert.ok(!g.input.firing, 'dopo il rilascio non resta acceso');
    canvas.listeners.pointerdown(event);
    g.input.update(.2);
    assert.ok(g.input.firing && !g.input.burst, 'tenuto: fuoco normale, non raffica');
    canvas.listeners.pointermove({ ...event, clientX: 280 });
    g.update(CONFIG.step);
    assert.equal(g.player.lane, 1, 'lo swipe col dito tenuto cambia corsia');
    assert.ok(g.input.firing, 'e il fuoco continua');
    up();
    assert.ok(!g.input.firing);
    canvas.listeners.pointerdown(event);
    g.input.update(.2);
    canvas.listeners.pointercancel(event);
    assert.ok(!g.input.firing, 'pointercancel spegne il fuoco');
    canvas.listeners.pointerdown(event);
    g.input.update(.2);
    g.pause();
    assert.ok(!g.input.firing, 'la pausa spegne il fuoco');
    g.resume();
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
check('nove corse da 3 minuti: tre difficoltà percorribili senza invulnerabilità artificiale', () => {
    const originalRandom = Math.random;
    try {
        for (const level of ['easy', 'medium', 'hard'])
        for (const seed of [17, 259, 4096]) {
            let randomState = seed;
            Math.random = () => { randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0; return randomState / 4294967296; };
            g.menu();
            g.setDifficulty(level);
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
                // Tra le corsie libere preferisce quella con monete in arrivo: servono a recuperare tempo.
                const coinsAhead = lane => g.pickups.coins.some(c => c.active && c.z > -26 && c.z < CONFIG.player.z && Math.abs(c.x - lane * CONFIG.player.laneWidth) < 1);
                options.sort((a, b) => (coinsAhead(b) - coinsAhead(a)) || Math.abs(a - g.player.lane) - Math.abs(b - g.player.lane));
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
                // Proiettile del tank raso terra nella propria corsia: si salta.
                else if (g.enemies.shots.some(shot => shot.active && shot.shell && Math.abs(shot.x - g.player.x) < shot.hw + CONFIG.player.halfWidth && shot.z > -9 && shot.z < 1) && g.player.y === 0 && g.player.slide <= 0)
                    g.player.command('jump');
                else if (g.enemies.shots.some(shot => shot.active && !shot.wall && !shot.shell && shot.z > -10 && shot.z < 6) && g.player.slide < CONFIG.player.inputBuffer)
                    g.player.command('slide');
                g.update(CONFIG.step);
                if (tick % 12 === 0)
                    g.render(.5, .2);
                assert.equal(g.state, 'play', `game over al tick ${tick}, seed ${seed}, ${level}, tempo ${g.timeLeft.toFixed(1)}, vite ${g.player.lives}`);
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
