#!/usr/bin/env python3
"""Ikony narzedzi w polu TOOL dolnego panelu: BOB-y 16x15 w chip (po 206 B), rekordy narzedzi $30992E (po 14 B,
+8 = przesuniecie ikony w banku). Bank zaczyna sie 2280 B przed bomba (chip $27D64 w zrzucie lvl1_h).
Kolejnosc w pasku = kolejnosc rekordow: ksiazka, bomba, lina, lupa, lampa (id 3), mapa (id 1), dalej id 4, 11, 5, 6,
7, 9, 10, 13, 12, 14, 8 (narzedzia z misji: level<n>.json quest.items).
Paleta: gorna czesc ekranu (linia 20 coppera poziomu 1) - fiolet tla jak ramka panelu.
Wyjscie: game/assets/tool_icons.png (17 x 16 px). Uzycie: python work/export_tools.py
"""
import os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import bob_img
from export_level import pal_fn, LEVELS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FB, RECORDS, N, BANK = 0x200000, 0x30992E, 17, 0x27D64 - 2280

if __name__ == '__main__':
    chip = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_chip.bin'), 'rb').read()
    fast = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_fast.bin'), 'rb').read()
    pal = pal_fn(chip, LEVELS['level1']['cop'])(20)
    im = Image.new('RGBA', (16 * N, 15))
    for k in range(N):
        off, = struct.unpack_from('>H', fast, RECORDS + 14 * k + 8 - FB)
        im.alpha_composite(bob_img(chip, BANK + off, pal), (16 * k, 0))
    im.save(os.path.join(ROOT, 'game', 'assets', 'tool_icons.png'))
    print(N, 'ikon narzedzi')
