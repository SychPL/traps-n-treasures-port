#!/usr/bin/env python3
"""Dekoduje sprite'y sprzetowe Amigi ze zrzutu chip RAM (wskazniki SPRxPT z copper listy gry).

Pary 0/1 i 2/3 (bit ATTACH w SPRxCTL nieparzystego) -> 15 kolorow (16-31), inaczej 3 kolory.
Uzycie: python work/sprites.py work/dumps/lvl1_f [copper_hex]  -> <prefix>_spr.png
"""
import struct, sys, os
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump_view import find_copper_lists, events, rgb


def sprite_ptrs_and_palette(chip, cop, line=55):
    ptr, pal = [0] * 8, [0] * 32
    for ln, reg, val in events(dict(find_copper_lists(chip[:0x70000]))[cop]):
        if 0x120 <= reg <= 0x13E:
            i, lo = (reg - 0x120) // 4, (reg - 0x120) % 4
            ptr[i] = (ptr[i] & 0xFFFF) | (val << 16) if lo == 0 else (ptr[i] & 0xFFFF0000) | val
        if 0x180 <= reg <= 0x1BE and ln <= line:
            pal[(reg - 0x180) // 2] = val
    return ptr, pal


def read_sprite(chip, a):
    """-> (hstart, vstart, attach, [(data, datb), ...]) dla pierwszego sprite'a w lancuchu."""
    pos, ctl = struct.unpack_from('>HH', chip, a)
    vstart = (pos >> 8) | ((ctl & 4) << 6)
    vstop = (ctl >> 8) | ((ctl & 2) << 7)
    hstart = ((pos & 0xFF) << 1) | (ctl & 1)
    rows = [struct.unpack_from('>HH', chip, a + 4 + 4 * i) for i in range(max(0, vstop - vstart))]
    return hstart, vstart, bool(ctl & 0x80), rows


def pair_image(chip, pa, pb, pal):
    """sprite parzysty + nieparzysty (attached) -> obraz RGBA 16 px szer."""
    h0, v0, _, r0 = read_sprite(chip, pa)
    h1, v1, att, r1 = read_sprite(chip, pb)
    n = max(len(r0), len(r1))
    img = Image.new('RGBA', (16, n))
    for y in range(n):
        a0, b0 = r0[y] if y < len(r0) else (0, 0)
        a1, b1 = r1[y] if y < len(r1) else (0, 0)
        for x in range(16):
            s = 15 - x
            c = (a0 >> s & 1) | (b0 >> s & 1) << 1 | (a1 >> s & 1) << 2 | (b1 >> s & 1) << 3
            if c:
                img.putpixel((x, y), rgb(pal[16 + c]) + (255,))
    return img, (h0, v0, att)


if __name__ == '__main__':
    prefix = sys.argv[1]
    cop = int(sys.argv[2], 16) if len(sys.argv) > 2 else 0xCDC0
    chip = open(prefix + '_chip.bin', 'rb').read()
    ptr, pal = sprite_ptrs_and_palette(chip, cop)
    print('SPRxPT', [hex(p) for p in ptr])
    left, (h0, v0, att) = pair_image(chip, ptr[0], ptr[1], pal)
    right, (h2, v2, _) = pair_image(chip, ptr[2], ptr[3], pal)
    print('pair0 h=%d v=%d attach=%s %s, pair1 h=%d v=%d' % (h0, v0, att, left.size, h2, v2))
    img = Image.new('RGBA', (16 + max(0, h2 - h0) + 16, max(left.height, right.height)))
    img.alpha_composite(left, (0, 0)); img.alpha_composite(right, (max(0, h2 - h0), v2 - v0 if v2 >= v0 else 0))
    img.resize((img.width * 4, img.height * 4), Image.NEAREST).save(prefix + '_spr.png')
    print(prefix + '_spr.png', img.size)
