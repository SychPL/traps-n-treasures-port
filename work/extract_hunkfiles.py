#!/usr/bin/env python3
"""Extract complete Amiga hunk files from ADF images by walking the hunk format."""
import struct, sys, os

def parse_hunk_file(data, pos):
    """Walk a hunk executable starting at pos. Return (end_pos, segments) or None."""
    start = pos
    if struct.unpack_from('>I', data, pos)[0] != 0x3F3:
        return None
    pos += 4
    # resident library names
    while True:
        n = struct.unpack_from('>I', data, pos)[0]
        pos += 4
        if n == 0:
            break
        pos += (n & 0xFFFFFF) * 4
    tsize, first, last = struct.unpack_from('>3I', data, pos)
    pos += 12 + 4 * tsize
    nseg = last - first + 1
    segs = []
    ended = 0
    while ended < nseg:
        magic = struct.unpack_from('>I', data, pos)[0]
        pos += 4
        t = magic & 0x3FFFFFFF
        if t == 0x3E9:  # HUNK_NAME
            n = struct.unpack_from('>I', data, pos)[0]; pos += 4
            pos += (n & 0xFFFFFF) * 4
        elif t in (0x3EA, 0x3EB):  # CODE/DATA
            n = struct.unpack_from('>I', data, pos)[0]; pos += 4
            ln = (n & 0xFFFFFF) * 4
            segs.append((t, pos, ln))
            pos += ln
        elif t == 0x3EC:  # BSS
            n = struct.unpack_from('>I', data, pos)[0]; pos += 4
            segs.append((t, pos, (n & 0xFFFFFF) * 4))
        elif t in (0x3ED, 0x3EE, 0x3EF):  # RELOC32/16/8
            while True:
                count = struct.unpack_from('>I', data, pos)[0]; pos += 4
                if count == 0:
                    break
                pos += 4
                pos += count * (4 if t == 0x3ED else (2 if t == 0x3EE else 1))
        elif t == 0x3F2:  # END
            ended += 1
        elif t == 0x3F6:  # BREAK (overlay)
            ended += 1  # stop at break
            if len(segs) == 0:
                return None
            break
        else:
            return None
    return pos, segs

def scan_disk(data, outdir, tag, lo=0x400, hi=None):
    hi = hi or len(data)
    pos = lo
    found = []
    while pos < hi - 4:
        if struct.unpack_from('>I', data, pos)[0] == 0x3F3:
            r = parse_hunk_file(data, pos)
            if r:
                end, segs = r
                code = [(o, l) for t, o, l in segs if t in (0x3EA, 0x3EB)]
                if not code:
                    pos += 2; continue
                ln = end - pos
                sec = pos // 512
                print(f"[{tag}] hunk @{pos:#08x} (sec {sec:4d}) len={ln:#08x} segs={[(hex(l)) for t,o,l in segs]}")
                fn = os.path.join(outdir, f"{tag}_hunk_{pos:06x}.bin")
                open(fn, 'wb').write(data[pos:end])
                found.append((pos, end))
                pos = end
                continue
        pos += 2
    return found

if __name__ == '__main__':
    outdir = r"I:\Projekty\pirat\extracted\files"
    os.makedirs(outdir, exist_ok=True)
    for path, tag in [
        (r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf", "d1"),
        (r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf", "d2"),
    ]:
        data = open(path, 'rb').read()
        scan_disk(data, outdir, tag)
