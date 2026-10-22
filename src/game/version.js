// Versione del gioco, unica fonte: la cambia `make bump`, che la scrive anche in package.json e crea il tag v<versione>.
// L'action di GitHub Pages pubblica solo i tag, e si rifiuta se il tag non coincide con questa riga.
export const VERSION = '0.1.3';
