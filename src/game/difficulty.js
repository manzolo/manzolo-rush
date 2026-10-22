// Medio conserva il bilanciamento originale. I moltiplicatori degli intervalli
// lasciano sempre spazio per cambiare corsia, anche alla velocità massima.
export const DIFFICULTIES = [
    { id: 'easy', name: 'Facile', hint: 'Corsa lenta, un ostacolo per fila, duelli brevi.', speed: .7, spawnInterval: 1.45, attackInterval: 1.5, projectileSpeed: .75, rowSize: 1, enemyChance: .25, unlockTime: 1.6, enemyHp: .75, duelHp: .65, duelLanes: 1 },
    { id: 'medium', name: 'Medio', hint: 'Due ostacoli per fila e duelli a colpi mirati.', speed: 1, spawnInterval: 1, attackInterval: 1, projectileSpeed: 1, rowSize: 2, enemyChance: .55, unlockTime: 1, enemyHp: 1, duelHp: 1, duelLanes: 1 },
    { id: 'hard', name: 'Difficile', hint: 'Corsa rapida, più nemici, duelli su due corsie.', speed: 1.25, spawnInterval: .8, attackInterval: .8, projectileSpeed: 1.15, rowSize: 2, enemyChance: .9, unlockTime: .5, enemyHp: 1.4, duelHp: 1.5, duelLanes: 2 },
];
export const difficultyById = id => DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1];
