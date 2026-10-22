#!/usr/bin/env python3
"""Find OFS file/dir header blocks (type=2, valid checksum) anywhere on disk."""
import struct, sys, os

def check(block):
    s = sum(struct.unpack('>128I', block)) & 0xFFFFFFFF
    return s == 0

def bcpl_str(block, off):
    ln = block[off]
    return block[off+1:off+1+ln].decode('ascii', 'replace')

def scan(path):
    with open(path, 'rb') as f:
        data = f.read()
    print(f"\n=== {os.path.basename(path)} ===")
    headers = []
    for sec in range(2, len(data)//512):
        block = data[sec*512:(sec+1)*512]
        t = struct.unpack_from('>I', block, 0)[0]
        if t == 2 and check(block):
            subtype = struct.unpack_from('>i', block, 0x134)[0]
            own = struct.unpack_from('>I', block, 4)[0]
            high_seq = struct.unpack_from('>I', block, 8)[0]
            # name at 0x1B0 (file/dir header blocks)
            try:
                nm = bcpl_str(block, 0x1B0)
            except Exception:
                nm = '?'
            headers.append((sec, own, high_seq, subtype, nm))
    print(f"found {len(headers)} header blocks:")
    for sec, own, hs, st, nm in headers:
        print(f"  sec {sec:4d}: own={own:5d} blocks={hs:4d} subtype={st:3d} name='{nm}'")

for p in sys.argv[1:]:
    scan(p)
