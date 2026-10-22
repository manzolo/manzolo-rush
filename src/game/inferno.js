import * as THREE from 'three';

// Atmosfera temporanea: geometrie allocate una sola volta, fuori dalle corsie.
export class Inferno {
    constructor(scene) {
        this.palette = Object.fromEntries(Object.entries({ sky: 0x330c18, fog: 0x983521, road: 0x754c46, ground: 0xb66a47, building: 0xc58160, roof: 0x9b543e, accent: 0xffbf75, sun: 0xff5424 }).map(([key, color]) => [key, new THREE.Color(color)]));
        this.group = new THREE.Group();
        scene.add(this.group);
        this.lava = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
            uniforms: { time: { value: 0 }, strength: { value: 0 } },
            vertexShader: `varying vec2 vUv;
                void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `varying vec2 vUv; uniform float time; uniform float strength;
                void main() {
                    float edge = sin(vUv.x * 3.14159);
                    float flow = sin(vUv.y * 85.0 + sin(vUv.x * 19.0) + time * 1.2);
                    float cracks = pow(abs(flow), 12.0);
                    vec3 color = mix(vec3(0.65, 0.045, 0.008), vec3(1.0, 0.62, 0.08), cracks);
                    gl_FragColor = vec4(color, edge * strength * (0.4 + cracks * 0.45));
                }`,
        });
        const geometry = new THREE.PlaneGeometry(1.15, 125);
        for (const side of [-1, 1]) {
            const strip = new THREE.Mesh(geometry, this.lava);
            strip.rotation.x = -Math.PI / 2;
            strip.position.set(side * 5.75, .18, -48);
            this.group.add(strip);
        }
        this.seeds = Array.from({ length: 100 }, (_, i) => ({ x: (i % 2 ? -1 : 1) * (5.3 + Math.random() * 2), z: 9 - Math.random() * 78, phase: Math.random() * 8, speed: .65 + Math.random() * 1.1 }));
        const particles = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.seeds.length * 3);
        particles.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        this.embers = new THREE.Points(particles, new THREE.PointsMaterial({ color: 0xffbd6b, size: .15, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        this.embers.frustumCulled = false;
        this.group.add(this.embers);
        this.reset();
    }
    reset() {
        this.strength = this.time = 0;
        this.group.visible = false;
        this.lava.uniforms.strength.value = 0;
        this.embers.material.opacity = 0;
    }
    update(dt, active) {
        this.strength += ((active ? 1 : 0) - this.strength) * (1 - Math.exp(-dt * 2));
        this.group.visible = this.strength > .01;
        if (!this.group.visible)
            return;
        this.time += dt;
        this.lava.uniforms.time.value = this.time;
        this.lava.uniforms.strength.value = this.strength;
        this.embers.material.opacity = this.strength * .85;
        for (let i = 0; i < this.seeds.length; i++) {
            const p = this.seeds[i];
            this.positions[i * 3] = p.x + Math.sin(this.time + p.phase) * .3;
            this.positions[i * 3 + 1] = (p.phase + this.time * p.speed) % 8;
            this.positions[i * 3 + 2] = p.z;
        }
        this.embers.geometry.attributes.position.needsUpdate = true;
    }
}
