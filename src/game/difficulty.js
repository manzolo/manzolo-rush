// Medio conserva il bilanciamento originale. I moltiplicatori degli intervalli
// lasciano sempre spazio per cambiare corsia, anche alla velocità massima.
export const DIFFICULTIES = [
    { id: 'easy', name: 'Facile', hint: 'Più tempo per schivare e prendere la mira.', speed: .8, spawnInterval: 1.2, attackInterval: 1.25, projectileSpeed: .85 },
    { id: 'medium', name: 'Medio', hint: 'La corsa originale. Riflessi e ritmo.', speed: 1, spawnInterval: 1, attackInterval: 1, projectileSpeed: 1 },
    { id: 'hard', name: 'Difficile', hint: 'Più velocità, meno tregua. Resta concentrato.', speed: 1.15, spawnInterval: .9, attackInterval: .85, projectileSpeed: 1.1 },
];
export const difficultyById = id => DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1];
