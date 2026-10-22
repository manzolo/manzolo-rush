import * as THREE from 'three';
import { CONFIG } from './config.js';
import { creature } from './creatures.js';
import { SIGNS, laneSign } from './signs.js';

const RIVALS = {
    soldier: { name: 'SOLDATO', hp: 18, color: 0xffa85b },
    runner: { name: 'PATTUGLIATORE', hp: 22, color: 0xbfa6ff },
    drone: { name: 'DRONE', hp: 16, color: 0xff7263 },
    tank: { name: 'TANK', hp: 30, color: 0xffd36d },
    stalker: { name: 'CAMALEONTE', hp: 18, color: 0xb8ff5a },
};
// Probabilità che una salva sia una raffica su tutte le corsie, alta o bassa a caso.
const SWEEP_CHANCE = { easy: .3, medium: .4, hard: .45 };

// Il rivale riusa il modello del nemico toccato e il pool di proiettili.
export class Encounter {
    constructor(scene) {
        this.warnings = [-1, 0, 1].map(lane => {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 27), new THREE.MeshBasicMaterial({ color: 0xff7263, transparent: true, opacity: .2, depthWrite: false }));
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(lane * CONFIG.player.laneWidth, .04, -9.5);
            scene.add(mesh);
            return mesh;
        });
        // hw: solo la corsia del rivale è colpibile, bisogna allinearsi per sparargli.
        this.sign = laneSign(scene);
        Object.assign(this, { x: 0, z: -23, hw: 1.3, hd: 1, bottom: 0, top: 6 });
        this.reset();
    }
    reset() {
        if (this.enemy) {
            this.enemy.mesh.visible = false;
            this.enemy.mesh.scale.setScalar(1);
            this.enemy.muzzle.visible = false;
            this.enemy.bar.visible = this.enemy.type === 'tank';
            this.enemy.sprite?.material.color.setScalar(1);
        }
        this.enemy = null;
        this.active = false;
        this.hp = this.maxHp = this.age = this.warning = this.flash = this.recoil = this.x = this.lane = 0;
        this.lanes = [];
        this.wall = 'full';
        for (const mesh of this.warnings)
            mesh.visible = false;
        this.sign?.hide();
    }
    start(enemy, game) {
        if (this.active || game.boss.active || !RIVALS[enemy.type])
            return;
        this.reset();
        this.enemy = enemy;
        // Il nome è quello della creatura (DEMONE, GOLEM DI ROCCIA…).
        this.spec = { ...RIVALS[enemy.type], name: creature(enemy.type)?.name ?? RIVALS[enemy.type].name };
        this.label = `DUELLO · ${this.spec.name}`;
        this.hp = this.maxHp = Math.round(this.spec.hp * game.difficulty.duelHp);
        this.attackTimer = 1.8;
        this.shots = 0;
        game.obstacles.reset();
        game.enemies.reset();
        game.pickups.reset();
        game.weapons.reset(true);
        game.effects.reset();
        game.player.dueling = true;
        game.player.invulnerable = Math.max(game.player.invulnerable, 1);
        game.speed = 0;
        this.active = true;
        enemy.mesh.visible = true;
        enemy.bar.visible = false;
        game.announce(`${this.spec.name} · SFIDA!`);
        game.audio.play('boss');
        game.ui.timer = 0;
    }
    update(dt, game) {
        if (!this.active)
            return;
        this.age += dt;
        this.flash = Math.max(0, this.flash - dt);
        this.recoil = Math.max(0, this.recoil - dt);
        this.attackTimer -= dt;
        // Spostamento laterale: il rivale scivola verso la corsia scelta per la salva.
        this.x += (this.lane * CONFIG.player.laneWidth - this.x) * (1 - Math.exp(-dt * 4));
        if (this.warning > 0) {
            this.warning = Math.max(0, this.warning - dt);
            for (const mesh of this.warnings)
                mesh.material.opacity = .15 + .15 * Math.abs(Math.sin(this.age * 12));
            // Raffica su tutte le corsie: il cartello sopra la corsia del giocatore dice come passarla.
            if (this.wall !== 'full')
                this.sign.show(this.wall, game.player.lane * CONFIG.player.laneWidth, -7, this.age);
            if (this.warning === 0) {
                this.sign.hide();
                for (const mesh of this.warnings)
                    mesh.visible = false;
                for (const lane of this.lanes) {
                    game.enemies.shoot(lane, this.z + 1, 19 * game.difficulty.projectileSpeed, 0, this.wall);
                    game.effects.emit(lane * CONFIG.player.laneWidth, 1, this.z + 1, this.spec.color, 5);
                }
                this.recoil = .22;
                game.audio.play('bossShot');
            }
        }
        else if (this.attackTimer <= 0) {
            this.shots++;
            const d = game.difficulty, target = game.player.lane;
            // Mai due volte nella stessa corsia: il giocatore deve inseguirlo per colpirlo.
            const moves = [-1, 0, 1].filter(lane => lane !== this.lane);
            this.lane = moves[Math.floor(Math.random() * moves.length)];
            // La prima salva è sempre mirata; dopo, raffiche alte o basse a sorpresa.
            if (this.shots > 1 && Math.random() < (SWEEP_CHANCE[d.id] ?? .4)) {
                // Raffica su tutte le corsie: cambiare corsia non basta, si salta o si scivola.
                this.wall = Math.random() < .5 ? 'low' : 'high';
                this.lanes = [-1, 0, 1];
                game.announce(this.wall === 'low' ? '↑ SALTA!' : '↓ ABBASSATI!');
            }
            else {
                // Muro pieno mirato: né salto né scivolata, solo il cambio di corsia.
                this.wall = 'full';
                this.lanes = [target];
                if (d.duelLanes > 1)
                    this.lanes.push(target === 0 ? (this.shots % 2 ? -1 : 1) : 0);
            }
            this.warning = .65 * d.attackInterval;
            this.attackTimer = 1.45 * d.attackInterval;
            for (let i = 0; i < 3; i++) {
                this.warnings[i].visible = this.lanes.includes(i - 1);
                this.warnings[i].material.color.set(this.wall === 'full' ? this.spec.color : SIGNS[this.wall].color);
            }
        }
    }
    render() {
        if (!this.active)
            return;
        const e = this.enemy, enter = Math.min(1, this.age / .8);
        e.mesh.visible = true;
        e.mesh.position.set(this.x, Math.sin(this.age * 3) * .04, this.z);
        // Si inclina nella direzione dello scatto laterale.
        e.mesh.rotation.set(-this.recoil * .25, 0, Math.sin(this.age * 2) * .015 - (this.lane * CONFIG.player.laneWidth - this.x) * .05);
        e.mesh.scale.setScalar((e.type === 'drone' ? 2 : 2.4) * (.65 + .35 * enter));
        if (e.sprite)
            e.sprite.material.color.setScalar(this.flash > 0 ? 2 : 1);
        for (const part of e.parts)
            part.mesh.material = part.material;
        if (e.limbs)
            for (const limb of e.limbs)
                limb.rotation.x = 0;
        e.muzzle.visible = this.warning > 0 || this.recoil > 0;
        e.muzzle.scale.setScalar(this.recoil > 0 ? 1.4 : .4 + this.warning * .6);
        e.muzzle.material.opacity = .8;
    }
    damage(amount, game) {
        if (!this.active)
            return;
        this.hp = Math.max(0, this.hp - amount);
        this.flash = .1;
        if (this.hp > 0)
            return;
        const points = CONFIG.enemies[this.enemy.type].score * 4 * game.multiplier;
        game.reward += points;
        game.kills++;
        game.effects.emit(this.x, 2, this.z, this.spec.color, 40);
        game.effects.burst(this.x, 2, this.z, 5);
        game.ui.scorePop(`+${points}`, this.x, 4, this.z, game.camera, true, 'big');
        game.announce(`${this.spec.name} SCONFITTO +${points} · RIPARTI!`);
        game.audio.play('explosion');
        for (const shot of game.enemies.shots)
            shot.active = false;
        game.player.dueling = false;
        game.player.invulnerable = Math.max(game.player.invulnerable, 1);
        game.spawner.timer = 2;
        game.boss.nextTime = Math.max(game.boss.nextTime, game.time + 15);
        game.pickups.power(0, -18, 'shield');
        this.reset();
        game.ui.timer = 0;
    }
}
