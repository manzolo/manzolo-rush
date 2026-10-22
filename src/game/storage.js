// Chiave attuale e chiave del vecchio nome del gioco, letta solo se manca quella nuova:
// record e monete passano alla nuova chiave al primo salvataggio.
import { DIFFICULTIES, difficultyById } from './difficulty.js';
const KEY = 'manzolo-rush-save', LEGACY_KEY = 'neon-rush-save';
export const volumeLevel = value => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
const defaults = () => ({ best: 0, bestCharacter: null, bestDifficulty: null, coins: 0, audio: true, music: true, hints: true, soundVolume: 1, musicVolume: 1, character: 'manzolo', difficulty: 'medium' });
export function readSave(storage) {
    try {
        const data = JSON.parse(storage.getItem(KEY) || storage.getItem(LEGACY_KEY) || '{}');
        return { best: Number.isFinite(data.best) ? Math.max(0, data.best) : 0, bestCharacter: typeof data.bestCharacter === 'string' ? data.bestCharacter : null, bestDifficulty: DIFFICULTIES.some(d => d.id === data.bestDifficulty) ? data.bestDifficulty : null, coins: Number.isFinite(data.coins) ? Math.max(0, data.coins) : 0, audio: data.audio !== false, music: data.music !== false, hints: data.hints !== false, soundVolume: volumeLevel(data.soundVolume), musicVolume: volumeLevel(data.musicVolume), character: typeof data.character === 'string' ? data.character : 'manzolo', difficulty: difficultyById(data.difficulty).id };
    }
    catch {
        return defaults();
    }
}
export function writeSave(storage, data) {
    try {
        storage.setItem(KEY, JSON.stringify(data));
        return true;
    }
    catch {
        return false;
    }
}
