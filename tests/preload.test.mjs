import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGraphics } from '../src/game/preload.js';

test('preparazione GPU: texture uniche, pool invisibili, attesa shader prima della disponibilità', async () => {
    const textures = Array.from({ length: 5 }, () => ({}));
    const events = [];
    let finishCompile;
    const renderer = {
        initTexture(texture) { events.push(texture); },
        compileAsync() { events.push('compile'); return new Promise(resolve => { finishCompile = resolve; }); },
    };
    const scene = { traverse(visit) {
        visit({ visible: false, material: { map: textures[3] } });
        visit({ material: [{ map: textures[4] }, { map: textures[0] }] });
        visit({});
    } };
    let ready = false;
    const task = prepareGraphics(renderer, scene, {}, textures.slice(0, 4), async () => { events.push('frame'); }).then(() => { ready = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ready, false);
    assert.deepEqual(events, [...textures.slice(0, 4), 'frame', textures[4], 'compile']);
    finishCompile();
    await task;
    assert.equal(ready, true);
});
