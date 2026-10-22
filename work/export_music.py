#!/usr/bin/env python3
"""Muzyka gry: moduly OctaMED (MMD0, z instrumentami syntetycznymi) spakowane PowerPackerem na dyskach.

Dysk 2: po jednym module na poziom (zaraz za programem poziomu) + dwa dodatkowe; dysk 1: modul tytulowy.
Wyjscie: game/assets/music/<nazwa>.med (odtwarzane przez libopenmpt, game/lib/chiptune3).
Uzycie: python work/export_music.py
"""
import os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ppdepack import unpack_file

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISK = os.path.join(ROOT, 'Traps-n-Treasures_Amiga_EN', "Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk %d of 2).adf")
# (dysk, poczatek pliku, nazwa)
FILES = [(2, 0x21BA8, 'level1'), (2, 0x3CE4C, 'level2'), (2, 0x5A11C, 'level3'), (2, 0x76024, 'level4'),
         (2, 0xB20F0, 'extra1'), (2, 0xC5C34, 'extra2'), (1, 0x7DF4, 'title'),
         (2, 0xABC8C, 'map'), (2, 0xACD5C, 'extra3'), (2, 0x9B100, 'extra4'),   # mapa wyspy ($1750A88, ekran $2F3770); inne z kodu
         (2, 0x9506C, 'hof_new')]   # Hall of Fame ($309FC4): nowy wynik $1660668, pokaz $16A06FC (extra4); zakonczenie SEG2: extra2
# deskryptor pliku w kodzie (jsr $284(a6), d0 = $01XXYYYY): offset = XX * 6144 + YYYY - 5628, od XX = $58 jeszcze - 12288

if __name__ == '__main__':
    out = os.path.join(ROOT, 'game', 'assets', 'music')
    os.makedirs(out, exist_ok=True)
    for disk, start, name in FILES:
        adf = open(DISK % disk, 'rb').read()
        flag, = struct.unpack_from('>I', adf, start - 4)
        data = unpack_file(adf, start, flag & 0x7FFFFFFF) if flag >> 31 else adf[start:start + flag]   # czesc plikow nie jest spakowana
        assert data[:4] == b'MMD0', (name, data[:4])
        open(os.path.join(out, name + '.med'), 'wb').write(data)
        print(name, len(data))
