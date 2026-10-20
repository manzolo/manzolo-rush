import * as THREE from 'three';
import { CONFIG } from './game/config.js';
import { Loop } from './game/loop.js';
import { Game } from './game/game.js';
import { loadSprites, SPRITES } from './game/sprites.js';
import { prepareGraphics } from './game/preload.js';
// Gli sprite si caricano prima della scena: il pulsante resta su "CARICAMENTO…" per al più
// CONFIG.sprites.loadTimeout secondi, poi si parte comunque con i modelli procedurali.
if (CONFIG.sprites.enabled)
    await loadSprites(CONFIG.sprites.loadTimeout * 1000);
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#game'),
    // Le texture sono già filtrate; evita il costo MSAA a schermo intero.
    antialias: false,
    powerPreference: 'high-performance',
});
const maxRatio = () => Math.min(devicePixelRatio, CONFIG.maxPixelRatio, Math.sqrt(CONFIG.performance.maxPixels / (innerWidth * innerHeight)));
let pixelRatio = maxRatio();
renderer.setPixelRatio(pixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, .1, 250);
camera.position.set(-5.3, 5.2, 11);
scene.add(new THREE.HemisphereLight(0xffffff, 0x5b555f, 2));
const sun = new THREE.DirectionalLight(0xffe6cc, 2.7);
sun.position.set(-20, 40, 15);
scene.add(sun);
const game = new Game(renderer, scene, camera);
game.sunlight = sun;
const playButton = document.querySelector('#play');
playButton.disabled = true;
document.querySelector('#play-label').textContent = 'PREPARAZIONE GRAFICA…';
function resize() {
    pixelRatio = Math.min(pixelRatio, maxRatio());
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    // setSize/setPixelRatio svuotano il canvas: ridisegna nello stesso frame,
    // anche in pausa, evitando un lampo dello sfondo al cambio di risoluzione.
    game.render(1, 0);
}
addEventListener('resize', resize);
resize();
renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    game.pause(true);
    const panel = document.querySelector('#error');
    panel.textContent = 'Il contesto grafico è stato interrotto. Ricarica la pagina per riprendere.';
    panel.classList.remove('hidden');
});
// Modalità diagnostica esplicita per test e bilanciamento; nessun global in produzione.
if (new URLSearchParams(location.search).has('debug'))
    window.__game = game;
await prepareGraphics(renderer, scene, camera, [
    ...SPRITES.textures.values(),
    ...(game.world.tiles || []).flatMap(theme => Object.values(theme)),
]);
game.render(1, 0);
playButton.disabled = false;
document.querySelector('#play-label').textContent = 'INIZIA LA CORSA';
let sampleTime = 0, sampleFrames = 0;
new Loop(dt => game.update(dt), (alpha, dt) => {
    game.render(alpha, dt);
    if (game.state !== 'play' || dt <= 0) {
        sampleTime = 0;
        sampleFrames = 0;
        return;
    }
    sampleTime += dt;
    sampleFrames++;
    if (sampleTime >= CONFIG.performance.sampleSeconds) {
        game.frameTime = sampleTime / sampleFrames;
        const minimum = Math.min(CONFIG.performance.minPixelRatio, maxRatio());
        if (game.frameTime > CONFIG.performance.slowFrame && pixelRatio > minimum) {
            pixelRatio = Math.max(minimum, pixelRatio - CONFIG.performance.ratioStep);
            resize();
        }
        sampleTime = 0;
        sampleFrames = 0;
    }
}).start();
