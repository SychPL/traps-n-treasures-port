#!/usr/bin/env python3
"""Carve bootblock and inspect the hunk at sector 880 of disk 1."""
import struct

path = r"I:\Projekty\pirat\Traps-n-Treasures_Amiga_EN\Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 1 of 2).adf"
with open(path, 'rb') as f:
    data = f.read()

# bootblock
bb = data[0:1024]
with open(r'I:\Projekty\pirat\extracted\bootblock.bin', 'wb') as f:
    f.write(bb)
print("bootblock saved (1024 B)")
print("bb magic+chksum+flags:", bb[:12].hex())
print("bb code first 64 bytes @0xC:")
for off in range(0x0C, 0x0C+64, 16):
    print(f"  +{off:#04x}: {' '.join(f'{b:02x}' for b in bb[off:off+16])}")
print("string near +0x58:", bb[0x40:0x90])

# hunk at sector 880
off = 880*512
print(f"\nhunk @ sector 880, first 128 bytes:")
for o in range(0, 128, 16):
    addr = off + o
    row = data[addr:addr+16]
    print(f"  +{o:#04x} (sec {880 + o//512}): {' '.join(f'{b:02x}' for b in row)}  |{''.join(chr(b) if 32<=b<127 else '.' for b in row)}|")

# dump longs
print("\nlongs:")
for o in range(0, 64, 4):
    print(f"  +{o:#04x}: {struct.unpack_from('>I', data, off+o)[0]:#010x}")
