import { SPRITES } from './sprites.js';
// Creature al posto dei robot: per ogni tipo di nemico i fotogrammi di ogni posa, il colpo
// che lancia e l'arma che lascia al giocatore quando viene abbattuto.
// height = altezza dello sprite in metri; fly = sospeso in aria (drone); blast = esplosione all'abbattimento.
export const CREATURES = {
    soldier: {
        name: 'DEMONE', height: 3.2, weapon: 'rocket', color: 0xff6a3a,
        idle: ['demon_front', 'demon_angry'], walk: ['demon_run_1', 'demon_run_2', 'demon_run_3', 'demon_run_4', 'demon_run_5', 'demon_run_6'],
        charge: 'demon_ready', shoot: 'demon_breath', hit: 'demon_hit', death: ['demon_knock', 'demon_fall', 'demon_dead'],
        shot: 'demon_fireball_1', blast: 'demon_blast', spin: false,
    },
    runner: {
        name: 'GOLEM DI FERRO', height: 3.4, weapon: 'plasma', color: 0xffa04a,
        idle: ['iron_front', 'iron_angry'], walk: ['iron_run_1', 'iron_run_2', 'iron_run_3', 'iron_run_4', 'iron_run_5', 'iron_run_6'],
        dash: 'iron_charge', charge: 'iron_windup', shoot: 'iron_punch', hit: 'iron_hit', death: ['iron_knock', 'iron_fall', 'iron_dead'],
        shot: 'iron_spikeball', blast: 'iron_blast', spin: true,
    },
    drone: {
        name: 'DEMONE ALATO', height: 2.8, weapon: 'rocket', color: 0xff4a3a, fly: true,
        idle: ['demon_leap', 'demon_flail'], walk: ['demon_leap', 'demon_flail'],
        charge: 'demon_slash', shoot: 'demon_breath', hit: 'demon_hit', death: ['demon_knock', 'demon_fall', 'demon_dead'],
        shot: 'demon_fireball_2', blast: 'demon_blast', spin: false,
    },
    tank: {
        name: 'GOLEM DI ROCCIA', height: 4, weapon: 'scatter', color: 0xffa030,
        idle: ['rock_front', 'rock_angry'], walk: ['rock_run_1', 'rock_run_2', 'rock_run_3', 'rock_run_4', 'rock_run_5', 'rock_run_6'],
        charge: 'rock_lift', shoot: 'rock_throw', hit: 'rock_hit', death: ['rock_knock', 'rock_fall', 'rock_dead'],
        shot: 'rock_boulder_1', blast: 'rock_blast', spin: true,
    },
    stalker: {
        name: 'CAMALEONTE', height: 3, weapon: 'laser', color: 0xb8ff5a,
        idle: ['cham_front', 'cham_angry'], walk: ['cham_sneak_1', 'cham_sneak_3', 'cham_sneak_6'],
        charge: 'cham_turn_1', shoot: 'cham_leap', hit: 'cham_angry', death: ['cham_leafburst', 'cham_leaves'],
        // Mimetizzato: restano solo gli occhi; riappare emergendo tra le foglie.
        hidden: 'cham_fade_2', appear: 'cham_emerge',
        shot: 'cham_dart', blast: 'cham_blast', spin: false,
    },
};
export const creature = type => CREATURES[type];
// Tutti i fotogrammi del tipo sono caricati: altrimenti si resta sui robot o sui modelli.
export function creatureReady(type) {
    const c = CREATURES[type];
    if (!c)
        return false;
    return [...c.idle, ...c.walk, c.charge, c.shoot, c.hit, ...c.death, c.shot, c.dash, c.hidden, c.appear]
        .filter(Boolean).every(name => SPRITES.has(name));
}
