import * as THREE from 'three';
import { CONFIG } from './config.js';
import { versioned } from './version.js';
// Sprite 2D ritagliati da assets/raw/spritesheet.png (vedi tools/slice_sprites.py).
// Il registro parte vuoto: finché loadSprites() non ha caricato una texture, has() è false
// e ogni modulo usa il proprio modello procedurale. Un file mancante non è mai un errore.
const PLANE_BOTTOM = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
const PLANE_CENTER = new THREE.PlaneGeometry(1, 1);
export const SPRITES = {
    atlas: {},
    textures: new Map(),
    loaded: false,
    has(name) { return this.textures.has(name); },
    texture(name) { return this.textures.get(name) || null; },
    aspect(name) { const a = this.atlas[name]; return a ? a.width / a.height : 1; },
    url(name, small = false) { const a = this.atlas[name]; return a ? versioned(CONFIG.sprites.path + (small ? a.small : a.file)) : ''; },
    geometry(anchorBottom = true) { return anchorBottom ? PLANE_BOTTOM : PLANE_CENTER; },
    // Materiale non illuminato e non tone-mapped: i colori restano quelli dell'immagine.
    material(name, options = {}) {
        return new THREE.MeshBasicMaterial({ map: this.texture(name), transparent: true, alphaTest: .35, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false, ...options });
    },
};
// Piano con lo sprite, alto `height` metri e largo in proporzione; origine ai piedi o al centro.
export function billboard(name, height, anchorBottom = true) {
    const mesh = new THREE.Mesh(SPRITES.geometry(anchorBottom), SPRITES.material(name));
    mesh.scale.set(height * SPRITES.aspect(name), height, 1);
    return mesh;
}
export function loadSprites(timeoutMs = 8000) {
    const base = CONFIG.sprites.path;
    const loader = new THREE.TextureLoader();
    const load = fetch(versioned(base + 'atlas.json')).then(r => {
        if (!r.ok)
            throw new Error(`atlas ${r.status}`);
        return r.json();
    }).then(atlas => {
        SPRITES.atlas = atlas;
        return Promise.allSettled(Object.keys(atlas).map(name => new Promise((resolve, reject) => {
            loader.load(versioned(base + atlas[name].file), texture => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.anisotropy = /road|ground|sidewalk|plates/.test(name) ? 4 : 1;
                SPRITES.textures.set(name, texture);
                resolve();
            }, undefined, reject);
        })));
    }).catch(error => console.warn('Sprite non disponibili, uso i modelli procedurali:', error.message));
    const timeout = new Promise(resolve => setTimeout(resolve, timeoutMs));
    return Promise.race([load, timeout]).then(() => {
        SPRITES.loaded = true;
        return SPRITES;
    });
}
