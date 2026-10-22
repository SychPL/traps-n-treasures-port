#!/usr/bin/env python3
"""Brute-force Amiga bitplane hypotheses; render a montage for visual identification."""
import struct, os, math
from PIL import Image, ImageDraw

OUT = r"I:\Projekty\pirat\remake\assets"
os.makedirs(OUT, exist_ok=True)

DEFAULT_PAL = [(0,0,0),(0x0d,0x0d,0x0d),(0xee,0xee,0xee),(0xff,0xff,0xff),
               (0x22,0x44,0x88),(0x33,0x66,0xbb),(0x44,0x88,0xdd),(0x66,0xaa,0xff),
               (0x88,0x44,0x22),(0xbb,0x66,0x33),(0xdd,0x88,0x44),(0xff,0xaa,0x66),
               (0x22,0x88,0x22),(0x33,0xbb,0x33),(0x44,0xdd,0x55),(0xdd,0x22,0x22),
               (0x66,0x33,0x11),(0x99,0x55,0x22),(0xcc,0x88,0x44),(0xff,0xdd,0xaa),
               (0x11,0x11,0x33),(0x22,0x22,0x66),(0x44,0x44,0x99),(0x77,0x77,0xcc),
               (0x33,0x22,0x11),(0x55,0x44,0x22),(0x88,0x77,0x44),(0xbb,0xaa,0x77),
               (0x00,0x44,0x44),(0x00,0x88,0x88),(0x00,0xcc,0xcc),(0x00,0xff,0xff)]

def planes_to_rows(data, off, w_bytes, h, nplanes, plane_gap=None):
    """Standard Amiga interleaved: row = nplanes consecutive plane-rows."""
    gap = plane_gap if plane_gap is not None else w_bytes
    rows = []
    for y in range(h):
        rowbase = off + y * nplanes * gap
        if rowbase + nplanes*gap > len(data):
            return None
        row = []
        for bx in range(w_bytes):
            pv = [data[rowbase + p*gap + bx] for p in range(nplanes)]
            for bit in range(7, -1, -1):
                v = 0
                for p in range(nplanes):
                    v |= ((pv[p] >> bit) & 1) << p
                row.append(v)
        rows.append(row)
    return rows

def render(rows, pal):
    h = len(rows); w = len(rows[0])
    img = Image.new('RGB', (w, h))
    img.putdata([pal[v % len(pal)] for row in rows for v in row])
    return img

def montage(cells, cols, label_h=10):
    if not cells: return None
    cw = max(c[1].width for c in cells)
    ch = max(c[1].height for c in cells)
    rows = math.ceil(len(cells)/cols)
    W = cols*(cw+4)+4
    Hh = rows*(ch+label_h+4)+4
    m = Image.new('RGB', (W, Hh), (24,28,38))
    d = ImageDraw.Draw(m)
    for i, (label, img) in enumerate(cells):
        gx = 4 + (i % cols)*(cw+4)
        gy = 4 + (i // cols)*(ch+label_h+4)
        m.paste(img, (gx, gy+label_h))
        d.text((gx+1, gy+1), label, fill=(230,230,160))
    return m

def main():
    targets = [
        ("chunk2", r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf",
         0x21BA4, 0x3C314),
        ("chunk3", r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf",
         0x3CE48, 0x56DB0),
        ("d1data", r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf",
         0x7DF4, 0x21118),
    ]
    for tag, path, s, e in targets:
        data = open(path, 'rb').read()
        blob = data[s:e]
        cells = []
        for nplanes in (4, 5):
            for w_bytes in (40, 20, 24, 32, 16):
                h = min(200, len(blob)//(nplanes*w_bytes))
                if h < 20: continue
                rows = planes_to_rows(data, s, w_bytes, h, nplanes)
                if not rows: continue
                img = render(rows, DEFAULT_PAL)
                cells.append((f"{nplanes}pl w{w_bytes*8} h{h}", img))
        m = montage(cells, 5)
        if m:
            fn = os.path.join(OUT, f"probe_{tag}.png")
            m.save(fn)
            print(f"saved {fn} ({m.width}x{m.height}, {len(cells)} cells)")

main()
