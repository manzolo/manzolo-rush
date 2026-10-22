import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { THEMES, SCENERY_ROUTE, sceneryAt } from '../src/game/scenery.js';

test('il percorso visita tutti e sei gli ambienti prima di ripetersi', () => {
    assert.equal(THEMES.length, 6);
    assert.equal(new Set(SCENERY_ROUTE).size, THEMES.length);
    assert.deepEqual(SCENERY_ROUTE.map(i => THEMES[i].id), ['city', 'forest', 'desert', 'volcano', 'neon', 'snow']);
    for (let i = 0; i < 36; i++) assert.equal(sceneryAt(i), SCENERY_ROUTE[i % 6]);
});

test('ogni ambiente ha texture e decorazioni distribuite nell’atlante', () => {
    const root = new URL('../assets/sprites/', import.meta.url);
    const atlas = JSON.parse(readFileSync(new URL('atlas.json', root)));
    for (const theme of THEMES) {
        assert.equal(theme.textures.length, 4);
        assert.equal(theme.props.length, 4);
        for (const name of [...theme.textures, ...theme.props.map(([name]) => name)]) {
            assert.ok(atlas[name], `${theme.id}: ${name} mancante nell’atlante`);
            assert.ok(existsSync(new URL(atlas[name].file, root)), `${name}: WebP mancante`);
            assert.ok(existsSync(new URL(atlas[name].small, root)), `${name}: anteprima mancante`);
            assert.ok(atlas[name].width > 0 && atlas[name].height > 0);
        }
    }
});
