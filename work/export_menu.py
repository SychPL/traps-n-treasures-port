#!/usr/bin/env python3
"""Menu po tytule (modul Hall of Fame $309DF0..$30AB16): logo, medalion z kapitanem i wstega START / PASSWORD;
haslo = 8 obrazkow (6 rodzajow) na wstedze, czerwony kursor, gora/dol zmienia obrazek, lewo/prawo pole (20 px),
FIRE sprawdza z tablica $30C438 (wiersz k = start od etapu k + 2). Ujecia z emulatora (work/dumps, okno 320x243 od
(93, 44)): hofm_up (START), menu_dn (PASSWORD), pwicon_0..5 (pole 0 = obrazek 1..5, 0), menu_pw_r (kursor na polu 1).
Wyjscie: game/assets/menu.png (3 ekrany jeden pod drugim: START, PASSWORD, pola hasla bez kursora), menu_icons.png
(6 obrazkow 18x18), pass_icons.png (6 obrazkow 16x16 z ekranu konca etapu, ujecie clr1_7) i menu.json
{slot: [x, y], step, cursor, passwords: [[8 x 0..5] na etap 2..4]} (tablica z work/dumps/lvl1_h_fast.bin).
Uzycie: python work/export_menu.py
"""
import json, os, struct
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
X0, Y0, W, H = 93, 44, 320, 243
BX, BY, STEP = 174 - X0, 218 - Y0, 20                 # ramka kursora pola 0 (20 x 20), wnetrze 18 x 18

if __name__ == '__main__':
    shot = lambda n: np.array(Image.open(os.path.join(ROOT, 'work', 'dumps', n + '_1824x313.png')).convert('RGB'))[Y0:Y0 + H, X0:X0 + W]
    start, pw = shot('hofm_up'), shot('menu_dn')
    icons = [shot('pwicon_%d' % ((k + 5) % 6))[BY + 1:BY + 19, BX + 1:BX + 19] for k in range(6)]   # pwicon_5 = obrazek 0
    fields = shot('pwicon_5').copy()
    ring = np.zeros((H, W), bool); ring[BY:BY + 20, BX:BX + 20] = True; ring[BY + 1:BY + 19, BX + 1:BX + 19] = False
    fields[ring] = shot('menu_pw_r')[ring]               # kursor zdjety z pola 0
    for k in range(8):
        fields[BY + 1:BY + 19, BX + 1 + STEP * k:BX + 19 + STEP * k] = icons[0]
    out = os.path.join(ROOT, 'game', 'assets')
    Image.fromarray(np.concatenate([start, pw, fields])).save(os.path.join(out, 'menu.png'))
    Image.fromarray(np.concatenate(icons, axis=1)).save(os.path.join(out, 'menu_icons.png'))
    # haslo na ekranie konca etapu ($2DE586): obrazki 16x16 co 23 px od (72, 140) ekranu z HUD (ujecie clr1_7 po etapie 1:
    # wiersz 0 tablicy = 5 2 0 1 1 4 1 3); tablica hasel $30C438: 8 slow na etap, koniec $FFFF
    clr = np.array(Image.open(os.path.join(ROOT, 'work', 'dumps', 'clr1_7_1824x313.png')).convert('RGB'))[44:, 93:413]
    row0 = [5, 2, 0, 1, 1, 4, 1, 3]
    pass_icons = [clr[140:156, 72 + 23 * row0.index(v):88 + 23 * row0.index(v)] for v in range(6)]
    Image.fromarray(np.concatenate(pass_icons, axis=1)).save(os.path.join(out, 'pass_icons.png'))
    fast = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_fast.bin'), 'rb').read()
    words = struct.unpack_from('>32h', fast, 0x30C438 - 0x200000)
    passwords = [list(words[i:i + 8]) for i in range(0, 32, 8) if words[i] >= 0]
    assert passwords[0] == row0, passwords
    json.dump({'w': W, 'h': H, 'slot': [BX, BY], 'step': STEP, 'cursor': '#c00000', 'passwords': passwords},
              open(os.path.join(out, 'menu.json'), 'w'))
    print('menu', W, H, 'pola od', BX, BY)
