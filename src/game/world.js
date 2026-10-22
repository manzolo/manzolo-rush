import * as THREE from 'three';
import { CONFIG, THEMES } from './config.js';
import { block } from './models.js';
import { SPRITES } from './sprites.js';
import { Atmosphere } from './atmosphere.js';
import { residentialFacade, officeFacade } from './facades.js';
import { SHARED_PROPS } from './scenery.js';
import { Landscape } from './landscape.js';
const WHITE = new THREE.Color(0xffffff);
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
        this.scroll = 0;
        // Lambert invece di Standard: palazzi, strada e terreno coprono gran parte dello schermo
        // (soprattutto i palazzi alti della città) e l'illuminazione PBR per pixel costava troppo.
        this.roadMaterial = new THREE.MeshLambertMaterial({ color: THEMES[0].road });
        this.buildingMaterials = [new THREE.MeshLambertMaterial(), new THREE.MeshLambertMaterial()];
        this.groundMaterial = new THREE.MeshLambertMaterial();
        this.roofMaterials = THEMES[0].roofs.map(color => new THREE.MeshLambertMaterial({ color }));
        this.accentMaterial = new THREE.MeshBasicMaterial();
        const s = CONFIG.sprites;
        // Ripiego per singolo ambiente: un asset mancante non spegne gli altri cinque.
        this.tiles = THEMES.map(t => {
            if (!s.enabled || !s.textures || !t.textures.every(n => SPRITES.has(n))) return null;
            const [a, b, road, ground] = t.textures;
            return { facadeA: tile(a, 1, 2.5), facadeB: tile(b, 1, 2.5), road: tile(road, 3, 7), ground: tile(ground, 90, 90) };
        });
        if (this.tiles[0]) {
            // Città: facciate vettoriali disegnate su canvas, più leggere e intonate al tramonto.
            if (s.vectorCity) {
                const a = residentialFacade(1, 2.5), b = officeFacade(1, 2.5);
                if (a && b)
                    Object.assign(this.tiles[0], { facadeA: a, facadeB: b });
            }
            for (const m of [this.roadMaterial, this.groundMaterial, ...this.buildingMaterials]) {
                m.color.set(0xffffff);
            }
        }
        this.props = [];
        this.propBatches = new Map();
        this.propsEnabled = s.enabled && s.props;
        if (this.propsEnabled)
            for (const [name] of THEMES.flatMap(t => t.props).concat(SHARED_PROPS)) {
                if (!SPRITES.has(name) || this.propBatches.has(name)) continue;
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
                const pole = block(group, 0x253e4d, side * 5.8, 2.4, -4, .1, 4.8, .12);
                pole.userData.role = 'streetlight';
                const lamp = block(group, 0xffe3bb, side * 5.5, 4.8, -4, .8, .12, .35, true);
                lamp.userData.role = 'streetlight';
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
                        this.props.push({ mesh, side, chunk: group, localZ: -11 + k * 12 + ((c * 5 + k * 3) % 5) - 2, index: c * 4 + k * 2 + (side > 0 ? 1 : 0) });
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
        this.landscape = new Landscape(scene, this.chunks, this.tiles);
        this.atmosphere = new Atmosphere(scene);
        // Colori del livello (LEVELS[i].tint) mescolati al tema: `levelBlend` sale piano a ogni cambio.
        this.levelTint = null;
        this.levelBlend = 0;
        this.tintColor = new THREE.Color();
        this.setTheme(0, true);
        this.update(0, 0);
    }
    setTheme(index, immediate = false) {
        this.theme = index % THEMES.length;
        this.target = THEMES[this.theme];
        const t = this.tiles[this.theme];
        this.landscape.setTheme(this.target.id);
        this.textured = Boolean(t);
        const swap = (m, map) => { if (m.map !== map) { m.map = map; m.needsUpdate = true; } };
        swap(this.roadMaterial, t?.road ?? null);
        swap(this.groundMaterial, t?.ground ?? null);
        swap(this.buildingMaterials[0], t?.facadeA ?? null);
        swap(this.buildingMaterials[1], t?.facadeB ?? null);
        const available = this.target.props.filter(([name]) => this.propBatches.has(name));
        const shared = SHARED_PROPS.filter(([name]) => this.propBatches.has(name));
        this.hasThemeProps = available.length > 0;
        for (const p of this.props) {
            // Negli ambienti naturali solo oggetti del luogo, senza coni o blocchi urbani.
            const list = !this.target.natural && shared.length && (p.index % 3 === 2 || !available.length) ? shared : available;
            if (!list.length) { p.spriteName = null; continue; }
            const [name, h] = list[(p.index * 7) % list.length];
            p.spriteName = name;
            const width = h * SPRITES.aspect(name);
            p.mesh.scale.set(width, h, 1);
            // Alberi e archi larghi restano interamente fuori dal bordo della strada.
            p.mesh.position.x = p.side * Math.max(6.1 + (p.index % 2) * .5, 5.5 + width / 2);
        }
        this.prepareInstances();
        if (immediate) {
            this.atmosphere.reset();
            this.scene.background = new THREE.Color(this.target.sky);
            this.scene.fog = new THREE.Fog(this.target.fog, 35, 160);
            if (!this.textured) {
                this.roadMaterial.color.set(this.target.road);
                this.groundMaterial.color.set(this.target.ground);
                this.buildingMaterials[0].color.set(this.target.primary);
                this.buildingMaterials[1].color.set(this.target.secondary);
            }
            else
                for (const material of [this.roadMaterial, this.groundMaterial, ...this.buildingMaterials])
                    material.color.set(0xffffff);
            this.accentMaterial.color.set(this.target.accent);
            for (let k = 0; k < 2; k++)
                this.roofMaterials[k].color.set(this.target.roofs[k]);
            this.sun.material.color.set(this.target.sun);
        }
    }
    // Dimensioni e rotazioni cambiano solo quando si cambia ambiente.
    prepareInstances() {
        const profile = this.target;
        for (const batch of this.batches) {
            for (const item of batch.items) {
                const m = item.matrix.elements;
                // Sagome definite dal tema: torri, mesas, rovine o solo paesaggio naturale.
                if (item.building) {
                    m[0] = item.scale.x * profile.width;
                    m[5] = item.scale.y * profile.height;
                    m[13] = item.local.y * profile.height;
                }
                if (item.role === 'roof') {
                    m[0] = profile.natural ? 0 : item.scale.x * profile.width;
                    m[5] = profile.natural ? 0 : item.scale.y;
                    m[10] = profile.natural ? 0 : item.scale.z;
                    m[13] = item.base * profile.height + item.dy;
                }
                if (item.role === 'window') {
                    m[13] = item.local.y * profile.height;
                    m[12] = item.local.x + item.faceShift * ((1 - profile.width) / .3);
                    // con le facciate a texture le finestre ci sono già
                    const visible = profile.windows && !this.textured;
                    m[0] = visible ? item.scale.x : 0;
                    m[5] = visible ? item.scale.y : 0;
                    m[10] = visible ? item.scale.z : 0;
                }
                if (item.role === 'streetlight') {
                    m[0] = profile.streetlights ? item.scale.x : 0;
                    m[5] = profile.streetlights ? item.scale.y : 0;
                    m[10] = profile.streetlights ? item.scale.z : 0;
                }
                if (item.role === 'cactus') {
                    const visible = profile.id === 'desert' && !this.hasThemeProps ? 1 : 0;
                    m[0] = item.scale.x * visible;
                    m[5] = item.scale.y * visible;
                    m[10] = item.scale.z * visible;
                }
            }
        }
        for (const p of this.props)
            if (p.spriteName) p.mesh.updateMatrix();
        this.rebuildInstances();
    }
    // Aggiorna le posizioni solo al cambio tema o quando un chunk torna in fondo.
    // Tra due ricicli basta traslare i batch interi: nessun upload delle matrici.
    rebuildInstances() {
        this.scroll = 0;
        for (const batch of this.batches) {
            let i = 0;
            for (const item of batch.items) {
                item.matrix.elements[14] = item.local.z + item.chunk.position.z;
                batch.mesh.setMatrixAt(i++, item.matrix);
            }
            batch.mesh.instanceMatrix.needsUpdate = true;
        }
        this.landscape.update();
        for (const mesh of this.propBatches.values())
            mesh.count = 0;
        for (const p of this.props) {
            if (!p.spriteName) continue;
            p.mesh.position.z = p.chunk.position.z + p.localZ;
            p.mesh.matrix.elements[14] = p.mesh.position.z;
            const mesh = this.propBatches.get(p.spriteName);
            mesh.setMatrixAt(mesh.count++, p.mesh.matrix);
        }
        for (const mesh of this.propBatches.values())
            if (mesh.count) mesh.instanceMatrix.needsUpdate = true;
    }
    // tint: palette del livello (null = nessuna); immediate = senza dissolvenza (nuova corsa).
    setLevel(tint, immediate = false) {
        this.levelTint = tint;
        if (immediate)
            this.levelBlend = 0;
    }
    // season: stagione dello scontro in corso ('storm', 'inferno', 'winter') o false.
    update(dt, speed, season = false) {
        this.atmosphere.update(dt, season);
        this.levelBlend += ((this.levelTint ? this.levelTint.amount : 0) - this.levelBlend) * (1 - Math.exp(-dt * .6));
        this.phase += dt;
        const distance = speed * dt;
        this.scroll += distance;
        let recycled = false;
        for (const chunk of this.chunks) {
            chunk.position.z += distance;
            while (chunk.position.z > 36) {
                chunk.position.z -= CONFIG.world.chunks * CONFIG.world.chunkLength;
                recycled = true;
            }
        }
        if (recycled) this.rebuildInstances();
        const blend = 1 - Math.exp(-dt * 1.8), t = this.target, heat = this.atmosphere.strength, hell = this.atmosphere.palette;
        const tint = this.levelTint, amount = tint ? this.levelBlend : 0, flash = this.atmosphere.flash * heat;
        // Tema → colori del livello → stagione dello scontro; il lampo schiarisce cielo e nebbia.
        const mix = (base, key) => {
            this.color.set(base);
            if (tint && amount > 0)
                this.color.lerp(this.tintColor.set(tint[key]), amount);
            return this.color.lerp(hell[key], heat);
        };
        this.scene.background.lerp(mix(t.sky, 'sky'), blend).lerp(WHITE, flash * .55);
        this.scene.fog.color.lerp(mix(t.fog, 'fog'), blend).lerp(WHITE, flash * .35);
        this.scene.fog.near = 35 - heat * (35 - this.atmosphere.fogNear) * .25;
        this.scene.fog.far = 160 - heat * (160 - this.atmosphere.fogFar);
        this.roadMaterial.color.lerp(mix(this.textured ? 0xffffff : t.road, 'road'), blend);
        this.groundMaterial.color.lerp(mix(this.textured ? 0xffffff : t.ground, 'ground'), blend);
        this.buildingMaterials[0].color.lerp(mix(this.textured ? 0xffffff : t.primary, 'building'), blend);
        this.buildingMaterials[1].color.lerp(mix(this.textured ? 0xffffff : t.secondary, 'building'), blend);
        this.accentMaterial.color.lerp(mix(t.accent, 'accent'), blend);
        for (let k = 0; k < 2; k++)
            this.roofMaterials[k].color.lerp(mix(t.roofs[k], 'roof'), blend);
        for (const layer of this.landscape.layers)
            if (layer.mesh.visible) layer.mesh.material.color.lerp(mix(layer.mesh.material.map ? 0xffffff : layer.color, layer.key), blend);
        this.sun.material.color.lerp(mix(t.sun, 'sun'), blend);
    }
    render(alpha, speed) {
        const offset = this.scroll + (alpha - 1) * speed * CONFIG.step;
        this.landscape.render(offset);
        for (const batch of this.batches)
            batch.mesh.position.z = offset;
        // Stessa interpolazione della strada: i props non avanzano più a scatti a 60 Hz.
        for (const mesh of this.propBatches.values())
            mesh.position.z = offset;
    }
}
