#!/usr/bin/env python3
"""Wycina HUD (gorny pasek i dolny panel) i cyfry z prawdziwego obrazu emulatora -> game/assets/hud_*.png

Zrodlo: zrzut bufora vAmigaWeb (work/shot2png.py), wiersz bufora = linia ekranu Amigi.
Uklad ekranu gry (zmierzony): linie 44-55 gorny pasek, 56-214 plansza, 215-254 dolny panel;
x 93..412 w PNG z shot2png (320 px). Kolory przeliczone z 8-bit vAmiga (x16) na x17 jak kafle.
Cyfry 5x6 (odcienie szarosci, rozstaw 6) z panelu, w ktorym gra pokazala SCORE 1234577 i GOLD 8916
(wpisane w pamiec gry: punkty long @chip $13120, zloto $13124); ramki punktow/zlota czyszczone
kolorem tla (48,0,63), zeby gra rysowala liczby sama.
Uzycie: python work/export_hud.py work/dumps/lvl1_g_1824x313.png work/dumps/digits_1824x313.png
"""
import os, sys
from PIL import Image

X0, TOP, PF, BOTTOM = 93, (44, 56), (56, 215), (215, 255)
RIGHT, SCORE_Y, GOLD_Y = 185, 12, 24           # ostatnia cyfra od x=185, wiersze panelu
BOX_BG = (51, 0, 68)


def x17(img):
    return img.point(lambda v: min(255, round(v / 16) * 17))


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'game', 'assets')
    src = x17(Image.open(sys.argv[1]).convert('RGB'))
    src.crop((X0, TOP[0], X0 + 320, TOP[1])).save(os.path.join(out, 'hud_top.png'))
    panel = src.crop((X0, BOTTOM[0], X0 + 320, BOTTOM[1]))
    for y in (SCORE_Y, GOLD_Y):
        panel.paste(BOX_BG, (RIGHT - 6 * 7 + 4, y, RIGHT + 5, y + 6))   # od x 147: lewa ramka pol zostaje
    panel.save(os.path.join(out, 'hud_bottom.png'))
    # cyfry
    dig = x17(Image.open(sys.argv[2]).convert('RGB')).crop((X0, BOTTOM[0], X0 + 320, BOTTOM[1]))
    cells = {}
    for k, ch in enumerate(reversed('1234577')): cells.setdefault(ch, (RIGHT - 6 * k, SCORE_Y))
    for k, ch in enumerate(reversed('8916')): cells.setdefault(ch, (RIGHT - 6 * k, GOLD_Y))
    cells['0'] = (125, 29)                          # "09" w polu CREW
    atlas = Image.new('RGBA', (60, 6))
    for d in range(10):
        x0, y0 = cells[str(d)]
        for y in range(6):
            for x in range(5):
                r, g, b = dig.getpixel((x0 + x, y0 + y))
                if r == g == b and r >= 64:
                    atlas.putpixel((d * 6 + x, y), (r, g, b, 255))
    atlas.save(os.path.join(out, 'hud_digits.png'))
    print('hud_top, hud_bottom (ramki wyczyszczone), hud_digits 10x(5x6)')
