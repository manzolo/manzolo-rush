import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SPRITES } from './sprites.js';
const BURST_LIFE = .42;
export class Effects {
    constructor(scene, player) {
        this.pool = Array.from({ length: CONFIG.juice.particlePool }, () => ({ life: 0, max: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, color: 0xffffff }));
        // Esplosioni a sprite (uccisioni, casse, danni): si gonfiano e svaniscono in meno di mezzo secondo.
        this.bursts = [];
        if (CONFIG.sprites.enabled && CONFIG.sprites.explosions && SPRITES.has('explosion')) {
            for (let i = 0; i < 8; i++) {
                const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPRITES.texture('explosion'), transparent: true, depthWrite: false, toneMapped: false }));
                mesh.visible = false;
                scene.add(mesh);
                this.bursts.push({ mesh, life: 0, size: 1, x: 0, y: 0, z: 0 });
            }
        }
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();
        this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), this.pool.length);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d'), g = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
        g.addColorStop(0, 'rgba(0,0,0,.4)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        const texture = new THREE.CanvasTexture(canvas);
        this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.5), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.y = .025;
        scene.add(this.shadow);
        this.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), new THREE.MeshBasicMaterial({ color: 0x8bffd1, wireframe: true, transparent: true, opacity: .3 }));
        scene.add(this.shield);
        this.player = player;
    }
    emit(x, y, z, color, count = 8) {
        for (const p of this.pool) {
            if (p.life > 0)
                continue;
            p.x = x;
            p.y = y;
            p.z = z;
            p.vx = (Math.random() - .5) * 7;
            p.vy = Math.random() * 5;
            p.vz = (Math.random() - .5) * 6;
            p.max = p.life = .3 + Math.random() * .45;
            p.color = color;
            if (--count <= 0)
                break;
        }
    }
    burst(x, y, z, size = 2.2) {
        const b = this.bursts.find(b => b.life <= 0);
        if (!b)
            return;
        Object.assign(b, { x, y, z, size, life: BURST_LIFE });
        b.mesh.material.rotation = Math.random() * Math.PI * 2;
        b.mesh.visible = true;
    }
    reset() {
        for (const p of this.pool)
            p.life = 0;
        for (const b of this.bursts) {
            b.life = 0;
            b.mesh.visible = false;
        }
        this.shield.visible = false;
    }
    update(dt, speed) {
        for (const b of this.bursts)
            if (b.life > 0) {
                b.life -= dt;
                b.z += speed * dt;
                if (b.life <= 0)
                    b.mesh.visible = false;
            }
        for (const p of this.pool)
            if (p.life > 0) {
                p.life -= dt;
                p.vy -= 14 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.z += (p.vz + speed * .5) * dt;
                if (p.y < .05) {
                    p.y = .05;
                    p.vy *= -.3;
                }
            }
    }
    render(game) {
        let n = 0;
        for (const p of this.pool)
            if (p.life > 0) {
                this.dummy.position.set(p.x, p.y, p.z);
                this.dummy.rotation.set(p.life * 3, p.life * 5, p.life);
                this.dummy.scale.setScalar(.16 * p.life / p.max);
                this.dummy.updateMatrix();
                this.mesh.setMatrixAt(n, this.dummy.matrix);
                this.mesh.setColorAt(n++, this.color.set(p.color));
            }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor)
            this.mesh.instanceColor.needsUpdate = true;
        for (const b of this.bursts)
            if (b.life > 0) {
                const t = 1 - b.life / BURST_LIFE, s = b.size * (.35 + .65 * Math.sqrt(t));
                b.mesh.position.set(b.x, b.y + t * .4, b.z);
                b.mesh.scale.set(s * SPRITES.aspect('explosion'), s, 1);
                b.mesh.material.opacity = 1 - t * t;
            }
        this.shadow.position.x = this.player.root.position.x;
        this.shadow.position.z = CONFIG.player.z;
        this.shadow.scale.setScalar(1 - this.player.y * .15);
        this.shadow.material.opacity = 1 - this.player.y * .2;
        this.shield.visible = game.powerups.shield > 0;
        this.shield.position.set(this.player.root.position.x, this.player.root.position.y + .9, CONFIG.player.z);
        this.shield.rotation.y = game.time;
    }
}
