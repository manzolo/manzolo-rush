import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SPRITES } from './sprites.js';
const BURST_LIFE = .42;
// Casualità solo estetica, separata da Math.random: non sposta i semi della simulazione.
let fxState = 0x2f6b1d;
export function fxRandom() {
    fxState = (Math.imul(1664525, fxState) + 1013904223) >>> 0;
    return fxState / 4294967296;
}
// Elettricità dello scudo: filamenti di luce che scorrono sulla bolla (isolinee di rumore 3D).
const ARC_SHADER = {
    vertexShader: `varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
        void main() { vPos = position; vec4 p = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal); vView = -p.xyz;
            gl_Position = projectionMatrix * p; }`,
    fragmentShader: `uniform float time; uniform float strength; varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x) {
            vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                       mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
        // Linea sottile dove il rumore attraversa 0,5: si deforma nel tempo come una scarica.
        float arc(vec3 p, float t) { return 0.015 / abs(fbm(p * 2.3 + vec3(0.0, t * 0.9, t * 0.45)) - 0.5); }
        void main() {
            vec3 p = normalize(vPos);
            float a = min(3.0, arc(p, time) + arc(p * 1.4 + 4.0, -time * 1.25) * 0.7);
            float facing = abs(dot(normalize(vNormal), normalize(vView)));
            float rim = pow(1.0 - facing, 1.4);
            float flicker = 0.75 + 0.25 * sin(time * 31.0 + p.y * 8.0);
            float i = a * (0.28 + rim) * flicker * strength;
            vec3 color = mix(vec3(0.25, 0.72, 1.0), vec3(0.92, 1.0, 1.0), clamp(a * 0.45, 0.0, 1.0));
            gl_FragColor = vec4(color * i, min(1.0, i));
        }`,
};
export class Effects {
    constructor(scene, player) {
        this.pool = Array.from({ length: CONFIG.juice.particlePool }, () => ({ life: 0, max: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, color: 0xffffff }));
        // Esplosioni a sprite (uccisioni, casse, danni): si gonfiano e svaniscono in meno di mezzo secondo.
        this.bursts = [];
        if (CONFIG.sprites.enabled && CONFIG.sprites.explosions && SPRITES.has('explosion')) {
            for (let i = 0; i < 14; i++) {
                const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: SPRITES.texture('explosion'), transparent: true, depthWrite: false, toneMapped: false }));
                mesh.visible = false;
                scene.add(mesh);
                this.bursts.push({ mesh, life: 0, size: 1, x: 0, y: 0, z: 0, name: 'explosion' });
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
        const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
        this.shield = new THREE.Group();
        this.shield.visible = false;
        this.shieldWire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshBasicMaterial({ color: 0x8bffd1, wireframe: true, opacity: .25, ...additive }));
        // Luce concentrata sul bordo: il personaggio resta leggibile dentro la bolla.
        this.shieldShell = new THREE.Mesh(new THREE.SphereGeometry(1.16, 24, 16), new THREE.ShaderMaterial({
            ...additive,
            uniforms: { strength: { value: .7 } },
            vertexShader: `varying vec3 vNormal; varying vec3 vView;
                void main() { vec4 p = modelViewMatrix * vec4(position, 1.0);
                    vNormal = normalize(normalMatrix * normal); vView = -p.xyz;
                    gl_Position = projectionMatrix * p; }`,
            fragmentShader: `uniform float strength; varying vec3 vNormal; varying vec3 vView;
                void main() { float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 2.5);
                    gl_FragColor = vec4(0.35, 1.0, 0.78, (0.025 + rim * 0.8) * strength); }`,
        }));
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width = glowCanvas.height = 64;
        const glowContext = glowCanvas.getContext('2d'), glow = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
        glow.addColorStop(0, 'rgba(139,255,209,0.35)');
        glow.addColorStop(.45, 'rgba(85,255,199,0.22)');
        glow.addColorStop(1, 'rgba(85,255,199,0)');
        glowContext.fillStyle = glow;
        glowContext.fillRect(0, 0, 64, 64);
        this.shieldGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), ...additive }));
        this.shieldGlow.scale.set(3.5, 3.8, 1);
        this.shieldArc = new THREE.Mesh(new THREE.SphereGeometry(1.22, 48, 32), new THREE.ShaderMaterial({
            ...additive, side: THREE.DoubleSide,
            uniforms: { time: { value: 0 }, strength: { value: 1 } },
            ...ARC_SHADER,
        }));
        this.arcTime = 0;
        this.shield.add(this.shieldWire, this.shieldShell, this.shieldGlow, this.shieldArc);
        scene.add(this.shield);
        this.shieldWave = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.shieldShell.material.clone());
        this.shieldWave.visible = false;
        scene.add(this.shieldWave);
        this.shieldFlash = this.shieldSpark = 0;
        this.player = player;
    }
    shieldPulse(impact = false) {
        this.shieldFlash = 1;
        this.shieldImpact = impact;
        this.shieldWave.position.set(this.player.x, this.player.y + .95, CONFIG.player.z);
        this.emit(this.player.x, this.player.y + 1, CONFIG.player.z, 0xbaffea, impact ? 24 : 18);
    }
    // Scintille estetiche (bocca dell'arma, scia dei razzi): non consumano Math.random.
    spark(x, y, z, color, count = 4, spread = 1, push = 0) {
        for (const p of this.pool) {
            if (p.life > 0)
                continue;
            p.x = x;
            p.y = y;
            p.z = z;
            p.vx = (fxRandom() - .5) * 6 * spread;
            p.vy = fxRandom() * 3.5 * spread;
            p.vz = (fxRandom() - .5) * 4 * spread + push;
            p.max = p.life = .12 + fxRandom() * .22;
            p.color = color;
            if (--count <= 0)
                break;
        }
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
    // name: sprite dell'effetto (es. impact_laser); se manca si usa l'esplosione standard.
    burst(x, y, z, size = 2.2, name = 'explosion') {
        const b = this.bursts.find(b => b.life <= 0);
        if (!b)
            return;
        if (!SPRITES.has(name))
            name = 'explosion';
        if (b.name !== name) {
            b.name = name;
            b.mesh.material.map = SPRITES.texture(name);
        }
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
        this.shieldWave.visible = false;
        this.shieldFlash = this.shieldSpark = 0;
    }
    update(dt, speed) {
        // Tempo proprio dell'elettricità: in pausa non scorre, nei duelli sì.
        this.arcTime += dt;
        this.shieldFlash = Math.max(0, this.shieldFlash - dt * 1.8);
        this.shieldSpark -= dt;
        if (this.shield.visible && this.shieldSpark <= 0) {
            this.shieldSpark = .12;
            const angle = Math.random() * Math.PI * 2;
            this.emit(this.player.x + Math.cos(angle) * .85, this.player.y + .4 + Math.random() * 1.3, CONFIG.player.z + Math.sin(angle) * .65, fxRandom() < .5 ? 0xe6ffff : 0x4fe8ff, 1);
        }
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
                b.mesh.scale.set(s * SPRITES.aspect(b.name), s, 1);
                b.mesh.material.opacity = 1 - t * t;
            }
        this.shadow.position.x = this.player.root.position.x;
        this.shadow.position.z = CONFIG.player.z;
        this.shadow.scale.setScalar(1 - this.player.y * .15);
        this.shadow.material.opacity = 1 - this.player.y * .2;
        const remaining = game.powerups.shield;
        const inRun = game.state !== 'menu';
        this.shield.visible = inRun && remaining > 0;
        const pulse = 1 + Math.sin(game.time * 5) * .045;
        const fading = remaining < 2 ? .4 + .6 * (.5 + .5 * Math.sin(game.time * 14)) : 1;
        this.shield.position.set(this.player.root.position.x, this.player.root.position.y + (this.player.slide > 0 ? .55 : .95), CONFIG.player.z);
        this.shield.scale.set(pulse, pulse * (this.player.slide > 0 ? .65 : 1.08), pulse);
        this.shieldWire.rotation.set(game.time * .2, game.time * .7, 0);
        this.shieldWire.material.opacity = (.07 + this.shieldFlash * .4) * fading;
        this.shieldShell.material.uniforms.strength.value = (.75 + this.shieldFlash) * fading;
        // Tremolio da scarica elettrica: il bagliore pulsa insieme ai fulmini.
        const flicker = .75 + fxRandom() * .25;
        this.shieldGlow.material.opacity = (.7 + Math.sin(game.time * 5) * .15 + this.shieldFlash * .5) * fading * flicker;
        this.shieldArc.material.uniforms.time.value = this.arcTime;
        this.shieldArc.material.uniforms.strength.value = (.85 + this.shieldFlash * 1.2) * fading;
        this.shieldWave.visible = inRun && this.shieldFlash > 0;
        this.shieldWave.scale.setScalar(1 + (1 - this.shieldFlash) * (this.shieldImpact ? 2.3 : 1.4));
        this.shieldWave.material.uniforms.strength.value = this.shieldFlash * .65;
    }
}
