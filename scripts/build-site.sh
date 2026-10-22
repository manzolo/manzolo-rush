#!/bin/bash
# Prepara il sito da pubblicare su GitHub Pages in una cartella (default _site), senza toccare i sorgenti.
#   scripts/build-site.sh [cartella]
# Codice e stile finiscono in <cartella>/<versione>/ e index.html punta lì: a ogni versione gli URL
# cambiano, quindi il browser non riusa moduli o CSS vecchi dalla cache (Pages li tiene 10 minuti).
# Le immagini citate da HTML e CSS prendono ?v=<versione>; sprite e musica caricati dal codice lo
# aggiungono da sé (versioned() in src/game/version.js).
# Per chi ha ancora in cache l'index.html precedente si pubblica anche la cartella della versione
# precedente, presa dal tag che precede quello corrente.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
OUT=${1:-_site}
version_of() { sed -n "s/^export const VERSION = '\([0-9.]*\)';$/\1/p"; }
VERSIONE=$(version_of < src/game/version.js)
[[ $VERSIONE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "✗ versione non leggibile in src/game/version.js"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/assets"
cp index.html "$OUT/"
[[ -f .nojekyll ]] && cp .nojekyll "$OUT/"
cp -r assets/sprites assets/audio "$OUT/assets/"

# Copia src/ e style.css di un albero (cartella o commit) in <OUT>/<versione>/, con i percorsi del CSS
# riportati alla radice del sito.
publish_code() {
    local version=$1 from=$2 dest="$OUT/$1"
    mkdir -p "$dest"
    if [[ $from == . ]]; then
        cp -r src style.css "$dest/"
    else
        git archive "$from" src style.css | tar -x -C "$dest"
    fi
    sed -i -E "s#url\(assets/([^)]*\.(webp|png))\)#url(../assets/\1?v=$version)#g" "$dest/style.css"
}
publish_code "$VERSIONE" .

# index.html: stile e modulo principale dalla cartella della versione, immagini con ?v=.
sed -i -E \
    -e "s#href=\"style\.css\"#href=\"$VERSIONE/style.css\"#" \
    -e "s#import\('\./src/main\.js'\)#import('./$VERSIONE/src/main.js')#" \
    -e "s#src=\"(assets/[^\"]*\.(webp|png))\"#src=\"\1?v=$VERSIONE\"#g" \
    "$OUT/index.html"
grep -q "$VERSIONE/src/main.js" "$OUT/index.html" || { echo "✗ index.html: import di main.js non riscritto"; exit 1; }
grep -q "$VERSIONE/style.css" "$OUT/index.html" || { echo "✗ index.html: style.css non riscritto"; exit 1; }

# Versione precedente: il tag v* che precede HEAD, se esiste e ha una versione diversa.
PRECEDENTE_TAG=$(git describe --tags --abbrev=0 --match 'v*' HEAD^ 2>/dev/null || true)
if [[ -n $PRECEDENTE_TAG ]]; then
    PRECEDENTE=$(git show "$PRECEDENTE_TAG:src/game/version.js" | version_of)
    if [[ -n $PRECEDENTE && $PRECEDENTE != "$VERSIONE" ]]; then
        if git show "$PRECEDENTE_TAG:index.html" | grep -q "import('./src/main.js')"; then
            # Pubblicata prima delle cartelle per versione: la sua pagina cerca src/ e style.css alla radice.
            git archive "$PRECEDENTE_TAG" src style.css | tar -x -C "$OUT"
        else
            publish_code "$PRECEDENTE" "$PRECEDENTE_TAG"
        fi
        echo "✓ incluso anche $PRECEDENTE ($PRECEDENTE_TAG) per le pagine ancora in cache"
    fi
fi
echo "✓ sito in $OUT/ (codice in $OUT/$VERSIONE/)"
