#!/usr/bin/env python3
"""Porownanie ekranu emulatora (zrzut T.shot: <nazwa>_1824x313.rgba) z ekranem portu (canvas 320 x 256 -> PNG).

Bufor emulatora ma 4 piksele na piksel lowres w poziomie; przesuniecie ekranu gry w buforze szukane automatycznie
(najmniej roznic w gornych 211 wierszach portu: HUD + plansza). Kolory porownywane po zaokragleniu do 4 bitow
na skladowa (paleta Amigi). Wynik: liczba roznych pikseli, ramka roznic i obraz <out>: emulator | port | roznice.
Uzycie: python work/cmp_screen.py emu.rgba port.png out.png [wysokosc=211]
"""
import re, sys
from PIL import Image, ImageChops

emu_p, port_p, out_p = sys.argv[1:4]
H = int(sys.argv[4]) if len(sys.argv) > 4 else 211
w, h = map(int, re.search(r'_(\d+)x(\d+)\.rgba$', emu_p).groups())
raw = Image.frombytes('RGBA', (w, h), open(emu_p, 'rb').read()).convert('RGB')
emu = raw.resize((w // 4, h), Image.NEAREST).point(lambda v: round(v / 17) * 17)
port = Image.open(port_p).convert('RGB').crop((0, 0, 320, H)).point(lambda v: round(v / 17) * 17)
small = port.resize((80, H // 4), Image.NEAREST)
best = None
for oy in range(0, h - H + 1):
    for ox in range(0, w // 4 - 320 + 1):
        e = emu.crop((ox, oy, ox + 320, oy + H)).resize((80, H // 4), Image.NEAREST)
        d = sum(1 for p in ImageChops.difference(e, small).convert('L').get_flattened_data() if p > 20)
        if best is None or d < best[0]:
            best = (d, ox, oy)
_, ox, oy = best
e = emu.crop((ox, oy, ox + 320, oy + H))
diff = ImageChops.difference(e, port).convert('L').point(lambda v: 255 if v > 20 else 0)
n = sum(1 for p in diff.get_flattened_data() if p)
print('offset', ox, oy, 'diff', n, 'bbox', diff.getbbox())
out = Image.new('RGB', (960, H)); out.paste(e, (0, 0)); out.paste(port, (320, 0)); out.paste(diff.convert('RGB'), (640, 0))
out.resize((1920, H * 2), Image.NEAREST).save(out_p)
