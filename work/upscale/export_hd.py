#!/usr/bin/env python3
"""Przykladowy zestaw grafik HD (2x) dla przelacznika HD / oryginal: te same nazwy plikow co
game/assets/*.png, w katalogu docelowym (domyslnie work/upscale/hd/ - docelowo game/assets/hd/).
Pliki JSON / BIN zostaja tylko w game/assets (wspolrzedne sa logiczne, 1x).

Kazda grafika skalowana po swoich komorkach, zeby sasiednie klatki atlasu sie nie mieszaly:
  kafle 16x16 (brzegi powielone - jak osobny plik; szwy patrz RAPORT.md rozdz. 5),
  sprite'y (komorki gracza / obiektow / miecza, prostokaty aktorow z level<n>_actors.json) i znaki
  fontu oraz cyfry - z przezroczystym otoczeniem; HUD w calosci.

Uzycie: python work/upscale/export_hd.py [metoda] [katalog]   (metoda: mmpx, xbr, hq2x, scale2x...)
"""
import json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from scalers import METHODS, colors, pad_scale

A = os.path.join(HERE, '..', '..', 'game', 'assets')


def grid(fn, img, cw, ch, edge=False):
    """kazda komorka cw x ch osobno."""
    out = np.zeros((img.shape[0] * 2, img.shape[1] * 2, 4), np.uint8)
    for y in range(0, img.shape[0], ch):
        for x in range(0, img.shape[1], cw):
            c = img[y:y + ch, x:x + cw]
            if c[..., 3].any():
                out[2 * y:2 * (y + c.shape[0]), 2 * x:2 * (x + c.shape[1])] = pad_scale(fn, c, edge=edge)
    return out


def rects(fn, img, rs):
    """wskazane prostokaty (x, y, w, h) osobno, reszta przezroczysta."""
    out = np.zeros((img.shape[0] * 2, img.shape[1] * 2, 4), np.uint8)
    for x, y, w, h in rs:
        out[2 * y:2 * (y + h), 2 * x:2 * (x + w)] = pad_scale(fn, img[y:y + h, x:x + w])
    return out


def export(method='mmpx', dst=os.path.join(HERE, 'hd')):
    fn = METHODS[method]
    os.makedirs(dst, exist_ok=True)
    js = lambda n: json.load(open(os.path.join(A, n), encoding='utf-8'))
    pl = js('player.json')['cell']
    plan = [   # wzorzec nazwy -> sposob skalowania (lv = level<n>, z jego JSON-a komorki / prostokaty)
        (r'level\d+_(surface|water)', lambda a, lv: grid(fn, a, 16, 16, edge=True)),
        (r'level\d+_objects_(surface|water)', lambda a, lv: grid(fn, a, *[js(lv + '_objects.json')['cell']] * 2)),
        (r'level\d+_actors_(surface|water)', lambda a, lv: rects(fn, a, [f[:4] for f in js(lv + '_actors.json')['frames'].values()])),
        (r'player_(surface|water)', lambda a, lv: grid(fn, a, *pl)),
        (r'sword_(surface|water)', lambda a, lv: grid(fn, a, 16, 8)),
        (r'font', lambda a, lv: grid(fn, a, 8, 9)), (r'font_ext', lambda a, lv: grid(fn, a, 8, 12)),
        (r'hud_digits', lambda a, lv: grid(fn, a, 6, 6)),
        (r'hud_(top|bottom|life_empty)', lambda a, lv: fn(a)),
    ]
    missing = []
    for name in sorted(f for f in os.listdir(A) if f.endswith('.png')):
        scale = next((s for pat, s in plan if re.fullmatch(pat, name[:-4])), None)
        if scale is None:
            missing.append(name); continue
        src = np.array(Image.open(os.path.join(A, name)).convert('RGBA'))
        out = scale(src, name.split('_')[0])
        assert out.shape[:2] == (src.shape[0] * 2, src.shape[1] * 2), name
        if method in ('nearest', 'scale2x', 'mmpx'):
            assert colors(out) <= colors(src), name           # metody kopiujace: bez nowych kolorow
        Image.fromarray(out, 'RGBA').save(os.path.join(dst, name), optimize=True)
        print('  %-28s %4dx%-4d -> %4dx%d' % (name, src.shape[1], src.shape[0], out.shape[1], out.shape[0]))
    if missing:
        print('UWAGA: bez planu (gra uzyje oryginalu):', ', '.join(missing))


if __name__ == '__main__':
    export(*sys.argv[1:])
