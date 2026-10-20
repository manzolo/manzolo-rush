import * as THREE from 'three';
import { CONFIG } from './config.js';
import { actor, block, material } from './models.js';
import { SPRITES, billboard } from './sprites.js';
const types = ['soldier', 'runner', 'drone', 'tank'];
// Preferisce le viste frontali (sheet_hero_rear), altrimenti quelle di profilo dello sheet principale.
const FRONT_NAMES = { soldier: 'enemy_front_grunt', runner: 'enemy_front_dodger', drone: 'enemy_front_drone', tank: 'enemy_front_tank' };
const SIDE_NAMES = { soldier: 'enemy_grunt', runner: 'enemy_dodger', drone: 'enemy_drone', tank: 'enemy_tank' };
const spriteName = type => SPRITES.has(FRONT_NAMES[type]) ? FRONT_NAMES[type] : SIDE_NAMES[type];
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
export class Enemies {
    constructor(scene) {
        this.pool = [];
        this.shots = [];
        this.shotDummy = new THREE.Object3D();
        for (let i = 0; i < CONFIG.spawn.enemyPool; i++) {
            const type = types[i % 4], mesh = new THREE.Group();
            scene.add(mesh);
            let limbs = null, sprite = null;
            const name = spriteName(type);
            if (CONFIG.sprites.enabled && CONFIG.sprites.enemies && SPRITES.has(name)) {
                // Sprite rivolto verso il giocatore; le hitbox restano quelle dei modelli.
                sprite = billboard(name, type === 'tank' ? 2.2 : type === 'drone' ? 1.2 : 1.95, type !== 'drone');
                if (type === 'drone')
                    sprite.position.y = 1.55;
                sprite.rotation.y = CONFIG.sprites.enemyAngle;
                mesh.add(sprite);
            }
            else if (type === 'drone') {
                block(mesh, 0x775f91, 0, 1.55, 0, 1.1, .55, .8);
                block(mesh, 0xff7263, 0, 1.45, .45, .5, .17, .1, true);
                for (const x of [-.85, .85]) {
                    block(mesh, 0x243d50, x, 1.65, 0, .8, .12, .8);
                    block(mesh, 0x8bffd1, x, 1.68, 0, .55, .03, .13, true);
                }
            }
            else if (type === 'tank') {
                block(mesh, 0x667c76, 0, .6, 0, 1.9, .85, 1.7);
                block(mesh, 0x8b9d83, 0, 1.25, 0, 1.25, .7, 1.1);
                block(mesh, 0xff976d, 0, 1.3, 1, .3, .25, 1.3);
                for (const x of [-.95, .95])
                    block(mesh, 0x253b46, x, .3, 0, .35, .5, 2);
            }
            else {
                const model = actor(type === 'runner' ? 0xb1a1f1 : 0xe5bd6c);
                mesh.add(model.root);
                model.root.rotation.y = Math.PI;
                limbs = model.limbs;
            }
            const bar = block(mesh, 0x8bffd1, 0, type === 'tank' ? 2 : 2.3, 0, 1.4, .09, .07, true);
            bar.visible = type === 'tank';
            const parts = [];
            mesh.traverse(child => {
                if (child.isMesh && child !== bar && child !== sprite)
                    parts.push({ mesh: child, material: child.material });
            });
            mesh.visible = false;
            this.pool.push({ type, mesh, limbs, sprite, spriteName: name, parts, bar, active: false, x: 0, z: 0, hw: type === 'tank' ? .95 : .52, hd: type === 'tank' ? 1 : .42, bottom: type === 'drone' ? 1.15 : 0, top: type === 'drone' ? 1.95 : 1.95, flash: 0, age: 0 });
        }
        for (let i = 0; i < CONFIG.enemies.shotPool; i++)
            this.shots.push({ active: false, x: 0, y: 0, z: 0, previousZ: 0, hw: .15, hd: .4, bottom: 0, top: 0, speed: 0, delay: 0 });
        this.shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.18, 6, 4), material(0xff665b, true), this.shots.length);
        this.shotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shotMesh.frustumCulled = false;
        scene.add(this.shotMesh);
    }
    spawn(type, lane, z, safeLane) {
        const e = this.pool.find(e => !e.active && e.type === type);
        if (!e)
            return;
        e.active = true;
        e.lane = lane;
        e.safeLane = safeLane;
        e.x = lane * CONFIG.player.laneWidth;
        e.z = z;
        e.previousZ = z;
        e.previousX = e.x;
        e.maxHp = CONFIG.enemies[type].hp;
        e.hp = e.maxHp;
        e.age = 0;
        e.flash = 0;
        e.fireTimer = CONFIG.enemies.drone.fireInterval;
        e.switchTimer = CONFIG.enemies.runner.switchInterval;
        e.mesh.visible = true;
        e.mesh.position.set(e.x, 0, z);
        e.bar.scale.x = 1.4;
        return e;
    }
    shoot(lane, z, speed = CONFIG.enemies.shotSpeed, delay = 0) {
        const b = this.shots.find(s => !s.active);
        if (!b)
            return;
        b.active = true;
        b.x = lane * CONFIG.player.laneWidth;
        b.y = .95;
        b.z = z;
        b.previousZ = z;
        b.bottom = .79;
        b.top = 1.11;
        b.speed = speed;
        b.delay = delay;
    }
    update(dt, game) {
        for (const e of this.pool)
            if (e.active) {
                e.age += dt;
                e.previousX = e.x;
                e.previousZ = e.z;
                e.z += game.speed * dt;
                e.flash = Math.max(0, e.flash - dt);
                for (const p of e.parts)
                    p.mesh.material = e.flash > 0 ? white : p.material;
                if (e.sprite) {
                    // Il colpo si segnala con un tinta chiara e un piccolo "pop" di scala.
                    e.sprite.material.color.setScalar(e.flash > 0 ? 2.2 : 1);
                    const h = e.type === 'tank' ? 2.2 : e.type === 'drone' ? 1.2 : 1.95, pop = e.flash > 0 ? 1.08 : 1;
                    e.sprite.scale.set(h * SPRITES.aspect(e.spriteName) * pop, h * pop, 1);
                    if (e.type === 'soldier' || e.type === 'runner')
                        e.sprite.position.y = Math.abs(Math.sin(e.age * 9)) * .07;
                }
                if (e.type === 'runner') {
                    e.switchTimer -= dt;
                    // Lo spostamento non può attraversare la corsia libera né iniziare a ridosso del giocatore.
                    if (e.switchTimer <= 0 && e.z < CONFIG.enemies.runner.turnLimitZ) {
                        e.switchTimer = CONFIG.enemies.runner.switchInterval;
                        const next = e.lane === -1 ? 0 : e.lane === 1 ? 0 : (e.safeLane === -1 ? 1 : -1);
                        if (next !== e.safeLane)
                            e.lane = next;
                    }
                    e.x += (e.lane * CONFIG.player.laneWidth - e.x) * (1 - Math.exp(-dt * CONFIG.enemies.runner.laneSmoothing));
                }
                if (e.type === 'drone') {
                    e.fireTimer -= dt;
                    if (e.fireTimer <= 0 && e.z < CONFIG.enemies.drone.fireNearZ && e.z > CONFIG.enemies.drone.fireFarZ) {
                        e.fireTimer = CONFIG.enemies.drone.fireInterval;
                        this.shoot(e.lane, e.z, CONFIG.enemies.shotSpeed, CONFIG.enemies.warningSeconds);
                    }
                }
                e.mesh.position.set(e.x, 0, e.z);
                if (e.type === 'drone')
                    e.mesh.position.y = Math.sin(e.age * 4) * .1;
                if (e.limbs)
                    for (let i = 0; i < 4; i++)
                        e.limbs[i].rotation.x = Math.sin(e.age * 7 + i * Math.PI) * .25;
                if (e.z > CONFIG.world.despawnZ)
                    this.remove(e);
            }
        for (const s of this.shots)
            if (s.active) {
                s.previousZ = s.z;
                if (s.delay > 0) {
                    s.delay -= dt;
                    continue;
                }
                s.z += s.speed * dt;
                if (s.z > CONFIG.world.despawnZ)
                    s.active = false;
            }
    }
    damage(e, damage) { e.hp -= damage; e.flash = .08; e.bar.scale.x = 1.4 * Math.max(0, e.hp / e.maxHp); return e.hp <= 0; }
    remove(e) {
        e.active = false;
        e.mesh.visible = false;
        for (const p of e.parts)
            p.mesh.material = p.material;
        if (e.sprite)
            e.sprite.material.color.setScalar(1);
    }
    reset() {
        for (const e of this.pool)
            this.remove(e);
        for (const s of this.shots)
            s.active = false;
    }
    render(alpha = 1) {
        for (const e of this.pool)
            if (e.active) {
                e.mesh.position.x = e.previousX + (e.x - e.previousX) * alpha;
                e.mesh.position.z = e.previousZ + (e.z - e.previousZ) * alpha;
            }
        let n = 0;
        for (const s of this.shots)
            if (s.active) {
                this.shotDummy.position.set(s.x, s.y, s.previousZ + (s.z - s.previousZ) * alpha);
                this.shotDummy.scale.setScalar(s.delay > 0 ? 1 + Math.sin(s.delay * 25) * .3 : 1);
                this.shotDummy.updateMatrix();
                this.shotMesh.setMatrixAt(n++, this.shotDummy.matrix);
            }
        this.shotMesh.count = n;
        this.shotMesh.instanceMatrix.needsUpdate = true;
    }
}
