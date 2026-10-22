#!/usr/bin/env python3
"""Obrazy porownawcze skalowania 2x dla RAPORT.md: plansza, szwy kafli, sprite'y, HUD/font,
assety 2x vs skalowanie gotowej klatki (shader). Wynik: work/upscale/img/*.png + work/upscale/stats.md

Rysowanie odtwarza draw() z game/main.js (niebo z paralaksa, kafle z koloru 1 przezroczystego,
obiekty, gracz, druga paleta pod linia wody, lustro wody, HUD), w skali S=1 albo S=2.

Uzycie: python work/upscale/make_comparisons.py
"""
import io, json, os, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from scalers import METHODS, colors, pad_scale, strips, xbr, mmpx, hq2x

A = os.path.join(HERE, '..', '..', 'game', 'assets')
OUT = os.path.join(HERE, 'img')
W, H, PFY, SH, TS = 320, 159, 12, 211, 16
SHOW = ['nearest', 'scale2x', 'mmpx', 'xbr', 'hq2x', 'xbr_pal']
TITLE = {'nearest': 'nearest (jak teraz)', 'scale2x': 'Scale2x / EPX', 'mmpx': 'MMPX', 'xbr': 'xBR 2x',
         'hq2x': 'HQ2x', 'xbr_pal': 'xBR + paleta oryginalu'}

png = lambda n: np.array(Image.open(os.path.join(A, n)).convert('RGBA'))
js = lambda n: json.load(open(os.path.join(A, n)))
rgb = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], float)
LV, OBJ, PL, FMAP = js('level1.json'), js('level1_objects.json'), js('player.json'), js('font.json')
MAP = np.frombuffer(open(os.path.join(A, 'level1.bin'), 'rb').read(), np.uint8).reshape(LV['h'], LV['w'])
MP = 8                                                     # margines mapy (kafle puste) dla wycinkow za krawedzia
MAPP = np.pad(MAP, MP)
ATLAS = {k: png(f'level1_{k}.png') for k in ('surface', 'water')}
OATLAS = {k: png(f'level1_objects_{k}.png') for k in ('surface', 'water')}
PATLAS = {k: png(f'player_{k}.png') for k in ('surface', 'water')}
HUD = {'top': png('hud_top.png'), 'bottom': png('hud_bottom.png')}
DIGITS, FONT = png('hud_digits.png'), png('font.png')


def tiles_of(atlas):
    t = atlas.reshape(16, TS, 16, TS, 4).transpose(0, 2, 1, 3, 4).reshape(256, TS, TS, 4).copy()
    t[0] = 0                                               # kafel 0 nie jest rysowany (if (v) w tiles())
    return t


TILES = {k: tiles_of(v) for k, v in ATLAS.items()}


def assemble(cells, x, y, w, h, s=1):
    """warstwa kafli mapy w pikselach swiata [x, x+w) x [y, y+h) z gotowych komorek (skala s)."""
    tx0, ty0 = x // TS, y // TS
    tx1, ty1 = (x + w - 1) // TS + 1, (y + h - 1) // TS + 1
    ids = MAPP[ty0 + MP:ty1 + MP, tx0 + MP:tx1 + MP]
    c = cells.shape[1]
    big = cells[ids].transpose(0, 2, 1, 3, 4).reshape(ids.shape[0] * c, ids.shape[1] * c, 4)
    oy, ox = (y - ty0 * TS) * s, (x - tx0 * TS) * s
    return big[oy:oy + h * s, ox:ox + w * s]


def rgba(a):
    """RGB (np. gotowa klatka) -> RGBA nieprzezroczyste."""
    return np.dstack([a[..., :3], np.full(a.shape[:2], 255, np.uint8)])


def sprite_obj(kind, t):
    g = OBJ['gfx'][t]; c = OBJ['cell']
    x, y = g['cell'] % 16 * c, g['cell'] // 16 * c
    return OATLAS[kind][y:y + g['h'], x:x + g['w']], g['ax'], g['ay']


def sprite_pl(kind, f):
    m = PL['frames'][f]; cw, ch = PL['cell']
    x, y = f % PL['cols'] * cw, f // PL['cols'] * ch
    return PATLAS[kind][y:y + m['h'], x:x + cw], m['ax'], m['ay']


class Gfx:
    """grafiki w skali S: S=1 oryginal, S=2 przeskalowane metoda fn (z pamiecia podreczna).
    per_tile=True: kazdy kafel skalowany osobno (szwy), inaczej warstwa mapy skalowana w kontekscie."""

    def __init__(self, fn=None, per_tile=False):
        self.fn, self.S, self.per_tile, self.c = fn, 1 if fn is None else 2, per_tile, {}

    def memo(self, key, make):
        if key not in self.c:
            self.c[key] = make()
        return self.c[key]

    def layer(self, kind, x, y, w, h):
        if self.fn is None:
            return assemble(TILES[kind], x, y, w, h)
        if self.per_tile:
            cells = self.memo(('tiles', kind), lambda: np.stack([pad_scale(self.fn, t, edge=True) for t in TILES[kind]]))
            return assemble(cells, x, y, w, h, 2)
        m = 8                                              # kontekst sasiednich kafli
        return self.fn(assemble(TILES[kind], x - m, y - m, w + 2 * m, h + 2 * m))[2 * m:2 * (m + h), 2 * m:2 * (m + w)]

    def sprite(self, key, get):
        img, ax, ay = get(*key)
        if self.fn is None:
            return img, ax, ay
        return self.memo(key, lambda: pad_scale(self.fn, img)), ax, ay

    def hud(self, k):
        return HUD[k] if self.fn is None else self.memo(('hud', k), lambda: self.fn(HUD[k]))

    def digit(self, d):
        cell = DIGITS[:, d * 6:d * 6 + 5]
        return cell if self.fn is None else self.memo(('dig', d), lambda: pad_scale(self.fn, cell))

    def glyph(self, i):
        cell = FONT[i // 16 * 9:i // 16 * 9 + 9, i % 16 * 8:i % 16 * 8 + 8]
        return cell if self.fn is None else self.memo(('gl', i), lambda: pad_scale(self.fn, cell))


def over(dst, src, x, y):
    """src RGBA na dst RGB (float) w (x, y), z obcieciem."""
    h, w = src.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x0 >= x1 or y0 >= y1:
        return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x].astype(float); a = s[..., 3:] / 255
    d = dst[y0:y1, x0:x1]; d[...] = d * (1 - a) + s[..., :3] * a


def number(dst, g, n, x, y):
    S, s = g.S, str(n)
    for i, ch in enumerate(reversed(s)):
        over(dst, g.digit(int(ch)), (x - 6 * i) * S, y * S)


def text(dst, g, s, x, y, color='#ffffff'):
    for ch in s.upper():
        i = FMAP.get(ch)
        if i is not None:
            gl = g.glyph(i).copy(); gl[..., :3] = rgb(color)
            over(dst, gl, x * g.S, y * g.S)
        x += 8


def scene(pf, g, kind, cam, player):
    S, (cx, cy) = g.S, cam
    over(pf, g.layer(kind, cx, cy, W, H), 0, 0)
    for o in OBJ['objects']:
        if o['type'] in OBJ['gfx'] and -48 < o['x'] - cx < W + 48 and -48 < o['y'] - cy < H + 48:
            img, ax, ay = g.sprite((kind, o['type']), sprite_obj)
            over(pf, img, (o['x'] - ax - cx) * S, (o['y'] - ay - cy) * S)
    px, py, f = player
    img, ax, ay = g.sprite((kind, f), sprite_pl)
    over(pf, img, (px - ax - cx) * S, (py - ay - cy) * S)


def playfield(g, cam, player):
    S, (cx, cy) = g.S, cam
    pf = np.zeros((H * S, W * S, 3))
    g0 = LV['skyRow0'] - cy // 2                           # niebo: gradient coppera, paralaksa 1/2
    for y in range(H):
        i = y - g0
        c = LV['waterColor'] if cy + y >= LV['waterY'] else LV['skyTop'] if i < 0 else LV['sky'][min(i, len(LV['sky']) - 1)]
        pf[y * S:(y + 1) * S] = rgb(c)
    scene(pf, g, 'surface', cam, player)
    wl = LV['waterY'] - cy
    if wl < H:
        wpf = np.zeros_like(pf); wpf[...] = rgb(LV['waterColor'])
        scene(wpf, g, 'water', cam, player)
        pf[max(0, wl) * S:] = wpf[max(0, wl) * S:]
        for i, c in enumerate(LV['surfaceLine']):
            if 0 <= wl + i < H:
                pf[(wl + i) * S:(wl + i + 1) * S] = rgb(c)
    return pf


def frame(g, cam, player, score=1250, gold=340):
    S = g.S
    f = np.zeros((SH * S, W * S, 3))
    over(f, g.hud('top'), 0, 0); over(f, g.hud('bottom'), 0, (PFY + H) * S)
    number(f, g, score, 185, PFY + H + 12); number(f, g, gold, 185, PFY + H + 24)
    f[PFY * S:(PFY + H) * S] = playfield(g, cam, player)
    return np.rint(f).astype(np.uint8)


# ---------------------------------------------------------------- arkusze porownawcze
FONT_UI = ImageFont.load_default(size=15)
BG = (22, 24, 30)


def sheet(rows, mag=1, gap=8):
    """rows: [(tytul wiersza lub '', [(tytul komorki, RGB/RGBA uint8), ...]), ...] -> Image."""
    up = lambda a: a.repeat(mag, 0).repeat(mag, 1)
    rows = [(t, [(ct, up(np.asarray(c)[..., :3])) for ct, c in cells]) for t, cells in rows]
    ncol = max(len(c) for _, c in rows)
    cw = [max((max(c[j][1].shape[1], int(FONT_UI.getlength(c[j][0])) + 4) for _, c in rows if j < len(c)), default=0)
          for j in range(ncol)]
    lab = 20
    rh = [(lab if t else 0) + lab + max(c.shape[0] for _, c in cells) for t, cells in rows]
    img = Image.new('RGB', (sum(cw) + gap * (ncol + 1), sum(rh) + gap * (len(rows) + 1)), BG)
    d = ImageDraw.Draw(img); y = gap
    for (t, cells), h in zip(rows, rh):
        if t:
            d.text((gap, y), t, fill=(255, 220, 120), font=FONT_UI); y += lab
        x = gap
        for j, (ct, c) in enumerate(cells):
            d.text((x, y), ct, fill=(200, 205, 215), font=FONT_UI)
            img.paste(Image.fromarray(c), (x, y + lab))
            x += cw[j] + gap
        y += h - (lab if t else 0) + gap
    return img


def on_bg(a, color):
    f = np.zeros(a.shape[:2] + (3,)); f[...] = rgb(color); over(f, a, 0, 0)
    return np.rint(f).astype(np.uint8)


def save(img, name):
    img.save(os.path.join(OUT, name), optimize=True)
    print('  ', name, img.size)


def ground(x, y):
    """pierwsza podloga (atrybut b0) pod (x, y) - zeby postawic gracza na planszy."""
    while not LV['attr'][MAP[y // TS, x // TS]] & 1:
        y += TS
    return y // TS * TS


SCREENS = [   # nazwa, kamera, gracz (x, y stop, klatka)
    ('start', (32, 176), (53, 271, 0)),
    ('sklep', (1225, 112), (1395, ground(1395, 150), 11)),
    ('pod_woda', (590, 316), (700, 420, 50)),
]
ZOOMS = [     # ekran, wycinek planszy (x, y, w, h) w pikselach logicznych
    ('start', (0, 60, 80, 56)), ('start', (150, 80, 80, 56)), ('sklep', (120, 60, 80, 56)), ('pod_woda', (80, 64, 80, 56)),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    stats = []
    G = {m: Gfx(METHODS[m]) for m in SHOW}
    G1 = Gfx()

    print('plansza: ekrany')
    fr = {}
    for name, cam, player in SCREENS:
        fr[name] = {m: frame(G[m], cam, player) for m in SHOW}
        fr[name]['1x'] = frame(G1, cam, player)
        pfy = slice(2 * PFY, 2 * (PFY + H))
        cells = [(TITLE[m], fr[name][m][pfy]) for m in SHOW]
        save(sheet([('', cells[:3]), ('', cells[3:])]), f'plansza_{name}.png')

    print('plansza: zblizenia')
    rows = []
    for name, (x, y, w, h) in ZOOMS:
        ys, xs = slice(2 * (PFY + y), 2 * (PFY + y + h)), slice(2 * x, 2 * (x + w))
        rows.append((f'{name}: x {x}..{x + w}, y {y}..{y + h} (powiekszenie 2x wyniku)',
                     [(m, fr[name][m][ys, xs]) for m in SHOW]))
    save(sheet(rows, mag=2), 'plansza_zblizenia.png')

    print('szwy kafli')
    cam, (x, y, w, h) = SCREENS[0][1], (0, 40, 112, 72)
    region = (cam[0] + x, cam[1] + y, w, h)
    rows, seam = [], {}
    for m in ['scale2x', 'mmpx', 'xbr', 'hq2x']:
        whole = G[m].layer('surface', *region)
        tile = Gfx(METHODS[m], per_tile=True).layer('surface', *region)
        sheet2 = METHODS[m](ATLAS['surface'])              # caly atlas jako jeden obraz (naiwnie)
        naive = assemble(np.stack([sheet2[r * 32:r * 32 + 32, c * 32:c * 32 + 32] for r in range(16) for c in range(16)]) *
                         (np.arange(256) > 0)[:, None, None, None].astype(np.uint8), *region, 2)
        diff = np.abs(whole.astype(int) - tile.astype(int)).max(-1) > 0
        vis = on_bg(whole, LV['skyTop']).astype(float) * 0.35; vis[diff] = (255, 40, 40)
        rows.append((TITLE[m], [('cala mapa (kontekst)', on_bg(whole, LV['skyTop'])),
                                ('kazdy kafel osobno', on_bg(tile, LV['skyTop'])),
                                ('roznice (czerwone)', vis.astype(np.uint8)),
                                ('atlas jako 1 obraz', on_bg(naive, LV['skyTop']))]))
        big = (cam[0] - 16, cam[1] - 16, 3 * W, 2 * H)     # statystyka na wiekszym obszarze
        wb, tb = G[m].layer('surface', *big), Gfx(METHODS[m], per_tile=True).layer('surface', *big)
        nb = assemble(np.stack([sheet2[r * 32:r * 32 + 32, c * 32:c * 32 + 32] for r in range(16) for c in range(16)]) *
                      (np.arange(256) > 0)[:, None, None, None].astype(np.uint8), *big, 2)
        seam[m] = [100 * (np.abs(wb.astype(int) - x.astype(int)).max(-1) > 0).mean() for x in (tb, nb)]
    save(sheet(rows, mag=2), 'szwy_kafli.png')

    print("sprite'y")
    pfr = [('stoi', 0), ('idzie', 11), ('skok', 4), ('spada', 88), ('wspina', 73), ('czeka', 58)]
    ob = [('rekin', '4d4', 1), ('ryba', '526', 1), ('rozdymka', '72c', 1), ('malz', '886', 1), ('krab', '962', 0),
          ('pirat', 'c34', 0), ('pirat 2', 'c7a', 0), ('topornik', '164ba', 0), ('papuga', 'd6a', 0), ('moneta', '15c46', 0),
          ('worek', '15d54', 0)]
    rows = [(TITLE[m], [(n, on_bg(G[m].sprite(('surface', f), sprite_pl)[0], LV['skyTop'])) for n, f in pfr] +
             [('plynie', on_bg(G[m].sprite(('water', 50), sprite_pl)[0], LV['waterColor']))]) for m in SHOW]
    save(sheet(rows, mag=2), 'sprite_gracz.png')
    rows = [(TITLE[m], [(n, on_bg(G[m].sprite(('water' if w else 'surface', t), sprite_obj)[0],
                                  LV['waterColor'] if w else LV['skyTop'])) for n, t, w in ob]) for m in SHOW]
    save(sheet(rows, mag=2), 'sprite_obiekty.png')

    print('HUD i font')
    rows = []
    for m in SHOW:
        g = G[m]
        t = np.zeros((2 * 34, 2 * 200, 3)); t[...] = rgb('#000000')
        text(t, g, "YOU'VE MADE IT!!!", 4, 2, '#eecc11'); text(t, g, 'SCORE 1250 GOLD 340', 4, 13, '#ffffff')
        text(t, g, '- PRESS BUTTON -', 4, 24, '#5599dd')
        hud = np.zeros((2 * 52, 2 * W, 3)); over(hud, g.hud('top'), 0, 0); over(hud, g.hud('bottom'), 0, 24)
        number(hud, g, 1250, 185, 12 + 12); number(hud, g, 340, 185, 12 + 24)
        rows.append((TITLE[m], [('HUD (gora + dol, cyfry gry)', np.rint(hud).astype(np.uint8)),
                                ('font 8x9', np.rint(t).astype(np.uint8))]))
    save(sheet(rows), 'hud_font.png')
    rows = []
    for m in ('nearest', 'scale2x', 'mmpx', 'xbr', 'hq2x'):
        t = np.zeros((2 * 12, 2 * 140, 3))
        text(t, G[m], "YOU'VE MADE IT!!!", 1, 1, '#eecc11')
        rows.append((TITLE[m], [('', fr['start'][m][2 * (PFY + H):, :2 * 216]), ('', np.rint(t).astype(np.uint8))]))
    save(sheet(rows, mag=2), 'hud_zblizenie.png')

    print('assety 2x vs skalowanie klatki (shader)')
    rows, zrows, rt = [], [], {}
    zoom = (slice(2 * (PFY + 60), 2 * (PFY + 132)), slice(0, 2 * 112))   # gracz na starcie + skaly
    for m in ['mmpx', 'xbr', 'hq2x']:
        a2 = fr['start'][m]
        sh = METHODS[m](rgba(fr['start']['1x']))[..., :3]
        diff = np.abs(a2.astype(int) - sh.astype(int)).max(-1) > 24
        vis = a2.astype(float) * 0.35; vis[diff] = (255, 40, 40)
        rows.append((TITLE[m], [('assety przeskalowane offline', a2), ('cala klatka 320x211 w shaderze', sh),
                                ('roznice > 24 (czerwone)', vis.astype(np.uint8))]))
        zrows.append((TITLE[m], [('assety offline', a2[zoom]), ('shader na klatce', sh[zoom]),
                                 ('roznice', vis.astype(np.uint8)[zoom])]))
        rt[m] = 100 * diff.mean()
    save(sheet(rows), 'assety_vs_shader.png')
    save(sheet(zrows, mag=2), 'assety_vs_shader_zblizenie.png')

    print('statystyki')
    with open(os.path.join(HERE, 'stats.md'), 'w', encoding='utf-8') as f:
        f.write('<!-- wygenerowane przez make_comparisons.py -->\n\n')
        f.write('| metoda | kolory: kafle | kolory: ekran start | kolory: gracz | kolory: obiekty | kolory: HUD dol | '
                'szwy: kafel osobno / atlas w calosci vs mapa | assety vs shader (piks. > 24) |\n'
                '|---|---|---|---|---|---|---|---|\n')
        src = [ATLAS['surface'], rgba(fr['start']['1x']), PATLAS['surface'], OATLAS['surface'], HUD['bottom']]
        f.write('| oryginal 1x | %s | - | - |\n' % ' | '.join(str(colors(s)) for s in src))
        for m in SHOW:
            fn = METHODS[m]
            c = [colors(fn(ATLAS['surface'])), colors(rgba(fr['start'][m])),
                 colors(fn(PATLAS['surface'])), colors(fn(OATLAS['surface'])), colors(fn(HUD['bottom']))]
            f.write('| %s | %s | %s | %s |\n' % (m, ' | '.join(map(str, c)), '%.1f%% / %.1f%%' % tuple(seam[m]) if m in seam else '-',
                                                 '%.1f%%' % rt[m] if m in rt else '-'))
        f.write('\n' + full_map_stats() + '\n')
    print(open(os.path.join(HERE, 'stats.md'), encoding='utf-8').read())


def full_map_stats():
    """cala mapa 1x -> 2x: rozmiar PNG, liczba roznych blokow 32x32 (= kafli w kontekscie), konteksty 3x3."""
    ctx = np.stack([np.pad(MAP, 1)[dy:dy + MAP.shape[0], dx:dx + MAP.shape[1]] for dy in range(3) for dx in range(3)], -1)
    n3 = len(np.unique(ctx[MAP > 0].reshape(-1, 9), axis=0))
    full = assemble(TILES['surface'], 0, 0, MAP.shape[1] * TS, MAP.shape[0] * TS)
    size = lambda a: len(enc(a))
    out = ['| warstwa kafli calej mapy (nad woda) | rozmiar PNG | rozne bloki 16x16 / 32x32 | czas |', '|---|---|---|---|']
    blocks = lambda a, c: len(np.unique(a.reshape(a.shape[0] // c, c, a.shape[1] // c, c, 4).transpose(0, 2, 1, 3, 4).reshape(-1, c * c * 4), axis=0))
    out.append('| 1x (8640x768) | %d KB | %d | - |' % (size(full) // 1024, blocks(full, 16)))
    for m, fn in (('nearest', METHODS['nearest']), ('mmpx', lambda a: strips(mmpx, a)), ('xbr', lambda a: strips(xbr, a)), ('hq2x', hq2x)):
        t = time.time(); o = fn(full); t = time.time() - t
        out.append('| %s 2x (17280x1536) | %d KB | %d | %.1f s |' % (m, size(o) // 1024, blocks(o, 32), t))
    atl = ['', '| atlas kafli 256 szt. | rozmiar PNG |', '|---|---|', '| 1x 256x256 | %d KB |' % (size(ATLAS['surface']) // 1024)]
    for m in ('nearest', 'mmpx', 'xbr', 'hq2x'):
        atl.append('| %s 512x512 | %d KB |' % (m, size(METHODS[m](ATLAS['surface'])) // 1024))
    return '\n'.join(out + ['', 'Rozne konteksty 3x3 kafli (kafel + 8 sasiadow) na mapie: %d (kafli uzytych: %d)' %
                            (n3, len(np.unique(MAP[MAP > 0])))] + atl)


def enc(a):
    b = io.BytesIO(); Image.fromarray(a).save(b, 'PNG', optimize=True); return b.getvalue()


if __name__ == '__main__':
    main()
