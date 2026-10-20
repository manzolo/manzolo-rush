import * as THREE from 'three';
import { CONFIG } from './config.js';
import { block } from './models.js';
import { SPRITES, billboard } from './sprites.js';
export class Boss {
    constructor(scene) {
        this.mesh = new THREE.Group();
        scene.add(this.mesh);
        this.sprite = null;
        if (CONFIG.sprites.enabled && SPRITES.has('boss_sentinel_v2')) {
            this.sprite = billboard('boss_sentinel_v2', CONFIG.boss.height);
            this.mesh.add(this.sprite);
        }
        else {
            block(this.mesh, 0x31465e, 0, 1.8, 0, 5.8, 2.4, 2.5);
            block(this.mesh, 0x667d91, 0, 3.45, 0, 3.6, 1.1, 2);
            block(this.mesh, 0xff7263, 0, 3.4, 1.04, 2.8, .27, .06, true);
            block(this.mesh, 0xf5b478, 0, 2, 1.3, 1.1, 1.4, .12);
            for (const x of [-3.2, 3.2]) {
                block(this.mesh, 0x213747, x, 1.4, 0, 1, 2.3, 3.6);
                block(this.mesh, 0x71878f, x, 2.9, .3, 1.15, .7, 2);
                block(this.mesh, 0xff7263, x, 2.8, 1.5, .6, .4, 1.4);
                block(this.mesh, 0xffd48a, x, 2.8, 2.25, .4, .25, .08, true);
            }
        }
        // Effetti separati dalla sagoma: il reattore si carica prima della salva.
        const glow = color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        this.core = new THREE.Mesh(new THREE.RingGeometry(.42, .54, 32), glow(0xffae42));
        this.core.position.set(0, this.sprite ? CONFIG.boss.height * .72 : 2, .12);
        this.mesh.add(this.core);
        this.muzzles = [-1, 1].map(side => {
            const mesh = new THREE.Mesh(new THREE.CircleGeometry(.5, 20), glow(0xffd47b));
            mesh.position.set(side * (this.sprite ? CONFIG.boss.height * .395 : 3.2), this.sprite ? CONFIG.boss.height * .54 : 2.8, .15);
            this.mesh.add(mesh);
            return mesh;
        });
        this.groundRing = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.68, 48), glow(0xff7043));
        this.groundRing.rotation.x = -Math.PI / 2;
        this.groundRing.position.y = .04;
        this.mesh.add(this.groundRing);
        this.warnings = [];
        for (let lane = -1; lane <= 1; lane++) {
            const mat = new THREE.MeshBasicMaterial({ color: 0xff695c, transparent: true, opacity: .2, depthWrite: false });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 48), mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(lane * CONFIG.player.laneWidth, .035, -18);
            scene.add(mesh);
            this.warnings.push(mesh);
        }
        this.parts = [];
        this.mesh.traverse(child => {
            if (child.isMesh && child !== this.sprite && child !== this.core && child !== this.groundRing && !this.muzzles.includes(child))
                this.parts.push({ mesh: child, material: child.material });
        });
        this.white = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.x = 0;
        this.hw = 3.7;
        this.hd = 2;
        this.bottom = .3;
        this.top = this.sprite ? CONFIG.boss.height : 4.2;
        this.reset();
    }
    reset() {
        this.active = false;
        this.mesh.visible = false;
        this.nextTime = CONFIG.boss.interval;
        this.number = 0;
        this.hp = 0;
        this.maxHp = 0;
        this.age = 0;
        this.warning = 0;
        this.attackTimer = 0;
        this.safeLane = 0;
        this.flash = 0;
        this.recoil = 0;
        this.enraged = false;
        for (const m of this.warnings)
            m.visible = false;
    }
    start(game) {
        this.active = true;
        this.number++;
        this.hp = CONFIG.boss.hp + (this.number - 1) * CONFIG.boss.hpGrowth;
        this.maxHp = this.hp;
        this.age = 0;
        this.z = -125;
        this.previousZ = this.z;
        this.recoil = 0;
        this.enraged = false;
        this.attackTimer = CONFIG.boss.firstAttackDelay;
        this.warning = 0;
        this.safeLane = 0;
        this.mesh.visible = true;
        this.mesh.position.set(0, 0, this.z);
        this.mesh.rotation.set(0, 0, 0);
        this.mesh.scale.setScalar(1);
        // Il duello ha un’arena pulita: nessun incrocio tra ostacoli e salve del boss.
        game.obstacles.reset();
        game.enemies.reset();
        game.pickups.reset();
        game.weapons.reset(true);
        game.announce('☠ SENTINELLA IN ARRIVO');
        game.audio?.play('boss');
    }
    update(dt, game) {
        if (!this.active) {
            if (game.time >= this.nextTime) {
                this.nextTime += CONFIG.boss.interval;
                this.start(game);
            }
            return;
        }
        this.age += dt;
        this.previousZ = this.z;
        this.z += (CONFIG.boss.approachZ - this.z) * (1 - Math.exp(-dt * CONFIG.boss.approachSmoothing));
        this.recoil = Math.max(0, this.recoil - dt);
        if (!this.enraged && this.hp < this.maxHp * .4) {
            this.enraged = true;
            game.announce('SENTINELLA · REATTORE INSTABILE');
        }
        this.flash = Math.max(0, this.flash - dt);
        for (const part of this.parts)
            part.mesh.material = this.flash > 0 ? this.white : part.material;
        this.attackTimer -= dt;
        if (this.warning > 0) {
            this.warning -= dt;
            for (let i = 0; i < 3; i++) {
                // Rosso: muro pieno; arancione: corsia di riparo, dove si salta o si scivola.
                this.warnings[i].visible = true;
                this.warnings[i].material.color.set(i - 1 === this.safeLane ? 0xffa21f : 0xff695c);
                this.warnings[i].material.opacity = .12 + Math.abs(Math.sin(this.warning * 12)) * .15;
            }
            if (this.warning <= 0) {
                for (const m of this.warnings)
                    m.visible = false;
                for (let lane = -1; lane <= 1; lane++)
                    game.enemies.shoot(lane, this.z + 3, CONFIG.boss.projectileSpeed, 0, lane === this.safeLane ? this.safeMove : 'full');
                game.audio?.play('bossShot');
                this.recoil = .22;
            }
        }
        else if (this.attackTimer <= 0) {
            this.attackTimer = CONFIG.boss.attackInterval * (this.enraged ? CONFIG.boss.enragedRate : 1);
            this.warning = CONFIG.boss.warning;
            this.safeLane = Math.max(-1, Math.min(1, this.safeLane + (Math.random() < .5 ? -1 : 1)));
            this.safeMove = Math.random() < .5 ? 'low' : 'high';
            game.announce(this.safeMove === 'low' ? '↑ SALTA!' : '↓ ABBASSATI!');
        }
    }
    render(alpha = 1) {
        if (!this.active)
            return;
        const kick = this.recoil / .22;
        this.mesh.position.set(0, .08 + Math.sin(this.age * 2.5) * .08, this.previousZ + (this.z - this.previousZ) * alpha - kick * .45);
        this.mesh.rotation.z = Math.sin(this.age * 1.4) * .012;
        this.mesh.scale.set(1 + kick * .015, 1 - kick * .025, 1);
        if (this.sprite)
            this.sprite.material.color.setScalar(this.flash > 0 ? 1.8 : 1);
        const charge = this.warning > 0 ? 1 - this.warning / CONFIG.boss.warning : 0;
        this.core.scale.setScalar(1 + charge * .9 + Math.sin(this.age * 5) * .06);
        this.core.material.opacity = .25 + charge * .6;
        this.core.material.color.set(this.enraged ? 0xff4730 : 0xffae42);
        for (const muzzle of this.muzzles) {
            muzzle.visible = this.warning > 0 || this.recoil > 0;
            muzzle.scale.setScalar(.25 + charge * .65 + kick * 1.3);
            muzzle.material.opacity = .15 + charge * .45 + kick * .4;
        }
        this.groundRing.material.opacity = .2 + charge * .5;
    }
    damage(amount, game) {
        this.hp -= amount;
        this.flash = .08;
        if (this.hp <= 0)
            this.end(game, true);
    }
    end(game, killed) {
        this.active = false;
        this.mesh.visible = false;
        for (const m of this.warnings)
            m.visible = false;
        for (const s of game.enemies.shots)
            s.active = false;
        game.spawner.timer = CONFIG.boss.resumeSpawnDelay;
        // Il duello non ha limite di tempo: il calendario resta ogni `interval` secondi, ma dopo un
        // duello lungo passano almeno `restAfter` secondi prima del boss successivo.
        this.nextTime = Math.max(this.nextTime, game.time + CONFIG.boss.restAfter);
        if (killed) {
            game.reward += CONFIG.boss.score * game.multiplier;
            game.kills++;
            game.announce('SENTINELLA DISTRUTTA +' + CONFIG.boss.score);
            game.effects?.emit(0, 2, this.z, 0xffa678, 60);
            game.effects?.burst(0, 3, this.z, 7);
            game.ui?.scorePop(`+${CONFIG.boss.score * game.multiplier}`, 0, 5, this.z, game.camera, true);
            game.audio?.play('explosion');
            game.shake = .4;
            for (let lane = -1; lane <= 1; lane++)
                game.pickups.power(lane * CONFIG.player.laneWidth, -25, CONFIG.bonuses.types[(lane + 1) % 4]);
        }
        else
            game.announce('SENTINELLA EVITATA · AVANTI!');
    }
}
