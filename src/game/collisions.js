import { CONFIG } from './config.js';
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
