#!/usr/bin/env python3
"""Mapa wyspy ($2F3770): czysty obraz $A5284 (dysk 2, 320x191, 5 planow po kolei, linia 17 ekranu) i aktorzy mapy
odtwarzani interpreterem skryptow z game/actors.js (osobna instancja).

Aktorzy ($2F3806..$2F386C): flagi zamku $2F3BF0 i $2F3C1C zawsze; etap 1 - statek $2F3C88 wplywa po sciezce
$2F3CC8 i na koncu ($FFC6) spuszcza szalupe $2F3E8E; dalsze etapy - statek $2F3E58 na kotwicy z szalupa i migajacy
znacznik $2F3C48 (rysowany w main.js). Bank BOB-ow $16F0F8C (dysk 2 $A3190): flagi, znacznik, 5 klatek statku,
4 szalupy; paleta mapy jak w work/export_screens.py. Skrypty z work/dumps/lvl1_h_fast.bin ($2F3BF0..$2F3F80).
Wyjscie: game/assets/island_clean.png, map_actors.png + map_actors.json (format jak level<n>_actors.json).
Uzycie: python work/export_map.py
"""
import json, os, struct, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import walk_bank, bob_img
from ppdepack import unpack_file
from export_screens import MAP_PAL

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADF = os.path.join(ROOT, 'Traps-n-Treasures_Amiga_EN', "Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf")
BASE, VAR, MEM = 0x400000, '30cdb4', (0x2F3BF0, 0x2F3F80)
SCRIPTS = {'flag1': 0x2F3BF0, 'flag2': 0x2F3C1C, 'sail': 0x2F3C88, 'anchor': 0x2F3E58}

if __name__ == '__main__':
    adf = open(ADF, 'rb').read()
    flag, = struct.unpack_from('>I', adf, 0xA5284 - 4)
    pic = np.frombuffer(unpack_file(adf, 0xA5284, flag & 0x7FFFFFFF), np.uint8).reshape(5, 191, 40)
    idx = sum(np.unpackbits(pic, axis=2)[p].astype(int) << p for p in range(5))
    pal = np.array([[(c >> 8 & 15) * 17, (c >> 4 & 15) * 17, (c & 15) * 17] for c in MAP_PAL], np.uint8)
    out = os.path.join(ROOT, 'game', 'assets')
    clean = np.array(Image.open(os.path.join(out, 'island.png')).convert('RGB'))
    clean[17:200] = pal[idx][:183]                       # wiersze 0..16: morze ze zrzutu
    Image.fromarray(clean).save(os.path.join(out, 'island_clean.png'))
    bank = adf[0xA3190:0xA3190 + 8430] + bytes([255] * 4)
    bobs = walk_bank(bank, 0)
    atl = Image.new('RGBA', (sum(f['w'] + 1 for _, f in bobs), max(f['h'] for _, f in bobs)))
    frames, order, x = {}, [], 0
    for a, f in bobs:
        atl.paste(bob_img(bank, a, MAP_PAL), (x, 0))
        frames['%x' % (BASE + a)] = [x, 0, f['w'], f['h'], f['ax'], f['ay']]; order.append('%x' % (BASE + a)); x += f['w'] + 1
    atl.save(os.path.join(out, 'map_actors.png'))
    fast = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_fast.bin'), 'rb').read()
    mem = fast[MEM[0] - 0x200000:MEM[1] - 0x200000]
    def pos(s):                                          # 0EFE x, 10FE y z naglowka skryptu
        o = s - MEM[0]; x = y = 0
        for k in range(o, o + 40, 2):
            w = struct.unpack_from('>H', mem, k)[0]
            if w == 0x0EFE: x = struct.unpack_from('>H', mem, k + 2)[0]
            if w == 0x10FE: y = struct.unpack_from('>H', mem, k + 2)[0]
        return [x, y]
    json.dump({'banks': {VAR: BASE}, 'frames': frames, 'order': order, 'mem': [[MEM[0], mem.hex()]], 'actors': [],
               'scripts': {k: [v] + pos(v) for k, v in SCRIPTS.items()}}, open(os.path.join(out, 'map_actors.json'), 'w'))
    print(len(bobs), 'BOB-ow mapy', {k: pos(v) for k, v in SCRIPTS.items()})
