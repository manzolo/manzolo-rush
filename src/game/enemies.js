import * as THREE from 'three';
import { CONFIG } from './config.js';
import { actor, block, material } from './models.js';
import { SPRITES, billboard } from './sprites.js';
import { CREATURES, creatureReady } from './creatures.js';
import { BOSSES } from './bosses.js';
const types = ['soldier', 'runner', 'drone', 'tank', 'stalker'];
// Preferisce le viste frontali (sheet_hero_rear), altrimenti quelle di profilo dello sheet principale.
const FRONT_NAMES = { soldier: 'enemy_front_grunt', runner: 'enemy_front_dodger', drone: 'enemy_front_drone', tank: 'enemy_front_tank', stalker: 'enemy_front_grunt' };
const SIDE_NAMES = { soldier: 'enemy_grunt', runner: 'enemy_dodger', drone: 'enemy_drone', tank: 'enemy_tank', stalker: 'enemy_grunt' };
const spriteName = type => SPRITES.has(FRONT_NAMES[type]) ? FRONT_NAMES[type] : SIDE_NAMES[type];
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
// Matrice a scala zero: nasconde un'istanza senza cambiare l'ordine del batch.
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
// Gradiente radiale condiviso: ombre a terra (nero) e bagliori di carica dell'arma (additivo).
function radialTexture(inner, outer) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}
// Altezza dell'arma (bocca di fuoco) per il bagliore di carica e il colpo.
const MUZZLE = { soldier: [0, 1.2, .45], runner: [0, 1.1, .4], drone: [0, 1.5, .5], tank: [0, .75, .9], stalker: [0, 1.1, .4] };
export class Enemies {
    constructor(scene) {
        this.pool = [];
        this.shots = [];
        this.shotDummy = new THREE.Object3D();
        for (let i = 0; i < CONFIG.spawn.enemyPool; i++) {
            const type = types[i % types.length], mesh = new THREE.Group();
            scene.add(mesh);
            let limbs = null, sprite = null, beast = null;
            let name = spriteName(type);
            if (CONFIG.sprites.enabled && CONFIG.sprites.enemies && creatureReady(type)) {
                // Creatura animata: un solo piano a cui si cambia il fotogramma in base alla posa.
                beast = CREATURES[type];
                name = beast.idle[0];
                sprite = billboard(name, beast.height, true);
                sprite.material = sprite.material.clone();
                mesh.add(sprite);
            }
            else if (CONFIG.sprites.enabled && CONFIG.sprites.enemies && SPRITES.has(name)) {
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
            if (beast)
                bar.position.y = beast.height + .2;
            bar.visible = type === 'tank';
            const parts = [];
            mesh.traverse(child => {
                if (child.isMesh && child !== bar && child !== sprite)
                    parts.push({ mesh: child, material: child.material });
            });
            const muzzle = new THREE.Sprite(this.muzzleMaterial(type));
            muzzle.position.set(...MUZZLE[type]);
            muzzle.visible = false;
            mesh.add(muzzle);
            mesh.visible = false;
            this.pool.push({ type, mesh, limbs, sprite, beast, frame: name, muzzle, spriteName: name, parts, bar, active: false, hidden: false, cloak: 0, dying: 0, charge: 0, recoil: 0, knock: 0, x: 0, z: 0, hw: type === 'tank' ? .95 : .52, hd: type === 'tank' ? 1 : .42, bottom: type === 'drone' ? 1.15 : 0, top: type === 'drone' ? 1.95 : 1.95, flash: 0, age: 0 });
        }
        for (let i = 0; i < CONFIG.enemies.shotPool; i++)
            this.shots.push({ active: false, x: 0, y: 0, z: 0, previousZ: 0, hw: .15, hd: .4, bottom: 0, top: 0, speed: 0, delay: 0, wall: false, wallKind: '', skin: '' });
        this.shotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.18, 6, 4), material(0xff665b, true), this.shots.length);
        this.shotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.shotMesh.frustumCulled = false;
        scene.add(this.shotMesh);
        // Colpi delle creature (palla di fuoco, macigno, mazza chiodata, dardo di foglie): un batch per sprite.
        this.shotSprites = new Map();
        for (const c of Object.values(CREATURES))
            if (SPRITES.has(c.shot) && !this.shotSprites.has(c.shot)) {
                const mesh = new THREE.InstancedMesh(SPRITES.geometry(false), SPRITES.material(c.shot, { depthWrite: false }), this.shots.length);
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                mesh.frustumCulled = false;
                mesh.count = 0;
                scene.add(mesh);
                this.shotSprites.set(c.shot, mesh);
            }
        // Muri e barre dei boss dei livelli (fulmine, colata, spuntoni di ghiaccio…), appoggiati a terra.
        this.wallSprites = new Map();
        for (const b of Object.values(BOSSES))
            for (const name of [b.walls.full, b.walls.low, b.walls.high].flat())
                if (SPRITES.has(name) && !this.wallSprites.has(name)) {
                    // Il colpo alto ruota attorno al suo centro, gli altri poggiano a terra.
                    const mesh = new THREE.InstancedMesh(SPRITES.geometry(name !== b.walls.high), SPRITES.material(name, { depthWrite: false }), this.shots.length);
                    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                    mesh.frustumCulled = false;
                    mesh.count = 0;
                    scene.add(mesh);
                    this.wallSprites.set(name, mesh);
                }
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
            // Campo di forza esagonale che scorre e si dissolve in alto: un muro di energia, non un cancello.
            fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
                float hexEdge(vec2 p) {
                    vec2 r = vec2(1.0, 1.732), h = r * 0.5;
                    vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
                    vec2 g = dot(a, a) < dot(b, b) ? a : b;
                    vec2 q = abs(g);
                    return 0.5 - max(dot(q, normalize(vec2(1.0, 1.732))), q.x);
                }
                void main() {
                    vec2 p = vUv * vec2(2.7, 3.4) * 2.2 + vec2(0.0, -uTime * 0.6);
                    float edge = hexEdge(p);
                    float lines = smoothstep(0.07, 0.0, edge);
                    float side = pow(1.0 - min(vUv.x, 1.0 - vUv.x) * 2.0, 6.0);
                    float ground = pow(1.0 - vUv.y, 9.0);
                    // Bordo superiore irregolare, come una fiamma che sale.
                    float crest = 0.82 + 0.08 * sin(vUv.x * 17.0 + uTime * 6.0) + 0.05 * sin(vUv.x * 41.0 - uTime * 9.0);
                    float fade = smoothstep(crest, crest - 0.35, vUv.y);
                    float sweep = exp(-pow((vUv.y - fract(uTime * 0.7) * 1.3 + 0.15) * 7.0, 2.0));
                    float pulse = 0.85 + 0.15 * sin(uTime * 23.0 + p.y * 2.0);
                    float a = (0.16 + lines * (0.55 + sweep * 1.2) + side * 0.9 + ground * 1.5) * fade * pulse + ground * 0.6;
                    vec3 col = mix(uColor, vec3(1.0, 0.86, 0.62), clamp(lines * 0.45 + sweep * 0.5 + ground * 0.8, 0.0, 1.0));
                    // Fusione additiva: l'intensità va nel colore, l'alpha resta piena.
                    gl_FragColor = vec4(col * a, 1.0);
                }`,
        });
        this.curtains = inst(new THREE.PlaneGeometry(1, 1).translate(0, .5, 0), this.curtainMaterial, this.shots.length);
        const beam = new THREE.CylinderGeometry(.5, .5, 1, 12).rotateZ(Math.PI / 2);
        // Colpi dei boss resi leggibili dalla forma: l'alto è un raggio sospeso nel colore del boss,
        // il basso striscia a terra su una scia luminosa sfumata.
        const glowing = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        this.skinBeamCore = inst(beam, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.shots.length);
        this.skinBeamGlow = inst(beam, glowing(), this.shots.length);
        this.skinTrail = inst(new THREE.PlaneGeometry(1, 1), glowing(), this.shots.length);
        this.skinTrail.material.map = radialTexture('rgba(255,255,255,.9)', 'rgba(255,255,255,0)');
        for (const mesh of [this.skinBeamGlow, this.skinTrail])
            mesh.setColorAt(0, new THREE.Color());
        this.beamCore = inst(beam, new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false }), this.shots.length * 2);
        this.beamGlow = inst(beam, new THREE.MeshBasicMaterial({ color: 0xff9a2a, opacity: .7, ...additive }), this.shots.length * 2);
        this.beamHalo = inst(beam, new THREE.MeshBasicMaterial({ color: 0xff6a1a, opacity: .25, ...additive }), this.shots.length * 2);
        this.shadows = inst(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,.45)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }), this.pool.length);
        this.shotHalo = inst(new THREE.SphereGeometry(.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5a3a, opacity: .35, ...additive }), this.shots.length);
        // Emettitori: piccoli cristalli luminosi alla base del muro e alle estremità delle barre.
        this.posts = inst(new THREE.OctahedronGeometry(.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), this.shots.length * 4);
        this.postColor = new THREE.Color();
        this.posts.setColorAt(0, this.postColor);
    }
    muzzleMaterial(type) {
        this.glowTexture ||= radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
        return new THREE.SpriteMaterial({ map: this.glowTexture, color: type === 'tank' ? 0xffa030 : type === 'drone' ? 0xff4040 : 0xff6a3a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    }
    spawn(type, lane, z, safeLane, difficulty) {
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
        e.maxHp = Math.max(1, Math.round(CONFIG.enemies[type].hp * (difficulty?.enemyHp ?? 1)));
        e.hp = e.maxHp;
        e.age = e.previousAge = 0;
        e.phase = (lane + 1) * 1.7 + Math.abs(z) * .09;
        e.hover = e.previousHover = 0;
        e.flash = 0;
        const spec = CONFIG.enemies[type];
        // Primo colpo sfasato: due soldati vicini non sparano mai all'unisono.
        e.fireTimer = (spec.fireInterval || 99) * (.45 + Math.random() * .55) * (difficulty?.attackInterval ?? 1);
        e.charge = e.recoil = e.knock = e.dying = 0;
        e.dash = false;
        e.hidden = false;
        e.cloak = 0;
        e.cloakTimer = (spec.showSeconds || 0) + (lane + 1) * .2;
        if (e.sprite)
            e.sprite.material.opacity = 1;
        e.muzzle.visible = false;
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
        b.shell = false;
        b.skin = '';
        b.tint = 0;
        b.tilt = 0;
        return b;
    }
    // Proiettile pesante del tank: rotola raso terra, si evita saltando o cambiando corsia.
    shell(lane, z, speed) {
        const b = this.shoot(lane, z, speed);
        if (b)
            Object.assign(b, { y: .38, bottom: 0, top: .62, hw: .32, hd: .45, shell: true });
        return b;
    }
    // Cambia il fotogramma della creatura; mirror = specchiato (si muove verso sinistra).
    pose(e, name, mirror = false) {
        if (!e.beast || !SPRITES.has(name))
            return;
        if (e.frame !== name) {
            e.frame = name;
            e.sprite.material.map = SPRITES.texture(name);
        }
        const h = e.beast.height;
        e.sprite.scale.set(h * SPRITES.aspect(name) * (mirror ? -1 : 1), h, 1);
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
                e.recoil = Math.max(0, e.recoil - dt);
                e.knock = Math.max(0, e.knock - dt);
                e.appear = Math.max(0, (e.appear || 0) - dt);
                if (e.type === 'runner' && !e.dash && e.z > movement.dashZ)
                    e.dash = true; // scatto finale verso il giocatore
                if (e.dash)
                    e.z += movement.dashSpeed * dt;
                if (e.type === 'stalker')
                    this.stalk(e, dt, movement);
                if ((e.type === 'soldier' || e.type === 'tank' || (e.type === 'stalker' && !e.hidden && e.cloak === 0)) && e.z > movement.fireFarZ && e.z < movement.fireNearZ) {
                    e.fireTimer -= dt;
                    e.charge = e.fireTimer < CONFIG.enemies.chargeSeconds ? 1 - Math.max(0, e.fireTimer) / CONFIG.enemies.chargeSeconds : 0;
                    if (e.fireTimer <= 0) {
                        e.fireTimer = movement.fireInterval * (game.difficulty?.attackInterval ?? 1);
                        e.charge = 0;
                        e.recoil = .22;
                        const lane = Math.max(-1, Math.min(1, Math.round(e.x / CONFIG.player.laneWidth)));
                        // I colpi viaggiano più veloci della strada, così non vengono "superati" dal nemico.
                        const shot = e.type === 'tank'
                            ? this.shell(lane, e.z + 1.2, game.speed + CONFIG.enemies.shellSpeed * .35)
                            : this.shoot(lane, e.z + .6, game.speed + CONFIG.enemies.shotSpeed * .45);
                        if (shot && e.beast)
                            shot.skin = e.beast.shot;
                        const [, my] = MUZZLE[e.type];
                        game.effects?.emit(e.x, my, e.z + .8, e.type === 'tank' ? 0xffb050 : 0xff7a4a, 6);
                        game.audio?.play('bossShot');
                    }
                }
                else
                    e.charge = 0;
                if (e.type === 'drone') {
                    e.x = e.lane * CONFIG.player.laneWidth + Math.sin(e.age * 1.8 + e.phase) * .28;
                    e.hover = Math.sin(e.age * 3 + e.phase) * .12;
                    e.bottom = 1.15 + e.hover;
                    e.top = 1.95 + e.hover;
                    e.fireTimer -= dt;
                    if (e.fireTimer <= 0 && e.z < CONFIG.enemies.drone.fireNearZ && e.z > CONFIG.enemies.drone.fireFarZ) {
                        e.fireTimer = CONFIG.enemies.drone.fireInterval * (game.difficulty?.attackInterval ?? 1);
                        e.recoil = .2;
                        const shot = this.shoot(e.lane, e.z, CONFIG.enemies.shotSpeed * (game.difficulty?.projectileSpeed ?? 1), CONFIG.enemies.warningSeconds);
                        if (shot && e.beast)
                            shot.skin = e.beast.shot;
                    }
                }
                if (e.z > CONFIG.world.despawnZ)
                    this.remove(e);
            }
        for (const e of this.pool)
            if (e.dying > 0) {
                e.previousZ = e.z;
                e.z += game.speed * dt;
                e.dying -= dt;
                if (e.dying <= 0)
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
    // Posa della creatura: colpita, spara, carica, scatta, cammina di lato o guarda il giocatore.
    animate(e, age, x, lean, phase) {
        const c = e.beast, moving = Math.abs(lean) > .12;
        let name, mirror = false;
        if (e.hidden)
            name = c.hidden;
        else if (e.appear > 0)
            name = c.appear;
        else if (e.flash > 0 || e.knock > .08)
            name = c.hit;
        else if (e.recoil > .1)
            name = c.shoot;
        else if (e.charge > 0)
            name = c.charge;
        else if (e.dash && c.dash)
            name = c.dash;
        else if (moving || e.type === 'runner' || c.fly) {
            name = c.walk[Math.floor(phase * .5) % c.walk.length];
            mirror = lean < 0; // i fotogrammi di corsa guardano a destra
        }
        else
            name = c.idle[Math.floor(age / .7 + e.phase) % c.idle.length];
        this.pose(e, name, mirror);
        const walking = moving && !c.fly;
        e.sprite.position.y = c.fly ? .9 + e.hover : walking ? Math.abs(Math.sin(phase)) * .08 : 0;
        e.sprite.material.color.setScalar(e.flash > 0 ? 2 : 1);
        // Mimetizzazione: sfuma in dissolvenza; nascosto restano gli occhi appena visibili.
        e.sprite.material.opacity = e.hidden ? .8 + Math.sin(age * 9) * .2 : 1 - e.cloak * .85;
        e.mesh.rotation.z = c.fly ? Math.cos(age * 1.8 + e.phase) * -.06 : -lean * .08;
    }
    // Camaleonte: visibile, poi sfuma e si mimetizza; riappare in un'altra corsia libera.
    stalk(e, dt, spec) {
        e.cloakTimer -= dt;
        if (!e.hidden) {
            // Durante la dissolvenza (cloak > 0) è ancora colpibile.
            if (e.cloak > 0) {
                e.cloak = Math.min(1, e.cloak + dt / spec.fadeSeconds);
                if (e.cloak >= 1) {
                    e.hidden = true;
                    e.cloakTimer = spec.hideSeconds;
                }
            }
            else if (e.cloakTimer <= 0 && e.z < -18)
                e.cloak = .001;
            return;
        }
        if (e.cloakTimer <= 0) {
            const lanes = [-1, 0, 1].filter(l => l !== e.lane && l !== e.safeLane);
            if (lanes.length)
                e.lane = lanes[Math.floor(Math.random() * lanes.length)];
            e.x = e.previousX = e.lane * CONFIG.player.laneWidth;
            e.hidden = false;
            e.cloak = 0;
            e.appear = .35;
            e.cloakTimer = spec.showSeconds;
            e.fireTimer = Math.max(e.fireTimer, .6);
        }
    }
    damage(e, damage) { e.hp -= damage; e.flash = .08; e.knock = .16; e.bar.scale.x = 1.4 * Math.max(0, e.hp / e.maxHp); return e.hp <= 0; }
    // Abbattuto: esce dalla logica subito, ma resta visibile mentre cade all'indietro e si spegne.
    kill(e) {
        e.active = false;
        e.dying = CONFIG.enemies.deathSeconds;
        e.charge = 0;
        e.muzzle.visible = false;
        e.bar.visible = false;
    }
    remove(e) {
        e.active = false;
        e.dying = 0;
        e.hidden = false;
        e.cloak = 0;
        e.mesh.visible = false;
        e.mesh.scale.setScalar(1);
        e.bar.visible = e.type === 'tank';
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
        let shadows = 0;
        const d = this.shotDummy;
        for (const e of this.pool) {
            if (!e.active && e.dying <= 0)
                continue;
            // Ombra a terra: più piccola e tenue per il drone, si restringe durante la caduta.
            const sx = e.previousX + (e.x - e.previousX) * alpha, sz = e.previousZ + (e.z - e.previousZ) * alpha;
            const fade = e.dying > 0 ? e.dying / CONFIG.enemies.deathSeconds : 1;
            const size = (e.type === 'tank' ? 2.6 : e.type === 'drone' ? 1.1 : 1.5) * (.4 + .6 * fade);
            d.position.set(sx, .03, sz);
            d.rotation.set(-Math.PI / 2, 0, 0);
            d.scale.set(size, size * .7, 1);
            d.updateMatrix();
            this.shadows.setMatrixAt(shadows++, d.matrix);
        }
        this.shadows.count = shadows;
        this.shadows.instanceMatrix.needsUpdate = true;
        for (const e of this.pool)
            if (!e.active && e.dying > 0) {
                const t = 1 - e.dying / CONFIG.enemies.deathSeconds;
                e.mesh.position.set(e.x, e.type === 'drone' ? e.hover - t * 1.4 : 0, e.previousZ + (e.z - e.previousZ) * alpha);
                if (e.beast) {
                    // Creatura: i fotogrammi della caduta fanno l'animazione, poi svanisce.
                    const d = e.beast.death;
                    e.mesh.rotation.set(0, 0, 0);
                    e.mesh.scale.setScalar(1);
                    this.pose(e, d[Math.min(d.length - 1, Math.floor(t * d.length * 1.25))]);
                    e.sprite.material.color.setScalar(t < .15 ? 1.8 : 1);
                    e.sprite.material.opacity = t < .75 ? 1 : 1 - (t - .75) / .25;
                    e.sprite.position.y = e.beast.fly ? Math.max(0, 1 - t * 2) * 1.2 : 0;
                    continue;
                }
                e.mesh.rotation.set(-t * 1.25, 0, (e.phase % 2 > 1 ? 1 : -1) * t * .5);
                e.mesh.scale.setScalar(1 - t * .45);
                if (e.sprite)
                    e.sprite.material.color.setRGB(1.6 - t * 1.3, .55 - t * .4, .45 - t * .35);
            }
        for (const e of this.pool)
            if (e.active) {
                const age = e.previousAge + (e.age - e.previousAge) * alpha;
                const phase = age * (e.type === 'runner' ? 12 : 8) + e.phase;
                const stride = Math.sin(phase);
                const x = e.previousX + (e.x - e.previousX) * alpha;
                const lean = Math.max(-1, Math.min(1, (e.lane * CONFIG.player.laneWidth - x) / CONFIG.player.laneWidth));
                // Arrivo: cade dall'alto e atterra con uno schiacciamento; colpito: sobbalza indietro.
                const drop = e.type === 'drone' ? 0 : Math.max(0, 1 - age / .35);
                const land = age > .35 && age < .55 ? Math.sin((age - .35) / .2 * Math.PI) : 0;
                const knock = e.knock / .16, recoil = e.recoil / .22;
                e.mesh.position.set(x, e.previousHover + (e.hover - e.previousHover) * alpha + drop * drop * 3.2, e.previousZ + (e.z - e.previousZ) * alpha - knock * .55 - recoil * .25);
                e.mesh.rotation.x = -knock * .28 - recoil * .1 + (e.dash ? .18 : 0);
                e.mesh.scale.set(1 + land * .12, 1 - land * .14, 1);
                e.muzzle.visible = e.charge > 0 || e.recoil > .12;
                if (e.muzzle.visible) {
                    const glow = e.recoil > .12 ? 1.3 + recoil : .3 + e.charge * .9 + Math.sin(age * 40) * .08 * e.charge;
                    e.muzzle.scale.setScalar(glow * (e.type === 'tank' ? 1.4 : 1));
                    e.muzzle.material.opacity = e.recoil > .12 ? 1 : .35 + e.charge * .65;
                }
                e.mesh.rotation.z = e.type === 'drone' ? Math.cos(age * 1.8 + e.phase) * -.065 : e.type === 'tank' ? stride * .008 : -lean * .16 + stride * .025;
                if (e.beast) {
                    this.animate(e, age, x, lean, phase);
                    continue;
                }
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
        const shotSprites = new Map();
        const time = performance.now() / 1000;
        this.curtainMaterial.uniforms.uTime.value = time;
        const wallSprites = new Map(), skin = { beams: 0, trails: 0 };
        const add = (mesh, key) => {
            d.updateMatrix();
            mesh.setMatrixAt(skin[key], d.matrix);
            mesh.setColorAt(skin[key]++, this.postColor);
        };
        for (const s of this.shots)
            if (s.active && s.wall && this.wallSprites.has(s.skin)) {
                const mesh = this.wallSprites.get(s.skin), z = s.previousZ + (s.z - s.previousZ) * alpha;
                const kind = s.wallKind, w = s.hw * 2, pulse = 1 + Math.sin(time * 14 + z) * .04;
                this.postColor.set(s.tint || 0xffffff);
                if (kind === 'high') {
                    // Sospeso: sprite in orizzontale all'altezza della testa, attraversato da un raggio.
                    const y = (s.bottom + s.top) / 2 + .15, aspect = SPRITES.aspect(s.skin);
                    d.position.set(s.x, y, z + .15);
                    d.rotation.set(0, 0, 0);
                    d.scale.set(w * 1.05, .09, .09);
                    d.updateMatrix();
                    this.skinBeamCore.setMatrixAt(skin.beams, d.matrix);
                    d.scale.set(w * 1.1, .42 * pulse, .42 * pulse);
                    add(this.skinBeamGlow, 'beams');
                    d.position.set(s.x, y, z);
                    d.rotation.set(0, 0, s.tilt || 0);
                    d.scale.set(w * 1.15 * pulse, w * 1.15 / aspect * pulse, 1);
                }
                else if (kind === 'low') {
                    // Raso terra: alto quanto l'ostacolo vero, su una scia luminosa.
                    d.position.set(s.x, .04, z + .3);
                    d.rotation.set(-Math.PI / 2, 0, 0);
                    d.scale.set(w * 1.3, 1.6, 1);
                    add(this.skinTrail, 'trails');
                    d.position.set(s.x, 0, z);
                    d.rotation.set(0, 0, 0);
                    d.scale.set(w * 1.12 * pulse, (s.top + .15) * pulse, 1);
                }
                else {
                    // Muro pieno: larghezza fissata alla corsia, si vede subito quale corsia è chiusa.
                    d.position.set(s.x, 0, z);
                    d.rotation.set(0, 0, 0);
                    d.scale.set(w * 1.12 * pulse, 4.4 * pulse, 1);
                }
                d.updateMatrix();
                const k = wallSprites.get(mesh) ?? 0;
                mesh.setMatrixAt(k, d.matrix);
                wallSprites.set(mesh, k + 1);
            }
            else if (s.active && s.wall) {
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
                // Emettitori ai due lati: alla base del muro pieno, alle estremità delle barre.
                const spin = time * 3 + z * .3, heights = full ? [.18] : [.28, .78].map(f => s.bottom + (s.top - s.bottom) * f);
                for (const side of [-1, 1])
                    for (const y of heights) {
                        d.position.set(s.x + side * (s.hw + .05), y, z);
                        d.rotation.set(0, spin * side, 0);
                        d.scale.set(.32, full ? .5 : .42, .32);
                        d.updateMatrix();
                        this.posts.setMatrixAt(posts, d.matrix);
                        this.posts.setColorAt(posts++, this.postColor.set(full ? 0xff6a50 : 0xffc066));
                    }
                d.rotation.set(0, 0, 0);
            }
            else if (s.active && this.shotSprites.has(s.skin)) {
                // Colpo di una creatura: sprite rivolto alla camera, la scia punta lontano dal giocatore.
                const mesh = this.shotSprites.get(s.skin), c = Object.values(CREATURES).find(c => c.shot === s.skin);
                const size = s.shell ? 1.6 : 1.25, pulse = s.delay > 0 ? 1 + Math.sin(s.delay * 25) * .25 : 1;
                d.position.set(s.x, s.y, s.previousZ + (s.z - s.previousZ) * alpha);
                d.rotation.set(0, 0, c?.spin ? -time * 9 : -Math.PI / 4);
                d.scale.set(size * SPRITES.aspect(s.skin) * pulse, size * pulse, 1);
                d.updateMatrix();
                mesh.setMatrixAt(shotSprites.get(mesh) ?? 0, d.matrix);
                shotSprites.set(mesh, (shotSprites.get(mesh) ?? 0) + 1);
                d.rotation.set(0, 0, 0);
                d.scale.setScalar(size * .8);
                d.updateMatrix();
                this.shotHalo.setMatrixAt(n, d.matrix);
                this.shotMesh.setMatrixAt(n++, HIDDEN);
            }
            else if (s.active) {
                // Sfera piena + alone additivo che pulsa; il proiettile del tank è più grosso.
                const base = (s.shell ? 2.2 : 1) * (s.delay > 0 ? 1 + Math.sin(s.delay * 25) * .3 : 1);
                this.shotDummy.rotation.set(0, 0, 0);
                this.shotDummy.position.set(s.x, s.y, s.previousZ + (s.z - s.previousZ) * alpha);
                this.shotDummy.scale.setScalar(base);
                this.shotDummy.updateMatrix();
                this.shotMesh.setMatrixAt(n, this.shotDummy.matrix);
                this.shotDummy.scale.setScalar(base * (.75 + Math.sin(time * 22 + s.z) * .12));
                this.shotDummy.updateMatrix();
                this.shotHalo.setMatrixAt(n++, this.shotDummy.matrix);
            }
        for (const mesh of this.shotSprites.values()) {
            mesh.count = shotSprites.get(mesh) ?? 0;
            mesh.instanceMatrix.needsUpdate = true;
        }
        this.skinBeamCore.count = this.skinBeamGlow.count = skin.beams;
        this.skinTrail.count = skin.trails;
        for (const mesh of [this.skinBeamCore, this.skinBeamGlow, this.skinTrail]) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor)
                mesh.instanceColor.needsUpdate = true;
        }
        for (const mesh of this.wallSprites.values()) {
            mesh.count = wallSprites.get(mesh) ?? 0;
            mesh.instanceMatrix.needsUpdate = true;
        }
        this.shotMesh.count = n;
        this.shotMesh.instanceMatrix.needsUpdate = true;
        this.shotHalo.count = n;
        this.shotHalo.instanceMatrix.needsUpdate = true;
        for (const [mesh, count] of [[this.curtains, curtains], [this.beamCore, beams], [this.beamGlow, beams], [this.beamHalo, beams], [this.posts, posts]]) {
            mesh.count = count;
            mesh.instanceMatrix.needsUpdate = true;
        }
        if (this.posts.instanceColor)
            this.posts.instanceColor.needsUpdate = true;
    }
}
