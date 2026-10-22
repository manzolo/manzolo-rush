import * as THREE from 'three';
// Facciate "vettoriali" della città disegnate su canvas: nessun download, colori del tramonto,
// finestre che riflettono il cielo e qualche luce calda accesa. Le righe dividono esattamente
// l'altezza della texture, così la ripetizione verticale non mostra giunture.
function rng(seed) {
    return () => {
        seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}
function glass(ctx, x, y, w, h, lit, random) {
    if (lit) {
        const warm = ctx.createLinearGradient(0, y, 0, y + h);
        warm.addColorStop(0, '#ffe2a6');
        warm.addColorStop(1, '#f6a95e');
        ctx.fillStyle = warm;
    }
    else {
        // Riflesso del tramonto: rosa in alto, blu crepuscolo in basso.
        const sky = ctx.createLinearGradient(0, y, 0, y + h);
        sky.addColorStop(0, '#f2b7a8');
        sky.addColorStop(.45, '#8a8fb8');
        sky.addColorStop(1, '#3e4a72');
        ctx.fillStyle = sky;
    }
    ctx.fillRect(x, y, w, h);
    if (!lit) {
        // Una sola diagonale chiara, non su tutte le finestre.
        if (random() < .55) {
            ctx.fillStyle = 'rgba(255,255,255,.22)';
            ctx.beginPath();
            ctx.moveTo(x + w * .15, y + h);
            ctx.lineTo(x + w * .55, y);
            ctx.lineTo(x + w * .75, y);
            ctx.lineTo(x + w * .35, y + h);
            ctx.fill();
        }
    }
}
function canvasTexture(draw, width, height, rx, ry) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;
    draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    texture.anisotropy = 4;
    return texture;
}
// Palazzo residenziale: intonaco terracotta tenue, tre colonne di finestre con davanzale.
export function residentialFacade(rx = 1, ry = 2.5) {
    return canvasTexture((ctx, w, h) => {
        const random = rng(91);
        ctx.fillStyle = '#c98472';
        ctx.fillRect(0, 0, w, h);
        // Lesene laterali appena più scure: danno profondità senza appesantire.
        ctx.fillStyle = '#b8705f';
        ctx.fillRect(0, 0, 10, h);
        ctx.fillRect(w - 10, 0, 10, h);
        const rows = 4, cols = 3, cell = h / rows;
        for (let r = 0; r < rows; r++) {
            const y = r * cell;
            // Fascia marcapiano.
            ctx.fillStyle = '#e8c9a8';
            ctx.fillRect(0, y + cell - 7, w, 4);
            for (let c = 0; c < cols; c++) {
                const ww = 44, wh = cell * .52, x = 22 + c * ((w - 44 - ww) / (cols - 1)), wy = y + cell * .2;
                ctx.fillStyle = '#7a4a45';
                ctx.fillRect(x - 3, wy - 3, ww + 6, wh + 6);
                glass(ctx, x, wy, ww, wh, random() < .22, random);
                ctx.fillStyle = 'rgba(60,40,50,.55)';
                ctx.fillRect(x + ww / 2 - 1, wy, 2, wh);
                ctx.fillStyle = '#f1dcc0';
                ctx.fillRect(x - 6, wy + wh + 3, ww + 12, 5);
            }
        }
    }, 256, 512, rx, ry);
}
// Torre per uffici: fasce vetrate continue tra marcapiani chiari e montanti sottili.
export function officeFacade(rx = 1, ry = 2.5) {
    return canvasTexture((ctx, w, h) => {
        const random = rng(7);
        ctx.fillStyle = '#5d6f8a';
        ctx.fillRect(0, 0, w, h);
        const rows = 5, cell = h / rows, panes = 5;
        for (let r = 0; r < rows; r++) {
            const y = r * cell, gh = cell - 22;
            for (let p = 0; p < panes; p++) {
                const pw = w / panes;
                glass(ctx, p * pw, y + 14, pw, gh, random() < .15, random);
            }
            ctx.fillStyle = '#e9d6c2';
            ctx.fillRect(0, y + cell - 8, w, 8);
            ctx.fillStyle = '#b9a99c';
            ctx.fillRect(0, y + 10, w, 4);
            ctx.fillStyle = 'rgba(40,46,70,.75)';
            for (let p = 0; p <= panes; p++)
                ctx.fillRect(p * w / panes - 2, y + 14, 4, gh);
        }
    }, 256, 512, rx, ry);
}
