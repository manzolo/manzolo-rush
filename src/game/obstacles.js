import * as THREE from 'three';
import { CONFIG } from './config.js';
import { block, material } from './models.js';
import { SPRITES } from './sprites.js';
const TYPES = ['barrier', 'bar', 'train', 'crate'];
// Texture dello sheet_textures sugli ostacoli: il blocco principale di ogni tipo riceve la sua.
const SKINS = { barrier: 'barrier', bar: 'barrier', train: 'train_side', crate: 'crate' };
export class Obstacles {
    constructor(scene) {
        this.pool = [];
        this.skins = {};
        if (CONFIG.sprites.enabled && CONFIG.sprites.textures)
            for (const type of TYPES)
                if (SPRITES.has(SKINS[type]))
                    this.skins[type] = new THREE.MeshStandardMaterial({ map: SPRITES.texture(SKINS[type]), roughness: .9 });
        for (let i = 0; i < CONFIG.spawn.obstaclePool; i++) {
            const type = TYPES[i % 4], mesh = new THREE.Group();
            scene.add(mesh);
            mesh.visible = false;
            const skin = this.skins[type];
            const main = (...args) => {
                const m = block(mesh, ...args);
                if (skin)
                    m.material = skin;
                return m;
            };
            if (type === 'barrier') {
                main(0xf68163, 0, .48, 0, 2.25, .95, .48);
                if (!skin)
                    for (let k = -1; k <= 1; k++)
                        block(mesh, 0xffdb9a, k * .65, .5, -.25, .22, .64, .03).rotation.z = -.4;
                block(mesh, 0x283e4d, 0, .12, 0, 2.5, .24, .75);
            }
            if (type === 'bar') {
                for (const x of [-1.15, 1.15])
                    block(mesh, 0xffa877, x, 1.35, 0, .16, 2.7, .25);
                main(0xff7263, 0, 1.85, 0, 2.45, 1, .4);
                if (!skin)
                    block(mesh, 0xffd896, 0, 1.53, .22, 2.2, .13, .02, true);
            }
            if (type === 'train') {
                main(0x346e7d, 0, 1.65, 0, 2.55, 3.3, 5);
                block(mesh, 0x9cf1dd, 0, 2.2, 2.52, 2.1, .9, .04);
                block(mesh, 0x233e4e, 0, .45, 0, 2.6, .6, 5.1);
                for (const x of [-.85, .85])
                    block(mesh, 0xffe8a7, x, .8, 2.56, .25, .18, .06, true);
                block(mesh, 0xf2ba8b, 0, 3.35, 0, 2.1, .12, 4.4);
            }
            if (type === 'crate') {
                main(0xc68a58, 0, .7, 0, 1.45, 1.4, 1.3);
                if (!skin) {
                    block(mesh, 0xf7ca83, 0, .7, .67, 1.5, .17, .04);
                    block(mesh, 0xf7ca83, 0, .7, .68, .17, 1.42, .04);
                }
                block(mesh, 0x8bffd1, 0, 1.2, .67, .35, .12, .04, true);
            }
            this.pool.push({ type, mesh, active: false, x: 0, z: 0, hp: CONFIG.obstacles.crateHp, hw: type === 'train' ? 1.23 : type === 'crate' ? .7 : 1.13, hd: type === 'train' ? 2.5 : type === 'crate' ? .65 : .25, bottom: type === 'bar' ? 1.35 : 0, top: type === 'bar' ? 2.7 : type === 'train' ? 3.3 : type === 'crate' ? 1.4 : .95 });
        }
    }
    spawn(type, lane, z) {
        const o = this.pool.find(o => !o.active && o.type === type);
        if (!o)
            return null;
        o.active = true;
        o.x = lane * CONFIG.player.laneWidth;
        o.z = z;
        o.hp = CONFIG.obstacles.crateHp;
        o.mesh.visible = true;
        o.mesh.position.set(o.x, 0, z);
        return o;
    }
    update(dt, speed) {
        for (const o of this.pool)
            if (o.active) {
                o.z += speed * dt;
                o.mesh.position.z = o.z;
                if (o.z > CONFIG.world.despawnZ)
                    this.remove(o);
            }
    }
    remove(o) { o.active = false; o.mesh.visible = false; }
    reset() {
        for (const o of this.pool)
            this.remove(o);
    }
}
