#!/usr/bin/env python3
"""Miecz gracza: osobny sprite sprzetowy (SPR4/5 attached, 16x8) widoczny przy ciosie.

Zrzuty z emulatora w trakcie ciosu (work/oracle.js, przytrzymany FIRE 3 klatki): 'stab' (w prawo, klatka
gracza 1) i 'stabL' (w lewo, klatka 30). Wyjscie: game/assets/sword_surface.png / sword_water.png
(32x8: prawo, lewo). Przesuniecia wzgledem stop gracza zmierzone z pozycji sprite'ow (SPR0 vs SPR4):
stojac (+16,-14) / (-27,-14), w kucki (klatki 3/32) (+13,-9) / (-23,-9) - wpisane w game/main.js.
Uzycie: python work/export_sword.py
"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import sprite_ptrs_and_palette, pair_image
from export_level import LEVELS, palettes

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if __name__ == '__main__':
    lvl = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_g_chip.bin'), 'rb').read()
    pals = dict(zip(('surface', 'water'), palettes(lvl, LEVELS['level1'])[:2]))
    for name, pal in pals.items():
        out = Image.new('RGBA', (32, 8))
        for i, dump in enumerate(('stab', 'stabL')):
            chip = open(os.path.join(ROOT, 'work', 'dumps', dump + '_chip.bin'), 'rb').read()
            ptr, _ = sprite_ptrs_and_palette(chip, 0xCDC0)
            out.paste(pair_image(chip, ptr[4], ptr[5], pal)[0].crop((0, 0, 16, 8)), (16 * i, 0))
        out.save(os.path.join(ROOT, 'game', 'assets', 'sword_%s.png' % name))
    print('sword_surface.png, sword_water.png')
