#!/usr/bin/env python3
"""Sprite'y broni (sprzetowe SPR4/5, para attached 16 px): tabela klatek $308EA2 (fast) -> struktura w chip
{w, h, kotwica x, y, ramka 4 slowa, wskazniki 2 sprite'ow}. Dane sprite'a: 2 slowa sterujace, potem wiersze (A, B).
Kolory jak u gracza: paleta 16-31 (work/export_player.py). Klatki uzywane: 4/5 bron startowa, $22/$23 miecz,
$18-$1C / $1D-$21 krzywa szabla (animacja), $0D morgensztern (kula na sciezce $308A20 / $308A6A).
Wyjscie: game/assets/weapons_surface.png, weapons_water.png, weapons.json {indeks: [x, y, w, h, ax, ay]}.
Uzycie: python work/export_weapons.py
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump_view import rgb
from export_level import palettes, LEVELS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAB, N, CELL, COLS = 0x308EA2, 0x30, 40, 12

if __name__ == '__main__':
    chip = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_chip.bin'), 'rb').read()
    fast = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_fast.bin'), 'rb').read()
    surf, water, _ = palettes(chip, LEVELS['level1'])
    imgs = {k: Image.new('RGBA', (COLS * CELL, (N + COLS - 1) // COLS * CELL)) for k in ('surface', 'water')}
    meta = {}
    for i in range(N):
        f = struct.unpack_from('>I', fast, TAB + 4 * i - 0x200000)[0]
        if not 0x1000 <= f < 0x80000:
            continue
        w, h, ax, ay = struct.unpack_from('>4h', chip, f)
        if not (0 < w <= 16 and 0 < h <= CELL):
            continue
        p0, p1 = struct.unpack_from('>2I', chip, f + 16)
        x0, y0 = i % COLS * CELL, i // COLS * CELL
        for k, pal in (('surface', surf), ('water', water)):
            px = imgs[k].load()
            for y in range(h):
                a0, b0 = struct.unpack_from('>HH', chip, p0 + 4 + 4 * y)
                a1, b1 = struct.unpack_from('>HH', chip, p1 + 4 + 4 * y)
                for x in range(16):
                    s = 15 - x
                    c = (a0 >> s & 1) | (b0 >> s & 1) << 1 | (a1 >> s & 1) << 2 | (b1 >> s & 1) << 3
                    if c:
                        px[x0 + x, y0 + y] = rgb(pal[16 + c]) + (255,)
        meta[i] = [x0, y0, w, h, ax, ay]
    for k, im in imgs.items():
        im.save(os.path.join(ROOT, 'game', 'assets', 'weapons_%s.png' % k))
    json.dump(meta, open(os.path.join(ROOT, 'game', 'assets', 'weapons.json'), 'w'))
    print('weapons', sorted(meta))
