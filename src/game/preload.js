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
    let count = 0;
    for (const texture of pending) {
        renderer.initTexture(texture);
        if (++count % 4 === 0)
            await nextFrame();
    }
    // Include i pool ancora invisibili: nemici, armi, bonus ed esplosioni.
    await renderer.compileAsync(scene, camera);
}
