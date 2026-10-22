#!/usr/bin/env python3
"""Demo asset pack: our own graphics and a test level in the formats the engine reads from game/assets.

Nothing here comes from the original game - every picture is drawn by this script, every table is written by
hand. The pack lets the engine run without the original data (public repository); the real assets from your own
disks replace it simply by existing in game/assets (main.js falls back to game/assets-demo otherwise).

Usage (project root): python -I work/make_demo_assets.py   -> game/assets-demo/
"""
import json, math, os, random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'game', 'assets-demo')
random.seed(1993)


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def save(name, im):
    p = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)


def save_json(name, obj):
    p = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def canvas(w, h, fill=(0, 0, 0, 0)):
    return Image.new('RGBA', (w, h), fill)


def tint(im, d):
    """underwater version: shift every opaque pixel by (dr, dg, db)"""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (max(0, min(255, r + d[0])), max(0, min(255, g + d[1])), max(0, min(255, b + d[2])), a)
    return out


WATER_TINT = (-40, -10, 30)

# --- bitmap font (own 5x7 design), used for the HUD font, the message font and all text screens -----------------
FONT5 = {
    'A': '01110 10001 10001 11111 10001 10001 10001', 'B': '11110 10001 10001 11110 10001 10001 11110',
    'C': '01110 10001 10000 10000 10000 10001 01110', 'D': '11100 10010 10001 10001 10001 10010 11100',
    'E': '11111 10000 10000 11110 10000 10000 11111', 'F': '11111 10000 10000 11110 10000 10000 10000',
    'G': '01110 10001 10000 10111 10001 10001 01111', 'H': '10001 10001 10001 11111 10001 10001 10001',
    'I': '01110 00100 00100 00100 00100 00100 01110', 'J': '00111 00010 00010 00010 00010 10010 01100',
    'K': '10001 10010 10100 11000 10100 10010 10001', 'L': '10000 10000 10000 10000 10000 10000 11111',
    'M': '10001 11011 10101 10101 10001 10001 10001', 'N': '10001 10001 11001 10101 10011 10001 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110', 'P': '11110 10001 10001 11110 10000 10000 10000',
    'Q': '01110 10001 10001 10001 10101 10010 01101', 'R': '11110 10001 10001 11110 10100 10010 10001',
    'S': '01111 10000 10000 01110 00001 00001 11110', 'T': '11111 00100 00100 00100 00100 00100 00100',
    'U': '10001 10001 10001 10001 10001 10001 01110', 'V': '10001 10001 10001 10001 10001 01010 00100',
    'W': '10001 10001 10001 10101 10101 10101 01010', 'X': '10001 10001 01010 00100 01010 10001 10001',
    'Y': '10001 10001 01010 00100 00100 00100 00100', 'Z': '11111 00001 00010 00100 01000 10000 11111',
    '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00010 00100 01000 11111', '3': '11111 00010 00100 00010 00001 10001 01110',
    '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000',
    '8': '01110 10001 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 00010 01100',
    '!': '00100 00100 00100 00100 00100 00000 00100', '"': '01010 01010 00000 00000 00000 00000 00000',
    '%': '11001 11010 00010 00100 01000 01011 10011', '&': '01100 10010 10100 01000 10101 10010 01101',
    "'": '00100 00100 00000 00000 00000 00000 00000', '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000', '*': '00000 00100 10101 01110 10101 00100 00000',
    '+': '00000 00100 00100 11111 00100 00100 00000', ',': '00000 00000 00000 00000 00110 00100 01000',
    '-': '00000 00000 00000 11111 00000 00000 00000', '.': '00000 00000 00000 00000 00000 01100 01100',
    '/': '00001 00010 00010 00100 01000 01000 10000', ':': '00000 01100 01100 00000 01100 01100 00000',
    ';': '00000 01100 01100 00000 01100 00100 01000', '?': '01110 10001 00001 00010 00100 00000 00100',
    '=': '00000 00000 11111 00000 11111 00000 00000', '#': '01010 01010 11111 01010 11111 01010 01010',
    '<': '00010 00100 01000 10000 01000 00100 00010', '>': '01000 00100 00010 00001 00010 00100 01000',
    '@': '01110 10001 10111 10101 10110 10000 01111', '[': '01110 01000 01000 01000 01000 01000 01110',
    ']': '01110 00010 00010 00010 00010 00010 01110', '_': '00000 00000 00000 00000 00000 00000 11111',
    '$': '00100 01111 10100 01110 00101 11110 00100',
}


def glyph_rows(ch):
    g = FONT5.get(ch.upper())
    return [r for r in g.split()] if g else None


def draw_glyph(px, ch, ox, oy, col, shadow=None):
    rows = glyph_rows(ch)
    if not rows:
        return
    for y, row in enumerate(rows):
        for x, b in enumerate(row):
            if b == '1':
                if shadow:
                    px[ox + x + 1, oy + y + 1] = shadow
                px[ox + x, oy + y] = col


def text_width(s):
    return sum(6 if ch != ' ' else 5 for ch in s)


def draw_text(im, s, x, y, col, shadow=(0, 0, 0, 255)):
    px = im.load()
    for ch in s:
        if ch != ' ' and glyph_rows(ch) and 0 <= x < im.width - 6 and 0 <= y < im.height - 8:
            draw_glyph(px, ch, x, y, col, shadow)
        x += 6 if ch != ' ' else 5


def font_assets():
    # font.png: 16 x 4 cells of 8 x 9 (index -> cell), white glyphs (the engine tints them)
    chars = [c for c in FONT5 if c not in ' ']
    im, fmap = canvas(128, 36), {}
    px = im.load()
    for i, ch in enumerate(chars[:64]):
        draw_glyph(px, ch, (i % 16) * 8 + 1, (i // 16) * 9 + 1, (255, 255, 255, 255))
        fmap[ch] = i
    save('font.png', im)
    save_json('font.json', fmap)
    # accented letters for the Polish texts (8 x 12 cells, 2 rows above the cell): base letter + accent
    ext = 'ĄĆĘŁŃÓŚŹŻ'
    base = {'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'}
    im2 = canvas(72, 12)
    px2 = im2.load()
    for i, ch in enumerate(ext):
        draw_glyph(px2, base[ch], i * 8 + 1, 3, (255, 255, 255, 255))
        if ch in 'ĄĘ':
            px2[i * 8 + 5, 11] = px2[i * 8 + 4, 11] = (255, 255, 255, 255)
        elif ch == 'Ł':
            px2[i * 8 + 3, 6] = (255, 255, 255, 255)
        elif ch == 'Ż':
            px2[i * 8 + 3, 1] = (255, 255, 255, 255)
        else:
            px2[i * 8 + 4, 0] = px2[i * 8 + 3, 1] = (255, 255, 255, 255)
    save('font_ext.png', im2)
    save_json('font_ext.json', {ch: i for i, ch in enumerate(ext)})
    # message font: glyphs '!'..'}' (93), each [x, w, h, ax, ay] on one row 9 px high, y = baseline anchor
    im3, glyphs, x = canvas(700, 9), [], 0
    px3 = im3.load()
    for code in range(0x21, 0x7e):
        ch = chr(code)
        rows = glyph_rows(ch)
        if rows:
            draw_glyph(px3, ch, x, 1, (255, 255, 255, 255), (60, 60, 60, 255))
            glyphs.append([x, 6, 8, 0, 7])
            x += 7
        else:
            glyphs.append([x, 4, 8, 0, 7])
            x += 5
    arrow = canvas(10, 9)
    d = ImageDraw.Draw(im3)
    d.polygon([(x + 1, 2), (x + 7, 2), (x + 4, 6)], fill=(255, 220, 80, 255))
    d.polygon([(x + 11, 3), (x + 17, 3), (x + 14, 7)], fill=(255, 220, 80, 255))
    save('msgfont.png', im3)
    save_json('msgfont.json', {'glyphs': glyphs, 'arrow': [[x, 8, 6, 0, 0], [x + 10, 8, 6, 0, 0]]})


# --- tiles --------------------------------------------------------------------------------------------------------
FLOOR, WALL, CEIL, LADDER, ENTRANCE, ROPE, ACTION, DEADLY, SLIPPY, BOTTOM = 1, 2, 4, 8, 0x10, 0x20, 0x40, 0x8000, 0x4000, 0x100
SOLID = FLOOR | WALL | CEIL | BOTTOM
TILES = {   # index: (attr, painter name)
    0: (0, 'sky'), 1: (SOLID, 'rock'), 2: (SOLID, 'grass'), 3: (FLOOR, 'plank'), 4: (LADDER, 'ladder'),
    5: (FLOOR | LADDER, 'ladder_top'), 6: (ROPE, 'rope'), 7: (SOLID | DEADLY, 'spikes'), 8: (ENTRANCE, 'door'),
    9: (0, 'door_top'), 10: (SOLID, 'brick'), 11: (SOLID, 'sand'), 12: (0, 'bush'), 13: (0, 'palm'),
    14: (0, 'palm_top'), 15: (SOLID | SLIPPY, 'ice'), 16: (SOLID, 'crate'), 17: (0, 'sign'),
}
CRATE = 16


def paint_tile(d, ox, oy, kind, theme):
    rock, rock2, grass, sand = theme['rock'], theme['rock2'], theme['grass'], theme['sand']
    R = lambda x0, y0, x1, y1, c: d.rectangle([ox + x0, oy + y0, ox + x1, oy + y1], fill=c)
    if kind == 'rock':
        R(0, 0, 15, 15, rock)
        for i in range(6):
            x, y = random.randrange(15), random.randrange(15)
            R(x, y, x + 1, y, rock2)
        R(0, 15, 15, 15, rock2)
    elif kind == 'grass':
        R(0, 0, 15, 15, rock)
        R(0, 0, 15, 3, grass)
        for x in range(0, 16, 3):
            R(x, 4, x, 5, grass)
    elif kind == 'plank':
        R(0, 0, 15, 4, (150, 96, 48, 255))
        R(0, 4, 15, 4, (90, 56, 28, 255))
        R(2, 5, 3, 9, (90, 56, 28, 255))
        R(12, 5, 13, 9, (90, 56, 28, 255))
    elif kind in ('ladder', 'ladder_top'):
        R(3, 0, 4, 15, (160, 110, 60, 255))
        R(11, 0, 12, 15, (160, 110, 60, 255))
        for y in range(1, 16, 5):
            R(3, y, 12, y + 1, (200, 150, 80, 255))
    elif kind == 'rope':
        for y in range(16):
            R(7 + (y // 2) % 2, y, 7 + (y // 2) % 2, y, (210, 180, 120, 255))
    elif kind == 'spikes':
        R(0, 8, 15, 15, rock)
        for x in range(0, 16, 4):
            d.polygon([(ox + x, oy + 8), (ox + x + 2, oy), (ox + x + 3, oy + 8)], fill=(220, 220, 230, 255))
    elif kind == 'door':
        R(1, 0, 14, 15, (100, 60, 30, 255))
        R(3, 2, 12, 15, (60, 34, 16, 255))
        R(10, 8, 11, 9, (240, 200, 60, 255))
    elif kind == 'door_top':
        d.pieslice([ox + 1, oy + 4, ox + 14, oy + 27], 180, 360, fill=(100, 60, 30, 255))
    elif kind == 'brick':
        R(0, 0, 15, 15, theme['brick'])
        for y in (0, 8):
            R(0, y, 15, y, (40, 30, 30, 255))
        R(7, 0, 7, 7, (40, 30, 30, 255))
        R(3, 8, 3, 15, (40, 30, 30, 255))
        R(11, 8, 11, 15, (40, 30, 30, 255))
    elif kind == 'sand':
        R(0, 0, 15, 15, sand)
        for i in range(8):
            x, y = random.randrange(16), random.randrange(16)
            R(x, y, x, y, tuple(max(0, c - 30) for c in sand[:3]) + (255,))
    elif kind == 'bush':
        d.ellipse([ox, oy + 6, ox + 15, oy + 15], fill=grass)
    elif kind == 'palm':
        R(6, 0, 9, 15, (130, 90, 50, 255))
    elif kind == 'palm_top':
        R(6, 8, 9, 15, (130, 90, 50, 255))
        d.ellipse([ox - 2, oy, ox + 17, oy + 9], fill=(40, 150, 60, 255))
    elif kind == 'ice':
        R(0, 0, 15, 15, (170, 220, 250, 255))
        R(1, 1, 5, 1, (255, 255, 255, 255))
    elif kind == 'crate':
        R(0, 0, 15, 15, (170, 110, 50, 255))
        d.rectangle([ox, oy, ox + 15, oy + 15], outline=(90, 56, 28, 255))
        d.line([ox, oy, ox + 15, oy + 15], fill=(90, 56, 28, 255))
        d.line([ox + 15, oy, ox, oy + 15], fill=(90, 56, 28, 255))
    elif kind == 'sign':
        R(7, 8, 8, 15, (130, 90, 50, 255))
        R(1, 2, 14, 8, (200, 160, 90, 255))


THEMES = {
    1: {'rock': rgb('#7a6a5a'), 'rock2': rgb('#5a4a3a'), 'grass': rgb('#4caa3c'), 'sand': rgb('#e0c890'), 'brick': rgb('#a05a40'),
        'sky': ['#2a6cc8', '#3a80d8', '#4a94e0', '#62a8e8', '#7cbcf0'], 'water': '#103070', 'surface': ['#5a9cf0', '#3a70c8']},
    2: {'rock': rgb('#5a6478'), 'rock2': rgb('#3c4456'), 'grass': rgb('#3c8c5a'), 'sand': rgb('#b8b090'), 'brick': rgb('#706880'),
        'sky': ['#202848', '#2c3660', '#3a4878', '#4c5c90', '#6070a8'], 'water': '#0c2040', 'surface': ['#4060a0', '#28406c']},
    3: {'rock': rgb('#6e5a48'), 'rock2': rgb('#4e3e30'), 'grass': rgb('#8c9c3c'), 'sand': rgb('#d0a870'), 'brick': rgb('#8c4c3c'),
        'sky': ['#c86438', '#d87c48', '#e49458', '#eca868', '#f4bc80'], 'water': '#1c2c58', 'surface': ['#6080c0', '#405890']},
    4: {'rock': rgb('#788c98'), 'rock2': rgb('#586c78'), 'grass': rgb('#e8f0f8'), 'sand': rgb('#c8d8e0'), 'brick': rgb('#607080'),
        'sky': ['#8cb4d8', '#9cc0e0', '#acccE8'.lower(), '#bcd8f0', '#cce4f8'], 'water': '#183c68', 'surface': ['#7ca8e0', '#5888c0']},
}

# demo level, built from features (tile coordinates). Ground top at row G, water line in row WROW.
LW, LH, G, WROW = 128, 24, 12, 16


def build_level(n):
    m = bytearray(LW * LH)

    def fill(x0, x1, y0, y1, t):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if 0 <= x < LW and 0 <= y < LH:
                    m[y * LW + x] = t

    def ground(x0, x1, top, t=2):
        fill(x0, x1, 0, top - 1, 0)
        fill(x0, x1, top, top, t)
        fill(x0, x1, top + 1, LH - 1, 1)

    ground(0, 22, G)
    ground(23, 26, G + 1, 11)                 # shallow sand pit
    ground(27, 52, G)
    fill(9, 9, G - 3, G - 1, 13)              # palm
    fill(9, 9, G - 4, G - 4, 14)
    fill(17, 17, G - 1, G - 1, 17)            # sign
    fill(31, 31, 8, G - 1, 4)                 # ladder up to a plank ledge
    fill(31, 31, 7, 7, 5)
    fill(32, 38, 7, 7, 3)
    fill(42, 44, G, G, 7)                     # spikes
    fill(48, 48, G - 1, G - 1, 12)            # bush
    ground(53, 68, WROW + 3)                  # water pool with a rope over it
    fill(53, 53, G, WROW + 2, 1)
    fill(61, 61, 4, 11, 6)
    fill(57, 59, 9, 9, 3)                     # small plank in the middle
    ground(71, 88, G)
    for k, top in enumerate((WROW - 1, WROW - 2, WROW - 3)):   # way out of the pool: low steps on the right bank
        ground(69 + 2 * k, 70 + 2 * k, top)
    fill(76, 76, G - 1, G - 1, CRATE)
    fill(77, 77, G - 1, G - 1, CRATE)
    fill(77, 77, G - 2, G - 2, CRATE)
    ground(89, 100, G, 15)                    # slippery ice
    for k in range(5):                        # stairs up to the exit hill
        ground(101 + 2 * k, 102 + 2 * k, G - 1 - k)
    ground(111, 127, G - 5)
    fill(118, 118, G - 6, G - 6, 8)           # exit door
    fill(118, 118, G - 7, G - 7, 9)
    fill(124, 124, G - 8, G - 6, 13)          # palm on the hill
    fill(124, 124, G - 9, G - 9, 14)
    if n >= 2:                                # later stages: a brick tower and more spikes
        fill(82, 85, G - 6, G - 1, 10)
        fill(83, 84, G - 5, G - 2, 0)
        fill(83, 83, G - 5, G - 1, 4)
        fill(83, 83, G - 6, G - 6, 5)
        fill(66, 68, WROW + 3, WROW + 3, 7)
    return LW, LH, m


def level_assets(n):
    th = THEMES[n]
    w, h, m = build_level(n)
    tiles = canvas(256, 256)
    d = ImageDraw.Draw(tiles)
    for i, (a, kind) in TILES.items():
        if kind != 'sky':
            paint_tile(d, (i % 16) * 16, (i // 16) * 16, kind, th)
    save(f'level{n}_surface.png', tiles)
    save(f'level{n}_water.png', tint(tiles, WATER_TINT))
    crates = [{'idx': i, 'under': 0} for i, t in enumerate(m) if t == CRATE]
    for c in crates:
        m[c['idx']] = CRATE
    open(os.path.join(OUT, f'level{n}.bin'), 'wb').write(bytes(m))
    attr = [0] * 256
    for i, (a, kind) in TILES.items():
        attr[i] = a
    exit_idx = next(i for i, t in enumerate(m) if t == 8)
    water_y = WROW * 16 + 4
    W, H = w * 16, h * 16
    sky = []
    for c in th['sky']:
        sky += [c] * 12
    meta = {
        'w': w, 'h': h, 'tile': 16, 'tiles': 256, 'waterY': water_y, 'skyTop': th['sky'][0], 'sky': sky, 'skyRow0': 40,
        'waterColor': th['water'], 'surfaceLine': th['surface'], 'attr': attr, 'start': [40, G * 16 - 1], 'area': 1,
        'areas': {'1': {'cam': [0, 0, W - 320, H - 159], 'water': water_y, 'doors': [{'tile': exit_idx, 'exit': 1}],
                        'target': [exit_idx % w * 16, exit_idx // w * 16], 'sect': '0'}},
        'shops': {}, 'escape': 120, 'actions': {'lever': [], 'list': []}, 'brittle': {'tile': 1, 'list': []},
        'keydoor': [1, 1, 1, 1], 'crates': {'tile': CRATE, 'list': crates}, 'bombwalls': {'tile': CRATE, 'list': []},
        'traps': [], 'bonus': {'x': 64, 'y': 64, 'cam': [0, 0, 0, 0], 'items': [], 'count': 0,
                               'gen': {'x': 64, 'y': 15, 'n': 0, 'w': 64}},
        'music_events': [0] * 32, 'quest': {'items': {}, 'spots': [], 'ropes': []},
        'treasure': {'x': 64, 'y': 127, 'cam': [0, 0, 1600, 0], 'items': []},
        'chests': {'shut': 1, 'open': 1, 'list': []}, 'currents': [],
    }
    save_json(f'level{n}.json', meta)
    objects_assets(n, m, w, h)
    actors_assets(n)


# --- objects (items in the level) ------------------------------------------------------------------------------------
# type ids are the engine's item names (they index its item tables); the pictures are ours
ITEMS = {'2f266c': 'coin', '2f25c2': 'gem', '2f26d0': 'bag', '2f271c': 'gem2', '2f2768': 'ring', '2f27b4': 'cup'}


def paint_item(d, ox, oy, kind, frame=0):
    if kind == 'coin':
        wd = [8, 8, 6, 4, 6, 8][frame]
        d.ellipse([ox + 4 - wd // 2, oy, ox + 4 + wd // 2 - 1, oy + 7], fill=(250, 210, 60, 255), outline=(170, 120, 20, 255))
    elif kind in ('gem', 'gem2'):
        c = (80, 220, 255, 255) if kind == 'gem' else (240, 80, 120, 255)
        d.polygon([(ox + 4, oy), (ox + 8, oy + 4), (ox + 4, oy + 7), (ox, oy + 4)], fill=c)
    elif kind == 'bag':
        d.ellipse([ox, oy + 3, ox + 10, oy + 12], fill=(150, 100, 50, 255))
        d.rectangle([ox + 3, oy, ox + 7, oy + 3], fill=(120, 80, 40, 255))
    elif kind == 'ring':
        d.ellipse([ox, oy, ox + 8, oy + 8], outline=(250, 210, 60, 255), width=2)
    elif kind == 'cup':
        d.rectangle([ox + 1, oy, ox + 8, oy + 6], fill=(220, 220, 230, 255))
        d.rectangle([ox + 3, oy + 7, ox + 6, oy + 9], fill=(220, 220, 230, 255))


def objects_assets(n, m, w, h):
    atlas = canvas(768, 144)
    d = ImageDraw.Draw(atlas)
    gfx, cell = {}, 0
    for t, kind in ITEMS.items():
        frames = 6 if kind == 'coin' else 1
        anim = []
        for f in range(frames):
            paint_item(d, (cell % 16) * 48 + 4, (cell // 16) * 48 + 4, kind, f)
            anim.append([cell, 12, 13, 6, 12])
            cell += 1
        gfx[t] = {'cell': anim[0][0], 'w': 12, 'h': 13, 'ax': 6, 'ay': 12}
        if frames > 1:
            gfx[t].update({'anim': anim, 'delay': 2})
    save(f'level{n}_objects_surface.png', atlas)
    save(f'level{n}_objects_water.png', tint(atlas, WATER_TINT))
    objs = []
    rnd = random.Random(n)
    for x in range(4, w - 4, 3):     # items on top of floor tiles
        for y in range(1, h - 1):
            if m[y * w + x] in (2, 3, 10, 15) and m[(y - 1) * w + x] == 0 and rnd.random() < 0.35:
                objs.append({'x': x * 16 + 8, 'y': y * 16 - 1, 'type': rnd.choice(list(ITEMS)), 'sect': '0'})
                break
    save_json(f'level{n}_objects.json', {'cell': 48, 'objects': objs, 'gfx': gfx})


def actors_assets(n):
    # no enemies in the demo level (the actor engine runs the original script format; a demo script set is future work)
    save_json(f'level{n}_actors.json', {'banks': {}, 'triggers': [], 'frames': {}, 'order': [], 'mem': [], 'actors': []})
    save(f'level{n}_actors_surface.png', canvas(16, 16))
    save(f'level{n}_actors_water.png', canvas(16, 16))


# --- the player: a little pirate, one 32 x 48 cell per frame ----------------------------------------------------------
SKIN, HAT, SHIRT, STRIPE, PANTS, BOOT, BLADE = rgb('#f0c090'), rgb('#c02828'), rgb('#f0f0f0'), rgb('#3050c0'), rgb('#304080'), rgb('#603010'), rgb('#d8d8e0')
WALK = {9: 0, 10: 1, 11: 2, 12: 3, 13: 2, 38: 0, 39: 1, 40: 2, 41: 3, 42: 2}
POSE = {}
for i in range(108):
    POSE[i] = 'stand'
for r, l, p in [(0, 29, 'stand'), (1, 30, 'attack'), (2, 31, 'crouch'), (3, 32, 'crouch_attack'), (4, 33, 'jump'),
                (6, 35, 'chute'), (8, 37, 'stomp'), (19, 48, 'crawl_attack'), (89, 90, 'throw'), (88, 87, 'fall'),
                (65, 64, 'hang'), (67, 66, 'rope_attack'), (79, 78, 'ladder_hang'), (81, 80, 'ladder_attack')]:
    POSE[r] = p
    POSE[l] = p
for i in list(range(9, 14)) + list(range(38, 43)):
    POSE[i] = 'walk'
for i in list(range(14, 19)) + list(range(43, 48)):
    POSE[i] = 'crawl'
for i in list(range(20, 26)) + list(range(49, 55)):
    POSE[i] = 'swim'
for i in (61, 62, 63):
    POSE[i] = 'rope'
for i in range(72, 78):
    POSE[i] = 'climb'
for i in (84, 85, 86):
    POSE[i] = 'back'
for i in range(91, 97):
    POSE[i] = 'spin'
POSE[97] = 'dead'
for i in (27, 28, 58, 102, 103, 104, 105, 106, 107):
    POSE[i] = 'wave'
LEFT = set(range(29, 58)) | {64, 66, 78, 80, 84, 87, 90}


def paint_player(d, ox, oy, pose, i):
    """draws into a 32 x 48 cell; returns (h, ax, ay, box)"""
    left = i in LEFT
    fx = (lambda x: ox + 31 - x) if left else (lambda x: ox + x)
    R = lambda x0, y0, x1, y1, c: d.rectangle([min(fx(x0), fx(x1)), oy + y0, max(fx(x0), fx(x1)), oy + y1], fill=c)
    ax, ay = (20 if left else 11), 44
    box = [-5, -26, 8, 0]
    if pose in ('crouch', 'crouch_attack', 'crawl', 'crawl_attack'):
        y = 30
        R(6, y, 13, y + 4, SKIN)
        R(5, y - 2, 14, y, HAT)
        R(5, y + 5, 15, y + 10, SHIRT)
        R(5, y + 7, 15, y + 7, STRIPE)
        k = (i % 2) * 2 if pose == 'crawl' else 0
        R(4 + k, y + 11, 17 - k, y + 14, PANTS)
        if pose.endswith('attack'):
            R(15, y + 6, 26, y + 6, BLADE)
        return 48, ax, ay, [-6, -13, 7, 0]
    if pose == 'swim':
        y = 26
        R(16, y, 22, y + 5, SKIN)
        R(15, y - 1, 22, y, HAT)
        R(3, y + 2, 15, y + 6, SHIRT)
        k = i % 3
        R(0, y + 2 + k, 3, y + 4 + k, PANTS)
        return 48, ax, ay, [-8, -15, 11, 3]
    if pose == 'dead':
        R(2, 38, 25, 43, SHIRT)
        R(24, 38, 29, 43, SKIN)
        return 48, ax, ay, box
    y = 18
    R(8, y + 2, 13, y + 7, SKIN)                       # head
    R(7, y, 14, y + 2, HAT)
    R(13, y + 1, 16, y + 1, HAT)                       # bandana knot
    R(6, y + 8, 15, y + 17, SHIRT)                     # body
    for s in range(y + 9, y + 17, 3):
        R(6, s, 15, s, STRIPE)
    step = WALK.get(i, 0)
    if pose in ('jump', 'fall', 'stomp', 'chute'):
        R(6, y + 18, 9, y + 23, PANTS)
        R(12, y + 18, 15, y + 22, PANTS)
        if pose == 'chute':
            d.pieslice([ox + 2, oy + 0, ox + 29, oy + 22], 180, 360, fill=(240, 240, 255, 255))
        if pose == 'stomp':
            R(10, y + 24, 10, y + 30, BLADE)
    else:
        lo = [0, 2, 3, 1][step]
        R(7 - lo // 2, y + 18, 9, y + 24, PANTS)
        R(12, y + 18, 14 + lo // 2, y + 24, PANTS)
        R(6 - lo // 2, y + 25, 9, y + 26, BOOT)
        R(12, y + 25, 15 + lo // 2, y + 26, BOOT)
    if pose in ('attack', 'rope_attack', 'ladder_attack', 'throw'):
        R(15, y + 10, 27, y + 10, BLADE)
        R(14, y + 9, 15, y + 11, BOOT)
    if pose in ('climb', 'rope', 'hang', 'ladder_hang', 'wave'):
        k = i % 2
        R(5, y - 4 + k, 6, y + 8, SKIN)
        R(15, y - 3 - k, 16, y + 8, SKIN)
    if pose == 'back':
        R(8, y + 2, 13, y + 7, HAT)
    return 48, ax, ay, box


def player_assets():
    im = canvas(384, 432)
    d = ImageDraw.Draw(im)
    frames = []
    for i in range(108):
        ox, oy = (i % 12) * 32, (i // 12) * 48
        if oy + 48 > im.height:
            frames.append(None)
            continue
        h, ax, ay, box = paint_player(d, ox, oy, POSE[i], i)
        frames.append({'h': h, 'ax': ax, 'ay': ay, 'box': box})
    save('player_surface.png', im)
    save('player_water.png', tint(im, WATER_TINT))
    save_json('player.json', {'cell': [32, 48], 'cols': 12, 'frames': frames})
    sw = canvas(32, 8)
    ImageDraw.Draw(sw).rectangle([2, 3, 29, 4], fill=BLADE)
    save('sword_surface.png', sw)
    save('sword_water.png', tint(sw, WATER_TINT))


# --- screens -----------------------------------------------------------------------------------------------------------
def screen(w, h, top, bottom):
    im = canvas(w, h, rgb(top))
    d = ImageDraw.Draw(im)
    a, b = rgb(top), rgb(bottom)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([0, y, w, y], fill=tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3)) + (255,))
    return im, d


def centered(im, s, y, col=(255, 255, 255, 255)):
    draw_text(im, s, (im.width - text_width(s)) // 2, y, col)


def screens_assets():
    im, d = screen(352, 289, '#103060', '#40a0e0')
    d.polygon([(0, 220), (352, 220), (352, 289), (0, 289)], fill=rgb('#1a4c8c'))
    d.ellipse([120, 120, 232, 230], fill=rgb('#e0c890'))
    for k in range(5):
        d.line([176, 150, 176 + 60 * math.cos(k * 1.2), 150 - 40 * abs(math.sin(k * 1.2))], fill=rgb('#3c9c48'), width=4)
    centered(im, "TRAPS 'N TREASURES", 40, rgb('#ffd040'))
    centered(im, 'BROWSER PORT - DEMO', 60)
    centered(im, 'OWN DEMO GRAPHICS - PUT YOUR ASSETS', 250)
    centered(im, 'INTO GAME/ASSETS FOR THE REAL GAME', 262)
    save('title.png', im)
    wide = canvas(626, 289)
    wide.paste(im.resize((626, 289)), (0, 0))
    wide.paste(im, (137, 0))
    save('title_wide.png', wide)
    for name, txt in [('intro_starbyte.png', 'A FAN PORT'), ('intro_nightingale.png', 'DEMO ASSETS')]:
        s, _ = screen(320, 200, '#000000', '#202040')
        centered(s, txt, 96, rgb('#ffd040'))
        save(name, s)
    for name in ('island.png', 'island_clean.png'):
        s, dd = screen(320, 200, '#1c5cb0', '#1c5cb0')
        dd.ellipse([90, 50, 230, 170], fill=rgb('#e0c890'))
        dd.ellipse([110, 70, 210, 150], fill=rgb('#4caa3c'))
        save(name, s)
    story = canvas(320, 600)
    lines = ['THE DEMO STORY', '', 'THIS IS A DEMO OF THE ENGINE', 'WITH GRAPHICS MADE FOR THE PORT.', '',
             'THE ORIGINAL GAME DATA IS NOT', 'INCLUDED. EXTRACT IT FROM YOUR', 'OWN DISKS TO PLAY THE REAL GAME.']
    for k, s in enumerate(lines):
        centered(story, s, 200 + k * 12)
    save('story_text.png', story)
    save('story_text_pl.png', story)
    bg, _ = screen(1, 256, '#000020', '#204080')
    save('story_bg.png', bg)
    hof, _ = screen(205, 55, '#402000', '#805010')
    centered(hof, 'HALL OF FAME', 24, rgb('#ffd040'))
    save('hof_logo.png', hof)
    go, _ = screen(458, 640, '#000000', '#300000')
    centered(go, 'GAME OVER', 300, rgb('#ff4040'))
    save('gameover.png', go)
    for name, a, b in [('ending_bg.png', '#203860', '#4080c0'), ('ending_dark.png', '#080c18', '#101830'), ('ending_sky.png', '#5090e0', '#90c0f0')]:
        s, _ = screen(320, 243, a, b)
        save(name, s)
    save_json('ending.json', {'lines': ['', ' THE END OF THE DEMO', '', ' THANK YOU FOR PLAYING', '', '', ' ENGINE: BROWSER PORT',
                                        ' GRAPHICS: DEMO PACK', '', ''], 'glyphs': {}})
    menu = canvas(320, 729, rgb('#101830'))
    centered(menu, 'MENU', 20, rgb('#ffd040'))
    centered(menu, 'START', 80)
    centered(menu, 'PASSWORD', 100)
    save('menu.png', menu)
    save('menu_icons.png', canvas(108, 18, rgb('#305080')))
    pi = canvas(96, 16)
    dp = ImageDraw.Draw(pi)
    for k, c in enumerate(['#e04040', '#40c040', '#4080e0', '#e0c040', '#c040c0', '#40c0c0']):
        dp.ellipse([k * 16 + 2, 2, k * 16 + 13, 13], fill=rgb(c))
    save('pass_icons.png', pi)
    save_json('menu.json', {'w': 320, 'h': 243, 'slot': [81, 128], 'step': 20, 'cursor': '#c00000',
                            'passwords': [[0, 1, 2, 3, 4, 5, 0, 1], [1, 2, 3, 4, 5, 0, 1, 2], [2, 3, 4, 5, 0, 1, 2, 3]]})
    shop, _ = screen(320, 160, '#3c2010', '#6c4020')
    centered(shop, 'SHOP', 10, rgb('#ffd040'))
    save('shop_bg.png', shop)
    save('shop_items.png', canvas(16, 16))
    save_json('shop_items.json', {'0': [0, 0, 1, 1, 0, 0]})
    save_json('shop_keeper.json', {'order': ['0'], 'keeper': []})


DIGITS6 = {'0': '01110 10001 10011 10101 11001 01110', '1': '00100 01100 00100 00100 00100 01110',
           '2': '01110 10001 00010 00100 01000 11111', '3': '11110 00001 00110 00001 00001 11110',
           '4': '00010 00110 01010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 11110',
           '6': '01110 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000',
           '8': '01110 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 01110'}


def heart(d, x, y, col):
    d.rectangle([x + 1, y, x + 3, y + 1], fill=col)
    d.rectangle([x + 5, y, x + 7, y + 1], fill=col)
    d.rectangle([x, y + 1, x + 8, y + 3], fill=col)
    d.polygon([(x, y + 3), (x + 8, y + 3), (x + 4, y + 6)], fill=col)


def hud_assets():
    top, dt = screen(320, 12, '#202020', '#383838')
    for i in range(5):             # full Life cells (the engine paints hud_life_empty over the missing ones)
        heart(dt, 51 + 11 * i, 2, rgb('#e03030'))
    draw_text(top, 'LIFE', 20, 2, rgb('#ffd040'))
    save('hud_top.png', top)
    vit = top.copy()
    dv = ImageDraw.Draw(vit)
    for i in range(6):
        dv.ellipse([258 + 10 * i, 3, 264 + 10 * i, 9], fill=rgb('#40d040'))
    save('hud_top_vit.png', vit)
    bot, db = screen(320, 40, '#302010', '#503020')
    db.rectangle([0, 0, 319, 39], outline=rgb('#806040'))
    save('hud_bottom.png', bot)
    dg = canvas(60, 6)
    px = dg.load()
    for k in range(10):
        for y, row in enumerate(DIGITS6[str(k)].split()):
            for x, bit in enumerate(row):
                if bit == '1':
                    px[k * 6 + x, y] = (255, 255, 255, 255)
    save('hud_digits.png', dg)
    le = canvas(9, 7, rgb('#282828'))
    heart(ImageDraw.Draw(le), 0, 0, rgb('#505050'))
    save('hud_life_empty.png', le)
    ti = canvas(272, 15)
    dti = ImageDraw.Draw(ti)
    for k in range(17):
        dti.rectangle([k * 16 + 2, 2, k * 16 + 13, 12], outline=rgb('#d0d0d0'))
    save('tool_icons.png', ti)
    mb = canvas(176, 48, rgb('#203050'))
    ImageDraw.Draw(mb).rectangle([0, 0, 175, 47], outline=rgb('#a0b0d0'), width=2)
    save('msgbox.png', mb)
    mm = canvas(13, 13)
    ImageDraw.Draw(mm).ellipse([1, 1, 11, 11], outline=rgb('#ff4040'), width=2)
    save('map_marker.png', mm)
    sh = canvas(20, 40)
    ImageDraw.Draw(sh).ellipse([2, 2, 9, 9], fill=rgb('#202020'))
    save('shots.png', sh)
    # weapons: one placeholder bank, frames [x, y, w, h, ax, ay]
    ws = canvas(480, 160)
    dw = ImageDraw.Draw(ws)
    meta = {}
    for k in list(range(0, 6)) + list(range(11, 14)) + list(range(24, 36)) + [37, 41]:
        x, y = (k % 12) * 40, (k // 12) * 40
        dw.rectangle([x + 2, y + 6, x + 13, y + 9], fill=BLADE)
        meta[str(k)] = [x, y, 16, 16, 8, 15]
    save('weapons_surface.png', ws)
    save('weapons_water.png', tint(ws, WATER_TINT))
    save_json('weapons.json', meta)
    cp = canvas(128, 17)
    dc = ImageDraw.Draw(cp)
    frames = []
    for k in range(8):
        a = k * math.pi / 4
        dc.line([k * 16 + 8, 8, k * 16 + 8 + 6 * math.sin(a), 8 - 6 * math.cos(a)], fill=rgb('#e04040'), width=2)
        frames.append([k * 16, 0, 16, 17, 8, 8])
    save('compass.png', cp)
    save_json('compass.json', {'anchor': [100, 24], 'frames': frames})
    tr = canvas(400, 16)
    dtr = ImageDraw.Draw(tr)
    tframes = []
    for k in range(25):
        dtr.polygon([(k * 16 + 6, 0), (k * 16 + 12, 5), (k * 16 + 6, 11), (k * 16, 5)], fill=rgb('#60e0ff'))
        tframes.append([k * 16, 0, 13, 12, 6, 11])
    save('treasure.png', tr)
    save_json('treasure.json', {'frames': tframes, 'diamond': [list(range(8)), list(range(8, 16)), list(range(16, 24))],
                                'heart': 24, 'sky': [['#204080'] * 46 for _ in range(4)]})
    ma = canvas(64, 16)
    save('map_actors.png', ma)
    save_json('map_actors.json', {'banks': {}, 'frames': {}, 'order': [], 'mem': [], 'actors': [], 'scripts': {}})


def main():
    os.makedirs(OUT, exist_ok=True)
    font_assets()
    for n in range(1, 5):
        level_assets(n)
    player_assets()
    screens_assets()
    hud_assets()
    print('demo assets ->', OUT, len(os.listdir(OUT)), 'files')


if __name__ == '__main__':
    main()
