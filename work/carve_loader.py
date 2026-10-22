#!/usr/bin/env python3
"""Carve loader code (no hunk header) and dump the load table at PC+0x122."""
import struct

path = r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf"
with open(path, 'rb') as f:
    data = f.read()

base = 880 * 512
# code = file offset base+0x20, length 0x1CD longs = 0x734
code = data[base+0x20 : base+0x20+0x734]
with open(r'I:\Projekty\pirat\extracted\loader_code.bin', 'wb') as f:
    f.write(code)
print(f"loader code: {len(code)} bytes, entry at $60020 = code+0")

# dump longs from code offset 0x128 (the table LEA points to)
print("\ntable region @ code+0x128 ($60020+0x128 = $60148):")
for o in range(0x128, min(0x734, 0x128+0x100), 4):
    v = struct.unpack_from('>I', code, o)[0]
    print(f"  code+{o:#05x} (${0x60020+o:#07x}): {v:#010x} ({v})")
