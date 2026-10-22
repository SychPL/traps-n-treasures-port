#!/usr/bin/env python3
"""Zakonczenie gry (segment SEG2 z dysku 2 $BC098, ladowany przez $2DE564 / jsr $28C, deskryptor $1800694).

Segment laduje muzyke $C5C34 (extra2) i obraz $C21E4: nieruchomy statek na morzu o zachodzie (zadnej animacji -
sprawdzone w emulatorze klatka po klatce). Tekst przewija sie w gore o 1 px co 3 klatki w szostym planie (EHB:
polowa jasnosci tla), tylko na niebie (wiersze nad horyzontem w kolorze tla wiersza - statek i wyspa go zaslaniaja),
wiersze co 10 px od x = 16 fontem gry. Bajt $01 w tekscie zaczyna panel (przyciemniony prostokat x 8..311 przez
5 wierszy, tekst w nim w pelnej jasnosci), $02 go konczy; '<' '>' '@' to cudzyslowy i (C).
Obraz z emulatora (work/dumps/endlate_5_1824x313.png, po przewinieciu tekstu; okno 320x243 od (93, 44)),
narozniki zaokraglone przez emulator uzupelnione. Wyjscie: game/assets/ending_bg.png, ending_dark.png (polowa
jasnosci jak EHB), ending_sky.png (maska nieba) i ending.json {lines, glyphs}.
Uzycie: python work/export_ending.py
"""
import json, os
from collections import Counter
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADF = os.path.join(ROOT, 'Traps-n-Treasures_Amiga_EN', "Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf")
SEG, SEGLEN = 0xBC098, 0x6148
X0, Y0, W, H, SKY = 93, 44, 320, 243, 159          # niebo: wiersze 0..158 (158 = pierwszy wiersz morza, tekst jeszcze siega)


def glyph(holes, x, y):
    """8x9 glif z panelu (tekst = piksele nieprzyciemnione) z ujecia w trakcie przewijania"""
    return [''.join('#' if holes[y + r, x + c] else '.' for c in range(8)) for r in range(9)]


if __name__ == '__main__':
    shot = lambda n: np.array(Image.open(os.path.join(ROOT, 'work', 'dumps', n + '_1824x313.png')).convert('RGB')).astype(int)[Y0:Y0 + H, X0:X0 + W]
    bg = shot('endlate_5')
    sky = np.zeros((H, W), bool)
    for y in range(H):                                   # narozniki: niebo = kolor wiersza, morze = piksel o 16 dalej
        row = bg[y]
        mode = Counter(map(tuple, row[14:306])).most_common(1)[0][0]
        corner = np.nonzero((row.max(axis=1) - row.min(axis=1) <= 8) & (row.sum(axis=1) < 120))[0]
        for x in corner:
            if x < 20 or x >= W - 20:
                row[x] = mode if y < SKY else row[x + 16 if x < W // 2 else x - 16]
        if y < SKY:
            sky[y] = np.all(row == mode, axis=1)
    dark = (bg >> 4 >> 1) << 4                           # EHB: 4-bitowa skladowa / 2
    out = os.path.join(ROOT, 'game', 'assets')
    Image.fromarray(bg.astype('uint8')).save(os.path.join(out, 'ending_bg.png'))
    Image.fromarray(dark.astype('uint8')).save(os.path.join(out, 'ending_dark.png'))
    m = np.zeros((H, W, 4), np.uint8); m[sky] = 255
    Image.fromarray(m, 'RGBA').save(os.path.join(out, 'ending_sky.png'))
    # tekst: ciagi zakonczone zerem od ' CONGRATULATIONS' (puste = wolny wiersz), do znacznika konca panelu $02
    seg = open(ADF, 'rb').read()[SEG:SEG + SEGLEN]
    a = seg.index(b' CONGRATULATIONS'); b = seg.index(b'\x02', a)
    lines = [s.decode('latin1') for s in seg[a:b + 1].split(b'\x00')]
    # brakujace glify (cudzyslowy, (C)) z panelu w ujeciu endseq_23: wiersz z '<' ma gore komorki na y = 74
    holes = np.abs(shot('endseq_23') - bg).sum(axis=2) == 0
    glyphs = {'<': glyph(holes, 88, 74), '>': glyph(holes, 16 + 28 * 8, 74), '@': glyph(holes, 56, 94)}
    json.dump({'lines': lines, 'glyphs': glyphs}, open(os.path.join(out, 'ending.json'), 'w'), indent=1)
    print(len(lines), 'wierszy, niebo', int(sky.sum()), 'px')
    for k, g in glyphs.items():
        print(k); print('\n'.join(g))
