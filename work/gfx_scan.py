#!/usr/bin/env python3
"""Skan regionu SEG2#1 na dysku 1: renderuje okna jako bitplane'y (arkusz kontaktowy)."""
import math, os
from PIL import Image, ImageDraw

PATH = r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf"
OUT = r"I:\Projekty\pirat\remake\assets"

def pal_gray(n=32):
    return [((i * 255) // (n - 1),) * 3 for i in range(n)]

def pal_sepia(n=32):
    out = []
    for i in range(n):
        v = (i * 255) // (n - 1)
        out.append((min(255, v + 20), min(255, int(v * 0.85) + 10), int(v * 0.6)))
    return out

def decode(data, off, w_bytes, h, nplanes):
    stride = w_bytes * nplanes
    rows = []
    for y in range(h):
        base = off + y * stride
        if base + stride > len(data):
            return None
        planes = [data[base + p * w_bytes: base + (p + 1) * w_bytes] for p in range(nplanes)]
        row = []
        for bx in range(w_bytes):
            vals = [planes[p][bx] for p in range(nplanes)]
            for bit in range(7, -1, -1):
                v = 0
                for p in range(nplanes):
                    v |= ((vals[p] >> bit) & 1) << p
                row.append(v)
        rows.append(row)
    return rows

def render(rows, pal):
    h, w = len(rows), len(rows[0])
    img = Image.new('RGB', (w, h))
    img.putdata([pal[v % len(pal)] for row in rows for v in row])
    return img

def main():
    data = open(PATH, 'rb').read()
    lo, hi = 0x21128, 0x51600
    planes = 5
    w_bytes = 40
    h = 100
    step = 0x1000
    cells = []
    off = lo
    while off < hi - planes * w_bytes * h:
        rows = decode(data, off, w_bytes, h, planes)
        if rows:
            cells.append(("0x%06x" % off, render(rows, pal_gray(32))))
        off += step
    cols = 8
    cw, ch = 320, 100
    lbl = 10
    rowsn = math.ceil(len(cells) / cols)
    m = Image.new('RGB', (cols * (cw + 4) + 4, rowsn * (ch + lbl + 4) + 4), (20, 24, 32))
    d = ImageDraw.Draw(m)
    for i, (label, img) in enumerate(cells):
        gx = 4 + (i % cols) * (cw + 4)
        gy = 4 + (i // cols) * (ch + lbl + 4)
        m.paste(img, (gx, gy + lbl))
        d.text((gx + 1, gy + 1), label, fill=(230, 230, 160))
    fn = os.path.join(OUT, "scan_seg2_1.png")
    m.save(fn)
    print("saved", fn, m.size, "cells:", len(cells))

main()
