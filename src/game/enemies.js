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
        // Colpi del boss. Muro pieno = cortina di plasma animata (shader) tra due piloni;
        // barra bassa/alta = due raggi laser con nucleo bianco tesi tra gli stessi piloni.
        const inst = (geometry, material, count) => {
            const mesh = new THREE.InstancedMesh(geometry, material, count);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            mesh.count = 0;
            scene.add(mesh);
            return mesh;
        };
        const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
        this.curtainMaterial = new THREE.ShaderMaterial({
            ...additive,
            side: THREE.DoubleSide,
            uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xff3b2f) } },
            vertexShader: `varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec4 p = vec4(position, 1.0);
                    #ifdef USE_INSTANCING
                    p = instanceMatrix * p;
                    #endif
                    gl_Position = projectionMatrix * modelViewMatrix * p;
                }`,
            fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                void main() {
                    float side = pow(1.0 - min(vUv.x, 1.0 - vUv.x) * 2.0, 7.0);
                    float cap = pow(1.0 - min(vUv.y, 1.0 - vUv.y) * 2.0, 10.0);
                    float bands = 0.5 + 0.5 * sin(vUv.y * 34.0 - uTime * 11.0);
                    float waves = 0.5 + 0.5 * sin(vUv.x * 18.0 + vUv.y * 6.0 + uTime * 5.0);
                    float sparks = step(0.94, hash(floor(vec2(vUv.x * 14.0, vUv.y * 5.0 - uTime * 3.0))));
                    float flicker = 0.85 + 0.15 * sin(uTime * 37.0 + vUv.y * 9.0);
                    float a = (0.3 + 0.55 * bands * bands * waves + side * 1.4 + cap * 1.0 + sparks * 0.5) * flicker;
                    vec3 col = mix(uColor, vec3(1.0, 0.92, 0.8), clamp(side * 0.7 + cap * 0.6 + sparks * 0.5, 0.0, 1.0));
                    // Fusione additiva: l'intensità va nel colore, l'alpha resta piena.
                    gl_FragColor = vec4(col * a, 1.0);
                }`,
        });
        this.curtains = inst(new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), this.curtainMaterial, this.shots.length);
        const beam = new THREE.CylinderGeometry(.5, .5, 1, 12).rotateZ(Math.PI / 2);
        this.beamCore = inst(beam, new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false }), this.shots.length * 2);
        this.beamGlow = inst(beam, new THREE.MeshBasicMaterial({ color: 0xff9a2a, opacity: .7, ...additive }), this.shots.length * 2);
        this.beamHalo = inst(beam, new THREE.MeshBasicMaterial({ color: 0xff6a1a, opacity: .25, ...additive }), this.shots.length * 2);
        this.posts = inst(new THREE.CylinderGeometry(.11, .16, 1, 8).translate(0, .5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.shots.length * 2);
        this.postColor = new THREE.Color();
        this.posts.setColorAt(0, this.postColor);
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
        let n = 0, curtains = 0, beams = 0, posts = 0;
        const time = performance.now() / 1000, d = this.shotDummy;
        this.curtainMaterial.uniforms.uTime.value = time;
        for (const s of this.shots)
            if (s.active && s.wall) {
                const z = s.previousZ + (s.z - s.previousZ) * alpha, w = s.hw * 2, full = s.wallKind === 'full';
                d.rotation.set(0, 0, 0);
                if (full) {
                    d.position.set(s.x, 0, z);
                    d.scale.set(w, s.top, 1);
                    d.updateMatrix();
                    this.curtains.setMatrixAt(curtains++, d.matrix);
                }
                else
                    for (const f of [.28, .78]) {
                        // Due raggi che pulsano sfasati; lo spessore del bagliore "respira".
                        const y = s.bottom + (s.top - s.bottom) * f, pulse = 1 + Math.sin(time * 18 + f * 9) * .15;
                        d.position.set(s.x, y, z);
                        d.scale.set(w, .1, .1);
                        d.updateMatrix();
                        this.beamCore.setMatrixAt(beams, d.matrix);
                        d.scale.set(w, .32 * pulse, .32 * pulse);
                        d.updateMatrix();
                        this.beamGlow.setMatrixAt(beams, d.matrix);
                        d.scale.set(w * 1.02, .85 * pulse, .85 * pulse);
                        d.updateMatrix();
                        this.beamHalo.setMatrixAt(beams++, d.matrix);
                    }
                // Piloni emettitori ai due lati della corsia.
                for (const side of [-1, 1]) {
                    d.position.set(s.x + side * (s.hw + .05), 0, z);
                    d.scale.set(1, full ? s.top + .25 : s.top + .15, 1);
                    d.updateMatrix();
                    this.posts.setMatrixAt(posts, d.matrix);
                    this.posts.setColorAt(posts++, this.postColor.set(full ? 0xff5040 : 0xffb347));
                }
            }
            else if (s.active) {
                this.shotDummy.position.set(s.x, s.y, s.previousZ + (s.z - s.previousZ) * alpha);
                this.shotDummy.scale.setScalar(s.delay > 0 ? 1 + Math.sin(s.delay * 25) * .3 : 1);
                this.shotDummy.updateMatrix();
                this.shotMesh.setMatrixAt(n++, this.shotDummy.matrix);
            }
        this.shotMesh.count = n;
        this.shotMesh.instanceMatrix.needsUpdate = true;
        for (const [mesh, count] of [[this.curtains, curtains], [this.beamCore, beams], [this.beamGlow, beams], [this.beamHalo, beams], [this.posts, posts]]) {
            mesh.count = count;
            mesh.instanceMatrix.needsUpdate = true;
        }
        if (this.posts.instanceColor)
            this.posts.instanceColor.needsUpdate = true;
    }
}
