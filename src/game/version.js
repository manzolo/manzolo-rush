// Versione del gioco, unica fonte: la cambia `make bump`, che la scrive anche in package.json e crea il tag v<versione>.
// L'action di GitHub Pages pubblica solo i tag, e si rifiuta se il tag non coincide con questa riga.
export const VERSION = '0.2.0';
// URL con la versione in coda: a ogni pubblicazione il browser scarica i file nuovi invece di
// riusare quelli in cache (GitHub Pages li tiene per 10 minuti).
export const versioned = url => `${url}?v=${VERSION}`;
