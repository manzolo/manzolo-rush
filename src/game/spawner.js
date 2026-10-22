import { CONFIG } from './config.js';
export function choosePattern(random = Math.random) {
    const list = CONFIG.spawn.patterns;
    let n = random() * list.reduce((sum, p) => sum + p.weight, 0);
    for (const p of list) {
        n -= p.weight;
        if (n <= 0)
            return p.name;
    }
    return list.at(-1).name;
}
export function makeRow(safeLane, pattern, random = Math.random) {
    const row = [];
    for (let lane = -1; lane <= 1; lane++)
        if (lane !== safeLane) {
            let kind = pattern === 'jump' ? 'barrier' : pattern === 'slide' ? 'bar' : pattern === 'freight' ? 'train' : pattern === 'crates' ? 'crate' : pattern === 'patrol' ? 'soldier' : ['barrier', 'bar', 'crate', 'soldier'][Math.floor(random() * 4)];
            row.push({ lane, kind });
        }
    return row;
}
export class Spawner {
    constructor(game) { this.game = game; this.reset(); }
    reset() { this.timer = CONFIG.spawn.initialDelay; this.safeLane = 0; this.rows = 0; }
    update(dt) {
        const g = this.game;
        if (g.boss?.active)
            return;
        this.timer -= dt;
        if (this.timer > 0)
            return;
        const interval = Math.max(CONFIG.spawn.intervalMin, CONFIG.spawn.intervalStart - g.time * CONFIG.spawn.intervalDecay);
        this.timer = interval * (g.difficulty?.spawnInterval ?? 1);
        // Una sola corsia di differenza tra vie di fuga successive. Ogni riga è
        // separata da almeno 1,75 s: molto più di cambio corsia + lunghezza treno.
        this.safeLane = Math.max(-1, Math.min(1, this.safeLane + (Math.floor(Math.random() * 3) - 1)));
        this.rows++;
        const pattern = this.rows < 3 ? (this.rows === 1 ? 'jump' : 'slide') : choosePattern();
        const row = makeRow(this.safeLane, pattern);
        if (pattern === 'mixed' && Math.random() < CONFIG.spawn.enemyChance)
            row[1].kind = 'soldier';
        for (const entry of row) {
            if (entry.kind === 'soldier' && g.enemies) {
                let kind = 'soldier', r = Math.random();
                for (const entry of CONFIG.enemyMix) {
                    if (g.time >= entry.unlock) {
                        r -= entry.weight;
                        if (r < 0) {
                            kind = entry.type;
                            break;
                        }
                    }
                }
                g.enemies.spawn(kind, entry.lane, CONFIG.world.spawnZ, this.safeLane);
            }
            else if (entry.kind === 'soldier')
                g.obstacles.spawn('crate', entry.lane, CONFIG.world.spawnZ);
            else
                g.obstacles.spawn(entry.kind, entry.lane, CONFIG.world.spawnZ);
        }
        g.pickups?.spawnRow(this.safeLane, CONFIG.world.spawnZ, pattern, row);
    }
}
