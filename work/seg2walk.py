#!/usr/bin/env python3
"""Walk the GAME EXEC SEG2 file chain on the disks.
Layout (from loader @ $7a872):
  "SEG2" d2 d3 d4
  seg1[d2]  RLOC rel1 RLOC rel2 RLOC rel3
  seg2[d3]  RLOC rel4 RLOC rel5 RLOC rel6
  (seg3 = d4 bytes BSS, no file data)
Each rel block: count:4, then delta-encoded offsets (word; 0 -> long).
"""
import struct, sys

RLOC = 0x524C4F43

def parse_relocs(data, pos):
    count = struct.unpack_from('>I', data, pos)[0]; pos += 4
    acc = 0
    for _ in range(count):
        w = struct.unpack_from('>h', data, pos)[0]; pos += 2
        if w == 0:
            w = struct.unpack_from('>i', data, pos)[0]; pos += 4
        acc += w
    return count, pos

def expect(data, pos, magic_val=RLOC, name="RLOC"):
    v = struct.unpack_from('>I', data, pos)[0]
    if v != magic_val:
        raise ValueError(f"missing {name} @{pos:#x}: got {v:#x}")
    return pos + 4

def parse_seg2(data, pos):
    """Returns dict or raises."""
    start = pos
    if data[pos:pos+4] != b'SEG2':
        raise ValueError(f"not SEG2 @{pos:#x}")
    d2, d3, d4 = struct.unpack_from('>III', data, pos+4)
    pos += 16
    seg1_off = pos
    pos += d2
    counts = []
    for _ in range(3):
        pos = expect(data, pos)
        c, pos = parse_relocs(data, pos)
        counts.append(c)
    seg2_off = pos
    pos += d3
    for _ in range(3):
        pos = expect(data, pos)
        c, pos = parse_relocs(data, pos)
        counts.append(c)
    return dict(start=start, end=pos, d2=d2, d3=d3, d4=d4,
                seg1_off=seg1_off, seg2_off=seg2_off, counts=counts)

def walk(data, start, limit, label=""):
    pos = start
    n = 0
    while pos + 16 < limit:
        # optional CHW header (0x14 bytes)
        if data[pos:pos+4] == b'CHW\x00':
            ver, flg = struct.unpack_from('>HH', data, pos+4)
            sz = struct.unpack_from('>I', data, pos+0x10)[0]
            print(f"[{label}] @{pos:#08x} (sec {pos//512:4d}) CHW ver={ver:#x} flg={flg} sz={sz:#x}")
            pos += 0x14
        try:
            f = parse_seg2(data, pos)
        except (ValueError, struct.error) as e:
            print(f"[{label}] stop @{pos:#08x} (sec {pos//512}): {e}; next bytes: {data[pos:pos+16].hex(' ')}")
            return n
        print(f"[{label}] @{f['start']:#08x} (sec {f['start']//512:4d}) SEG2 #{n}: seg1={f['d2']:#08x} seg2={f['d3']:#08x} bss={f['d4']:#08x} relocs={f['counts']} total={f['end']-f['start']:#08x}")
        n += 1
        pos = f['end']
        # skip zero padding between files
        while pos < limit and data[pos] == 0:
            pos += 1
        pos &= ~1
    return n

if __name__ == '__main__':
    d1 = open(r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf", 'rb').read()
    d2 = open(r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf", 'rb').read()
    print("--- DISK 1 ---")
    walk(d1, 0x3200, 0x6E000, "D1")
    print("\n--- DISK 2 ---")
    walk(d2, 0x3200, 0x6E000, "D2")
