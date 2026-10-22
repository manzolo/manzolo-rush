import * as THREE from 'three';
import { CONFIG } from './config.js';
import { fxRandom } from './effects.js';
// Blaster di base + armi raccoglibili a tempo (CONFIG.guns). Ogni colpo porta con sé danno,
// dimensione, perforazione ed esplosione: il combattimento in game.js legge questi campi.
const BLASTER = { label: 'BLASTER', color: 0x9bffe1, damage: CONFIG.weapon.damage, pellets: 1, spread: 0, speed: CONFIG.weapon.bulletSpeed, life: CONFIG.weapon.bulletLifetime, size: .095, length: 1.6, radius: .12, heat: CONFIG.weapon.heatPerShot, recoil: CONFIG.weapon.recoil };
export function gunSpec(kind) { return CONFIG.guns.types[kind] || BLASTER; }
export class Weapons {
    constructor(scene) {
        this.pool = Array.from({ length: CONFIG.weapon.bulletPool }, () => ({ active: false, x: 0, y: 0, z: 0, previousZ: 0, previousX: 0, vx: 0, life: 0, damage: 1, radius: .12, pierce: 0, splash: 0, kind: 'blaster', hits: [] }));
        // Proiettili in batch: il plasma ha un nucleo, una scia conica e due archi elettrici.
        const shotMaterial = () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
        this.boxMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), shotMaterial(), this.pool.length);
        this.ballMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 1), shotMaterial(), this.pool.length);
        for (const mesh of [this.boxMesh, this.ballMesh]) {
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            mesh.setColorAt(0, new THREE.Color());
            scene.add(mesh);
        }
        const energy = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        this.plasmaCore = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.5, 1), new THREE.MeshBasicMaterial({ color: 0xf8eaff, toneMapped: false }), this.pool.length);
        this.plasmaTrail = new THREE.InstancedMesh(new THREE.ConeGeometry(.5, 1, 8).rotateX(Math.PI / 2), energy(0x9c48ff, .6), this.pool.length);
        this.plasmaArcs = new THREE.InstancedMesh(new THREE.TorusGeometry(.32, .024, 4, 20, Math.PI * 1.35), energy(0xc49bff, .9), this.pool.length * 2);
        for (const mesh of [this.plasmaCore, this.plasmaTrail, this.plasmaArcs]) {
            mesh.count = 0;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            scene.add(mesh);
        }
        // Alone additivo attorno a ogni colpo: ellissoide che sfuma verso i bordi, colorato come l'arma.
        const halo = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
            vertexShader: `varying float vFacing; varying vec3 vColor;
                void main() {
                    vec4 p = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                    vFacing = abs(dot(normalize(normalMatrix * mat3(instanceMatrix) * normal), normalize(-p.xyz)));
                    vColor = vec3(1.0);
                    #ifdef USE_INSTANCING_COLOR
                    vColor = instanceColor;
                    #endif
                    gl_Position = projectionMatrix * p; }`,
            fragmentShader: `varying float vFacing; varying vec3 vColor;
                void main() { gl_FragColor = vec4(vColor * (0.6 + vFacing), pow(vFacing, 1.6) * 0.75); }`,
        });
        this.glowBox = new THREE.InstancedMesh(new THREE.SphereGeometry(.5, 14, 10), halo, this.pool.length);
        this.glowBall = new THREE.InstancedMesh(new THREE.SphereGeometry(.5, 14, 10), halo, this.pool.length);
        for (const mesh of [this.glowBox, this.glowBall]) {
            mesh.count = 0;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.frustumCulled = false;
            mesh.setColorAt(0, new THREE.Color());
            scene.add(mesh);
        }
        this.mesh = this.boxMesh; // compatibilità con i test
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();
        // Vampa: nucleo, fiammata conica in avanti e alone, scalati sul calibro dell'arma.
        this.flash = new THREE.Group();
        this.flashCore = new THREE.Mesh(new THREE.OctahedronGeometry(.23), new THREE.MeshBasicMaterial({ color: 0xd9ffab, toneMapped: false }));
        this.flashCone = new THREE.Mesh(new THREE.ConeGeometry(.3, 1, 7).rotateX(-Math.PI / 2).translate(0, 0, -.5), energy(0xffffff, .85));
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(.3, 'rgba(255,255,255,.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        this.flashGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        this.flash.add(this.flashGlow, this.flashCone, this.flashCore);
        scene.add(this.flash);
        this.flashMax = .07;
        this.reset();
    }
    // keepGun: il boss pulisce l'arena ma non toglie l'arma raccolta.
    reset(keepGun = false) {
        for (const b of this.pool)
            b.active = false;
        this.heat = 0;
        this.overheated = false;
        this.cooldown = 0;
        this.flashTime = 0;
        this.flash.visible = false;
        if (!keepGun) {
            this.kind = 'blaster';
            this.gunTime = 0;
        }
    }
    get spec() { return gunSpec(this.kind); }
    equip(kind, game) {
        if (!CONFIG.guns.types[kind])
            return;
        this.kind = kind;
        this.gunTime = CONFIG.guns.duration;
        this.cooldown = 0;
        game?.announce?.(`${CONFIG.guns.types[kind].label}!`);
        game?.audio?.play('power');
    }
    update(dt, game) {
        const p = game.player, w = CONFIG.weapon;
        this.cooldown -= dt;
        this.flashTime -= dt;
        if (this.kind !== 'blaster') {
            this.gunTime -= dt;
            if (this.gunTime <= 0) {
                this.kind = 'blaster';
                game.announce?.('BLASTER');
            }
        }
        this.heat = Math.max(0, this.heat - w.cooling * dt);
        if (this.overheated && this.heat <= w.overheatRecovery)
            this.overheated = false;
        if (game.input.firing && !this.overheated && this.cooldown <= 0) {
            const burst = game.input.burst, spec = this.spec, gun = this.kind !== 'blaster';
            this.cooldown = gun ? spec.interval * (burst ? CONFIG.guns.burstFactor : 1) : burst ? w.burstInterval : w.normalInterval;
            const y = p.y + (p.slide > 0 ? .42 : 1.12), z = CONFIG.player.z - .85;
            const lanes = game.powerups?.triple > 0 ? [0, -1, 1] : [0];
            for (const lane of lanes)
                for (let i = 0; i < spec.pellets; i++) {
                    const fan = spec.pellets > 1 ? (i / (spec.pellets - 1) - .5) * 2 : 0;
                    this.fire(p.x + .35 + lane * CONFIG.player.laneWidth, y + (spec.pellets > 1 ? Math.abs(fan) * .15 : 0), z, spec, fan * spec.spread);
                }
            const heat = gun ? spec.heat * (burst ? CONFIG.guns.burstHeat : 1) : burst ? w.burstHeatPerShot : w.heatPerShot;
            this.heat = Math.min(1, this.heat + heat);
            if (this.heat >= 1) {
                this.overheated = true;
                game.announce?.('SURRISCALDAMENTO');
            }
            const color = gun ? spec.color : 0xd9ffab, calibre = gun ? 1 + spec.size * 2.5 : 1;
            this.flashMax = this.flashTime = this.kind === 'rocket' ? .12 : this.kind === 'scatter' ? .09 : .07;
            this.flashCore.material.color.set(color);
            this.flashCone.material.color.set(color);
            this.flashGlow.material.color.set(color);
            this.flashCone.scale.set(calibre * (this.kind === 'scatter' ? 2.2 : 1), calibre * (this.kind === 'scatter' ? 2.2 : 1), calibre * (.7 + fxRandom() * .6) * (this.kind === 'laser' ? .6 : 1.4));
            this.flashGlow.scale.setScalar(1.9 * calibre);
            this.flash.rotation.set(0, 0, fxRandom() * Math.PI);
            this.flash.position.set(p.x + .48, y, CONFIG.player.z - .95);
            game.effects?.spark(p.x + .48, y, CONFIG.player.z - 1.1, color, this.kind === 'scatter' ? 7 : this.kind === 'rocket' ? 6 : 3, gun ? 1 : .6, -6);
            p.recoil = spec.recoil;
            game.audio?.play('shoot', this.kind);
        }
        this.flash.visible = this.flashTime > 0;
        if (this.flash.visible) {
            const t = this.flashTime / this.flashMax;
            this.flashCone.material.opacity = .85 * t;
            this.flashGlow.material.opacity = t;
            this.flashCore.scale.setScalar(.6 + t * .6);
        }
        this.flash.rotation.z += dt * 20;
        for (const b of this.pool)
            if (b.active) {
                b.previousZ = b.z;
                b.previousX = b.x;
                b.z -= b.speed * dt;
                b.x += b.vx * dt;
                b.life -= dt;
                if (b.life <= 0)
                    b.active = false;
                else if (b.kind === 'rocket')
                    // Scarico del razzo: fiamma e scintille lasciate indietro.
                    game.effects?.spark(b.x, b.y, b.z + b.length * .6, fxRandom() < .6 ? 0xffb43c : 0xff5a1e, 1, .5, 4);
            }
    }
    fire(x, y, z, spec = BLASTER, vx = 0) {
        const b = this.pool.find(b => !b.active);
        if (!b)
            return;
        Object.assign(b, { active: true, x, y, z, previousZ: z, previousX: x, vx, life: spec.life, speed: spec.speed, damage: spec.damage, radius: spec.radius, pierce: spec.pierce || 0, splash: spec.splash || 0, kind: this.kind, size: spec.size, length: spec.length, color: spec.color });
        b.hits.length = 0;
    }
    render(alpha = 1) {
        let boxes = 0, balls = 0, plasma = 0, glowBoxes = 0, glowBalls = 0;
        for (const b of this.pool)
            if (b.active) {
                const x = b.previousX + (b.x - b.previousX) * alpha;
                const z = b.previousZ + (b.z - b.previousZ) * alpha;
                if (b.kind === 'plasma') {
                    const phase = (b.life + (1 - alpha) * CONFIG.step) * 18;
                    const pulse = 1 + Math.sin(phase) * .08;
                    this.dummy.position.set(x, b.y, z - .2);
                    this.dummy.rotation.set(0, 0, phase * .2);
                    this.dummy.scale.set(.24 * pulse, .24 * pulse, 1.7);
                    this.dummy.updateMatrix();
                    this.plasmaCore.setMatrixAt(plasma, this.dummy.matrix);
                    this.dummy.position.z = z + 1.1;
                    this.dummy.scale.set(.65 * pulse, .65 * pulse, 2.8);
                    this.dummy.updateMatrix();
                    this.plasmaTrail.setMatrixAt(plasma, this.dummy.matrix);
                    for (let ring = 0; ring < 2; ring++) {
                        this.dummy.position.z = z + ring * .65;
                        this.dummy.rotation.set(.25, -.15, phase * (ring ? -1 : 1) + ring * Math.PI);
                        this.dummy.scale.setScalar(pulse * (ring ? .8 : 1));
                        this.dummy.updateMatrix();
                        this.plasmaArcs.setMatrixAt(plasma * 2 + ring, this.dummy.matrix);
                    }
                    plasma++;
                    continue;
                }
                const round = b.kind === 'scatter';
                const mesh = round ? this.ballMesh : this.boxMesh;
                this.dummy.position.set(x, b.y, z);
                this.dummy.rotation.set(0, 0, 0);
                this.dummy.scale.set(b.size, b.size, round ? b.size : b.length);
                this.dummy.updateMatrix();
                const n = round ? balls++ : boxes++;
                mesh.setMatrixAt(n, this.dummy.matrix);
                this.color.set(b.color ?? BLASTER.color);
                mesh.setColorAt(n, this.color);
                // Alone più largo e una scia che si allunga dietro al colpo.
                const glow = round ? this.glowBall : this.glowBox, g = round ? glowBalls++ : glowBoxes++;
                const width = b.size * (b.kind === 'laser' ? 3.2 : 3.6);
                this.dummy.position.z = z + (round ? 0 : b.length * .45);
                this.dummy.scale.set(width, width, round ? width : b.length * 1.9);
                this.dummy.updateMatrix();
                glow.setMatrixAt(g, this.dummy.matrix);
                glow.setColorAt(g, this.color);
            }
        for (const [mesh, n] of [[this.boxMesh, boxes], [this.ballMesh, balls], [this.plasmaCore, plasma], [this.plasmaTrail, plasma], [this.plasmaArcs, plasma * 2], [this.glowBox, glowBoxes], [this.glowBall, glowBalls]]) {
            mesh.count = n;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor)
                mesh.instanceColor.needsUpdate = true;
        }
    }
}
