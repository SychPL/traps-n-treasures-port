#!/usr/bin/env python3
"""Font gry 8x9 (1 bit) z fast RAM -> game/assets/font.png (biale glify, 16 w rzedzie) + mapa znakow.

W lvl1_h font pod $30AC08 (naglowek), glify od $30AC49 po 9 B: 1..14 interpunkcja (! " % & ' ( ) * + , - .),
16..25 cyfry, 26 ':', 31 '?', 33..58 A-Z. Uzycie: python work/export_font.py work/dumps/lvl1_h
"""
import json, os, sys
from PIL import Image

START, H, N = 0x30AC49, 9, 64
CHARS = {'!': 1, '"': 2, '%': 3, '&': 6, "'": 7, '(': 8, ')': 9, '*': 10, '+': 11, ',': 12, '-': 13, '.': 14, ':': 26, '?': 31}
CHARS.update({str(d): 16 + d for d in range(10)})
CHARS.update({chr(65 + i): 33 + i for i in range(26)})

if __name__ == '__main__':
    f = open(sys.argv[1] + '_fast.bin', 'rb').read()
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'game', 'assets')
    img = Image.new('RGBA', (16 * 8, (N // 16) * H))
    for g in range(N):
        for y in range(H):
            b = f[START - 0x200000 + g * H + y]
            for x in range(8):
                if b >> (7 - x) & 1:
                    img.putpixel((g % 16 * 8 + x, g // 16 * H + y), (255, 255, 255, 255))
    img.save(os.path.join(out, 'font.png'))
    json.dump(CHARS, open(os.path.join(out, 'font.json'), 'w'))
    print('font', N, 'glifow 8x9')
