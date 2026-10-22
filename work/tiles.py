#!/usr/bin/env python3
"""Wycina bank kafli 16x16 (5 bitplanow po 32 B, plane-major = 160 B/kafel) ze zrzutu fast RAM
i zapisuje arkusz PNG z paleta poziomu (copper list gry, kolory od linii planszy).

Uzycie: python work/tiles.py work/dumps/lvl1_f <adres_pierwszego_kafla_hex> <ile> [kolumn]
np.     python work/tiles.py work/dumps/lvl1_f 2a8f92 512
"""
import sys
from PIL import Image
sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from dump_view import find_copper_lists, events, rgb

FAST_BASE = 0x200000
TILE = 160


def level_palette(chip, cop=0xCDC0, line=55):
    pal = [0] * 32
    for ln, reg, val in events(dict(find_copper_lists(chip[:0x70000]))[cop]):
        if ln <= line and 0x180 <= reg <= 0x1BE:
            pal[(reg - 0x180) // 2] = val
    return [rgb(c) for c in pal]


def tile_img(fast, a, pal):
    img = Image.new('RGB', (16, 16))
    for y in range(16):
        for x in range(16):
            c = 0
            for p in range(5):
                w = fast[a + p * 32 + y * 2] << 8 | fast[a + p * 32 + y * 2 + 1]
                c |= (w >> (15 - x) & 1) << p
            img.putpixel((x, y), pal[c])
    return img


if __name__ == '__main__':
    prefix, start, count = sys.argv[1], int(sys.argv[2], 16), int(sys.argv[3])
    cols = int(sys.argv[4]) if len(sys.argv) > 4 else 32
    chip = open(prefix + '_chip.bin', 'rb').read()
    fast = open(prefix + '_fast.bin', 'rb').read()
    pal = level_palette(chip)
    rows = (count + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 17, rows * 17), (255, 0, 255))
    for i in range(count):
        a = start - FAST_BASE + i * TILE
        sheet.paste(tile_img(fast, a, pal), (i % cols * 17, i // cols * 17))
    out = '%s_tiles_%06x.png' % (prefix, start)
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(out)
    print(out, count, 'tiles')
