#!/usr/bin/env python3
"""GAME OVER ($2DE1BA): tapeta z czaszek (plik dysku 2 $16804F8 = ADF $97EFC, 320x160, 2 plany, bez pakowania)
i dwa BOB-y z pliku $1670D08 = ADF $96F0C (bank 4076 B: $0 72x36, $88A 66x31). Kolory: paleta planszy poziomu
($30CD94, rozjasniana przez $2DFD14), kolor 1 z gradientu $30C1B8 = $512 na kazdej linii.
Wyjscie: game/assets/gameover.png - wiersz na poziom (160 px): tapeta, BOB 0 od x 320, BOB 1 od x 392.
Uzycie: python work/export_gameover.py
"""
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import bob_img
from dump_view import rgb
from export_level import pal_fn, LEVELS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADF2 = os.path.join(ROOT, 'Traps-n-Treasures_Amiga_EN', "Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf")
DUMPS = ['lvl1_h', 'lvl2_a', 'lvl3_a', 'lvl4_a']

if __name__ == '__main__':
    adf = open(ADF2, 'rb').read()
    wall, bank = adf[0x97EFC:0x97EFC + 12800], adf[0x96F0C:0x96F0C + 0xFEC]
    out = Image.new('RGBA', (320 + 72 + 66, 160 * 4))
    for n, d in enumerate(DUMPS):
        chip = open(os.path.join(ROOT, 'work', 'dumps', d + '_chip.bin'), 'rb').read()
        L = LEVELS['level%d' % (n + 1)]
        pal = pal_fn(chip, L['cop'])(L['pf'] + 1)
        pal[1] = 0x512
        img = Image.new('RGBA', (320, 160))
        px = img.load()
        for y in range(160):
            for x in range(320):
                c = sum(((wall[p * 6400 + y * 40 + x // 8] >> (7 - x % 8)) & 1) << p for p in range(2))
                px[x, y] = rgb(pal[c]) + (255,)
        out.paste(img, (0, 160 * n))
        out.alpha_composite(bob_img(bank, 0, pal), (320, 160 * n))
        out.alpha_composite(bob_img(bank, 0x88A, pal), (392, 160 * n))
    out.save(os.path.join(ROOT, 'game', 'assets', 'gameover.png'))
    print('gameover.png', out.size)
