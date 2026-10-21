#!/bin/bash
# Prima di pubblicare: niente prompt, fogli grezzi, log di Codex, segreti o nomi della rete di casa.
# Guarda tutti i percorsi raggiungibili da tutti i ref (la storia intera, non solo HEAD) e il testo di HEAD.
# `--self-test` costruisce un repo usa e getta, inietta un prompt e un host .lan e pretende che siano rifiutati:
# un controllo che non fallisce mai non prova niente.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

FORBIDDEN_PATHS='(^|/)(PROMPT[A-Z_]*\.md|prompts/|assets/raw/|codex\.log|deploy\.local\.mk)'
FORBIDDEN_PATHS+='|(^|/)\.env$|(^|/)id_(rsa|ed25519|ecdsa)(\.pub)?$|\.(pem|key|p12|pfx)$'
FORBIDDEN_TEXT='[a-z0-9-]+\.lan([^a-z0-9.-]|$)|192\.168\.[0-9]+\.[0-9]+|BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY'

scan_repo() {
    local repo=$1 rc=0 hits
    hits=$(git -C "$repo" rev-list --all --objects | awk 'NF>1{print $2}' | sort -u | grep -E "$FORBIDDEN_PATHS" || true)
    if [[ -n $hits ]]; then
        echo "FAIL: percorsi vietati nella storia (va riscritta, non basta cancellarli):"
        echo "$hits" | head -40 | sed 's/^/  /'
        rc=1
    fi
    hits=$(git -C "$repo" grep -nIE "$FORBIDDEN_TEXT" HEAD -- . ':!scripts/check-public.sh' 2>/dev/null | sed 's/^HEAD://' || true)
    if [[ -n $hits ]]; then
        echo "FAIL: testo vietato in HEAD:"
        echo "$hits" | head -20 | sed 's/^/  /'
        rc=1
    fi
    [[ $rc -eq 0 ]] && echo "PASS: niente prompt, fogli grezzi, segreti o host privati in $repo (tutti i ref)"
    return $rc
}

self_test() {
    local tmp
    tmp=$(mktemp -d /tmp/check-public.XXXXXX)
    trap 'rm -rf -- "$tmp"' RETURN
    local -a g=(git -C "$tmp" -c user.name=check -c user.email=check@example.invalid -c commit.gpgsign=false)
    git init -q "$tmp"
    printf '# pulito\n' > "$tmp/README.md"
    "${g[@]}" add README.md && "${g[@]}" commit -qm pulito
    scan_repo "$tmp" >/dev/null || { echo 'self-test FAIL: un repo pulito deve passare'; return 1; }
    mkdir -p "$tmp/prompts" && printf 'foto di famiglia\n' > "$tmp/prompts/character_x.md"
    "${g[@]}" add prompts && "${g[@]}" commit -qm 'prompt iniettato'
    "${g[@]}" rm -rq prompts && "${g[@]}" commit -qm 'cancellato (resta nella storia)'
    if scan_repo "$tmp" >/dev/null 2>&1; then echo 'self-test FAIL: un prompt nella storia deve essere rifiutato'; return 1; fi
    rm -rf "$tmp/.git" && git init -q "$tmp" && printf 'DEPLOY_HOST = root@casa.lan\n' > "$tmp/README.md"
    "${g[@]}" add README.md && "${g[@]}" commit -qm 'host privato'
    if scan_repo "$tmp" >/dev/null 2>&1; then echo 'self-test FAIL: un host .lan deve essere rifiutato'; return 1; fi
    echo 'self-test PASS: repo pulito accettato, prompt nella storia e host .lan rifiutati'
}

[[ ${1:-} == --self-test ]] && { self_test; exit; }
scan_repo "$ROOT"
