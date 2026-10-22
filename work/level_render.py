#!/usr/bin/env python3
"""Sklada caly poziom z mapy (1 bajt/kafel, wierszami) i banku kafli (160 B/kafel) ze zrzutu fast RAM.

Uzycie: python work/level_render.py work/dumps/lvl1_f <mapa_hex> <szer> <wys> <bank_hex> [linia_wody_px]
np.     python work/level_render.py work/dumps/lvl1_f 2b0ec6 540 36 2a6d32
Poziom 1: mapa $2B0EC6 540x36, bank $2A6D32 (wartosc v -> kafel bank + v*160).
Paleta z copper listy gry (nad woda); ponytail: paleta podwodna dojdzie z copper listy po linii wody.
"""
import sys
from PIL import Image
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from tiles import level_palette, tile_img, FAST_BASE, TILE

if __name__ == '__main__':
    prefix, mp, w, h, bank = sys.argv[1], int(sys.argv[2], 16), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5], 16)
    chip = open(prefix + '_chip.bin', 'rb').read()
    fast = open(prefix + '_fast.bin', 'rb').read()
    pal = level_palette(chip)
    cache = {}
    img = Image.new('RGB', (w * 16, h * 16))
    for y in range(h):
        for x in range(w):
            v = fast[mp - FAST_BASE + y * w + x]
            if v not in cache:
                cache[v] = tile_img(fast, bank - FAST_BASE + v * TILE, pal)
            img.paste(cache[v], (x * 16, y * 16))
    out = '%s_level_%06x.png' % (prefix, mp)
    img.save(out)
    print(out, img.size, len(cache), 'distinct tiles, max value', max(cache))
