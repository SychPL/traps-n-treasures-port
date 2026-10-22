#!/usr/bin/env python3
"""Render candidate Amiga palettes and probe bitplane decoding of nearby data."""
import struct, os, json

OUT = r"I:\Projekty\pirat\remake\assets"
os.makedirs(OUT, exist_ok=True)

def amiga_rgb(w):
    """Amiga $0RGB word -> 8-bit RGB (nibble*17)."""
    r = ((w >> 8) & 0xF) * 17
    g = ((w >> 4) & 0xF) * 17
    b = (w & 0xF) * 17
    return (r, g, b)

def find_palettes(data, n=16, min_uniq=12, min_spread=5, step=2, lo=0, hi=None):
    """Runs of n words <=0xFFF that look like a real palette."""
    hi = hi or len(data) - n*2
    out = []
    for off in range(lo, hi, step):
        words = struct.unpack_from('>%dH' % n, data, off)
        if any(w > 0xFFF for w in words):
            continue
        if len(set(words)) < min_uniq:
            continue
        # require a ramp-like structure: several monotonic-ish runs
        spread = len(set(((w >> 8) & 0xF) for w in words))
        if spread < min_spread:
            continue
        out.append((off, words))
    return out

def planes_to_img(data, off, w_bytes, h, nplanes, stride=None):
    """Decode standard Amiga interleaved bitplanes: for each row, nplanes planes of w_bytes."""
    stride = stride or (w_bytes * nplanes)
    px = []
    for y in range(h):
        rowbase = off + y * stride
        if rowbase + stride > len(data):
            break
        planes = [data[rowbase + p*w_bytes : rowbase + (p+1)*w_bytes] for p in range(nplanes)]
        row = []
        for x in range(w_bytes):
            v = 0
            for p in range(nplanes):
                bit = (planes[p][x] >> (7 - (x % 8))) & 1 if x < len(planes[p]) else 0
            # correct per-pixel extraction below
            row.append(0)
        # proper per-pixel
        row = []
        for bx in range(w_bytes):
            byte_vals = [planes[p][bx] for p in range(nplanes)]
            for bit in range(7, -1, -1):
                v = 0
                for p in range(nplanes):
                    v |= ((byte_vals[p] >> bit) & 1) << p
                row.append(v)
        px.append(row)
    return px

def pil_save(rows, palette, path):
    try:
        from PIL import Image
    except ImportError:
        return False
    h = len(rows)
    w = len(rows[0]) if h else 0
    img = Image.new('RGB', (w, h))
    img.putdata([palette[v % len(palette)] for row in rows for v in row])
    img.save(path)
    return True

if __name__ == '__main__':
    targets = [
        (r"I:\Projekty\pirat\extracted\files\d2_072500.hunk", 0x72500, "levels"),
        (r"I:\Projekty\pirat\extracted\files\d2_00940c.hunk", 0x940C, "prog1"),
        (r"I:\Projekty\pirat\extracted\stage2a.bin", 0x70000, "gameexec"),
    ]
    report = []
    for path, base, tag in targets:
        data = open(path, 'rb').read()
        pals = find_palettes(data)
        print(f"\n=== {tag} ({os.path.basename(path)}): {len(pals)} palettes ===")
        for off, words in pals[:40]:
            pal = [amiga_rgb(w) for w in words]
            print(f"  @{base+off:#08x}: " + ' '.join(f'{w:03x}' for w in words))
            # render swatch strip
            try:
                from PIL import Image
                strip = Image.new('RGB', (16*16, 24))
                for i, c in enumerate(pal):
                    for y in range(24):
                        for x in range(16):
                            strip.putpixel((i*16+x, y), c)
                strip.save(os.path.join(OUT, f"pal_{tag}_{off:06x}.png"))
            except ImportError:
                pass
            report.append(dict(tag=tag, file=os.path.basename(path), abs=f"0x{base+off:06x}",
                               words=[f"{w:03x}" for w in words]))
    json.dump(report, open(os.path.join(OUT, "palettes.json"), "w"), indent=1)
    print(f"\nsaved {len(report)} palettes -> assets/palettes.json")
