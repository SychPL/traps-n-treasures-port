#!/usr/bin/env python3
"""Igla kompasu w dolnym panelu HUD ($308FF4, skrypt $309AFE: bank $30CD60 + $1F66, 8 klatek: 0 N, 1 NE ... 7 NW).
Kotwica igly w panelu (x 100, y 24) i kolory dopasowane do zrzutu emulatora (work/dumps/cmp*_1824x313.png).
Wyjscie: game/assets/compass.png (8 komorek 16x17) + compass.json {cell, frames: [[x, y, w, h, ax, ay]]}.
Uzycie: python work/export_compass.py
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import walk_bank

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = 0x2747C + 0x1F66                                # zmienna $30CD60 w zrzucie lvl1_h
PAL = {27: (0, 0, 34), 14: (153, 85, 0), 11: (255, 187, 85), 13: (204, 119, 0), 15: (119, 51, 0), 1: (238, 238, 238),
       12: (238, 153, 0)}

if __name__ == '__main__':
    chip = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_chip.bin'), 'rb').read()
    bobs = walk_bank(chip, BANK)[:8]
    sheet, meta = Image.new('RGBA', (16 * 8, 17)), []
    for i, (a, h) in enumerate(bobs):
        stored, forced = chip[a + 16], chip[a + 17]
        ps = struct.unpack_from('>H', chip, a + 22)[0]
        rb, d, planes = ps // h['h'], a + 26, [p for p in range(5) if stored >> p & 1]
        for y in range(h['h']):
            for x in range(h['w']):
                bit = lambda o: chip[o + y * rb + (x >> 3)] >> (7 - (x & 7)) & 1
                if bit(d):
                    c = forced & ~stored
                    for k, p in enumerate(planes):
                        c |= bit(d + ps * (k + 1)) << p
                    sheet.putpixel((16 * i + x, y), PAL.get(c, (255, 0, 255)) + (255,))
        meta.append([16 * i, 0, h['w'], h['h'], h['ax'], h['ay']])
    sheet.save(os.path.join(ROOT, 'game', 'assets', 'compass.png'))
    json.dump({'anchor': [100, 24], 'frames': meta}, open(os.path.join(ROOT, 'game', 'assets', 'compass.json'), 'w'))
    print('compass', meta)
