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
            this.shots.push({ active: false, x: 0, y: 0, z: 0, previousZ: 0, hw: .15, hd: .4, bottom: 0, top: 0, speed: 0, delay: 0, wall: false, wallKind: '' });
        this.shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.18, 6, 4), material(0xff665b, true), this.shots.length);
        this.shotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shotMesh.frustumCulled = false;
        scene.add(this.shotMesh);
        // Muri di energia del boss: lastra luminosa larga una corsia più un contorno a filo.
        const wallGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
        this.wallMesh = new THREE.InstancedMesh(wallGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), this.shots.length);
        this.wallEdge = new THREE.InstancedMesh(wallGeometry, new THREE.MeshBasicMaterial({ color: 0xffb36b, wireframe: true, transparent: true, opacity: .8, toneMapped: false }), this.shots.length);
        this.wallColor = new THREE.Color();
        this.wallMesh.setColorAt(0, this.wallColor);
        for (const mesh of [this.wallMesh, this.wallEdge]) {
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            mesh.count = 0;
            scene.add(mesh);
        }
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
        e.age = e.previousAge = 0;
        e.phase = (lane + 1) * 1.7 + Math.abs(z) * .09;
        e.hover = e.previousHover = 0;
        e.flash = 0;
        e.fireTimer = CONFIG.enemies.drone.fireInterval;
        e.switchTimer = (CONFIG.enemies[type].switchInterval || 3) + (lane + 1) * .15;
        e.mesh.visible = true;
        e.mesh.position.set(e.x, 0, z);
        e.mesh.rotation.set(0, 0, 0);
        e.bar.scale.x = 1.4;
        return e;
    }
    // wall: colpo del boss. 'full' = muro pieno (solo cambiando corsia), 'low' = barra bassa da
    // saltare, 'high' = barra alta da passare in scivolata; false = sfera normale.
    shoot(lane, z, speed = CONFIG.enemies.shotSpeed, delay = 0, wall = false) {
        if (wall === true)
            wall = 'full';
        const b = this.shots.find(s => !s.active);
        if (!b)
            return;
        b.active = true;
        b.x = lane * CONFIG.player.laneWidth;
        b.y = .95;
        b.z = z;
        b.previousZ = z;
        b.wall = Boolean(wall);
        b.wallKind = wall || '';
        b.bottom = wall === 'high' ? CONFIG.boss.highBottom : wall ? 0 : .79;
        b.top = wall === 'low' ? CONFIG.boss.lowHeight : wall === 'high' ? CONFIG.boss.highTop : wall ? CONFIG.boss.wallHeight : 1.11;
        b.hw = wall ? CONFIG.player.laneWidth * .45 : .15;
        b.hd = wall ? CONFIG.boss.wallDepth : .4;
        b.speed = speed;
        b.delay = delay;
    }
    update(dt, game) {
        for (const e of this.pool)
            if (e.active) {
                e.previousAge = e.age;
                e.previousHover = e.hover;
                e.age += dt;
                e.previousX = e.x;
                e.previousZ = e.z;
                e.z += game.speed * dt;
                e.flash = Math.max(0, e.flash - dt);
                for (const p of e.parts)
                    p.mesh.material = e.flash > 0 ? white : p.material;
                const movement = CONFIG.enemies[e.type];
                if (e.type === 'runner' || e.type === 'soldier') {
                    e.switchTimer -= dt;
                    // Pattuglia solo tra corsie adiacenti occupabili, mai attraverso la via di fuga.
                    if (e.switchTimer <= 0 && e.z < movement.turnLimitZ && e.z > -85) {
                        e.switchTimer = movement.switchInterval;
                        const next = e.lane === -1 ? 0 : e.lane === 1 ? 0 : (e.safeLane === -1 ? 1 : -1);
                        if (next !== e.safeLane)
                            e.lane = next;
                    }
                    e.x += (e.lane * CONFIG.player.laneWidth - e.x) * (1 - Math.exp(-dt * movement.laneSmoothing));
                }
                if (e.type === 'drone') {
                    e.x = e.lane * CONFIG.player.laneWidth + Math.sin(e.age * 1.8 + e.phase) * .28;
                    e.hover = Math.sin(e.age * 3 + e.phase) * .12;
                    e.bottom = 1.15 + e.hover;
                    e.top = 1.95 + e.hover;
                    e.fireTimer -= dt;
                    if (e.fireTimer <= 0 && e.z < CONFIG.enemies.drone.fireNearZ && e.z > CONFIG.enemies.drone.fireFarZ) {
                        e.fireTimer = CONFIG.enemies.drone.fireInterval;
                        this.shoot(e.lane, e.z, CONFIG.enemies.shotSpeed, CONFIG.enemies.warningSeconds);
                    }
                }
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
                const age = e.previousAge + (e.age - e.previousAge) * alpha;
                const phase = age * (e.type === 'runner' ? 12 : 8) + e.phase;
                const stride = Math.sin(phase);
                const x = e.previousX + (e.x - e.previousX) * alpha;
                const lean = Math.max(-1, Math.min(1, (e.lane * CONFIG.player.laneWidth - x) / CONFIG.player.laneWidth));
                e.mesh.position.set(x, e.previousHover + (e.hover - e.previousHover) * alpha, e.previousZ + (e.z - e.previousZ) * alpha);
                e.mesh.rotation.z = e.type === 'drone' ? Math.cos(age * 1.8 + e.phase) * -.065 : e.type === 'tank' ? stride * .008 : -lean * .16 + stride * .025;
                if (e.sprite) {
                    const h = e.type === 'tank' ? 2.2 : e.type === 'drone' ? 1.2 : 1.95;
                    const walking = e.type === 'soldier' || e.type === 'runner';
                    const bounce = walking ? (1 - Math.cos(phase * 2)) * .045 : 0;
                    const squash = walking ? 1 + stride * .018 : 1;
                    const pop = e.flash > 0 ? 1.06 : 1;
                    e.sprite.material.color.setScalar(e.flash > 0 ? 2.2 : 1);
                    e.sprite.position.y = e.type === 'drone' ? 1.55 : bounce;
                    e.sprite.rotation.y = CONFIG.sprites.enemyAngle + lean * .22;
                    e.sprite.scale.set(h * SPRITES.aspect(e.spriteName) * pop / squash, h * pop * squash, 1);
                }
                if (e.limbs)
                    for (let i = 0; i < 4; i++)
                        e.limbs[i].rotation.x = Math.sin(phase + (i % 2) * Math.PI) * (i < 2 ? .55 : .35);
            }
        let n = 0, walls = 0;
        for (const s of this.shots)
            if (s.active && s.wall) {
                this.shotDummy.position.set(s.x, s.bottom, s.previousZ + (s.z - s.previousZ) * alpha);
                this.shotDummy.scale.set(s.hw * 2, s.top - s.bottom, s.hd * 2);
                this.shotDummy.updateMatrix();
                this.wallMesh.setColorAt(walls, this.wallColor.set(s.wallKind === 'full' ? 0xff3b2f : 0xffa21f));
                this.wallMesh.setMatrixAt(walls, this.shotDummy.matrix);
                this.wallEdge.setMatrixAt(walls++, this.shotDummy.matrix);
            }
            else if (s.active) {
                this.shotDummy.position.set(s.x, s.y, s.previousZ + (s.z - s.previousZ) * alpha);
                this.shotDummy.scale.setScalar(s.delay > 0 ? 1 + Math.sin(s.delay * 25) * .3 : 1);
                this.shotDummy.updateMatrix();
                this.shotMesh.setMatrixAt(n++, this.shotDummy.matrix);
            }
        this.shotMesh.count = n;
        this.shotMesh.instanceMatrix.needsUpdate = true;
        for (const mesh of [this.wallMesh, this.wallEdge]) {
            mesh.count = walls;
            mesh.instanceMatrix.needsUpdate = true;
        }
        if (this.wallMesh.instanceColor)
            this.wallMesh.instanceColor.needsUpdate = true;
    }
}
