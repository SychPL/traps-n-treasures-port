#!/usr/bin/env python3
"""Find Amiga 12-bit palettes: runs of 16 (or 8/32) big-endian words with high nibble 0."""
import struct, sys, glob

def valid_pal(words):
    """Amiga $0RGB colours: each word 0x0RGB, so 0..0xFFF. Score by spread/dark entry."""
    if any(w > 0xFFF for w in words):
        return -1
    uniq = len(set(words))
    dark = sum(1 for w in words if max((w >> 8) & 0xF, (w >> 4) & 0xF, w & 0xF) <= 1)
    spread = len(set(((w >> 8) & 0xF)//4 for w in words))
    return uniq + spread * 3 + (5 if dark >= 1 else 0)

def scan(path, sizes=(16, 32), min_score=None):
    data = open(path, 'rb').read()
    out = []
    for n in sizes:
        for off in range(2, len(data) - n*2, 2):
            words = struct.unpack_from('>%dH' % n, data, off)
            sc = valid_pal(words[:16])
            if sc >= (min_score or 28):
                out.append((off, n, sc, words[:16]))
    return out

for path in [r"I:\Projekty\pirat\extracted\stage2a.bin",
             r"I:\Projekty\pirat\extracted\files\d2_00940c.hunk",
             r"I:\Projekty\pirat\extracted\files\d2_072500.hunk",
             r"I:\Projekty\pirat\extracted\files\d2_03c314.hunk",
             r"I:\Projekty\pirat\extracted\files\d2_056db0.hunk"]:
    res = scan(path)
    print(f"\n=== {path.split(chr(92))[-1]} : {len(res)} candidates ===")
    # dedupe overlapping
    res.sort(key=lambda r: -r[2])
    seen = []
    for off, n, sc, words in res:
        if any(abs(off - s) < 64 for s in seen):
            continue
        seen.append(off)
        print(f"  @{off:#08x} n={n} score={sc}: " + ' '.join(f'{w:03x}' for w in words))
        if len(seen) >= 8:
            break
