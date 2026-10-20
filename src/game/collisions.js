import { CONFIG } from './config.js';
// Conta la posizione reale, non la corsia di destinazione di un cambio ancora in corso.
// La corsia della moneta è quella di nascita: il magnete non può allargare il suo
// raggio trascinando prima una moneta della corsia opposta verso il centro.
export function coinLaneReachable(player, coin, magnet = false) {
    const occupiedLane = Math.max(-1, Math.min(1, Math.round(player.x / CONFIG.player.laneWidth)));
    return Math.abs(occupiedLane - coin.lane) <= (magnet ? 1 : 0);
}
// Premio solo dopo aver oltrepassato tutta la hitbox, mai per una schivata laterale.
export function obstaclePassBonus(player, obstacle) {
    if (!obstacle.active || obstacle.passScored)
        return 0;
    const aligned = Math.abs(player.x - obstacle.x) < CONFIG.player.halfWidth + obstacle.hw;
    const clearance = CONFIG.player.halfDepth + obstacle.hd;
    const dz = obstacle.z - CONFIG.player.z;
    if (Math.abs(dz) <= clearance) {
        if (aligned && obstacle.type === 'barrier' && player.y >= obstacle.top)
            obstacle.passAction = 'jump';
        else if (aligned && obstacle.type === 'bar' && player.slide > 0 && player.y + player.height <= obstacle.bottom)
            obstacle.passAction = 'slide';
        else
            obstacle.passAction = null;
    }
    if (dz > clearance) {
        obstacle.passScored = true;
        return aligned ? CONFIG.obstacles.passScores[obstacle.passAction] || 0 : 0;
    }
    return 0;
}
// Hitbox più strette dei modelli: i contatti visivi marginali sono perdonati.
export function playerOverlap(player, entity) {
    return Math.abs(player.x - entity.x) < CONFIG.player.halfWidth + entity.hw && Math.abs(CONFIG.player.z - entity.z) < CONFIG.player.halfDepth + entity.hd && player.y + player.height > entity.bottom + .08 && player.y < entity.top - .08;
}
// Segmento lungo Z: evita che un proiettile veloce attraversi un bersaglio tra due tick.
export function bulletOverlap(bullet, entity) {
    const r = bullet.radius ?? .12;
    return Math.abs(bullet.x - entity.x) < entity.hw + r && bullet.y > entity.bottom - r && bullet.y < entity.top + r && Math.min(bullet.z, bullet.previousZ) <= entity.z + entity.hd && Math.max(bullet.z, bullet.previousZ) >= entity.z - entity.hd;
}
export function safeTransition(previousLane, nextLane, rowSeconds, speed, maxDepth = 5) {
    return Math.abs(nextLane - previousLane) * CONFIG.player.laneTime + maxDepth / speed + .3 < rowSeconds;
}
