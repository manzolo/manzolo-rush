import * as THREE from 'three';
import { CONFIG, THEMES } from './config.js';
import { block } from './models.js';
import { SPRITES } from './sprites.js';
// Texture ripetibili per tema (sheet_textures) e oggetti di contorno (sheet_props).
const THEME_TEXTURES = [
    { facadeA: 'city_facade_a', facadeB: 'city_facade_b', road: 'city_road', ground: 'city_sidewalk' },
    { facadeA: 'desert_facade_a', facadeB: 'desert_facade_b', road: 'desert_road', ground: 'desert_ground' },
    { facadeA: 'neon_facade_a', facadeB: 'neon_facade_b', road: 'neon_road', ground: 'neon_plates' },
];
const THEME_PROPS = [
    ['prop_city_lamp', 'prop_city_tree', 'prop_city_busstop', 'prop_city_sign'],
    ['prop_desert_cactus', 'prop_desert_tree', 'prop_desert_barrels', 'prop_desert_sign'],
    ['prop_neon_antenna', 'prop_neon_holo', 'prop_neon_pylon', 'prop_neon_canisters'],
];
// Coronamento dei tetti per tema: cornicione e torretta chiari in città, terracotta nel deserto, acciaio nella base.
const ROOF_COLORS = [[0xf3dcc0, 0xd8c3a6], [0xc9774a, 0xa85f3a], [0x34466a, 0x23314d]];
const SHARED_PROPS = ['prop_cone', 'prop_block', 'prop_bush', 'prop_rocks'];
// Altezza in metri di ogni oggetto; la larghezza segue le proporzioni dello sprite.
const PROP_HEIGHT = { prop_city_lamp: 4.6, prop_city_tree: 4.2, prop_city_busstop: 2.8, prop_city_sign: 4, prop_desert_cactus: 3.4, prop_desert_tree: 3.6, prop_desert_barrels: 1.7, prop_desert_sign: 2.6,
    prop_neon_antenna: 4.8, prop_neon_holo: 3.4, prop_neon_pylon: 4.6, prop_neon_canisters: 3.6, prop_cone: .85, prop_block: 1, prop_bush: 1.2, prop_rocks: 1.4 };
function tile(name, rx, ry) {
    const texture = SPRITES.texture(name).clone();
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    texture.needsUpdate = true;
    return texture;
}
export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = [];
        this.theme = -1;
        this.phase = 0;
        // Lambert invece di Standard: palazzi, strada e terreno coprono gran parte dello schermo
        // (soprattutto i palazzi alti della città) e l'illuminazione PBR per pixel costava troppo.
        this.roadMaterial = new THREE.MeshLambertMaterial({ color: THEMES[0].road });
        this.buildingMaterials = [new THREE.MeshLambertMaterial(), new THREE.MeshLambertMaterial()];
        this.groundMaterial = new THREE.MeshLambertMaterial();
        this.roofMaterials = [new THREE.MeshLambertMaterial({ color: ROOF_COLORS[0][0] }), new THREE.MeshLambertMaterial({ color: ROOF_COLORS[0][1] })];
        this.accentMaterial = new THREE.MeshBasicMaterial();
        const s = CONFIG.sprites;
        this.textured = s.enabled && s.textures && THEME_TEXTURES.every(t => Object.values(t).every(n => SPRITES.has(n)));
        if (this.textured) {
            // Ripetizioni tarate sulle geometrie: strada 10×24 m (una tile per corsia), terreno 700 m, palazzi 4–21 m.
            this.tiles = THEME_TEXTURES.map(t => ({ facadeA: tile(t.facadeA, 1, 2.5), facadeB: tile(t.facadeB, 1, 2.5), road: tile(t.road, 3, 7), ground: tile(t.ground, 90, 90) }));
            for (const m of [this.roadMaterial, this.groundMaterial, ...this.buildingMaterials]) {
                m.color.set(0xffffff);
            }
        }
        this.props = [];
        this.propBatches = new Map();
        this.propsEnabled = s.enabled && s.props && THEME_PROPS.flat().concat(SHARED_PROPS).every(n => SPRITES.has(n));
        if (this.propsEnabled)
            for (const name of THEME_PROPS.flat().concat(SHARED_PROPS)) {
                const mesh = new THREE.InstancedMesh(SPRITES.geometry(true), SPRITES.material(name), CONFIG.world.chunks * 4);
                mesh.count = 0;
                mesh.frustumCulled = false;
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                scene.add(mesh);
                this.propBatches.set(name, mesh);
            }
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), this.groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -.09;
        scene.add(ground);
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#ffffff80';
        for (let i = 0; i < 64; i += 8)
            ctx.fillRect(0, i, 64, 1);
        this.stripeTexture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.BoxGeometry(1, 1, 1);
        for (let c = 0; c < CONFIG.world.chunks; c++) {
            const group = new THREE.Group();
            group.position.z = 12 - c * CONFIG.world.chunkLength;
            scene.add(group);
            const road = new THREE.Mesh(geo, this.roadMaterial);
            road.scale.set(10, .16, 24);
            road.position.y = -.08;
            group.add(road);
            for (const side of [-1, 1]) {
                block(group, 0xd4d6c6, side * 5.15, .12, 0, .35, .24, 24);
                for (let j = 0; j < 3; j++) {
                    const stripe = new THREE.Mesh(geo, this.accentMaterial);
                    stripe.position.set(side * 1.5, .015, -8 + j * 8);
                    stripe.scale.set(.07, .02, 3);
                    group.add(stripe);
                    const building = new THREE.Mesh(geo, this.buildingMaterials[(j + c) % 2]);
                    const h = 4 + ((c * 7 + j * 11) % 17);
                    building.position.set(side * (9 + (j % 2) * 3), h / 2, -9 + j * 8);
                    building.scale.set(4 + (c % 3), h, 5.5);
                    group.add(building);
                    // Tetto a gradoni: cornicione sporgente, parapetto rientrato e torretta con antenna,
                    // così la sagoma non finisce "segata" ma si legge come la cima di un palazzo.
                    const bw = 4 + (c % 3), roof = (y, w, hh, d, mat, dx = 0, dz = 0) => {
                        const m = new THREE.Mesh(geo, mat);
                        m.position.set(side * (9 + (j % 2) * 3) + dx, h + y, -9 + j * 8 + dz);
                        m.scale.set(w, hh, d);
                        m.userData.role = 'roof';
                        m.userData.base = h;
                        m.userData.dy = y;
                        group.add(m);
                    };
                    roof(.12, bw + .35, .24, 5.85, this.roofMaterials[0]);
                    roof(.45, bw - .5, .42, 5, this.roofMaterials[1]);
                    roof(.78, bw - .8, .1, 4.7, this.roofMaterials[0]);
                    const tower = (c + j) % 3;
                    if (tower !== 2) {
                        roof(1.25, 1.4, .9, 1.6, this.roofMaterials[1], (tower ? -.6 : .6) * side, tower ? 1.2 : -1.1);
                        roof(1.74, 1.6, .1, 1.8, this.roofMaterials[0], (tower ? -.6 : .6) * side, tower ? 1.2 : -1.1);
                    }
                    if ((c + j) % 2 === 0)
                        roof(1.6, .08, 2.2, .08, this.accentMaterial, -.9 * side, -1.8);
                    const window = new THREE.Mesh(geo, this.accentMaterial);
                    window.position.set(side * (9 + (j % 2) * 3 - (4 + c % 3) / 2 - .025), h * .7, -9 + j * 8);
                    window.scale.set(.03, .14, 3.5);
                    window.userData.role = 'window';
                    window.userData.faceShift = side * (4 + c % 3) * .15;
                    group.add(window);
                }
                block(group, 0x253e4d, side * 5.8, 2.4, -4, .1, 4.8, .12);
                const lamp = block(group, 0xffe3bb, side * 5.5, 4.8, -4, .8, .12, .35, true);
                lamp.material.map = this.stripeTexture;
            }
            for (const side of [-1, 1]) {
                const cactus = new THREE.Group();
                group.add(cactus);
                block(cactus, 0x5b8775, side * 6.3, 1, -10, .36, 2, .36);
                block(cactus, 0x5b8775, side * 6.6, 1.25, -10, .8, .22, .3);
                block(cactus, 0x5b8775, side * 6.95, 1.5, -10, .23, .65, .3);
                cactus.traverse(mesh => {
                    if (mesh.isMesh)
                        mesh.userData.role = 'cactus';
                });
            }
            this.chunks.push(group);
            if (this.propsEnabled) {
                // Due billboard per lato e per chunk, tra marciapiede e palazzi; la texture dipende dal tema.
                for (const side of [-1, 1])
                    for (let k = 0; k < 2; k++) {
                        const mesh = new THREE.Object3D();
                        mesh.position.x = side * (6.1 + ((c + k) % 2) * .5);
                        this.props.push({ mesh, chunk: group, localZ: -11 + k * 12 + ((c * 5 + k * 3) % 5) - 2, index: c * 4 + k * 2 + (side > 0 ? 1 : 0) });
                    }
            }
        }
        this.sun = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ color: 0xffd7a2, fog: false }));
        this.sun.position.set(28, 35, -190);
        scene.add(this.sun);
        // Bake di tutti i chunk in batch instanziati per materiale: pochi draw call.
        this.dummy = new THREE.Object3D();
        this.batches = [];
        const map = new Map();
        for (const chunk of this.chunks) {
            chunk.updateMatrixWorld(true);
            chunk.traverse(mesh => {
                if (!mesh.isMesh)
                    return;
                let batch = map.get(mesh.material);
                if (!batch) {
                    batch = { material: mesh.material, items: [] };
                    map.set(mesh.material, batch);
                }
                batch.items.push({ chunk, local: mesh.position.clone(), scale: mesh.scale.clone(), matrix: mesh.matrixWorld.clone(), building: this.buildingMaterials.includes(mesh.material), role: mesh.userData.role, faceShift: mesh.userData.faceShift || 0, base: mesh.userData.base || 0, dy: mesh.userData.dy || 0 });
            });
            scene.remove(chunk);
        }
        for (const batch of map.values()) {
            batch.mesh = new THREE.InstancedMesh(geo, batch.material, batch.items.length);
            batch.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            batch.mesh.frustumCulled = false;
            scene.add(batch.mesh);
            this.batches.push(batch);
        }
        this.color = new THREE.Color();
        this.setTheme(0, true);
        this.update(0, 0);
    }
    setTheme(index, immediate = false) {
        this.theme = index % THEMES.length;
        this.target = THEMES[this.theme];
        if (this.textured) {
            const t = this.tiles[this.theme];
            const swap = (m, map) => { if (m.map !== map) { m.map = map; m.needsUpdate = true; } };
            swap(this.roadMaterial, t.road);
            swap(this.groundMaterial, t.ground);
            swap(this.buildingMaterials[0], t.facadeA);
            swap(this.buildingMaterials[1], t.facadeB);
        }
        for (const p of this.props) {
            // Un oggetto su tre è condiviso fra i temi, gli altri appartengono al tema attivo.
            const list = THEME_PROPS[this.theme];
            const name = p.index % 3 === 2 ? SHARED_PROPS[Math.floor(p.index / 3) % SHARED_PROPS.length] : list[(p.index * 7) % list.length];
            const h = PROP_HEIGHT[name] || 2;
            p.spriteName = name;
            p.mesh.scale.set(h * SPRITES.aspect(name), h, 1);
        }
        if (immediate) {
            this.scene.background = new THREE.Color(this.target.sky);
            this.scene.fog = new THREE.Fog(this.target.fog, 35, 160);
            if (!this.textured) {
                this.roadMaterial.color.set(this.target.road);
                this.groundMaterial.color.set(this.target.ground);
                this.buildingMaterials[0].color.set(this.target.primary);
                this.buildingMaterials[1].color.set(this.target.secondary);
            }
            this.accentMaterial.color.set(this.target.accent);
            for (let k = 0; k < 2; k++)
                this.roofMaterials[k].color.set(ROOF_COLORS[this.theme][k]);
        }
    }
    update(dt, speed) {
        this.phase += dt;
        for (const chunk of this.chunks) {
            chunk.position.z += speed * dt;
            if (chunk.position.z > 36)
                chunk.position.z -= CONFIG.world.chunks * CONFIG.world.chunkLength;
        }
        for (const batch of this.batches) {
            let i = 0;
            for (const item of batch.items) {
                const m = item.matrix.elements;
                m[14] = item.local.z + item.chunk.position.z;
                // Città: torri; deserto: mesas basse; base: torri strette e alte.
                if (item.building) {
                    const height = this.theme === 1 ? .35 : this.theme === 2 ? 1.15 : 1;
                    const width = this.theme === 2 ? .7 : 1;
                    m[0] = item.scale.x * width;
                    m[5] = item.scale.y * height;
                    m[13] = item.local.y * height;
                }
                if (item.role === 'roof') {
                    const height = this.theme === 1 ? .35 : this.theme === 2 ? 1.15 : 1;
                    m[0] = item.scale.x * (this.theme === 2 ? .7 : 1);
                    m[13] = item.base * height + item.dy;
                }
                if (item.role === 'window') {
                    m[13] = item.local.y * (this.theme === 1 ? .35 : this.theme === 2 ? 1.15 : 1);
                    m[12] = item.local.x + (this.theme === 2 ? item.faceShift : 0);
                    // con le facciate a texture le finestre ci sono già
                    m[5] = this.theme === 1 || this.textured ? 0 : item.scale.y;
                }
                if (item.role === 'cactus') {
                    const visible = this.theme === 1 && !this.props.length ? 1 : 0;
                    m[0] = item.scale.x * visible;
                    m[5] = item.scale.y * visible;
                    m[10] = item.scale.z * visible;
                }
                batch.mesh.setMatrixAt(i++, item.matrix);
            }
            batch.mesh.instanceMatrix.needsUpdate = true;
        }
        for (const mesh of this.propBatches.values())
            mesh.count = 0;
        for (const p of this.props) {
            p.mesh.position.z = p.chunk.position.z + p.localZ;
            p.mesh.updateMatrix();
            const mesh = this.propBatches.get(p.spriteName);
            mesh.setMatrixAt(mesh.count++, p.mesh.matrix);
        }
        for (const mesh of this.propBatches.values())
            mesh.instanceMatrix.needsUpdate = true;
        const blend = 1 - Math.exp(-dt * .8), t = this.target;
        this.scene.background.lerp(this.color.set(t.sky), blend);
        this.scene.fog.color.lerp(this.color.set(t.fog), blend);
        if (!this.textured) {
            this.roadMaterial.color.lerp(this.color.set(t.road), blend);
            this.groundMaterial.color.lerp(this.color.set(t.ground), blend);
            this.buildingMaterials[0].color.lerp(this.color.set(t.primary), blend);
            this.buildingMaterials[1].color.lerp(this.color.set(t.secondary), blend);
        }
        this.accentMaterial.color.lerp(this.color.set(t.accent), blend);
        for (let k = 0; k < 2; k++)
            this.roofMaterials[k].color.lerp(this.color.set(ROOF_COLORS[this.theme][k]), blend);
        this.sun.material.color.lerp(this.color.set(t.sun), blend);
    }
    render(alpha, speed) {
        const offset = (alpha - 1) * speed * CONFIG.step;
        for (const batch of this.batches)
            batch.mesh.position.z = offset;
        // Stessa interpolazione della strada: i props non avanzano più a scatti a 60 Hz.
        for (const mesh of this.propBatches.values())
            mesh.position.z = offset;
    }
}
