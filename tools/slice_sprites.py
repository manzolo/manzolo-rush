#!/usr/bin/env python3
"""Ritaglia lo sprite sheet su sfondo verde chroma in singoli PNG trasparenti.

Uso:
    python3 tools/slice_sprites.py [--sheet assets/raw/spritesheet.png] [--names main]
                                   [--out assets/sprites] [--cols 4 --rows 5]
                                   [--thresh 200] [--pad 4] [--no-key --inset 6]

Esempi (vedi PROMPT_SPRITES.md per i tre sheet aggiuntivi):
    python3 tools/slice_sprites.py --sheet assets/raw/sheet_hero_rear.png --names hero_rear --cols 4 --rows 5
    python3 tools/slice_sprites.py --sheet assets/raw/sheet_textures.png --names textures --cols 4 --rows 4 --no-key
    python3 tools/slice_sprites.py --sheet assets/raw/sheet_props.png --names props --cols 4 --rows 4

Dipendenze: solo Pillow. La griglia viene rilevata cercando righe/colonne
interamente verdi (gutter); --cols/--rows forzano una griglia fissa se il
rilevamento non torna.
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

# Nomi delle celle di ogni sheet, riga per riga, da sinistra a destra (vedi PROMPT_SPRITES.md).
SHEETS = {
    "main": [
        "hero_run_1", "hero_run_2", "hero_run_3", "hero_run_4",
        "hero_jump", "hero_slide", "hero_shoot", "weapon_blaster",
        "enemy_grunt", "enemy_dodger", "enemy_drone", "enemy_tank",
        "coin", "powerup_triple", "powerup_shield", "powerup_magnet",
        "powerup_multiplier", "bullet", "explosion", "boss_head",
    ],
    "hero_rear": [
        "hero_back_run_1", "hero_back_run_2", "hero_back_run_3", "hero_back_run_4",
        "hero_back_jump", "hero_back_slide", "hero_back_shoot", "hero_back_lean",
        "enemy_front_grunt", "enemy_front_dodger", "enemy_front_drone", "enemy_front_tank",
        "hero_front_idle", "hero_front_run", "hero_front_victory", "hero_portrait",
        "hero_front_hurt", "hero_front_tired", "hero_front_thumbs", "boss_head_front",
    ],
    "textures": [
        "city_facade_a", "city_facade_b", "city_road", "city_sidewalk",
        "desert_facade_a", "desert_facade_b", "desert_road", "desert_ground",
        "neon_facade_a", "neon_facade_b", "neon_road", "neon_plates",
        "crate", "barrier", "train_side", "container",
    ],
    "props": [
        "prop_city_lamp", "prop_city_tree", "prop_city_busstop", "prop_city_sign",
        "prop_desert_cactus", "prop_desert_tree", "prop_desert_barrels", "prop_desert_sign",
        "prop_neon_antenna", "prop_neon_holo", "prop_neon_pylon", "prop_neon_canisters",
        "prop_cone", "prop_block", "prop_bush", "prop_rocks",
    ],
    "nature_textures": [
        "forest_facade_a", "forest_facade_b", "forest_road", "forest_ground",
        "volcano_facade_a", "volcano_facade_b", "volcano_road", "volcano_ground",
        "snow_facade_a", "snow_facade_b", "snow_road", "snow_ground",
    ],
    "nature_props": [
        "prop_forest_tree", "prop_forest_arch", "prop_forest_pillar", "prop_forest_ferns",
        "prop_volcano_basalt", "prop_volcano_vent", "prop_volcano_tree", "prop_volcano_crystals",
        "prop_snow_fir", "prop_snow_crystals", "prop_snow_sign", "prop_snow_rocks",
    ],
    # Personaggio giocabile (sezione 7 di PROMPT_SPRITES.md), da usare con --prefix <id>_
    "character": [
        "back_run_1", "back_run_2", "back_run_3", "back_run_4",
        "back_jump", "back_slide", "back_shoot", "back_lean",
        "front_idle", "portrait", "front_thumbs", "front_tired",
    ],
    # Secondo boss: la nuvola temporalesca (pose, colpi e impatti).
    "storm": [
        "storm_front", "storm_angry", "storm_left", "storm_back", "storm_right", "storm_front_2",
        "storm_glare", "storm_roar", "storm_blow", "storm_charge", "storm_tornado", "storm_hurt",
        "storm_drop", "storm_drops", "storm_bolt", "storm_strike", "storm_twister", "storm_gust",
        "storm_splash", "storm_splash_big", "storm_bolt_impact", "storm_burst", "storm_rain", "storm_twister_impact",
    ],
    # Nemico demone (al posto dei robot): righe da 7, 6, 6, 6, 6 celle.
    "demon": [
        "demon_front", "demon_turn_1", "demon_left", "demon_back", "demon_turn_4", "demon_right", "demon_angry",
        "demon_run_1", "demon_run_2", "demon_run_3", "demon_run_4", "demon_run_5", "demon_run_6",
        "demon_leap", "demon_flail", "demon_breath", "demon_slash", "demon_pound", "demon_ready",
        "demon_hit", "demon_knock", "demon_fall", "demon_ko", "demon_dazed", "demon_dead",
        "demon_fireball_1", "demon_fireball_2", "demon_fireball_3", "demon_ring", "demon_blast", "demon_pillar",
    ],
    # Nemico di roccia: stessa disposizione del demone.
    "rock": [
        "rock_front", "rock_turn_1", "rock_left", "rock_back", "rock_turn_4", "rock_right", "rock_angry",
        "rock_run_1", "rock_run_2", "rock_run_3", "rock_run_4", "rock_run_5", "rock_run_6",
        "rock_windup", "rock_throw", "rock_lift", "rock_pound", "rock_swing", "rock_ready",
        "rock_hit", "rock_knock", "rock_fall", "rock_down", "rock_dazed", "rock_dead",
        "rock_boulder_1", "rock_boulders", "rock_boulder_2", "rock_blast", "rock_spikes", "rock_ring",
    ],
    # Nemico di ferro: righe da 7, 6, 5, 6, 6 celle.
    "iron": [
        "iron_front", "iron_turn_1", "iron_left", "iron_back", "iron_turn_4", "iron_right", "iron_angry",
        "iron_run_1", "iron_run_2", "iron_run_3", "iron_run_4", "iron_run_5", "iron_run_6",
        "iron_windup", "iron_punch", "iron_pound", "iron_charge", "iron_spin",
        "iron_dazed", "iron_hit", "iron_knock", "iron_fall", "iron_down", "iron_dead",
        "iron_spikeball", "iron_spikeballs", "iron_drill", "iron_blast", "iron_pillar", "iron_ring",
    ],
    # Camaleonte che si mimetizza (pose "ghost" semitrasparenti): righe da 8, 7, 5, 6, 7 celle.
    "chameleon": [
        "cham_front", "cham_turn_1", "cham_ghost_front", "cham_back", "cham_turn_4", "cham_ghost_side", "cham_ghost_eyes", "cham_angry",
        "cham_sneak_1", "cham_sneak_2", "cham_sneak_3", "cham_sneak_4", "cham_sneak_5", "cham_sneak_6", "cham_sneak_7",
        "cham_leap", "cham_swipe", "cham_slash", "cham_emerge", "cham_spin",
        "cham_fade_1", "cham_fade_2", "cham_fade_3", "cham_fade_4", "cham_appear", "cham_fade_5",
        "cham_smoke", "cham_leafburst", "cham_tornado", "cham_leaves", "cham_ring", "cham_blast", "cham_dart",
    ],
    # Boss di magma: righe da 8, 8, 6, 6 celle (--row-cols 8,8,6,6).
    "magma": [
        "magma_front", "magma_turn_1", "magma_turn_2", "magma_turn_3", "magma_back", "magma_turn_5", "magma_turn_6", "magma_front_2",
        "magma_glare", "magma_roar", "magma_blow", "magma_charge", "magma_tornado", "magma_erupt", "magma_dash", "magma_hurt",
        "magma_rock", "magma_rocks", "magma_flame", "magma_boulder", "magma_spikes", "magma_wave",
        "magma_splash", "magma_splash_big", "magma_pillar", "magma_burst", "magma_ring", "magma_crystals",
    ],
    # Boss di ghiaccio: quattro righe da 7 celle (--row-cols 7,7,7,7).
    "ice": [
        "ice_front", "ice_turn_1", "ice_turn_2", "ice_back", "ice_turn_4", "ice_angry", "ice_front_2",
        "ice_glare", "ice_roar", "ice_blow", "ice_stomp", "ice_charge", "ice_dash", "ice_hurt",
        "ice_shard", "ice_shards", "ice_volley", "ice_tornado", "ice_spike", "ice_boulder", "ice_spikes",
        "ice_splash", "ice_splash_big", "ice_pillar", "ice_burst", "ice_twister_impact", "ice_crystals", "ice_debris",
    ],
    "weapons": [
        "weapon_scatter", "weapon_plasma", "weapon_laser", "weapon_rocket",
        "shot_scatter", "shot_plasma", "shot_laser", "shot_rocket",
        "impact_scatter", "impact_plasma", "impact_laser", "impact_rocket",
    ],
}
NAMES = SHEETS["main"]
SENTINEL = (255, 0, 255)  # colore usato dal flood fill per marcare lo sfondo


def anchor_for(name: str) -> str:
    return "bottom-center" if name.startswith(("hero_", "enemy_", "prop_")) else "center"


def sample_background(im: Image.Image) -> tuple:
    """Colore verde dominante più frequente nello sheet (lo sfondo delle celle,
    non le linee della griglia che possono essere di un verde più scuro)."""
    small = im.convert("RGB").resize((max(1, im.width // 4), max(1, im.height // 4)))
    counts = {}
    for p in small.get_flattened_data() if hasattr(small, "get_flattened_data") else small.getdata():
        if p[1] > p[0] + 100 and p[1] > p[2] + 100:
            counts[p] = counts.get(p, 0) + 1
    if not counts:
        sys.exit("nessuno sfondo verde trovato nello sheet")
    return max(counts, key=counts.get)


def find_runs(flags):
    """Trasforma una lista di booleani in intervalli [start, end) di True."""
    runs, start = [], None
    for i, f in enumerate(flags):
        if f and start is None:
            start = i
        elif not f and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(flags)))
    return runs


def is_screen(p) -> bool:
    """Verde "da schermo" per tinta: sfondo chiaro e linee della griglia verde scuro
    (es. (0,28,0)) contano entrambi; i verdi degli oggetti hanno rosso/blu più alti."""
    r, g, b = p[0], p[1], p[2]
    m = max(r, b)
    return m < 45 and g > 2 * m + 18


def screen_mask(im: Image.Image) -> Image.Image:
    """Maschera L: 255 dove il pixel è verde da schermo."""
    rgb = im.convert("RGB")
    mask = Image.new("L", rgb.size)
    data = rgb.get_flattened_data() if hasattr(rgb, "get_flattened_data") else rgb.getdata()
    mask.putdata([255 if is_screen(p) else 0 for p in data])
    return mask


def detect_grid(im: Image.Image, bg: tuple, min_frac: float = .995, min_cell: int = 20):
    """Restituisce (colonne, righe) come liste di intervalli di celle.
    Una colonna/riga è gutter se almeno `min_frac` dei suoi pixel è verde da schermo."""
    mask = screen_mask(im)
    w, h = mask.size
    col_is_bg = [mask.crop((x, 0, x + 1, h)).histogram()[255] >= min_frac * h for x in range(w)]
    row_is_bg = [mask.crop((0, y, w, y + 1)).histogram()[255] >= min_frac * w for y in range(h)]
    cols = [r for r in find_runs([not c for c in col_is_bg]) if r[1] - r[0] >= min_cell]
    rows = [r for r in find_runs([not c for c in row_is_bg]) if r[1] - r[0] >= min_cell]
    return cols, rows


def fixed_grid(size: int, n: int):
    step = size / n
    return [(round(i * step), round((i + 1) * step)) for i in range(n)]


def snapped_grid(im: Image.Image, cols: int, rows: int, window: float = .06):
    """Griglia "agganciata": per ogni linea attesa (i * lato / n) cerca entro ±window
    la fascia di colonne/righe più verdi (gutter + linea scura) e taglia le celle ai
    suoi bordi. Regge gutter irregolari e oggetti che sfiorano la linea."""
    mask = screen_mask(im)
    w, h = mask.size
    col_frac = [mask.crop((x, 0, x + 1, h)).histogram()[255] / h for x in range(w)]
    row_frac = [mask.crop((0, y, w, y + 1)).histogram()[255] / w for y in range(h)]

    def axis(frac, size, n):
        edges = [(0, 0)]
        for i in range(1, n):
            c = round(i * size / n)
            lo, hi = max(1, c - round(window * size)), min(size - 1, c + round(window * size))
            best = max(range(lo, hi), key=lambda k: frac[k])
            # allargo la fascia finché resta quasi tutta verde
            limit = max(.9, frac[best] * .97)
            a = b = best
            while a - 1 > lo and frac[a - 1] >= limit: a -= 1
            while b + 1 < hi and frac[b + 1] >= limit: b += 1
            edges.append((a, b + 1))
        edges.append((size, size))
        return [(edges[i][1], edges[i + 1][0]) for i in range(n)]

    return axis(col_frac, w, cols), axis(row_frac, h, rows)


def line_cuts(im: Image.Image, n: int, axis: int, min_frac: float = .3):
    """Intervalli delle n celle lungo un asse (0 = colonne, 1 = righe) usando le sottili
    linee scure (nere o verde scuro) di separazione; None se non se ne trovano esattamente n - 1."""
    rgb = im.convert("RGB")
    gray = Image.new("L", rgb.size)
    data = rgb.get_flattened_data() if hasattr(rgb, "get_flattened_data") else rgb.getdata()
    gray.putdata([255 if r < 8 and b < 14 and g < 170 else 0 for r, g, b in data])
    w, h = gray.size
    size, other = (w, h) if axis == 0 else (h, w)
    def frac(k):
        box = (k, 0, k + 1, h) if axis == 0 else (0, k, w, k + 1)
        return gray.crop(box).histogram()[255] / other
    lines = find_runs([frac(k) >= min_frac for k in range(size)])
    lines = [r for r in lines if 0 < r[0] and r[1] < size and r[1] - r[0] < 12]
    if len(lines) != n - 1:
        return None
    edges = [0] + [x for r in lines for x in r] + [size]
    return [(edges[2 * i], edges[2 * i + 1]) for i in range(n)]


def key_out_background(cell: Image.Image, bg: tuple, thresh: int, band: int = 8,
                       min_hole: int = 60, despill: bool = False) -> Image.Image:
    """Chroma key "green excess" in tre passi:

    1. maschera dura: verde puro e brillante ovunque (anche nelle sacche chiuse,
       es. tra le gambe) + verde puro più scuro (linee della griglia) solo se
       collegato al bordo della cella, così i verdi interni di un oggetto
       (es. la capsula del magnete) sopravvivono;
    2. in una fascia di `band` px attorno alla maschera, alpha morbida stimata
       dall'eccesso di verde e colore "smiscelato" dallo sfondo (niente frangia);
    3. tutto il resto resta opaco.
    """
    rgb = cell.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    bg_g = max(bg[1], 1)

    def excess(p):  # quanto il pixel è "schermo verde": 0 = per niente, ~bg_g = sfondo puro
        return p[1] - max(p[0], p[2])

    hard = Image.new("L", (w, h), 0)   # 255 = sfondo certo
    cand = Image.new("L", (w, h), 0)   # 255 = verde puro scuro, da confermare via flood fill
    hp, cp = hard.load(), cand.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            d, s = excess(p), max(p[0], p[2])
            if d > thresh:
                hp[x, y] = 255
            elif is_screen(p):  # verde scuro delle linee di griglia: sfondo solo se collegato al bordo
                cp[x, y] = 255
    # flood fill dei candidati collegati al bordo
    for x in range(w):
        for y in (0, h - 1):
            if cp[x, y] == 255:
                ImageDraw.floodfill(cand, (x, y), 128)
    for y in range(h):
        for x in (0, w - 1):
            if cp[x, y] == 255:
                ImageDraw.floodfill(cand, (x, y), 128)
    for y in range(h):
        for x in range(w):
            if cp[x, y] == 128 or (cp[x, y] == 255 and hp[x, y] == 255):
                hp[x, y] = 255
    # i candidati scuri adiacenti alla maschera dura sono comunque sfondo
    grown = hard.filter(ImageFilter.MaxFilter(3))
    gp = grown.load()
    for y in range(h):
        for x in range(w):
            if cp[x, y] == 255 and gp[x, y] == 255:
                hp[x, y] = 255
    # componenti di sfondo isolate e minuscole (riflessi verdi dentro un oggetto)
    # non sono buchi veri: le riporto a opaco
    for y in range(h):
        for x in range(w):
            if hp[x, y] == 255:
                ImageDraw.floodfill(hard, (x, y), 100)
                area = hard.histogram()[100]
                ImageDraw.floodfill(hard, (x, y), 0 if area < min_hole else 200)
    for y in range(h):
        for x in range(w):
            if hp[x, y] == 200:
                hp[x, y] = 255

    # fascia di transizione attorno alla maschera dura
    ring = hard.filter(ImageFilter.MaxFilter(2 * band + 1))
    rp = ring.load()
    out = rgb.copy()
    op = out.load()
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            if hp[x, y] == 255:
                ap[x, y] = 0
                continue
            if rp[x, y] != 255:
                continue
            p = px[x, y]
            d = excess(p)
            if d <= 0:
                continue
            a = max(0.0, min(1.0, 1.0 - d / bg_g))
            if a < 0.04:
                ap[x, y] = 0
                continue
            # smiscelo il colore dallo sfondo: c = (p - (1-a)*bg) / a
            c = [max(0, min(255, round((p[i] - (1 - a) * bg[i]) / a))) for i in range(3)]
            if despill and c[1] > max(c[0], c[2]):  # solo per sheet senza oggetti verdi
                c[1] = max(c[0], c[2])
            op[x, y] = tuple(c)
            ap[x, y] = round(a * 255)
    if despill:
        # Passata globale (solo sheet senza oggetti verdi): i pixel ancora "verde schermo",
        # anche fuori dalla fascia di bordo (tra i ricci, nel fumo), diventano trasparenti
        # in proporzione al verde e perdono la dominante verde.
        for y in range(h):
            for x in range(w):
                if ap[x, y] == 0:
                    continue
                p = px[x, y]
                e = p[1] - max(p[0], p[2])
                if e > 18:
                    ap[x, y] = round(ap[x, y] * max(0.0, 1 - (e - 18) / (bg_g * .5)))
                    r, g, b = op[x, y]
                    op[x, y] = (r, min(g, max(r, b)), b)
    out.putalpha(alpha)
    return out


def drop_border_slivers(img: Image.Image, max_frac: float = 0.015) -> Image.Image:
    """Elimina i frammenti piccoli attaccati al bordo della cella (pezzi di
    sprite vicini finiti nel ritaglio quando la griglia non è perfetta)."""
    alpha = img.getchannel("A")
    w, h = alpha.size
    solid = alpha.point(lambda v: 255 if v > 32 else 0)
    sp = solid.load()
    limit = max_frac * w * h
    border = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    cleared = False
    for x, y in border:
        if sp[x, y] == 255:
            ImageDraw.floodfill(solid, (x, y), 100)
            area = solid.histogram()[100]
            if area < limit:
                ImageDraw.floodfill(solid, (x, y), 50)  # da cancellare
                cleared = True
            else:
                ImageDraw.floodfill(solid, (x, y), 200)  # da tenere
    if not cleared:
        return img
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            if sp[x, y] == 50:
                ap[x, y] = 0
    out = img.copy()
    out.putalpha(alpha)
    return out


def trim(img: Image.Image, pad: int, min_alpha: int = 1) -> Image.Image:
    # Ignora l'alone quasi invisibile nel calcolo dei margini, preservando l'alpha
    # originale dentro il ritaglio (nessun chroma key sugli sprite già trasparenti).
    bbox = img.getchannel("A").point(lambda a: 255 if a >= min_alpha else 0).getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(img.width, r + pad), min(img.height, b + pad)
    return img.crop((l, t, r, b))


def checkerboard(size, tile=16):
    board = Image.new("RGBA", size, (200, 200, 200, 255))
    d = ImageDraw.Draw(board)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                d.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(150, 150, 150, 255))
    return board


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sheet", default="assets/raw/spritesheet.png")
    ap.add_argument("--out", default="assets/sprites")
    ap.add_argument("--cols", type=int, default=0, help="forza il numero di colonne")
    ap.add_argument("--rows", type=int, default=0, help="forza il numero di righe")
    ap.add_argument("--fixed-grid", action="store_true", help="celle esattamente uguali, senza cercare separatori verdi")
    ap.add_argument("--alpha", action="store_true", help="preserva l'alpha originale e rifila i margini trasparenti, senza chroma key")
    ap.add_argument("--row-cols", default="",
                    help="celle per riga quando le righe hanno larghezze diverse (es. 8,8,6,6)")
    ap.add_argument("--thresh", type=int, default=200,
                    help="eccesso di verde (g - max(r,b)) oltre cui un pixel è sfondo certo (0-255)")
    ap.add_argument("--pad", type=int, default=4)
    ap.add_argument("--band", type=int, default=8, help="larghezza in px della fascia di smiscelamento ai bordi")
    ap.add_argument("--despill", action="store_true",
                    help="toglie il verde residuo dai bordi (solo per sheet senza oggetti verdi)")
    ap.add_argument("--min-hole", type=int, default=60, help="area minima (px) di un buco interno per essere tenuto")
    ap.add_argument("--small", type=int, default=128, help="lato della versione ridotta per l'HUD")
    ap.add_argument("--webp-quality", type=int, default=88, help="qualità WebP (0-100)")
    ap.add_argument("--names", default="main",
                    help="preset (" + ", ".join(SHEETS) + ") oppure elenco di nomi separati da virgola")
    ap.add_argument("--prefix", default="", help="prefisso dei nomi (es. erika_ per un personaggio)")
    ap.add_argument("--same-box", action="store_true",
                    help="stesso ritaglio per tutte le celle (cicli di animazione: il corpo non salta di lato)")
    ap.add_argument("--no-key", action="store_true",
                    help="niente chroma key: ritaglia le celle piene (texture) con un bordo interno di --inset px")
    ap.add_argument("--inset", type=int, default=6, help="pixel scartati sul bordo di ogni cella con --no-key")
    args = ap.parse_args()
    if args.fixed_grid and (not args.cols or not args.rows or args.row_cols):
        ap.error("--fixed-grid richiede --cols e --rows, senza --row-cols")
    if args.alpha and args.no_key:
        ap.error("usa --alpha per sprite trasparenti oppure --no-key per texture piene")
    names = SHEETS[args.names] if args.names in SHEETS else [n.strip() for n in args.names.split(",") if n.strip()]
    names = [args.prefix + n for n in names]
    preset = args.names if args.names in SHEETS else "custom"

    sheet = Image.open(args.sheet).convert("RGBA")
    bg = (0, 255, 0) if args.fixed_grid and (args.alpha or args.no_key) else sample_background(sheet)
    print(f"sheet {sheet.size[0]}x{sheet.size[1]}, sfondo campionato {bg}")

    if args.fixed_grid:
        cols = [(round(i * sheet.width / args.cols), round((i + 1) * sheet.width / args.cols)) for i in range(args.cols)]
        rows = [(round(i * sheet.height / args.rows), round((i + 1) * sheet.height / args.rows)) for i in range(args.rows)]
        cells = [(x0, y0, x1, y1) for y0, y1 in rows for x0, x1 in cols]
        ncols = args.cols
        print(f"griglia esatta: {args.cols}x{args.rows}")
    elif args.row_cols:
        # Righe con celle di larghezza diversa: prima le linee orizzontali, poi le
        # verticali di ogni riga, entrambe agganciate alle fasce più verdi.
        counts = [int(c) for c in args.row_cols.split(",")]
        rows = line_cuts(sheet, len(counts), 1) or snapped_grid(sheet, 1, len(counts))[1]
        cells = []
        for (y0, y1), n in zip(rows, counts):
            band = sheet.crop((0, y0, sheet.width, y1))
            band_cols = line_cuts(band, n, 0) or snapped_grid(band, n, 1)[0]
            cells += [(x0, y0, x1, y1) for x0, x1 in band_cols]
        ncols = max(counts)
        print(f"griglia per righe: {counts}")
    else:
        cols, rows = detect_grid(sheet, bg)
        if args.cols and args.rows and (len(cols) != args.cols or len(rows) != args.rows):
            print(f"griglia rilevata {len(cols)}x{len(rows)} diversa da quella richiesta: aggancio le linee attese")
            cols, rows = snapped_grid(sheet, args.cols, args.rows)
        print(f"griglia: {len(cols)} colonne x {len(rows)} righe")
        cells = [(x0, y0, x1, y1) for (y0, y1) in rows for (x0, x1) in cols]
        ncols = len(cols)
    if len(cells) != len(names):
        sys.exit(f"attese {len(names)} celle, trovate {len(cells)}: usa --cols/--rows o --row-cols")

    out_dir = Path(args.out)
    small_dir = out_dir / str(args.small)
    out_dir.mkdir(parents=True, exist_ok=True)
    small_dir.mkdir(parents=True, exist_ok=True)

    # L'atlas accumula gli sheet: si aggiornano solo le voci di questo sheet.
    atlas_path = out_dir / "atlas.json"
    atlas = json.loads(atlas_path.read_text()) if atlas_path.exists() else {}
    sprites = []
    # --same-box: un unico riquadro (unione dei contenuti di tutte le celle, in coordinate di cella)
    # per ogni frame, così personaggio e linea dei piedi restano nello stesso punto.
    keyed, box = {}, None
    if args.same_box:
        for name, (x0, y0, x1, y1) in zip(names, cells):
            keyed[name] = drop_border_slivers(key_out_background(sheet.crop((x0, y0, x1, y1)), bg, args.thresh, args.band, args.min_hole, args.despill))
            b = keyed[name].getchannel("A").point(lambda a: 255 if a >= 1 else 0).getbbox()
            if b:
                box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    for name, (x0, y0, x1, y1) in zip(names, cells):
        if True:
            cell = sheet.crop((x0, y0, x1, y1))
            if args.alpha:
                sprite = trim(cell, args.pad, min_alpha=32)
            elif args.no_key and args.fixed_grid:
                k = args.inset
                sprite = cell.crop((k, k, cell.width - k, cell.height - k))
            elif args.no_key:
                # Texture piena: rifilo righe/colonne di bordo con più del 2% di verde
                # da schermo, poi scarto `inset` px di sicurezza.
                mask = screen_mask(cell)
                l, t, r, b = 0, 0, cell.width, cell.height
                mx, my = cell.width // 8, cell.height // 8  # mai più di 1/8 per lato
                green = lambda box, n, f: mask.crop(box).histogram()[255] > f * n
                # prima i margini quasi interamente verdi, poi i residui sottili
                for f in (.5, .02):
                    while l < mx and green((l, t, l + 1, b), b - t, f): l += 1
                    while r > cell.width - mx and green((r - 1, t, r, b), b - t, f): r -= 1
                    while t < my and green((l, t, r, t + 1), r - l, f): t += 1
                    while b > cell.height - my and green((l, b - 1, r, b), r - l, f): b -= 1
                k = args.inset
                sprite = cell.crop((l + k, t + k, r - k, b - k))
            elif args.same_box and box:
                k = keyed[name]
                sprite = k.crop((max(0, box[0] - args.pad), max(0, box[1] - args.pad), min(k.width, box[2] + args.pad), min(k.height, box[3] + args.pad)))
            else:
                sprite = key_out_background(cell, bg, args.thresh, args.band, args.min_hole, args.despill)
                sprite = trim(drop_border_slivers(sprite), args.pad)
            alpha_bbox = sprite.getchannel("A").getbbox()
            coverage = sum(sprite.getchannel("A").histogram()[33:]) / (sprite.width * sprite.height)
            if not alpha_bbox or coverage < 0.02:
                print(f"  ATTENZIONE: {name} quasi vuoto (copertura {coverage:.1%})")
            sprite.save(out_dir / f"{name}.png")
            # WebP con alpha: ~10x più leggero del PNG, è quello che carica il gioco.
            sprite.save(out_dir / f"{name}.webp", quality=args.webp_quality, method=6)
            small = sprite.copy()
            small.thumbnail((args.small, args.small), Image.LANCZOS)
            small.save(small_dir / f"{name}.png")
            small.save(small_dir / f"{name}.webp", quality=args.webp_quality, method=6)
            atlas[name] = {
                "file": f"{name}.webp",
                "png": f"{name}.png",
                "small": f"{args.small}/{name}.webp",
                "width": sprite.width,
                "height": sprite.height,
                "anchor": anchor_for(name),
                "cell": [x0, y0, x1, y1],
            }
            sprites.append((name, sprite))
            print(f"  {name:20s} {sprite.width:4d}x{sprite.height:<4d} copertura {coverage:.0%}")

    atlas_path.write_text(json.dumps(atlas, indent=2) + "\n")

    # Anteprima su scacchiera per controllo visivo.
    tile = max(max(s.width, s.height) for _, s in sprites)
    nrows = -(-len(sprites) // ncols)
    prev = checkerboard((tile * ncols, tile * nrows))
    for k, (_, s) in enumerate(sprites):
        px = (k % ncols) * tile + (tile - s.width) // 2
        py = (k // ncols) * tile + (tile - s.height) // 2
        prev.alpha_composite(s, (px, py))
    preview = "preview.png" if preset == "main" and not args.prefix else f"preview_{args.prefix}{preset}.png"
    prev.save(out_dir / preview)
    print(f"scritti {len(sprites)} sprite in {out_dir}/, atlas.json e {preview}")


if __name__ == "__main__":
    main()
