#!/usr/bin/env python3
"""Content-aware carving of all game files from both ADFs.
Self-delimiting formats: Amiga hunk executables, MMD0 modules.
Other regions: bounded by the next recognizable structure."""
import struct, os, re

OUT = r"I:\Projekty\pirat\extracted\files"
os.makedirs(OUT, exist_ok=True)

def hunk_end(data, pos):
    """Walk a hunk file (GAME EXEC variant: header, CODE(chip), BSS, plain-long reloc lists, END)."""
    start = pos
    if struct.unpack_from('>I', data, pos)[0] & 0x3FFFFFFF != 0x3F3:
        return None
    pos += 4
    while True:
        n = struct.unpack_from('>I', data, pos)[0]; pos += 4
        if n == 0: break
        pos += (n & 0xFFFFFF) * 4
    tsize, first, last = struct.unpack_from('>3I', data, pos)
    pos += 12 + 4 * tsize
    nseg = last - first + 1
    ended = 0
    segs = []
    while ended < nseg:
        if pos + 4 > len(data): return None
        magic = struct.unpack_from('>I', data, pos)[0]
        t = magic & 0x3FFFFFFF
        pos += 4
        if t == 0x3E9:
            n = struct.unpack_from('>I', data, pos)[0]; pos += 4 + (n & 0xFFFFFF) * 4
        elif t in (0x3EA, 0x3EB):
            n = struct.unpack_from('>I', data, pos)[0]
            ln = (n & 0xFFFFFF) * 4
            segs.append(('code', pos, ln)); pos += ln
        elif t == 0x3EC:
            n = struct.unpack_from('>I', data, pos)[0]
            segs.append(('bss', pos, (n & 0xFFFFFF) * 4)); pos += 4
        elif t == 0x3F2:
            ended += 1
        else:
            # wariant GAME EXEC: po segmencie goła lista relokacji (rosnące
            # longi) zakończona parą (0, HUNK_END)
            if pos + 8 > len(data): return None
            guard = 0
            while True:
                v1 = struct.unpack_from('>I', data, pos)[0]
                v2 = struct.unpack_from('>I', data, pos+4)[0]
                if v1 == 0 and v2 == 0x3F2:
                    pos += 8
                    ended += 1
                    break
                pos += 4
                guard += 1
                if guard > 20000 or pos + 8 > len(data): return None
    # jednostkowe END-y bywają po każdym segmencie; dobierz koniec po ostatnim END
    return pos, segs

def carve(data, tag):
    files = []
    pos = 0x7DF0  # za nagłówkiem modułu boot (0x7DD8..0x7DF0)
    n = 0
    while pos < 0x6E000:
        # pomiń wyrównanie/padding zer (i śmieci)
        if data[pos] == 0 and data[pos+1] == 0 and data[pos+2] == 0 and data[pos+3] == 0:
            pos += 2
            continue
        v = struct.unpack_from('>I', data, pos)[0]
        t = v & 0x3FFFFFFF
        if t == 0x3F3:
            r = hunk_end(data, pos)
            if r:
                end, segs = r
                if any(s[0] == 'code' for s in segs) and 64 < end - pos < 0x20000:
                    files.append((pos, end, 'hunk', segs))
                    pos = (end + 1) & ~1
                    n += 1
                    continue
        if data[pos:pos+4] == b'MMD0':
            # długość modułu: znajdź następny hunk/strukturę — ostrożnie:
            # MMD0: expLen@+4; załóż granicę = następny wpis {.. size} przed hunkiem
            files.append((pos, None, 'mmd0', None))
            # przeskok heurystyczny: następny 0x3F3/3F2 po +0x200
            pos += 2
            continue
        pos += 2
    # doprecyzuj MMD0
    out = []
    for i, (s, e, ty, segs) in enumerate(files):
        if ty == 'mmd0':
            nxt = files[i+1][0] if i + 1 < len(files) else s + 0x2000
            e = nxt - 6
            # heurystycznie: size-word przed następnym plikiem
            out.append((s, e, 'mmd0', None))
        else:
            out.append((s, e, ty, segs))
    return out

for path, tag in [
    (r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf", "d1"),
    (r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf", "d2"),
]:
    data = open(path, 'rb').read()
    print(f"=== {tag} ===")
    for s, e, ty, segs in carve(data, tag):
        if ty == 'hunk':
            print(f"  {s:#08x}..{e:#08x} len={e-s:#07x} hunk segs={[(t, hex(l)) for t,_,l in segs]}")
            open(os.path.join(OUT, f"{tag}_{s:06x}.hunk"), 'wb').write(data[s:e])
        else:
            print(f"  {s:#08x}..{e and hex(e)} {ty}")
            if e:
                open(os.path.join(OUT, f"{tag}_{s:06x}.mmd0"), 'wb').write(data[s:e])
