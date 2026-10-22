import * as THREE from 'three';
import { fxRandom } from './effects.js';
// Stagione portata da boss e duelli: geometrie allocate una sola volta, fuori dalle corsie.
// storm = autunno in tempesta (pioggia, lampi), inferno = estate rovente (lava, braci),
// winter = inverno (neve, crepe di ghiaccio). `strength` sale a 1 durante lo scontro e poi
// torna a 0; `flash` è il lampo del temporale (0–1) che il mondo e le luci usano per schiarire.
const SEASONS = {
    storm: {
        palette: { sky: 0x253148, fog: 0x4a586c, road: 0x2e3846, ground: 0x4e5a66, building: 0x667488, roof: 0x48525e, accent: 0x9fd8ff, sun: 0x8fb4ff },
        strip: [[0.05, 0.2, 0.45], [0.5, 0.85, 1.0]], particles: 'rain', fogNear: 9, fogFar: 70,
    },
    inferno: {
        palette: { sky: 0x330c18, fog: 0x983521, road: 0x754c46, ground: 0xb66a47, building: 0xc58160, roof: 0x9b543e, accent: 0xffbf75, sun: 0xff5424 },
        strip: [[0.65, 0.045, 0.008], [1.0, 0.62, 0.08]], particles: 'embers', fogNear: 7, fogFar: 65,
    },
    winter: {
        palette: { sky: 0x93a9c0, fog: 0xdfe9f2, road: 0x5e6e82, ground: 0xdae6f2, building: 0x9cb2cc, roof: 0xf6faff, accent: 0xa6ecff, sun: 0xeef6ff },
        strip: [[0.25, 0.55, 0.85], [0.85, 0.97, 1.0]], particles: 'snow', fogNear: 4, fogFar: 55,
    },
};
const DROPS = 260;
export class Atmosphere {
    constructor(scene) {
        this.palettes = Object.fromEntries(Object.entries(SEASONS).map(([name, s]) => [name,
            Object.fromEntries(Object.entries(s.palette).map(([key, color]) => [key, new THREE.Color(color)]))]));
        this.season = 'inferno';
        this.palette = this.palettes.inferno;
        this.group = new THREE.Group();
        scene.add(this.group);
        // Strisce ai bordi della strada: lava, pozzanghere elettriche o crepe di ghiaccio.
        this.strip = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
            uniforms: { time: { value: 0 }, strength: { value: 0 }, dark: { value: new THREE.Color() }, bright: { value: new THREE.Color() } },
            vertexShader: `varying vec2 vUv;
                void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `varying vec2 vUv; uniform float time; uniform float strength; uniform vec3 dark; uniform vec3 bright;
                void main() {
                    float edge = sin(vUv.x * 3.14159);
                    float flow = sin(vUv.y * 85.0 + sin(vUv.x * 19.0) + time * 1.2);
                    float cracks = pow(abs(flow), 12.0);
                    vec3 color = mix(dark, bright, cracks);
                    gl_FragColor = vec4(color, edge * strength * (0.4 + cracks * 0.45));
                }`,
        });
        const geometry = new THREE.PlaneGeometry(1.15, 125);
        for (const side of [-1, 1]) {
            const strip = new THREE.Mesh(geometry, this.strip);
            strip.rotation.x = -Math.PI / 2;
            strip.position.set(side * 5.75, .18, -48);
            this.group.add(strip);
        }
        // Braci (salgono) e neve (scende ondeggiando): stessi punti, moto diverso.
        this.seeds = Array.from({ length: 100 }, (_, i) => ({ x: (i % 2 ? -1 : 1) * (5.3 + fxRandom() * 2), z: 9 - fxRandom() * 78, phase: fxRandom() * 8, speed: .65 + fxRandom() * 1.1 }));
        const particles = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.seeds.length * 3);
        particles.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        // Punti rotondi e sfumati (senza texture WebGL li disegna quadrati).
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(.5, 'rgba(255,255,255,.7)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 32, 32);
        }
        this.points = new THREE.Points(particles, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(canvas), color: 0xffbd6b, size: .15, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        this.points.frustumCulled = false;
        this.group.add(this.points);
        // Pioggia: segmenti obliqui che cadono veloci su tutta la scena davanti alla camera.
        this.drops = Array.from({ length: DROPS }, () => ({ x: (fxRandom() - .5) * 34, y: fxRandom() * 16, z: 10 - fxRandom() * 70, speed: 22 + fxRandom() * 10 }));
        this.rainPositions = new Float32Array(DROPS * 6);
        const rain = new THREE.BufferGeometry();
        rain.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
        this.rain = new THREE.LineSegments(rain, new THREE.LineBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
        this.rain.frustumCulled = false;
        this.group.add(this.rain);
        this.reset();
    }
    // La stagione cambia solo a scenario tornato normale, per non far "saltare" i colori.
    setSeason(name) {
        if (!SEASONS[name] || name === this.season)
            return;
        this.season = name;
        this.palette = this.palettes[name];
        const s = SEASONS[name];
        this.strip.uniforms.dark.value.setRGB(...s.strip[0]);
        this.strip.uniforms.bright.value.setRGB(...s.strip[1]);
        const snow = s.particles === 'snow';
        this.points.material.color.set(snow ? 0xffffff : 0xffbd6b);
        this.points.material.size = snow ? .32 : .15;
        this.points.material.blending = snow ? THREE.NormalBlending : THREE.AdditiveBlending;
        this.points.material.needsUpdate = true;
    }
    get fogNear() { return SEASONS[this.season].fogNear; }
    get fogFar() { return SEASONS[this.season].fogFar; }
    reset() {
        this.strength = this.time = this.flash = 0;
        this.nextFlash = 2;
        this.group.visible = false;
        this.strip.uniforms.strength.value = 0;
        this.points.material.opacity = 0;
        this.rain.material.opacity = 0;
        const s = SEASONS[this.season];
        this.strip.uniforms.dark.value.setRGB(...s.strip[0]);
        this.strip.uniforms.bright.value.setRGB(...s.strip[1]);
    }
    update(dt, season) {
        if (season && this.strength < .02)
            this.setSeason(season);
        this.strength += ((season ? 1 : 0) - this.strength) * (1 - Math.exp(-dt * 2));
        this.flash = Math.max(0, this.flash - dt * 3);
        this.group.visible = this.strength > .01;
        if (!this.group.visible)
            return;
        this.time += dt;
        const kind = SEASONS[this.season].particles;
        this.strip.uniforms.time.value = this.time;
        this.strip.uniforms.strength.value = this.strength * (kind === 'rain' ? .55 : 1);
        this.points.material.opacity = kind === 'rain' ? 0 : this.strength * (kind === 'snow' ? 1 : .85);
        this.rain.material.opacity = kind === 'rain' ? this.strength * .55 : 0;
        if (kind === 'rain') {
            // Lampi a intervalli irregolari, solo a tempesta piena.
            this.nextFlash -= dt;
            if (this.nextFlash <= 0 && this.strength > .6) {
                this.flash = 1;
                this.nextFlash = 2.2 + fxRandom() * 3.5;
            }
            for (let i = 0; i < DROPS; i++) {
                const d = this.drops[i];
                d.y -= d.speed * dt;
                if (d.y < 0)
                    d.y += 16;
                const k = i * 6;
                this.rainPositions[k] = d.x;
                this.rainPositions[k + 1] = d.y;
                this.rainPositions[k + 2] = d.z;
                this.rainPositions[k + 3] = d.x - .12;
                this.rainPositions[k + 4] = d.y + .7;
                this.rainPositions[k + 5] = d.z - .2;
            }
            this.rain.geometry.attributes.position.needsUpdate = true;
            return;
        }
        for (let i = 0; i < this.seeds.length; i++) {
            const p = this.seeds[i], k = i * 3;
            if (kind === 'snow') {
                // Fiocchi su tutta la scena, strada compresa, lenti e ondeggianti.
                this.positions[k] = (p.phase / 4 - 1) * 13 + Math.sin(this.time * .8 + p.phase) * .6;
                this.positions[k + 1] = 11 - (p.phase * 1.4 + this.time * p.speed * .9) % 11;
            }
            else {
                this.positions[k] = p.x + Math.sin(this.time + p.phase) * .3;
                this.positions[k + 1] = (p.phase + this.time * p.speed) % 8;
            }
            this.positions[k + 2] = p.z;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
    }
}
