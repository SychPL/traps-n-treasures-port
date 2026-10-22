#!/usr/bin/env python3
"""Explore the rootblock of an ADF image to verify OFS layout."""
import struct, sys

path = sys.argv[1]
with open(path, 'rb') as f:
    data = f.read()

print(f"size: {len(data)} bytes = {len(data)//512} sectors")
# bootblock
print("bootblock magic:", data[0:8])
# rootblock = sector 880
root = data[880*512 : 880*512+512]
print("\nrootblock first 96 bytes:")
for off in range(0, 96, 16):
    hexs = ' '.join(f"{b:02x}" for b in root[off:off+16])
    longs = ' '.join(f"{l:>10d}" for l in struct.unpack_from('>4I', root, off))
    print(f"  +0x{off:03x}: {hexs}  | {longs}")

def checksum_ok(block):
    longs = struct.unpack('>128I', block)
    s = sum(longs) & 0xFFFFFFFF
    return s == 0

print("\nrootblock checksum (sum of all longs) == 0 ?", checksum_ok(root))

# scan candidate hash table offsets
for ht_off in (0x04, 0x0C, 0x10):
    vals = struct.unpack_from('>72I', root, ht_off)
    nz = [(i, v) for i, v in enumerate(vals) if v != 0]
    print(f"hashtable@0x{ht_off:02x}: {len(nz)} nonzero: {[(i, hex(v)) for i, v in nz[:10]]}")

# name field candidates
for off in (0x1B0, 0x1B4, 0x1B8, 0x1BC, 0x20C):
    ln = root[off]
    if 1 <= ln <= 30:
        try:
            nm = root[off+1:off+1+ln].decode('ascii')
            print(f"name@0x{off:03x}: len={ln} '{nm}'")
        except UnicodeDecodeError:
            pass
