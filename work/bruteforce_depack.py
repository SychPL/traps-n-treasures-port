#!/usr/bin/env python3
"""Brute-force polarity/count variants of the depacker; oracle = exact stream exhaustion."""
import struct, sys

src = open(r'I:\Projekty\pirat\work\depack.py').read().split("if __name__")[0]
ns = {}
exec(src, ns)
BackwardBits = ns['BackwardBits']

code = open(r'I:\Projekty\pirat\extracted\loader_code.bin','rb').read()
size, psize = struct.unpack_from('>II', code, 0x128)
blob = code[0x130:0x130+psize]

def run(main_pol, len_pol, off_pol, n2_pol, run_extra, subq_mode):
    bits = BackwardBits(blob)
    out = bytearray(size)
    w = size
    while w > 0:
        b = bits.getbit()
        if b == main_pol:  # literal
            w -= 1; out[w] = bits.getbits(8); continue
        # match length tree
        for base, n in ((1,1),(3,2),(7,4),(23,8)):
            if bits.getbit() == len_pol:
                break
        d4 = base + bits.getbits(n)
        if d4 == 22:
            n2 = 5 if bits.getbit() == n2_pol else 14
            d4 = 14 + bits.getbits(n2)
            cnt = d4 + run_extra
            if cnt <= 0: return None, -9999
            for _ in range(cnt):
                if w <= 0: return None, -9998
                w -= 1; out[w] = bits.getbits(8)
            continue
        if d4 > 22:
            if subq_mode == 0: d4 -= 1
        cnt = d4 + 1
        if not bits.getbit() == off_pol:
            off = 32 + bits.getbits(9)
        elif not bits.getbit() == off_pol:
            off = bits.getbits(5)
        else:
            off = 0x220 + bits.getbits(14)
        if w + off >= size or w - cnt < -1:
            return None, -9997
        for _ in range(cnt):
            w -= 1; out[w] = out[w + off]
    return bytes(out), bits.pos

best = []
for mp in (1, 0):
    for lp in (0, 1):
        for op in (0, 1):
            for np in (1, 0):
                for re_ in (1, 0):
                    for sq in (0, 1):
                        try:
                            out, pos = run(mp, lp, op, np, re_, sq)
                        except Exception:
                            continue
                        if out is not None:
                            best.append((abs(pos), pos, (mp, lp, op, np, re_, sq), out[:16].hex()))

best.sort()
for dist, pos, cfg, head in best[:12]:
    print(f"leftover={pos:+5d} cfg={cfg} head={head}")
if best and best[0][1] == 0:
    out, _ = run(*best[0][2])
    open(r'I:\Projekty\pirat\extracted\stage2.bin','wb').write(out)
    print("\nEXACT MATCH saved to stage2.bin; first 32 bytes:", out[:32].hex())
