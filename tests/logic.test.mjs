import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/game/config.js';
import { makeRow, choosePattern } from '../src/game/spawner.js';
import { playerOverlap, bulletOverlap, safeTransition, coinLaneReachable } from '../src/game/collisions.js';
import { readSave, writeSave } from '../src/game/storage.js';
import { DIFFICULTIES } from '../src/game/difficulty.js';
import { VERSION } from '../src/game/version.js';
import { readFileSync } from 'node:fs';
test('versione: x.y.z, uguale in version.js e package.json', () => {
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
    assert.equal(JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version, VERSION);
});
test('monete: solo corsia occupata; magnete esteso al massimo di una corsia', () => {
    for (const lane of [-1, 0, 1]) {
        const player = { x: lane * CONFIG.player.laneWidth, lane };
        for (const coinLane of [-1, 0, 1]) {
            const coin = { lane: coinLane, x: coinLane * CONFIG.player.laneWidth };
            assert.equal(coinLaneReachable(player, coin), lane === coinLane);
            assert.equal(coinLaneReachable(player, coin, true), Math.abs(lane - coinLane) <= 1);
            // Anche dopo un'attrazione precedente vale la corsia originale.
            coin.x = player.x;
            assert.equal(coinLaneReachable(player, coin, true), Math.abs(lane - coinLane) <= 1);
        }
    }
});
test('monete: un comando di cambio corsia non teletrasporta la raccolta', () => {
    const player = { x: -3, lane: 1 };
    assert.ok(coinLaneReachable(player, { lane: -1 }));
    assert.ok(!coinLaneReachable(player, { lane: 1 }, true));
    player.x = -.2;
    assert.ok(coinLaneReachable(player, { lane: 0 }));
    assert.ok(!coinLaneReachable(player, { lane: 1 }));
});
test('ogni pattern lascia libera la corsia dichiarata, anche ai limiti casuali', () => {
    for (const safe of [-1, 0, 1])
        for (const pattern of CONFIG.spawn.patterns)
            for (const random of [() => 0, () => .499, () => .999999]) {
                const row = makeRow(safe, pattern.name, random);
                assert.equal(row.length, 2);
                assert.ok(row.every(e => e.lane !== safe));
                assert.equal(new Set(row.map(e => e.lane)).size, 2);
            }
});
test('transizioni di fuga fattibili anche con treni e velocità massima', () => {
    for (const a of [-1, 0, 1])
        for (const b of [-1, 0, 1])
            for (const speed of [CONFIG.speed.initial, CONFIG.speed.max])
                assert.ok(safeTransition(a, b, CONFIG.spawn.intervalMin, speed));
});
test('selezione pesata copre tutti i pattern senza valori indefiniti', () => {
    const found = new Set();
    for (let i = 0; i < 1000; i++)
        found.add(choosePattern(() => i / 1000));
    assert.deepEqual([...found].sort(), CONFIG.spawn.patterns.map(p => p.name).sort());
});
test('hitbox: salto supera la barriera, scivolata passa sotto barra e proiettili', () => {
    const p = { x: 0, y: 0, height: CONFIG.player.height };
    const barrier = { x: 0, z: 3, hw: 1.1, hd: .3, bottom: 0, top: .95 };
    assert.ok(playerOverlap(p, barrier));
    p.y = 1;
    assert.ok(!playerOverlap(p, barrier));
    p.y = 0;
    p.height = CONFIG.player.slideHeight;
    assert.ok(!playerOverlap(p, { ...barrier, bottom: 1.35, top: 2.7 }));
    assert.ok(!playerOverlap(p, { ...barrier, bottom: .79, top: 1.11 }));
    p.height = CONFIG.player.height;
    assert.ok(playerOverlap(p, { ...barrier, bottom: .79, top: 1.11 }));
    p.x = 3;
    assert.ok(!playerOverlap(p, barrier));
});
test('proiettile spazzato colpisce bersagli attraversati in un singolo tick', () => {
    const enemy = { x: 0, z: -10, hw: .5, hd: .4, bottom: 0, top: 2 };
    assert.ok(bulletOverlap({ x: 0, y: 1, z: -13, previousZ: -8 }, enemy));
    assert.ok(!bulletOverlap({ x: 3, y: 1, z: -13, previousZ: -8 }, enemy));
    assert.ok(!bulletOverlap({ x: 0, y: 3, z: -13, previousZ: -8 }, enemy));
});
test('salvataggi corrotti, storage negato e valori non validi non bloccano il gioco', () => {
    assert.deepEqual(readSave(null), { best: 0, bestCharacter: null, bestDifficulty: null, coins: 0, audio: true, music: true, hints: true, soundVolume: 1, musicVolume: 1, character: 'manzolo', difficulty: 'medium' });
    assert.deepEqual(readSave({ getItem: () => '{broken' }), { best: 0, bestCharacter: null, bestDifficulty: null, coins: 0, audio: true, music: true, hints: true, soundVolume: 1, musicVolume: 1, character: 'manzolo', difficulty: 'medium' });
    assert.deepEqual(readSave({ getItem: () => '{"best":-5,"coins":"oops","audio":false}' }), { ...readSave(null), audio: false });
    assert.equal(writeSave({ setItem() { throw new Error('quota'); } }, {}), false);
    let value;
    const storage = { setItem(k, v) { value = v; }, getItem() { return value; } };
    assert.ok(writeSave(storage, { best: 123, coins: 7, audio: false, music: false, character: 'erika' }));
    assert.deepEqual(readSave(storage), { ...readSave(null), best: 123, coins: 7, audio: false, music: false, character: 'erika' });
});

test('salvataggi: migrazione non attribuisce il vecchio record al personaggio selezionato', () => {
    const old = readSave({ getItem: key => key === 'neon-rush-save' ? JSON.stringify({ best: 850, character: 'erika' }) : null });
    assert.equal(old.best, 850);
    assert.equal(old.character, 'erika');
    assert.equal(old.bestCharacter, null);
    assert.equal(old.bestDifficulty, null);
    assert.equal(old.difficulty, 'medium');
});
test('volumi, record e difficoltà: persistenza e normalizzazione', () => {
    let value;
    const storage = { getItem: () => value, setItem: (key, data) => { value = data; } };
    const save = { ...readSave(null), best: 1200, bestCharacter: 'linda', bestDifficulty: 'hard', difficulty: 'easy', soundVolume: 0, musicVolume: .42 };
    writeSave(storage, save);
    assert.deepEqual(readSave(storage), save);
    value = JSON.stringify({ soundVolume: -2, musicVolume: 5, difficulty: 'invalid', bestDifficulty: 'invalid' });
    assert.equal(readSave(storage).soundVolume, 0);
    assert.equal(readSave(storage).musicVolume, 1);
    assert.equal(readSave(storage).difficulty, 'medium');
    assert.equal(readSave(storage).bestDifficulty, null);
    value = JSON.stringify({ soundVolume: 'loud', musicVolume: null });
    assert.equal(readSave(storage).soundVolume, 1);
    assert.equal(readSave(storage).musicVolume, 1);
});
test('ogni difficoltà mantiene fattibili i cambi tra corsie di fuga', () => {
    for (const level of DIFFICULTIES)
        for (const from of [-1, 0, 1])
            for (const to of [-1, 0, 1])
                for (const speed of [CONFIG.speed.initial, CONFIG.speed.max])
                    assert.ok(safeTransition(from, to, CONFIG.spawn.intervalMin * level.spawnInterval, speed * level.speed), level.name);
});
