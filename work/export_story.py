#!/usr/bin/env python3
"""Przewijana historia z intra ('The previous history: ...', tekst w pamieci map1_fast $2A9480): tekst sklejony
z klatek emulatora (work/dumps/st_NNN_320x290.rgb: ekran 320 px od x 93, wiersze bufora od 20; ekran gry od
wiersza 6, przewijanie 1 px/klatke, klatki co 40). Tlo to paski coppera nieruchome wzgledem ekranu (okres
14 linii), tekst = piksele rozne od koloru wiersza. Kolory 8-bit vAmiga -> x17 jak HUD.
Wyjscie: game/assets/story_text.png (przezroczyste tlo), story_bg.png (1 x 256, kolory linii); do tego ekrany
startowe intro_starbyte.png i intro_nightingale.png (320 x 200 z zrzutow work/dumps/starbyte_/nightingale_1824x313.png).
Uzycie: python work/export_story.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOP, H, STEP, N = 6, 256, 40, 115


def frame(i):
    p = os.path.join(ROOT, 'work', 'dumps', 'st_%03d_320x290.rgb' % i)
    return np.frombuffer(open(p, 'rb').read(), np.uint8).reshape(290, 320, 3).astype(int)[TOP:TOP + H]


def modes(f):
    out = []
    for row in f:
        v, c = np.unique(row.reshape(-1, 3), axis=0, return_counts=True)
        out.append(v[c.argmax()])
    return np.array(out)


x17 = lambda a: np.minimum(255, np.round(a / 16) * 17).astype(np.uint8)
if __name__ == '__main__':
    ms = np.array([modes(frame(i)) for i in range(5, N, 10)])   # kolor wiersza: najczestszy w wielu klatkach
    bg = np.array([max(map(tuple, ms[:, y]), key=lambda c: (ms[:, y] == c).all(axis=1).sum()) for y in range(H)])
    tall = np.zeros((H + STEP * N, 320, 4), np.uint8)
    for i in range(N):
        f = frame(i)
        m = np.any(f != bg[:, None, :], axis=2)
        for y in np.nonzero(m.sum(axis=1) > 150)[0]:     # linia innego koloru coppera w tej klatce (1-2 kolory) to nie tekst
            if len(np.unique(f[y][m[y]], axis=0)) <= 2:
                m[y] = False
        m[:8] = False; m[-24:] = False                  # brzegi ekranu (linie coppera na granicy) - klatki i tak sie nakladaja
        ys, xs = np.nonzero(m)
        tall[ys + STEP * i, xs, :3] = x17(f[ys, xs])
        tall[ys + STEP * i, xs, 3] = 255
    rows = np.nonzero(tall[:, :, 3].any(axis=1))[0]
    tall = tall[rows[0]:rows[-1] + 1]
    out = os.path.join(ROOT, 'game', 'assets')
    Image.fromarray(tall, 'RGBA').save(os.path.join(out, 'story_text.png'))
    Image.fromarray(x17(bg)[:, None, :]).save(os.path.join(out, 'story_bg.png'))
    print('story_text', tall.shape[1], 'x', tall.shape[0], ', pierwszy wiersz tekstu na ekranie', rows[0])
    for name in ('starbyte', 'nightingale'):              # logo wydawcy i napis studia (ekran od x 93, linia 44)
        im = Image.open(os.path.join(ROOT, 'work', 'dumps', name + '_1824x313.png')).convert('RGB').crop((93, 44, 413, 244))
        Image.fromarray(x17(np.array(im).astype(int))).save(os.path.join(out, 'intro_%s.png' % name))
