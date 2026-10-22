#!/usr/bin/env python3
"""Zrzut bufora obrazu vAmigaWeb (<nazwa>_<W>x<H>.rgba) -> PNG 1:1 w pikselach lowres.

Bufor ma 4 piksele na lowres piksel w poziomie (superhires) i obejmuje cale wygaszanie;
przycinamy do obszaru z trescia i skalujemy poziomo /4.
Uzycie: python work/shot2png.py work/dumps/shot_x_1824x313.rgba [...]
"""
import re, sys
from PIL import Image

for path in sys.argv[1:]:
    w, h = map(int, re.search(r'_(\d+)x(\d+)\.rgba$', path).groups())
    img = Image.frombytes('RGBA', (w, h), open(path, 'rb').read()).convert('RGB')
    box = img.point(lambda v: 255 if v > 8 else 0).getbbox() or (0, 0, w, h)
    img = img.crop(box)
    img = img.resize((max(1, img.width // 4), img.height), Image.NEAREST)
    out = path[:-5] + '.png'
    img.save(out)
    print(out, img.size, 'crop', box)
