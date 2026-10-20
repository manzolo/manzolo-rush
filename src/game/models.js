import * as THREE from 'three';
const box = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map();
export function material(color, glow = false) {
    const key = `${color}-${glow}`;
    if (!materials.has(key))
        materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .05, emissive: glow ? color : 0, emissiveIntensity: glow ? .65 : 0 }));
    return materials.get(key);
}
export function block(parent, color, x, y, z, w, h, d, glow = false) { const m = new THREE.Mesh(box, material(color, glow)); m.position.set(x, y, z); m.scale.set(w, h, d); parent.add(m); return m; }
export function actor(color = 0xff7263, hero = false) {
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    block(body, color, 0, 1.02, 0, .66, .7, .42);
    block(body, 0x233642, 0, .69, 0, .58, .19, .44);
    block(body, 0xf3c09a, 0, 1.58, -.02, .45, .43, .43);
    if (hero) {
        // Versione procedurale del protagonista: basco nero con stella, capelli e barba grigi.
        block(body, 0x161616, 0, 1.78, 0, .56, .14, .54);
        block(body, 0x161616, 0, 1.85, 0, .46, .08, .44);
        block(body, 0xffffff, 0, 1.79, -.275, .09, .09, .02, true);
        block(body, 0xb3b6b6, 0, 1.6, .2, .47, .3, .1);
        block(body, 0xb3b6b6, 0, 1.42, -.18, .3, .14, .1);
    }
    else
        block(body, 0x213e4d, 0, 1.74, 0, .5, .2, .48);
    block(body, 0x8bffd1, 0, 1.59, -.245, .38, .13, .04, true);
    block(body, 0x293d4c, 0, 1.08, .28, .48, .53, .2);
    const limbs = [];
    for (let i = 0; i < 4; i++) {
        const p = new THREE.Group();
        p.position.set((i % 2 ? 1 : -1) * (i < 2 ? .19 : .43), i < 2 ? .65 : 1.26, 0);
        body.add(p);
        block(p, i < 2 ? 0x243d50 : color, 0, -.25, 0, i < 2 ? .24 : .2, .52, .24);
        if (i < 2)
            block(p, 0xe4e9db, 0, -.5, -.07, .27, .16, .39);
        limbs.push(p);
    }
    const gun = block(body, 0x1a303e, .48, 1.06, -.42, .23, .24, .72);
    block(body, 0x8bffd1, .48, 1.1, -.8, .13, .13, .08, true);
    return { root, body, limbs, gun };
}
