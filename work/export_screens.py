#!/usr/bin/env python3
"""Ekrany poza rozgrywka: tytul (render z pamieci emulatora, copper $71B4, EHB 352x289 -
work/dumps/title_from_ram.png) i mapa wyspy (zrzut ekranu emulatora po etapie 1: obraz 320x200 od linii 44,
DIW $2C81 jak plansza, x 93 w shot2png). Kolory z 8-bitowych wartosci vAmiga przeliczone na 4-bitowe (x17).
Uzycie: python work/export_screens.py
"""
import os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_data import walk_bank, bob_img

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'work', 'dumps')


# paleta mapy wyspy (dopasowanie obrazu $A5284 do island.png)
MAP_PAL = [0x04a, 0xa00, 0x000, 0x9a1, 0x781, 0x570, 0x350, 0x240, 0xaaa, 0xaa8, 0xaa7, 0xa96, 0xa84, 0x970, 0x860, 0x750,
           0x643, 0x532, 0x421, 0x121, 0x343, 0x564, 0x899, 0xaaa, 0xaaa, 0xaaa, 0x8aa, 0x6aa, 0x4aa, 0x39a, 0x16a, 0x028]


def x17(img):
    return img.point(lambda v: min(255, round(v / 16) * 17))


if __name__ == '__main__':
    out = os.path.join(ROOT, 'game', 'assets')
    Image.open(os.path.join(D, 'title_from_ram.png')).convert('RGB').save(os.path.join(out, 'title.png'))
    shot = x17(Image.open(os.path.join(D, 'to2_1_1824x313.png')).convert('RGB'))
    shot.crop((93, 44, 413, 244)).save(os.path.join(out, 'island.png'))
    # znacznik etapu na mapie: BOB $5A banku mapy (dysk 2 $A3190, 13x13, kotwica 6,12), paleta mapy z dopasowania obrazu
    # $A5284 do island.png (linia 17); aktor $2F3C48 miga: 5 krokow widoczny, 3 ukryty (krok 5 taktow 25 Hz)
    adf = open(os.path.join(ROOT, 'Traps-n-Treasures_Amiga_EN', "Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf"), 'rb').read()
    bank = adf[0xA3190:0xA3190 + 8430] + bytes([255] * 4)
    bob_img(bank, 0x5A, MAP_PAL).save(os.path.join(out, 'map_marker.png'))
    print('title.png 352x289, island.png 320x200, map_marker.png')
