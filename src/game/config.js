// Tutto il bilanciamento è qui. Unità: metri, secondi, punti vita.
export const CONFIG = {
    step: 1 / 60, maxFrame: 0.1, maxPixelRatio: 2,
    // Risoluzione adattiva: dopo 3 s sotto 45 fps riduce il DPR, mai sotto 1.
    performance: { sampleSeconds: 3, slowFrame: 1 / 45, minPixelRatio: 1, ratioStep: .25 },
    player: { laneWidth: 3, laneTime: .15, jumpVelocity: 10.8, gravity: 27, slideDuration: .7, inputBuffer: .18, lives: 3, invulnerability: 1.5, halfWidth: .32, height: 1.65, slideHeight: .62, halfDepth: .32, z: 3 },
    speed: { initial: 15, max: 30, acceleration: .065 }, // Raggiunge il tetto in ~231 s.
    world: { chunkLength: 24, chunks: 9, spawnZ: -150, despawnZ: 14, themeSeconds: 45 },
    spawn: { initialDelay: 3, intervalStart: 2.6, intervalMin: 1.75, intervalDecay: .003, obstaclePool: 52, enemyPool: 32, coinPool: 240, powerPool: 12,
        // Pesi dei pattern: una corsia di fuga non è mai occupata nella riga.
        patterns: [{ name: 'jump', weight: 3 }, { name: 'slide', weight: 3 }, { name: 'freight', weight: 2 }, { name: 'crates', weight: 3 }, { name: 'patrol', weight: 4 }, { name: 'mixed', weight: 3 }],
        enemyChance: .55, powerChance: .13, crateDropChance: .28, coinCount: 6, coinSpacing: 2.1 },
    weapon: { normalInterval: .24, burstInterval: .075, damage: 1, bulletSpeed: 96, bulletLifetime: 1.8, bulletPool: 160, heatPerShot: .016, burstHeatPerShot: .085, cooling: .22, overheatRecovery: .25, recoil: .12 },
    // Armi raccoglibili a tempo. interval/heat valgono per il fuoco normale; la raffica usa
    // interval × burstFactor e heat × burstHeat. size = spessore, length = lunghezza del colpo (m),
    // radius = raggio di collisione, pierce = bersagli extra trapassati, splash = raggio d'esplosione.
    guns: { duration: 14, rowChance: .09, crateDrop: .3, burstFactor: .45, burstHeat: 3,
        types: {
            scatter: { label: 'SPARPAGLIATORE', color: 0xff9a3c, interval: .42, damage: 1, pellets: 5, spread: 9, speed: 80, life: .6, size: .26, length: .4, radius: .2, heat: .05, recoil: .2 },
            plasma: { label: 'PLASMA', color: 0xb67cff, interval: .4, damage: 3, pellets: 1, spread: 0, speed: 52, life: 2.2, size: .78, length: .78, radius: .5, pierce: 2, heat: .06, recoil: .18 },
            laser: { label: 'LASER', color: 0xff4d5e, interval: .1, damage: 2, pellets: 1, spread: 0, speed: 170, life: .9, size: .13, length: 3.6, radius: .12, pierce: 3, heat: .028, recoil: .05 },
            rocket: { label: 'RAZZI', color: 0xffd23c, interval: .62, damage: 6, pellets: 1, spread: 0, speed: 58, life: 2.4, size: .32, length: 1.1, radius: .3, splash: 3.2, heat: .09, recoil: .25 },
        } },
    // Sblocco graduale dei nemici e pesi relativi (il soldato resta sempre disponibile).
    enemyMix: [{ type: 'runner', unlock: 20, weight: .2 }, { type: 'drone', unlock: 30, weight: .23 }, { type: 'tank', unlock: 42, weight: .19 }],
    obstacles: { crateHp: 2 },
    intro: { coinCount: 12, firstCoinZ: -8, barrierZ: -60, barZ: -110 },
    collection: { coinRadius: .8, powerRadius: .9, magnetPull: 11, arcCount: 7, arcHeight: 1.8, arcSpacing: 2 },
    enemies: { soldier: { hp: 2, score: 100 }, runner: { hp: 3, score: 140, switchInterval: 1.7, turnLimitZ: -22, laneSmoothing: 5 }, drone: { hp: 2, score: 180, fireInterval: 2.4, fireNearZ: -18, fireFarZ: -65 }, tank: { hp: 9, score: 300 }, shotSpeed: 19, shotPool: 72, warningSeconds: .8 },
    boss: { interval: 90, hp: 130, hpGrowth: 25, score: 2500, approachZ: -38, attackInterval: 2.2, warning: 1.1, duration: 34, projectileSpeed: 28, firstAttackDelay: 3, approachSmoothing: 1.1, resumeSpawnDelay: 1 },
    bonuses: { duration: 11, magnetRadius: 9, comboWindow: 3, maxCombo: 8, coinScore: 10, distanceScore: 1, types: ['triple', 'shield', 'magnet', 'double'] },
    juice: { particlePool: 320, hitStop: .045, shake: .14, killParticles: 16, landingParticles: 7 },
    audio: { master: .3, music: .12, tempo: 112 },
    // Sprite 2D (assets/sprites, rigenerabili con `make sprites`). Ogni voce si può spegnere
    // singolarmente; se un file manca o il caricamento fallisce si torna ai modelli procedurali.
    // hero usa i frame visti di spalle (hero_back_*); textures e props vestono scenario e ostacoli per tema.
    sprites: { enabled: true, path: 'assets/sprites/', hero: true, enemies: true, pickups: true, explosions: true, textures: true, props: true,
        heroHeight: 1.95, slideHeight: 1.15, heroAngle: 0, enemyAngle: 0, runFps: 11, leanThreshold: .9, loadTimeout: 8 },
};
export const THEMES = [
    { name: 'SUNSET CITY', sky: 0xd39c98, fog: 0xd3a6a0, road: 0x344654, ground: 0x846e73, primary: 0x628e9a, secondary: 0xd58375, accent: 0x8bffd1, sun: 0xffd7a2 },
    { name: 'DUST VALLEY', sky: 0xe9b783, fog: 0xe6b580, road: 0x776758, ground: 0xbb895d, primary: 0xb57953, secondary: 0xdfa66d, accent: 0xffdc82, sun: 0xffedb7 },
    { name: 'NEON OUTPOST', sky: 0x172e49, fog: 0x263e5b, road: 0x293849, ground: 0x22384d, primary: 0x365777, secondary: 0x526087, accent: 0x79f3e5, sun: 0x9fcfe7 },
];
