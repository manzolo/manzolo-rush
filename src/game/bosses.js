import { SPRITES } from './sprites.js';
// I boss dei tre livelli: pose, attacchi e stagione che portano nello scenario.
// walls: lo sprite di ogni tipo di colpo ('full' = muro da evitare cambiando corsia, può avere
// più varianti; 'low' = da saltare; 'high' = da passare in scivolata).
// height = altezza in metri; float = quota da terra (la nuvola vola); highTilt = rotazione che
// mette in orizzontale lo sprite del colpo alto (disegnato in diagonale nello sheet).
export const BOSSES = {
    storm: {
        name: 'NUVOLA TEMPESTA', height: 18, float: 2, color: 0x8fd4ff, season: 'storm',
        idle: ['storm_front', 'storm_angry', 'storm_front_2', 'storm_glare'], charge: 'storm_charge',
        fire: 'storm_roar', blow: 'storm_blow', hurt: 'storm_hurt', enraged: 'storm_tornado',
        walls: { full: ['storm_strike', 'storm_rain'], low: 'storm_gust', high: 'storm_bolt' },
        highTilt: .72, burst: 'storm_burst', enragedText: 'LA TEMPESTA SI SCATENA',
    },
    magma: {
        name: 'GOLEM DI MAGMA', height: 21, float: 0, color: 0xff8a3a, season: 'inferno',
        idle: ['magma_front', 'magma_glare', 'magma_front_2'], charge: 'magma_charge',
        fire: 'magma_roar', blow: 'magma_blow', hurt: 'magma_hurt', enraged: 'magma_tornado',
        walls: { full: ['magma_spikes', 'magma_pillar'], low: 'magma_wave', high: 'magma_flame' },
        highTilt: .35, burst: 'magma_burst', enragedText: 'IL MAGMA RIBOLLE',
    },
    ice: {
        name: 'GOLEM DI GHIACCIO', height: 22, float: 0, color: 0x9fe8ff, season: 'winter',
        idle: ['ice_front', 'ice_angry', 'ice_front_2', 'ice_glare'], charge: 'ice_charge',
        fire: 'ice_roar', blow: 'ice_blow', hurt: 'ice_hurt', enraged: 'ice_stomp',
        walls: { full: ['ice_spike', 'ice_pillar'], low: 'ice_spikes', high: 'ice_volley' },
        highTilt: .12, burst: 'ice_splash_big', enragedText: 'IL GELO SI ROMPE',
    },
};
export function bossFrames(boss) {
    return [...boss.idle, boss.charge, boss.fire, boss.blow, boss.hurt, boss.enraged, ...boss.walls.full, boss.walls.low, boss.walls.high, boss.burst];
}
export const bossReady = id => Boolean(BOSSES[id]) && bossFrames(BOSSES[id]).every(name => SPRITES.has(name));
// Tre livelli: battuto il boss si passa al successivo; il terzo è l'ultimo e il suo boss ritorna.
// tint = colori dello scenario del livello (mescolati al tema di turno con peso `amount`).
export const LEVELS = [
    { name: 'LIVELLO 1', boss: 'storm', tint: null },
    { name: 'LIVELLO 2 · TERRE ARSE', boss: 'magma', tint: { amount: .45, sky: 0xd9825e, fog: 0xc98466, road: 0x4a3a36, ground: 0x9a6a50, building: 0xc88a6a, roof: 0x8a4a3a, accent: 0xffc27a, sun: 0xffb070 } },
    { name: 'LIVELLO 3 · GELO ETERNO', boss: 'ice', tint: { amount: .5, sky: 0x9fbcd8, fog: 0xbcd0e2, road: 0x56677a, ground: 0xc4d6e4, building: 0x9fb4cc, roof: 0xe8f2fa, accent: 0x9fe8ff, sun: 0xe6f4ff } },
];
