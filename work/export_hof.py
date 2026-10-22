#!/usr/bin/env python3
"""Logo z ekranu Hall of Fame (zrzut emulatora work/dumps/hof_1824x313.png, work/shot2png.py): zwoj 'Traps'n'Treasures'
x 151..355, wiersze 45..99 (ekran gry od x 93). Tabela wynikow w pamieci gry (fast $D002F): 10 x 'JEREMY FLYNN',
100000..10000, font 8x9, kolor (176,144,112), wiersze co 11 px. Wyjscie: game/assets/hof_logo.png.
Uzycie: python work/export_hof.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if __name__ == '__main__':
    im = Image.open(os.path.join(ROOT, 'work', 'dumps', 'hof_1824x313.png')).convert('RGB').crop((151, 45, 356, 100))
    im = im.point(lambda v: min(255, round(v / 16) * 17))
    out = Image.new('RGBA', im.size)
    out.putdata([p + (255,) if sum(p) > 30 else (0, 0, 0, 0) for p in im.getdata()])
    out.save(os.path.join(ROOT, 'game', 'assets', 'hof_logo.png'))
    print('hof_logo', out.size)
