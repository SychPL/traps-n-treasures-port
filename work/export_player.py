#!/usr/bin/env python3
"""Eksport klatek gracza (sprite'y sprzetowe, bank w chip RAM) do game/assets/player*.

Bank $131A4: 108 dlugich slow = przesuniecia klatek (0 = brak). Klatka: naglowek 8 slow
(szer, wys, kotwica x/y = stopy, ramka kolizji x1, y1, x2, y2 wzgledem stop) + 4 przesuniecia sprite'ow
(2 pary attached, 16 px kazda) + dane sprite'ow (pos, ctl, wys*(DATA, DATB)).
Wyjscie: player_surface.png / player_water.png (komorki 32x48, 12 w rzedzie), player.json.
Uzycie: python work/export_player.py work/dumps/lvl1_g
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump_view import rgb
from export_level import LEVELS, palettes

BANK, N, CW, CH, COLS = 0x131A4, 108, 32, 48, 12


def frames(chip):
    tab = struct.unpack_from('>%dI' % N, chip, BANK)
    out = []
    for o in tab:
        if not o:
            out.append(None); continue
        f = BANK + o
        hd = struct.unpack_from('>8h', chip, f)
        sp = [BANK + x for x in struct.unpack_from('>4I', chip, f + 16)]
        rows = [[struct.unpack_from('>HH', chip, s + 4 + 4 * i) for i in range(hd[1])] for s in sp]
        out.append((hd, rows))
    return out


def sheet(fr, pal):
    img = Image.new('RGBA', (COLS * CW, (N + COLS - 1) // COLS * CH))
    px = img.load()
    for i, f in enumerate(fr):
        if not f:
            continue
        hd, rows = f
        ox, oy = i % COLS * CW, i // COLS * CH
        for half in (0, 1):
            r0, r1 = rows[2 * half], rows[2 * half + 1]
            for y in range(min(hd[1], CH)):
                a0, b0 = r0[y]; a1, b1 = r1[y]
                for x in range(16):
                    s = 15 - x
                    c = (a0 >> s & 1) | (b0 >> s & 1) << 1 | (a1 >> s & 1) << 2 | (b1 >> s & 1) << 3
                    if c:
                        px[ox + half * 16 + x, oy + y] = rgb(pal[16 + c]) + (255,)
    return img


if __name__ == '__main__':
    prefix = sys.argv[1]
    chip = open(prefix + '_chip.bin', 'rb').read()
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'game', 'assets')
    surf, water, _ = palettes(chip, LEVELS['level1'])
    fr = frames(chip)
    sheet(fr, surf).save(os.path.join(out, 'player_surface.png'))
    sheet(fr, water).save(os.path.join(out, 'player_water.png'))
    meta = dict(cell=[CW, CH], cols=COLS,
                frames=[None if not f else dict(h=f[0][1], ax=f[0][2], ay=f[0][3], box=list(f[0][4:8])) for f in fr])
    json.dump(meta, open(os.path.join(out, 'player.json'), 'w'))
    print('player frames', sum(1 for f in fr if f), '->', out)
