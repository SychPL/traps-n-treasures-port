#!/usr/bin/env python3
"""Oracle-based chunk scan: a real cruncher chunk depacks exactly."""
import struct, sys

src = open(r'I:\Projekty\pirat\work\depack.py').read().split("if __name__")[0]
ns = {}
exec(src, ns)
BackwardBits, depack = ns['BackwardBits'], ns['depack']

def try_chunk(data, off, max_ops=3_000_000):
    """Try to depack a chunk headered at off. Returns (out_bytes|None, leftover)."""
    if off + 8 > len(data):
        return None, None
    out_size, packed = struct.unpack_from('>II', data, off)
    if not (0x40 <= packed <= 0xE000) or not (packed <= out_size <= 0x40000):
        return None, None
    blob = data[off+8:off+8+packed]
    if len(blob) < packed:
        return None, None
    try:
        bits = BackwardBits(blob)
        out = bytearray(out_size)
        w = out_size
        ops = 0
        while w > 0:
            ops += 1
            if ops > max_ops:
                return None, None
            if bits.getbit():
                w -= 1; out[w] = bits.getbits(8); continue
            if bits.getbit() == 0:   base, n = 1, 1
            elif bits.getbit() == 0: base, n = 3, 2
            elif bits.getbit() == 0: base, n = 7, 4
            else:                    base, n = 23, 8
            d4 = base + bits.getbits(n)
            if d4 == 22:
                n2 = 5 if bits.getbit() else 14
                d4 = 14 + bits.getbits(n2)
                for _ in range(d4 + 1):
                    w -= 1; out[w] = bits.getbits(8)
                continue
            if d4 > 22:
                d4 -= 1
            if not bits.getbit():
                offv = 32 + bits.getbits(9)
            elif not bits.getbit():
                offv = bits.getbits(5)
            else:
                offv = 0x220 + bits.getbits(14)
            for _ in range(d4 + 1):
                w -= 1
                out[w] = out[w + offv]
        return bytes(out), bits.pos - len(blob)   # leftover relative to blob start
    except IndexError:
        return None, None

def scan(path, start_off=0x400, end_off=None):
    data = open(path, 'rb').read()
    end = end_off or len(data)
    found = []
    off = start_off
    while off < end - 8:
        out, leftover = try_chunk(data, off)
        if out is not None and -8 <= leftover <= 8:
            out_size, packed = struct.unpack_from('>II', data, off)
            found.append((off, out_size, packed, out))
            print(f"CHUNK @{off:#08x} (sec {off//512:4d}+{off%512:03d}): out={out_size:#08x} packed={packed:#06x} leftover={leftover}")
            off += 8 + packed
            continue
        off += 2
    return found

if __name__ == '__main__':
    path = sys.argv[1]
    start = int(sys.argv[2], 0) if len(sys.argv) > 2 else 0x400
    end = int(sys.argv[3], 0) if len(sys.argv) > 3 else None
    chunks = scan(path, start, end)
    print(f"\n{len(chunks)} chunks found")
