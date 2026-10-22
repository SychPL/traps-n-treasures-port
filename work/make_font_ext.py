#!/usr/bin/env python3
"""Polskie litery dla fontu gry (8x9, tylko wielkie litery w wierszach 1-7).

Glif rozszerzony = 8x12: 2 wiersze nad komorka (kreska, kropka), komorka 9 wierszy z litera bazowa
bez zmian, 1 wiersz pod (ogonek). Silnik rysuje go 2 px wyzej niz zwykly znak, wiec litera stoi na
tej samej linii. Ozdobniki w wierszu 0 komorki (N, O, S) sa usuwane, zeby nie zlewaly sie z kreska.
Wyjscie: game/assets/font_ext.png + font_ext.json {znak: indeks}. Kolejny jezyk = dopisac znaki
do GLYPHS (litera bazowa + wzor nad/pod) i uruchomic ponownie.
Uzycie: python work/make_font_ext.py
"""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACUTE = ['....##..', '...##...']
DOT = ['...##...', '...##...']
# znak: (litera bazowa, 2 wiersze nad, wiersze do dorysowania w komorce {wiersz: wzor}, wiersz pod)
GLYPHS = {
    'Ą': ('A', None, {8: '......#.'}, '.......#'),
    'Ć': ('C', ACUTE, {}, None),
    'Ę': ('E', None, {8: '....#...'}, '.....##.'),
    'Ł': ('L', None, {3: '.####...', 4: '###.....'}, None),
    'Ń': ('N', ACUTE, {}, None),
    'Ó': ('O', ACUTE, {}, None),
    'Ś': ('S', ACUTE, {}, None),
    'Ź': ('Z', ACUTE, {}, None),
    'Ż': ('Z', DOT, {}, None),
}

if __name__ == '__main__':
    font = Image.open(os.path.join(ROOT, 'game', 'assets', 'font.png')).convert('RGBA')
    fmap = json.load(open(os.path.join(ROOT, 'game', 'assets', 'font.json')))
    out = Image.new('RGBA', (8 * len(GLYPHS), 12))
    white = (255, 255, 255, 255)
    for k, (ch, (base, above, extra, below)) in enumerate(GLYPHS.items()):
        i = fmap[base]
        cell = font.crop((i % 16 * 8, i // 16 * 9, i % 16 * 8 + 8, i // 16 * 9 + 9))
        if above:                                   # wiersz 0 komorki pod kreske/kropke: wyczysc ozdobnik
            for x in range(8):
                cell.putpixel((x, 0), (0, 0, 0, 0))
        out.paste(cell, (8 * k, 2))
        rows = {r + 2: p for r, p in extra.items()}
        if above:
            rows.update({0: above[0], 1: above[1]})
        if below:
            rows[11] = below
        for y, pat in rows.items():
            for x, c in enumerate(pat):
                if c == '#':
                    out.putpixel((8 * k + x, y), white)
    out.save(os.path.join(ROOT, 'game', 'assets', 'font_ext.png'))
    json.dump({ch: k for k, ch in enumerate(GLYPHS)}, open(os.path.join(ROOT, 'game', 'assets', 'font_ext.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(len(GLYPHS), 'glifow ->', 'game/assets/font_ext.png')
