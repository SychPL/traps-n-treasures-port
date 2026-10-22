#!/usr/bin/env python3
"""Pokoj skarbu (6 kawalkow mapy, $309742 -> $30CC3C -> $2DD69E): grafika i niebo.

Diamenty: bank $30CD80 (plik dysku $17901AC, ladowany na czas biegu; zrzut work/dumps/treasure_*), 3 rodzaje po 8 klatek
(przesuniecia 0, $468, $8D0; blok animacji $2F35CC: klatka 0, przerwa 5-20, klatki 1-7). Serce (dodatkowe zycie,
typ 3/4) = BOB 0 banku obiektow $30CD58. Niebo: listy coppera $30BF68/$30C01E/$30C082/$30BFC4 dla poziomow 1-4
($30CD10), wpis co 4 linie od linii 6 planszy, wzor [k, k-1, k, k] (zmierzone na zrzucie biegu).
Wyjscie: game/assets/treasure.png + treasure.json {frames, diamond: [[...8] x3], heart, sky: [[kolory] x4]}.
Dane biegu kazdego poziomu (start, granice kamery, przedmioty) wpisuje work/export_level.py (treasure).
Uzycie: python work/export_treasure.py
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import bob_img
from export_level import pal_fn, LEVELS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FB = 0x200000
SKY = (0x30BF68, 0x30C01E, 0x30C082, 0x30BFC4)

if __name__ == '__main__':
    d = os.path.join(ROOT, 'work', 'dumps')
    chip = open(os.path.join(d, 'treasure_chip.bin'), 'rb').read(); fast = open(os.path.join(d, 'treasure_fast.bin'), 'rb').read()
    L = lambda a: struct.unpack_from('>I', chip if a < FB else fast, a if a < FB else a - FB)[0]
    pal = pal_fn(open(os.path.join(d, 'lvl1_h_chip.bin'), 'rb').read(), LEVELS['level1']['cop'])(LEVELS['level1']['pf'] + 1)
    bobs = []
    for off in (0, 0x468, 0x8D0):
        a = L(0x30CD80) + off
        for k in range(8):
            bobs.append(a); a += struct.unpack_from('>H', chip, a + 24)[0]
    bobs.append(L(0x30CD58))
    atl = Image.new('RGBA', (16 * len(bobs), 16)); frames = []
    for i, a in enumerate(bobs):
        w, h, ax, ay = struct.unpack_from('>HHhh', chip, a)
        atl.alpha_composite(bob_img(chip, a, pal), (16 * i, 0)); frames.append([16 * i, 0, w, h, ax, ay])
    atl.save(os.path.join(ROOT, 'game', 'assets', 'treasure.png'))
    sky = []
    for base in SKY:
        cols = struct.unpack_from('>46H', fast, base - FB)
        sky.append(['#%x%x%x' % (v >> 8 & 15, v >> 4 & 15, v & 15) for v in cols])
    json.dump(dict(frames=frames, diamond=[list(range(0, 8)), list(range(8, 16)), list(range(16, 24))], heart=24, sky=sky),
              open(os.path.join(ROOT, 'game', 'assets', 'treasure.json'), 'w'))
    print(len(frames), 'klatek, niebo', [len(s) for s in sky])
