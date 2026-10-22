// Tutto il bilanciamento è qui. Unità: metri, secondi, punti vita.
export const CONFIG = {
    step: 1 / 60, maxFrame: 0.1, maxPixelRatio: 2,
    // Budget iniziale di pixel e adattamento a 55 fps, anche su schermi grandi/HiDPI.
    performance: { maxPixels: 2000000, sampleSeconds: 1.5, slowFrame: 1 / 55, minPixelRatio: .7, ratioStep: .15 },
    // Vita extra ogni extraLifeEvery punti, fino a maxLives cuori.
    player: { extraLifeEvery: 5000, maxLives: 5, laneWidth: 3, laneTime: .15, jumpVelocity: 10.8, gravity: 27, slideDuration: .7, inputBuffer: .18, lives: 3, invulnerability: 1.5, halfWidth: .32, height: 1.65, slideHeight: .62, halfDepth: .32, z: 3 },
    speed: { initial: 15, max: 30, acceleration: .065 }, // Raggiunge il tetto in ~231 s.
    world: { chunkLength: 24, chunks: 9, spawnZ: -150, despawnZ: 14, themeSeconds: 45 },
    spawn: { initialDelay: 3, intervalStart: 2.6, intervalMin: 1.75, intervalDecay: .003, obstaclePool: 52, enemyPool: 35, coinPool: 240, powerPool: 12,
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
            plasma: { label: 'PLASMA', color: 0xb67cff, interval: .4, damage: 3, pellets: 1, spread: 0, speed: 52, life: 2.2, size: .32, length: 1.7, radius: .5, pierce: 2, heat: .06, recoil: .18 },
            laser: { label: 'LASER', color: 0xff4d5e, interval: .1, damage: 2, pellets: 1, spread: 0, speed: 170, life: .9, size: .13, length: 3.6, radius: .12, pierce: 3, heat: .028, recoil: .05 },
            rocket: { label: 'RAZZI', color: 0xffd23c, interval: .62, damage: 6, pellets: 1, spread: 0, speed: 58, life: 2.4, size: .32, length: 1.1, radius: .3, splash: 3.2, heat: .09, recoil: .25 },
        } },
    // Sblocco graduale dei nemici e pesi relativi (il soldato resta sempre disponibile).
    enemyMix: [{ type: 'runner', unlock: 20, weight: .2 }, { type: 'stalker', unlock: 25, weight: .18 }, { type: 'drone', unlock: 30, weight: .23 }, { type: 'tank', unlock: 42, weight: .19 }],
    obstacles: { crateHp: 2, passScores: { jump: 15, slide: 10 } },
    intro: { coinCount: 12, firstCoinZ: -8, barrierZ: -60, barZ: -110 },
    collection: { coinRadius: .8, powerRadius: .9, magnetPull: 11, arcCount: 7, arcHeight: 1.8, arcSpacing: 2 },
    // Soldati e tank sparano entro [fireFarZ, fireNearZ] con chargeSeconds di preavviso (arma che si
    // illumina): il soldato a mezza altezza, il tank un proiettile raso terra da saltare.
    // Il pattugliatore scatta in avanti (dashSpeed m/s in più) quando supera dashZ.
    enemies: { soldier: { hp: 2, score: 100, switchInterval: 3, turnLimitZ: -30, laneSmoothing: 3.5, fireInterval: 2.8, fireNearZ: -20, fireFarZ: -62 }, runner: { hp: 3, score: 140, switchInterval: 1.7, turnLimitZ: -22, laneSmoothing: 5, dashZ: -26, dashSpeed: 8 }, drone: { hp: 2, score: 180, fireInterval: 2.4, fireNearZ: -18, fireFarZ: -65 }, tank: { hp: 9, score: 300, fireInterval: 3.6, fireNearZ: -22, fireFarZ: -58 },
        // Camaleonte: visibile `showSeconds`, poi si mimetizza (né colpibile né visibile) per
        // `hideSeconds` e riappare in un'altra corsia, mai in quella di fuga.
        stalker: { hp: 2, score: 220, fireInterval: 2.6, fireNearZ: -20, fireFarZ: -60, showSeconds: 1.5, hideSeconds: 1.1, fadeSeconds: .3 }, shotSpeed: 19, shellSpeed: 15, shotPool: 72, warningSeconds: .8, chargeSeconds: .55, deathSeconds: .75 },
    // Le salve del boss sono muri alti wallHeight su due corsie: non si saltano né si scivola sotto.
    // Nella terza arriva una barra bassa (alta lowHeight, da saltare) o una sbarra sospesa (da
    // highBottom a highTop, da passare in scivolata). Sotto il 40% di vita l'intervallo si riduce di enragedRate.
    // Il duello dura finché il boss non viene abbattuto.
    boss: { interval: 90, hp: 130, hpGrowth: 25, score: 2500, height: 8.2, wallHeight: 3.4, wallDepth: .5, enragedRate: .7, lowHeight: .9, highBottom: .95, highTop: 2.4, restAfter: 45, approachZ: -30, attackInterval: 1.85, warning: 1.1, duration: 34, projectileSpeed: 28, firstAttackDelay: 3, approachSmoothing: 1.1, resumeSpawnDelay: 1,
        progression: { attackRateStep: .035, minAttackRate: .8, speedStep: .04, maxSpeed: 1.25, minRecovery: .15 } },
    // Tempo: si parte con `start` secondi, ogni moneta ne ridà `coin` (fino a `max`); a zero si perde.
    // Si ferma durante boss e duelli; sotto `warn` secondi la barra lampeggia.
    timer: { start: 25, max: 30, coin: .5, warn: 6 },
    bonuses: { duration: 11, magnetRadius: 9, comboWindow: 3, maxCombo: 8, coinScore: 10, distanceScore: 1, types: ['triple', 'shield', 'magnet', 'double'] },
    juice: { particlePool: 320, hitStop: .045, shake: .14, killParticles: 16, landingParticles: 7 },
    // tracks: brani MP3 (menu/game over e corsa); se mancano si usa la musica procedurale.
    audio: { master: .65, music: .12, tempo: 112, trackVolume: .28, fade: .8, tracks: { menu: 'assets/audio/intro.mp3', run: 'assets/audio/run.mp3' } },
    // Sprite 2D (assets/sprites, rigenerabili con `make sprites`). Ogni voce si può spegnere
    // singolarmente; se un file manca o il caricamento fallisce si torna ai modelli procedurali.
    // hero usa i frame visti di spalle (hero_back_*); textures e props vestono scenario e ostacoli per tema.
    // vectorCity: nella città le facciate sono disegnate su canvas (facades.js) invece delle immagini.
    sprites: { enabled: true, path: 'assets/sprites/', hero: true, enemies: true, pickups: true, explosions: true, textures: true, props: true,
        vectorCity: true, heroHeight: 1.95, slideHeight: 1.15, heroAngle: 0, enemyAngle: 0, runFps: 11, leanThreshold: .9, loadTimeout: 8 },
};
export { THEMES } from './scenery.js';
