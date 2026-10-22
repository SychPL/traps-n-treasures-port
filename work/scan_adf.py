#!/usr/bin/env python3
"""Scan ADF images: rootblocks, hunk magics, strings, structure."""
import struct, sys, glob, os

def scan(path):
    with open(path, 'rb') as f:
        data = f.read()
    name = os.path.basename(path)
    print(f"\n=== {name} ===")
    print(f"bootblock: {data[:4]}  root(880): {data[880*512:880*512+4].hex()}")

    # scan for hunk block magics every longword
    hunks = {}
    for off in range(0, len(data) - 4, 4):
        magic = struct.unpack_from('>I', data, off)[0]
        if magic in (0x3E7, 0x3E8, 0x3E9, 0x3EA, 0x3EB, 0x3EC, 0x3ED, 0x3EE, 0x3EF,
                     0x3F0, 0x3F1, 0x3F2, 0x3F3, 0x3F4, 0x3F5, 0x3F6, 0x3F7, 0x3F8, 0x3F9):
            hunks.setdefault(magic, []).append(off)

    interesting = {0x3F3: 'HUNK_HEADER', 0x3E7: 'HUNK_UNIT?', 0x3E9: 'HUNK_NAME',
                   0x3EA: 'HUNK_CODE', 0x3EB: 'HUNK_DATA', 0x3EC: 'HUNK_BSS',
                   0x3F2: 'HUNK_END', 0x3F5: 'HUNK_OVERLAY?'}
    for magic, label in interesting.items():
        if magic in hunks:
            offs = hunks[magic]
            print(f"  {label} (0x{magic:x}): {len(offs)}x at sectors {[o//512 for o in offs[:20]]}")

    # strings at least 6 chars
    import re
    strings = [(m.start(), m.group().decode('ascii')) for m in
               re.finditer(rb'[\x20-\x7e]{6,}', data)]
    # filter obvious code noise: keep strings with spaces or meaningful words
    good = [(o, s) for o, s in strings if
            (' ' in s or '_' in s or '.' in s) and len(s) >= 8]
    print(f"  strings>=8 w/ space: {len(good)}; first 60:")
    for o, s in good[:60]:
        print(f"    sec {o//512:4d} +0x{o%512:03x}: {s[:80]}")

for p in sorted(glob.glob(r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\*.adf")):
    scan(p)
