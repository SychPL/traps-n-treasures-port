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


# paleta mapy wyspy: cel rozjasniania $2F3B70 (32 kolory, $2F3A8C co 4 takty, 16 krokow) z glownego programu (zrzut
# lvl1_h); wczesniej dopasowana do zrzutu ekranu zrobionego w trakcie rozjasniania (jasne kolory obciete do $A)
MAP_PAL = list(struct.unpack_from('>32H', open(os.path.join(D, 'lvl1_h_fast.bin'), 'rb').read(), 0x2F3B70 - 0x200000))


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
