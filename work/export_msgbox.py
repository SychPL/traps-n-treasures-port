#!/usr/bin/env python3
"""Okno komunikatu gry ($2E3ED0): ramka = BOB $2E50E4 (bank obiektow $30CD58 + $2218, 176x48, kotwica 88,40),
czcionka = bank $30CD5C (93 BOB-y, znak - $21, szerokosc glifu + 1 px odstepu, spacja 5 px), strzalka 'dalej' =
BOB-y $1DC6.. tego banku (aktor $2E5120, klatki 0 1 co 3 takty, x ramki + 74).
Paleta: poziom 1 nad woda. Wyjscie: game/assets/msgbox.png, msgfont.png + msgfont.json
{glyphs: [[x, w, h, ax, ay] dla znakow od '!'], arrow: [[x, w, h, ax, ay] x2]}. Uzycie: python work/export_msgbox.py
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import bob_img
from export_level import pal_fn, LEVELS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FB = 0x200000

if __name__ == '__main__':
    chip = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_chip.bin'), 'rb').read()
    fast = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_fast.bin'), 'rb').read()
    bank = lambda v: struct.unpack_from('>I', fast, v - FB)[0]
    pal = pal_fn(chip, LEVELS['level1']['cop'])(LEVELS['level1']['pf'] + 1)
    out = os.path.join(ROOT, 'game', 'assets')
    bob_img(chip, bank(0x30CD58) + 0x2218, pal).save(os.path.join(out, 'msgbox.png'))
    fb = bank(0x30CD5C)
    def chain(a, n):
        r = []
        for _ in range(n):
            r.append(a); a += struct.unpack_from('>H', chip, a + 24)[0]
        return r
    bobs = chain(fb, 93) + chain(fb + 0x1DC6, 2)
    dims = [struct.unpack_from('>HHhh', chip, a) for a in bobs]
    atl = Image.new('RGBA', (sum(d[0] + 1 for d in dims), max(d[1] for d in dims)))
    meta, x = [], 0
    for a, (w, h, ax, ay) in zip(bobs, dims):
        atl.alpha_composite(bob_img(chip, a, pal), (x, 0)); meta.append([x, w, h, ax, ay]); x += w + 1
    atl.save(os.path.join(out, 'msgfont.png'))
    json.dump(dict(glyphs=meta[:93], arrow=meta[93:]), open(os.path.join(out, 'msgfont.json'), 'w'))
    print('ramka', Image.open(os.path.join(out, 'msgbox.png')).size, '93 glify + strzalka')
