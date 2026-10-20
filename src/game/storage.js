// Chiave attuale e chiave del vecchio nome del gioco, letta solo se manca quella nuova:
// record e monete passano alla nuova chiave al primo salvataggio.
const KEY = 'manzolo-rush-save', LEGACY_KEY = 'neon-rush-save';
export function readSave(storage) {
    try {
        const data = JSON.parse(storage.getItem(KEY) || storage.getItem(LEGACY_KEY) || '{}');
        return { best: Number.isFinite(data.best) ? Math.max(0, data.best) : 0, coins: Number.isFinite(data.coins) ? Math.max(0, data.coins) : 0, audio: data.audio !== false };
    }
    catch {
        return { best: 0, coins: 0, audio: true };
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
