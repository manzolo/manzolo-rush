import * as THREE from 'three';
// Cartelli dei colpi da saltare o da passare in scivolata: verde con freccia in su («SALTA»)
// e azzurro con freccia in giù («GIÙ»). Stessi colori per corsie di preavviso, cartelli e colpi.
export const SIGNS = {
    low: { color: 0x5dff8a, css: '#5dff8a', text: 'SALTA', up: true },
    high: { color: 0x5ac8ff, css: '#5ac8ff', text: 'GIÙ', up: false },
};
const cache = {};
export function signTexture(kind) {
    if (cache[kind])
        return cache[kind];
    const s = SIGNS[kind], canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(8,14,24,.82)';
        ctx.beginPath();
        ctx.arc(64, 64, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = s.css;
        ctx.stroke();
        // Freccia spessa: punta in alto per saltare, in basso per scivolare.
        ctx.fillStyle = s.css;
        const dir = s.up ? -1 : 1, tip = 64 + dir * 40, base = 64 - dir * 2;
        ctx.beginPath();
        ctx.moveTo(64, tip);
        ctx.lineTo(30, base);
        ctx.lineTo(50, base);
        ctx.lineTo(50, 64 - dir * 30);
        ctx.lineTo(78, 64 - dir * 30);
        ctx.lineTo(78, base);
        ctx.lineTo(98, base);
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText?.(s.text, 64, s.up ? 112 : 30);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return (cache[kind] = texture);
}
// Cartello grande sopra la corsia di riparo, durante il preavviso di boss e duelli.
export function laneSign(scene) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture('low'), transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    sprite.visible = false;
    sprite.renderOrder = 5;
    scene.add(sprite);
    return {
        sprite,
        show(kind, x, z, age) {
            sprite.material.map = signTexture(kind);
            sprite.position.set(x, 3.4 + Math.sin(age * 10) * .15, z);
            sprite.scale.setScalar(2.4 * (1 + Math.abs(Math.sin(age * 8)) * .12));
            sprite.visible = true;
        },
        hide() { sprite.visible = false; },
    };
}
