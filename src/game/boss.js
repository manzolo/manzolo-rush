import * as THREE from 'three';
import { CONFIG } from './config.js';
import { block } from './models.js';
export class Boss {
    constructor(scene) {
        this.mesh = new THREE.Group();
        scene.add(this.mesh);
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
            if (child.isMesh)
                this.parts.push({ mesh: child, material: child.material });
        });
        this.white = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.x = 0;
        this.hw = 3.7;
        this.hd = 2;
        this.bottom = .3;
        this.top = 4.2;
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
        this.attackTimer = CONFIG.boss.firstAttackDelay;
        this.warning = 0;
        this.safeLane = 0;
        this.mesh.visible = true;
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
        this.z += (CONFIG.boss.approachZ - this.z) * (1 - Math.exp(-dt * CONFIG.boss.approachSmoothing));
        this.mesh.position.set(0, Math.sin(this.age * 2) * .12, this.z);
        this.mesh.rotation.z = Math.sin(this.age) * .025;
        this.flash = Math.max(0, this.flash - dt);
        for (const part of this.parts)
            part.mesh.material = this.flash > 0 ? this.white : part.material;
        if (this.age > CONFIG.boss.duration) {
            this.end(game, false);
            return;
        }
        this.attackTimer -= dt;
        if (this.warning > 0) {
            this.warning -= dt;
            for (let i = 0; i < 3; i++) {
                this.warnings[i].visible = i - 1 !== this.safeLane;
                this.warnings[i].material.opacity = .12 + Math.abs(Math.sin(this.warning * 12)) * .15;
            }
            if (this.warning <= 0) {
                for (const m of this.warnings)
                    m.visible = false;
                for (let lane = -1; lane <= 1; lane++)
                    if (lane !== this.safeLane)
                        game.enemies.shoot(lane, this.z + 3, CONFIG.boss.projectileSpeed);
                game.audio?.play('bossShot');
            }
        }
        else if (this.attackTimer <= 0) {
            this.attackTimer = CONFIG.boss.attackInterval;
            this.warning = CONFIG.boss.warning;
            this.safeLane = Math.max(-1, Math.min(1, this.safeLane + (Math.random() < .5 ? -1 : 1)));
        }
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
        if (killed) {
            game.reward += CONFIG.boss.score * game.multiplier;
            game.kills++;
            game.announce('SENTINELLA DISTRUTTA +' + CONFIG.boss.score);
            game.effects?.emit(0, 2, this.z, 0xffa678, 60);
            game.audio?.play('explosion');
            game.shake = .4;
            for (let lane = -1; lane <= 1; lane++)
                game.pickups.power(lane * CONFIG.player.laneWidth, -25, CONFIG.bonuses.types[(lane + 1) % 4]);
        }
        else
            game.announce('SENTINELLA EVITATA · AVANTI!');
    }
}
