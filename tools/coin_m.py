#!/usr/bin/env python3
"""Sostituisce la stella della moneta con una M in rilievo.

Legge l'originale dalla storia git (la moneta con la stella), così si può rilanciare
senza accumulare modifiche, e scrive coin.png/webp e 128/coin.png/webp in assets/sprites.
    python3 tools/coin_m.py
"""
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / 'assets' / 'sprites'
# Commit in cui è stata aggiunta la moneta con la stella.
SOURCE = 'a95d55d:assets/sprites/coin.png'
FONT = '/usr/share/fonts/truetype/ubuntu/Ubuntu[wdth,wght].ttf'
# Faccia interna (ellisse vista di tre quarti): copre tutta la stella, resta dentro l'anello.
CX, CY, RX, RY = 117, 104, 49, 67


def original():
    data = subprocess.run(['git', 'show', SOURCE], cwd=ROOT, check=True, capture_output=True).stdout
    return Image.open(BytesIO(data)).convert('RGBA')


def erase_star(im):
    """Riempie l'ellisse sfocandola più volte e rimettendo fuori i pixel originali:
    converge a una sfumatura continua con il bordo della faccia (come un'equazione di Laplace)."""
    inside = Image.new('L', im.size)
    ImageDraw.Draw(inside).ellipse([CX - RX, CY - RY, CX + RX, CY + RY], fill=255)
    rgb = im.convert('RGB')
    fill = rgb.copy()
    for radius in [12] * 80 + [6] * 120 + [2] * 120:
        fill = Image.composite(fill.filter(ImageFilter.GaussianBlur(radius)), rgb, inside)
    out = fill.convert('RGBA')
    out.putalpha(im.getchannel('A'))
    return out, inside


def letter_mask(size):
    """M arrotondata (Ubuntu Extra Bold con angoli smussati), schiacciata in orizzontale
    come la faccia in prospettiva."""
    font = ImageFont.truetype(FONT, 200)
    font.set_variation_by_name(b'Extra Bold')
    box = font.getbbox('M')
    glyph = Image.new('L', (box[2] - box[0] + 60, box[3] - box[1] + 60))
    ImageDraw.Draw(glyph).text((30 - box[0], 30 - box[1]), 'M', font=font, fill=255)
    # Sfocatura e soglia: tutti gli spigoli diventano curve, come in un font rotondo.
    glyph = glyph.filter(ImageFilter.GaussianBlur(9)).point(lambda v: 255 if v > 128 else 0)
    glyph = glyph.crop(glyph.getbbox())
    tall = int(RY * 1.2)
    wide = int(glyph.width * tall / glyph.height * .8)
    glyph = glyph.resize((wide, tall), Image.LANCZOS)
    mask = Image.new('L', size)
    mask.paste(glyph, (CX - wide // 2 + 1, CY - tall // 2 - 2))
    return mask


def emboss(face, mask):
    w, h = face.size
    out = face.copy()
    # Ombra in basso a sinistra, come lo spessore della stella originale.
    shadow = ImageChops.offset(mask, -3, 4).filter(ImageFilter.GaussianBlur(.8))
    out.paste(Image.new('RGBA', (w, h), (188, 79, 0, 255)), (0, 0), shadow)
    # Corpo: oro chiaro in alto, giallo carico in basso.
    band = ImageOps.colorize(Image.linear_gradient('L').resize((w, 2 * RY)), black=(255, 246, 140), white=(252, 196, 10))
    body = Image.new('RGB', (w, h), (252, 196, 10))
    body.paste(Image.new('RGB', (w, CY - RY), (255, 246, 140)), (0, 0))
    body.paste(band, (0, CY - RY))
    out.paste(body.convert('RGBA'), (0, 0), mask)
    # Smusso: luce sul bordo in alto a destra, ombra morbida su quello in basso a sinistra.
    light = ImageChops.subtract(mask, ImageChops.offset(mask, -1, 1))
    dark = ImageChops.subtract(mask, ImageChops.offset(mask, 1, -1))
    out.paste(Image.new('RGBA', (w, h), (255, 255, 220, 255)), (0, 0), light.point(lambda v: v * .8))
    out.paste(Image.new('RGBA', (w, h), (214, 120, 0, 255)), (0, 0), dark.point(lambda v: v * .6))
    out.putalpha(face.getchannel('A'))
    return out


def main():
    face, _ = erase_star(original())
    coin = emboss(face, letter_mask(face.size))
    coin.save(SPRITES / 'coin.png')
    coin.save(SPRITES / 'coin.webp', quality=92, method=6)
    small = coin.resize((114, 128), Image.LANCZOS)
    small.save(SPRITES / '128' / 'coin.png')
    small.save(SPRITES / '128' / 'coin.webp', quality=92, method=6)
    print('Moneta con la M scritta in', SPRITES)


if __name__ == '__main__':
    main()
