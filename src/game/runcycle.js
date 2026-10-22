// Ciclo di corsa dello sprite: frame, molleggio, ondeggiamento e schiacciamento derivano tutti dalla
// stessa fase, così il corpo tocca terra esattamente quando un piede appoggia.
// Un ciclo = `frames` fotogrammi = due passi: i frame 0 e frames/2 sono gli appoggi.
// phase: avanza di 13 al secondo (Player.update); fps: fotogrammi di corsa al secondo.
export function runPose(phase, fps, frames, bounce = .07, sway = .035) {
    const cycle = phase / 13 * fps / frames;
    const steps = cycle * 2;
    const lift = Math.abs(Math.sin(Math.PI * steps)); // 0 all'appoggio, 1 a metà passo
    return {
        frame: Math.floor(cycle * frames) % frames,
        // Più in alto a metà passo, a terra sugli appoggi: due rimbalzi per ciclo.
        bounce: lift * bounce,
        // Il busto si inclina da un lato e dall'altro a passi alterni (segno opposto a ogni passo).
        sway: Math.sin(Math.PI * steps) * sway,
        // Schiacciamento breve all'appoggio (1 = nessuno).
        squash: 1 - Math.pow(1 - lift, 6) * .05,
    };
}
