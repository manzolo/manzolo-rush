#!/bin/bash
# Nuova versione: scrive la versione in src/game/version.js e package.json, verifica, fa il commit,
# crea il tag annotato v<versione> e spinge main col tag. Il tag fa partire l'action che pubblica su GitHub Pages.
#   scripts/bump.sh [patch|minor|major]      (default patch: 1.0.0 → 1.0.1)
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
PARTE=${1:-patch}
[[ $PARTE =~ ^(patch|minor|major)$ ]] || { echo "uso: $0 [patch|minor|major]"; exit 2; }
[[ $(git branch --show-current) == main ]] || { echo "✗ non sono su main"; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo "✗ ci sono modifiche non committate: prima il commit"; git status --short; exit 1; }

ATTUALE=$(sed -n "s/^export const VERSION = '\([0-9.]*\)';$/\1/p" src/game/version.js)
[[ $ATTUALE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "✗ versione non leggibile in src/game/version.js"; exit 1; }
IFS=. read -r MA MI PA <<<"$ATTUALE"
case $PARTE in
    major) NUOVA="$((MA + 1)).0.0" ;;
    minor) NUOVA="$MA.$((MI + 1)).0" ;;
    patch) NUOVA="$MA.$MI.$((PA + 1))" ;;
esac
git rev-parse -q --verify "refs/tags/v$NUOVA" >/dev/null && { echo "✗ il tag v$NUOVA esiste già"; exit 1; }

sed -i "s/^export const VERSION = '$ATTUALE';$/export const VERSION = '$NUOVA';/" src/game/version.js
python3 - "$NUOVA" <<'PY'
import json, sys
d = json.load(open('package.json')); d['version'] = sys.argv[1]
open('package.json', 'w').write(json.dumps(d, separators=(',', ':')) + '\n')
PY
if ! make -s verify check-public; then
    git checkout -- src/game/version.js package.json
    echo "✗ verifiche fallite: versione rimessa a $ATTUALE"; exit 1
fi
git commit -q -am "Versione $NUOVA"
git tag -a "v$NUOVA" -m "Manzolo Rush $NUOVA"
echo "✓ $ATTUALE → $NUOVA (commit e tag v$NUOVA)"
if git remote get-url origin >/dev/null 2>&1; then
    git push -q origin main "v$NUOVA"
    echo "✓ spinto: l'action pubblica v$NUOVA su GitHub Pages"
else
    echo "  nessun remoto origin: niente push"
fi
