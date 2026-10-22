// Misura il solo lavoro CPU dello scenario, senza GPU: non è un benchmark FPS.
// THREE_MODULE=/percorso/three.module.js node tests/world-benchmark.mjs
import { register } from 'node:module';
if (!process.env.THREE_MODULE) throw new Error('Imposta THREE_MODULE sul modulo locale di Three.js 0.169.0.');
register('./three-loader.mjs', import.meta.url);
const THREE = await import('three');
globalThis.document = { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ fillRect() {}, createRadialGradient() { return { addColorStop() {} }; } }),
}) };
const { CONFIG } = await import('../src/game/config.js');
const { THEMES, SHARED_PROPS } = await import('../src/game/scenery.js');
const { SPRITES } = await import('../src/game/sprites.js');
CONFIG.sprites.vectorCity = false;
// Texture vuote: includono il costo dei props senza dipendere dal caricamento di immagini.
for (const name of THEMES.flatMap(t => [...t.textures, ...t.props.map(p => p[0])]).concat(SHARED_PROPS.map(p => p[0])))
    SPRITES.textures.set(name, new THREE.Texture());
const { World } = await import('../src/game/world.js');
const world = new World(new THREE.Scene()), steps = 6000, speed = 30, results = [];
for (let theme = 0; theme < THEMES.length; theme++) {
    world.setTheme(theme, true);
    for (let i = 0; i < 600; i++) { world.update(CONFIG.step, speed); world.render(.5, speed); }
    const samples = [];
    for (let n = 0; n < 5; n++) {
        const start = performance.now();
        for (let i = 0; i < steps; i++) { world.update(CONFIG.step, speed); world.render(.5, speed); }
        samples.push(performance.now() - start);
    }
    // Conteggio separato dal tempo: la strumentazione non altera la misura precedente.
    let writes = 0;
    const original = THREE.InstancedMesh.prototype.setMatrixAt;
    THREE.InstancedMesh.prototype.setMatrixAt = function (...args) { writes++; return original.apply(this, args); };
    try {
        for (let i = 0; i < steps; i++) { world.update(CONFIG.step, speed); world.render(.5, speed); }
    } finally {
        THREE.InstancedMesh.prototype.setMatrixAt = original;
    }
    samples.sort((a, b) => a - b);
    results.push({ theme: THEMES[theme].id, steps, medianMs: Math.round(samples[2] * 100) / 100, matrixWrites: writes });
}
console.log(JSON.stringify(results, null, 2));
