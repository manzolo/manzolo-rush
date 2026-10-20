export function readSave(storage) {
    try {
        const data = JSON.parse(storage.getItem('neon-rush-save') || '{}');
        return { best: Number.isFinite(data.best) ? Math.max(0, data.best) : 0, coins: Number.isFinite(data.coins) ? Math.max(0, data.coins) : 0, audio: data.audio !== false };
    }
    catch {
        return { best: 0, coins: 0, audio: true };
    }
}
export function writeSave(storage, data) {
    try {
        storage.setItem('neon-rush-save', JSON.stringify(data));
        return true;
    }
    catch {
        return false;
    }
}
