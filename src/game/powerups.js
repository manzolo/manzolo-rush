import * as THREE from 'three';
import { CONFIG } from './config.js';
import { material } from './models.js';
import { SPRITES } from './sprites.js';
import { coinLaneReachable } from './collisions.js';
export const POWER_LABELS = { triple: 'TRIPLE', shield: 'SCUDO', magnet: 'MAGNETE', double: 'PUNTI ×2' };
export const POWER_SPRITES = { triple: 'powerup_triple', shield: 'powerup_shield', magnet: 'powerup_magnet', double: 'powerup_multiplier' };
const COLORS = { triple: 0xfa9b86, shield: 0x8bffd1, magnet: 0xbfa6ff, double: 0xffdc80 };
const COIN_HEIGHT = .62, POWER_HEIGHT = 1.15;
export class Pickups {
    constructor(scene) {
        this.coins = Array.from({ length: CONFIG.spawn.coinPool }, () => ({ active: false, x: 0, y: 0, z: 0 }));
        this.powers = Array.from({ length: CONFIG.spawn.powerPool }, () => ({ active: false, x: 0, y: 0, z: 0, type: 'triple' }));
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();
        this.phase = 0;
        const useSprites = CONFIG.sprites.enabled && CONFIG.sprites.pickups;
        // Monete: piano con lo sprite che ruota su sé stesso (effetto moneta che gira), altrimenti cilindro.
        this.coinSprite = useSprites && SPRITES.has('coin');
        this.coinMesh = this.coinSprite
            ? new THREE.InstancedMesh(SPRITES.geometry(false), SPRITES.material('coin'), this.coins.length)
            : new THREE.InstancedMesh(new THREE.CylinderGeometry(.27, .27, .08, 8), material(0xffd36d, true), this.coins.length);
        this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.coinMesh.frustumCulled = false;
        scene.add(this.coinMesh);
        // Power-up: un InstancedMesh per tipo (texture diversa), altrimenti un unico ottaedro colorato.
        this.powerSprites = useSprites && Object.values(POWER_SPRITES).every(name => SPRITES.has(name)) ? {} : null;
        if (this.powerSprites) {
            for (const type in POWER_SPRITES) {
                const mesh = new THREE.InstancedMesh(SPRITES.geometry(false), SPRITES.material(POWER_SPRITES[type]), this.powers.length);
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                mesh.frustumCulled = false;
                scene.add(mesh);
                this.powerSprites[type] = mesh;
            }
        }
        else {
            this.powerMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.48), material(0xffffff, true), this.powers.length);
            this.powerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            this.powerMesh.frustumCulled = false;
            scene.add(this.powerMesh);
        }
        // Armi raccoglibili: sprite weapon_<tipo> se c'è, altrimenti il blaster tinto del colore dell'arma.
        this.guns = Array.from({ length: 6 }, () => ({ active: false, x: 0, y: 0, z: 0, type: 'scatter' }));
        this.gunMeshes = {};
        for (const type in CONFIG.guns.types) {
            const own = SPRITES.has(`weapon_${type}`), name = own ? `weapon_${type}` : 'weapon_blaster';
            const mesh = SPRITES.has(name)
                ? new THREE.InstancedMesh(SPRITES.geometry(false), SPRITES.material(name, own ? {} : { color: CONFIG.guns.types[type].color }), this.guns.length)
                : new THREE.InstancedMesh(new THREE.OctahedronGeometry(.5), material(CONFIG.guns.types[type].color, true), this.guns.length);
            mesh.userData.sprite = SPRITES.has(name) ? name : null;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            scene.add(mesh);
            this.gunMeshes[type] = mesh;
        }
        // Anello luminoso sotto ogni arma, per distinguerla dai bonus.
        this.ringMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(.62, .05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.guns.length);
        this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.ringMesh.frustumCulled = false;
        this.ringMesh.setColorAt(0, this.color);
        scene.add(this.ringMesh);
    }
    gun(x, z, type) {
        const types = Object.keys(CONFIG.guns.types);
        const g = this.guns.find(g => !g.active);
        if (g)
            Object.assign(g, { active: true, x, y: 1.15, z, type: type || types[Math.floor(Math.random() * types.length)] });
    }
    reset() {
        for (const c of this.coins)
            c.active = false;
        for (const p of this.powers)
            p.active = false;
        for (const g of this.guns)
            g.active = false;
    }
    coin(x, y, z) {
        const c = this.coins.find(c => !c.active);
        if (c) {
            c.active = true;
            c.x = x;
            c.lane = Math.round(x / CONFIG.player.laneWidth);
            c.y = y;
            c.z = z;
        }
    }
    power(x, z, type = CONFIG.bonuses.types[Math.floor(Math.random() * CONFIG.bonuses.types.length)]) {
        const p = this.powers.find(p => !p.active);
        if (p) {
            p.active = true;
            p.x = x;
            p.y = 1.05;
            p.z = z;
            p.type = type;
        }
    }
    spawnRow(safeLane, z, pattern, row) {
        for (let i = 0; i < CONFIG.spawn.coinCount; i++)
            this.coin(safeLane * CONFIG.player.laneWidth, .85, z + 8 + i * CONFIG.spawn.coinSpacing);
        if (pattern === 'jump') {
            const lane = row[0].lane;
            for (let i = 0; i < CONFIG.collection.arcCount; i++)
                this.coin(lane * CONFIG.player.laneWidth, .8 + Math.sin(i / (CONFIG.collection.arcCount - 1) * Math.PI) * CONFIG.collection.arcHeight, z + (CONFIG.collection.arcCount - 1) * CONFIG.collection.arcSpacing / 2 - i * CONFIG.collection.arcSpacing);
        }
        if (Math.random() < CONFIG.spawn.powerChance)
            this.power(safeLane * CONFIG.player.laneWidth, z - 4);
        else if (Math.random() < CONFIG.guns.rowChance)
            this.gun(safeLane * CONFIG.player.laneWidth, z - 4);
    }
    update(dt, game) {
        this.phase += dt;
        const player = game.player;
        for (const c of this.coins)
            if (c.active) {
                c.z += game.speed * dt;
                const dx = player.x - c.x, dy = player.y + .9 - c.y, dz = CONFIG.player.z - c.z;
                const magnet = game.powerups.magnet > 0;
                const reachable = coinLaneReachable(player, c, magnet);
                if (magnet && reachable && dx * dx + dy * dy + dz * dz < CONFIG.bonuses.magnetRadius ** 2) {
                    const f = 1 - Math.exp(-dt * CONFIG.collection.magnetPull);
                    c.x += dx * f;
                    c.y += dy * f;
                    c.z += dz * f;
                }
                if (reachable && Math.abs(player.x - c.x) < CONFIG.collection.coinRadius && Math.abs(CONFIG.player.z - c.z) < CONFIG.collection.coinRadius && c.y > player.y - .2 && c.y < player.y + player.height + .35) {
                    c.active = false;
                    game.coins++;
                    game.reward += CONFIG.bonuses.coinScore * game.multiplier;
                    game.audio?.play('coin');
                    game.ui?.coinFly();
                    game.effects?.emit(c.x, c.y, c.z, 0xffd36d, 3);
                }
                if (c.z > CONFIG.world.despawnZ)
                    c.active = false;
            }
        for (const p of this.powers)
            if (p.active) {
                p.z += game.speed * dt;
                if (Math.abs(player.x - p.x) < CONFIG.collection.powerRadius && Math.abs(CONFIG.player.z - p.z) < CONFIG.collection.powerRadius && Math.abs(player.y + .8 - p.y) < 1.1) {
                    p.active = false;
                    game.powerups[p.type] = CONFIG.bonuses.duration;
                    game.audio?.play('power');
                    game.announce?.(POWER_LABELS[p.type] + ' ATTIVO');
                }
                if (p.z > CONFIG.world.despawnZ)
                    p.active = false;
            }
        for (const g of this.guns)
            if (g.active) {
                g.z += game.speed * dt;
                if (Math.abs(player.x - g.x) < CONFIG.collection.powerRadius && Math.abs(CONFIG.player.z - g.z) < CONFIG.collection.powerRadius && Math.abs(player.y + .8 - g.y) < 1.1) {
                    g.active = false;
                    game.weapons.equip(g.type, game);
                    game.effects?.emit(g.x, g.y, g.z, CONFIG.guns.types[g.type].color, 14);
                }
                if (g.z > CONFIG.world.despawnZ)
                    g.active = false;
            }
    }
    render(alpha = 1, speed = 0) {
        const offset = (alpha - 1) * speed * CONFIG.step;
        let n = 0;
        if (this.coinSprite)
            this.dummy.scale.set(COIN_HEIGHT * SPRITES.aspect('coin'), COIN_HEIGHT, 1);
        else
            this.dummy.scale.setScalar(1);
        for (const c of this.coins)
            if (c.active) {
                this.dummy.position.set(c.x, c.y + Math.sin(this.phase * 3 + c.z) * .04, c.z + offset);
                if (this.coinSprite)
                    this.dummy.rotation.set(0, this.phase * 2.5 + c.z * .25, 0);
                else
                    this.dummy.rotation.set(Math.PI / 2, this.phase * 2, 0);
                this.dummy.updateMatrix();
                this.coinMesh.setMatrixAt(n++, this.dummy.matrix);
            }
        this.coinMesh.count = n;
        this.coinMesh.instanceMatrix.needsUpdate = true;
        const gunCounts = {};
        let rings = 0;
        for (const type in this.gunMeshes)
            gunCounts[type] = 0;
        for (const g of this.guns)
            if (g.active) {
                const mesh = this.gunMeshes[g.type], bob = Math.sin(this.phase * 4 + g.z) * .14;
                this.dummy.position.set(g.x, g.y + bob, g.z + offset);
                if (mesh.userData.sprite) {
                    const h = .95;
                    this.dummy.rotation.set(0, Math.sin(this.phase * 2.5) * .4, Math.sin(this.phase * 3) * .12);
                    this.dummy.scale.set(h * SPRITES.aspect(mesh.userData.sprite), h, 1);
                }
                else {
                    this.dummy.rotation.set(.4, this.phase * 2, .3);
                    this.dummy.scale.setScalar(1);
                }
                this.dummy.updateMatrix();
                mesh.setMatrixAt(gunCounts[g.type]++, this.dummy.matrix);
                this.dummy.position.set(g.x, .08, g.z + offset);
                this.dummy.rotation.set(Math.PI / 2, 0, 0);
                this.dummy.scale.setScalar(1 + Math.sin(this.phase * 6) * .08);
                this.dummy.updateMatrix();
                this.ringMesh.setMatrixAt(rings, this.dummy.matrix);
                this.ringMesh.setColorAt(rings++, this.color.set(CONFIG.guns.types[g.type].color));
            }
        for (const type in this.gunMeshes) {
            this.gunMeshes[type].count = gunCounts[type];
            this.gunMeshes[type].instanceMatrix.needsUpdate = true;
        }
        this.ringMesh.count = rings;
        this.ringMesh.instanceMatrix.needsUpdate = true;
        if (this.ringMesh.instanceColor)
            this.ringMesh.instanceColor.needsUpdate = true;
        if (this.powerSprites) {
            const counts = {};
            for (const type in this.powerSprites)
                counts[type] = 0;
            for (const p of this.powers)
                if (p.active) {
                    const mesh = this.powerSprites[p.type];
                    this.dummy.position.set(p.x, p.y + Math.sin(this.phase * 4) * .16, p.z + offset);
                    this.dummy.rotation.set(0, Math.sin(this.phase * 2) * .35, Math.sin(this.phase * 3) * .1);
                    this.dummy.scale.set(POWER_HEIGHT * SPRITES.aspect(POWER_SPRITES[p.type]), POWER_HEIGHT, 1);
                    this.dummy.updateMatrix();
                    mesh.setMatrixAt(counts[p.type]++, this.dummy.matrix);
                }
            for (const type in this.powerSprites) {
                this.powerSprites[type].count = counts[type];
                this.powerSprites[type].instanceMatrix.needsUpdate = true;
            }
            return;
        }
        n = 0;
        this.dummy.scale.setScalar(1);
        for (const p of this.powers)
            if (p.active) {
                this.dummy.position.set(p.x, p.y + Math.sin(this.phase * 4) * .16, p.z + offset);
                this.dummy.rotation.set(.4, this.phase * 2, .3);
                this.dummy.updateMatrix();
                this.powerMesh.setMatrixAt(n, this.dummy.matrix);
                this.powerMesh.setColorAt(n++, this.color.set(COLORS[p.type]));
            }
        this.powerMesh.count = n;
        this.powerMesh.instanceMatrix.needsUpdate = true;
        if (this.powerMesh.instanceColor)
            this.powerMesh.instanceColor.needsUpdate = true;
    }
}
