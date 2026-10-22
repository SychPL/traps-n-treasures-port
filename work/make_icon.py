#!/usr/bin/env python3
"""Ikona APK z ekranu tytulowego (game/assets/title.png) -> android/app/src/main/res/mipmap-*

Kadr 144x144 z glowa pirata, powiekszony 3x nearest-neighbor (432 px = 108 dp na xxxhdpi),
mniejsze gestosci zmniejszane z tego wzorca. Adaptive icon (API 26+): foreground = caly kadr
(launcher pokazuje srodkowe 72 z 108 dp, czyli srodkowe 96 px kadru), tlo = kolor nieba
w values/ic_launcher_background.xml. Starsze Androidy: ic_launcher(_round).png ze srodka kadru.
Uzycie: python work/make_icon.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
CROP = (128, 62, 272, 206)                     # 144x144, glowa z kapeluszem w srodkowych 96 px
DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def mask(size, round_):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    if round_:
        d.ellipse((0, 0, size - 1, size - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 8, fill=255)
    return m


def scaled(img, size):
    return img if img.width == size else img.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    src = Image.open(os.path.join(ROOT, 'game', 'assets', 'title.png')).convert('RGB').crop(CROP)
    fg = src.resize((432, 432), Image.NEAREST)
    legacy = fg.crop((72, 72, 360, 360))          # srodkowe 72 dp, to co widac w adaptive icon
    for name, s in DENSITIES.items():
        d = os.path.join(RES, 'mipmap-' + name)
        scaled(fg, round(108 * s)).save(os.path.join(d, 'ic_launcher_foreground.png'))
        n = round(48 * s)
        for fn, round_ in (('ic_launcher.png', False), ('ic_launcher_round.png', True)):
            icon = scaled(legacy, n).convert('RGBA')
            icon.putalpha(mask(n, round_))
            icon.save(os.path.join(d, fn))
