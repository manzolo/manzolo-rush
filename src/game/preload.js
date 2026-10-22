// Scaricare le immagini non basta: upload, mipmap e shader vanno preparati sulla GPU
// prima della corsa. Piccoli gruppi mantengono reattiva la schermata di caricamento.
export async function prepareGraphics(renderer, scene, camera, textures = [], nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve))) {
    const pending = new Set(textures);
    scene.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials)
            if (material?.map)
                pending.add(material.map);
    });
    // compile() visita solo gli oggetti visibili: per un attimo si mostrano anche i pool
    // nascosti (scudo, fulmini, inferno), così il primo boss non blocca il frame.
    const hidden = [];
    scene.traverse(object => {
        if (object.visible === false)
            hidden.push(object);
    });
    let count = 0;
    for (const texture of pending) {
        renderer.initTexture(texture);
        if (++count % 4 === 0)
            await nextFrame();
    }
    for (const object of hidden)
        object.visible = true;
    const compiled = renderer.compileAsync(scene, camera);
    for (const object of hidden)
        object.visible = false;
    await compiled;
}
