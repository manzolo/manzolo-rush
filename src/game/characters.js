import { SPRITES } from './sprites.js';
// Personaggi giocabili. Ognuno ha uno sheet
// 4×3 ritagliato con il loro prefisso (vedi PROMPT_SPRITES.md, sezione 7):
//   make sprites SHEET=assets/raw/sheet_erika.png GRID_COLS=4 GRID_ROWS=3 NAMES=character PREFIX=erika_
// Un personaggio senza sprite compare nel menu come "presto" e non si può scegliere.
export const CHARACTERS = [
    { id: 'manzolo', name: 'Manzolo', legacy: true },
    { id: 'erika', name: 'Erika' },
    { id: 'mariel', name: 'Mariel' },
    { id: 'vittoria', name: 'Vittoria' },
    { id: 'linda', name: 'Linda' },
];
const LEGACY = { portrait: 'hero_portrait', front_idle: 'hero_front_idle', front_thumbs: 'hero_front_thumbs', front_tired: 'hero_front_tired' };
// Nome dello sprite di una posa: back_run_1…4, back_jump, back_slide, back_shoot, back_lean,
// front_idle, portrait, front_thumbs, front_tired.
export function poseName(id, pose) {
    const c = CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
    // Manzolo ha uno sheet nuovo (manzolo_*); i vecchi hero_* restano come riserva.
    if (c.legacy && !SPRITES.has(`${c.id}_${pose}`))
        return LEGACY[pose] || `hero_${pose}`;
    return `${c.id}_${pose}`;
}
export function characterReady(id) {
    return SPRITES.has(poseName(id, 'back_run_1'));
}
export function characterById(id) {
    return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}
