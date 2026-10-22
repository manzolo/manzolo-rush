import * as THREE from 'three';
import { CONFIG } from './config.js';
import { THEMES } from './scenery.js';

// Sagome fuori strada, riciclate con i chunk. Due draw call per ambiente naturale,
// nessuna allocazione quando si cambia tema e ripiego completo anche senza sprite.
export class Landscape {
    constructor(scene, chunks, tiles) {
        this.chunks = chunks;
        this.dummy = new THREE.Object3D();
        this.layers = [];
        const add = (theme, geometry, color, key, place, surface = null) => {
            // Anche i materiali nascosti sono pronti per prepareGraphics prima della corsa.
            const map = tiles[THEMES.findIndex(t => t.id === theme)]?.[surface] ?? null;
            const material = new THREE.MeshLambertMaterial({ color: map ? 0xffffff : color, map, flatShading: true });
            const mesh = new THREE.InstancedMesh(geometry, material, chunks.length * 4);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            mesh.visible = false;
            scene.add(mesh);
            this.layers.push({ theme, mesh, color, key, place, surface });
        };
        add('forest', new THREE.CylinderGeometry(.65, 1, 1, 5), 0x63513c, 'building', (o, v) => {
            o.position.y = 3;
            o.scale.set(.8, 6, .8);
        });
        add('forest', new THREE.DodecahedronGeometry(1, 0), 0x426c42, 'ground', (o, v) => {
            o.position.y = 7 + v * .3;
            o.scale.set(3.6, 4 + v * .3, 3.2);
        });
        add('volcano', new THREE.CylinderGeometry(.65, 1, 1, 5), 0x47414b, 'building', (o, v) => {
            const h = 7 + v * 1.8;
            o.position.y = h / 2;
            o.scale.set(3, h, 3.4);
        }, 'facadeA');
        add('volcano', new THREE.DodecahedronGeometry(1, 0), 0x6b4b41, 'building', (o, v) => {
            o.position.x *= .85;
            o.position.y = 2;
            o.position.z += 4;
            o.scale.set(3.2, 2.6 + v * .2, 3);
        }, 'facadeB');
        add('snow', new THREE.ConeGeometry(1, 1, 5), 0x6b849d, 'building', (o, v) => {
            const h = 13 + v * 2;
            o.position.x *= 1.25;
            o.position.y = h / 2;
            o.scale.set(7, h, 6);
        }, 'facadeA');
        add('snow', new THREE.ConeGeometry(1, 1, 5), 0xe7f3f6, 'roof', (o, v) => {
            const h = 13 + v * 2;
            o.position.x *= 1.25;
            o.position.y = h * .79;
            o.scale.set(3.05, h * .43, 2.62);
        });
    }
    setTheme(id) {
        for (const layer of this.layers) {
            layer.mesh.visible = layer.theme === id;
            layer.mesh.material.color.set(layer.mesh.material.map ? 0xffffff : layer.color);
        }
    }
    update() {
        for (const layer of this.layers) {
            if (!layer.mesh.visible) continue;
            let index = 0;
            for (let c = 0; c < this.chunks.length; c++)
                for (const side of [-1, 1])
                    for (let k = 0; k < 2; k++) {
                        const v = (c * 3 + k * 2) % 5, o = this.dummy;
                        o.position.set(side * (14 + k * 6), 0, this.chunks[c].position.z - 9 + k * 12);
                        o.rotation.set(0, (c + k) * .7, 0);
                        layer.place(o, v);
                        o.updateMatrix();
                        layer.mesh.setMatrixAt(index++, o.matrix);
                    }
            layer.mesh.instanceMatrix.needsUpdate = true;
        }
    }
    render(alpha, speed) {
        for (const { mesh } of this.layers)
            mesh.position.z = (alpha - 1) * speed * CONFIG.step;
    }
}
