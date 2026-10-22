#!/usr/bin/env python3
"""Pociski gracza: kula zelazna (skrypt $2E1840, BOB chip $F7F2) i specjalna ($2E17D0, BOB $F870), 10x10, kotwica (5, 9),
w palecie kazdego poziomu (zrzuty work/dumps/lvl1_h, lvl2_a, lvl3_a, lvl4_a).
Wyjscie: game/assets/shots.png - wiersz = poziom, kolumny: zelazna, specjalna (po 10 px).
Uzycie: python work/export_shots.py
"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import bob_img
from export_level import pal_fn, LEVELS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMPS = ['lvl1_h', 'lvl2_a', 'lvl3_a', 'lvl4_a']

if __name__ == '__main__':
    out = Image.new('RGBA', (20, 40))
    for n, d in enumerate(DUMPS):
        chip = open(os.path.join(ROOT, 'work', 'dumps', d + '_chip.bin'), 'rb').read()
        L = LEVELS['level%d' % (n + 1)]
        pal = pal_fn(chip, L['cop'])(L['pf'] + 1)
        for k, a in enumerate((0xF7F2, 0xF870)):
            out.alpha_composite(bob_img(chip, a, pal), (10 * k, 10 * n))
    out.save(os.path.join(ROOT, 'game', 'assets', 'shots.png'))
    print('shots.png 20x40')
