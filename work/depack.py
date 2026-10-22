#!/usr/bin/env python3
"""Depacker for the backward-LZ cruncher found in the TnT boot loader.

Semantics lifted verbatim from the M68k code at $60020 (disk 1, sector 880):
- getbit: consumes bit0 of 32-bit window d6; refill pulls 16-bit words backwards
  from the source and returns pre-shift bit0 (refill path via move.w d6,d0; lsr.w #1,d0).
- getbits(n): d0 = low16(d6); d6 >>= n; d7 -= n; if d7 <= 0: d7 += 16;
  ror.l d7,d6; fetch word into low half; rol.l d7,d6; return d0 & mask[n].
- main loop (write pointer walks backwards from dest end):
    bit=1 -> literal byte (getbits(8))
    bit=0 -> length code via unary-ish tree: base/n in (1,1)(3,2)(7,4)(23,8)
             d4 = base+bits; if d4==22: long-literal run len=14+bits(5|14),
             write d4+1 fresh bytes; elif d4>22: d4-=1
             offset: bit; 0 -> 32+bits(9); 1 -> bit; 0 -> bits(5); 1 -> 0x220+bits(14)
             copy d4+1 bytes: out[w-1] = out[w-1+off]
"""
import struct, sys

MASK = [(1 << n) - 1 for n in range(17)]

class BackwardBits:
    def __init__(self, mem):
        # mem = full packed blob; pos = index one-past-end; reads go backwards
        self.mem = mem
        self.pos = len(mem)
        d0 = self.fetch_word()
        self.d6 = self.fetch_long()
        self.d7 = 16 - d0
        self.d6 >>= self.d7 & 31   # lsr.l d7,d6 — align valid bits to bottom
        self.d7 = d0               # move.w d0,d7 — valid bit count = raw d0

    def fetch_word(self):
        self.pos -= 2
        return (self.mem[self.pos] << 8) | self.mem[self.pos + 1]

    def fetch_long(self):
        self.pos -= 4
        return int.from_bytes(self.mem[self.pos:self.pos + 4], 'big')

    def getbit(self):
        self.d7 -= 1
        if self.d7 == 0:
            self.d7 = 16
            d0 = self.d6 & 0xFFFF
            self.d6 >>= 1
            # swap halves; insert new word in low half; swap back
            self.d6 = ((self.d6 & 0xFFFF) << 16) | (self.d6 >> 16)
            self.d6 = (self.d6 & 0xFFFF0000) | self.fetch_word()
            self.d6 = ((self.d6 & 0xFFFF) << 16) | (self.d6 >> 16)
            return d0 & 1
        c = self.d6 & 1
        self.d6 >>= 1
        return c

    def getbits(self, n):
        d0 = self.d6 & 0xFFFF
        self.d6 >>= n
        self.d7 -= n
        if self.d7 <= 0:
            self.d7 += 16
            r = self.d7 & 31
            if r:
                self.d6 = ((self.d6 >> r) | (self.d6 << (32 - r))) & 0xFFFFFFFF
            self.d6 = (self.d6 & 0xFFFF0000) | self.fetch_word()
            if r:
                self.d6 = ((self.d6 << r) | (self.d6 >> (32 - r))) & 0xFFFFFFFF
        return d0 & MASK[n]


def depack(blob, unpacked_size):
    bits = BackwardBits(blob)
    out = bytearray(unpacked_size)
    w = unpacked_size  # a1
    while w > 0:
        if bits.getbit():
            # literal
            w -= 1
            out[w] = bits.getbits(8)
            continue
        # match length (bcs falls through on bit==0 to shorter codes)
        if bits.getbit() == 0:
            base, n = 1, 1
        elif bits.getbit() == 0:
            base, n = 3, 2
        elif bits.getbit() == 0:
            base, n = 7, 4
        else:
            base, n = 23, 8
        d4 = base + bits.getbits(n)
        if d4 == 22:
            # long literal run
            n2 = 5 if bits.getbit() else 14
            d4 = 14 + bits.getbits(n2)
            for _ in range(d4 + 1):
                w -= 1
                out[w] = bits.getbits(8)
            continue
        if d4 > 22:
            d4 -= 1
        # offset
        if not bits.getbit():
            off = 32 + bits.getbits(9)
        elif not bits.getbit():
            off = bits.getbits(5)
        else:
            off = 0x220 + bits.getbits(14)
        for _ in range(d4 + 1):
            w -= 1
            out[w] = out[w + off]
    return bytes(out), bits.pos


if __name__ == '__main__':
    code = open(sys.argv[1], 'rb').read()
    # header at code+0x128: unpacked size, packed size, then blob
    size, psize = struct.unpack_from('>II', code, 0x128)
    blob = code[0x130:0x130 + psize]
    out, consumed = depack(blob, size)
    fn = sys.argv[2]
    open(fn, 'wb').write(out)
    print(f"depacked {len(blob)} -> {len(out)} bytes (stream pos left at {consumed}); saved {fn}")
    print("first 64 bytes:", out[:64].hex())
    print("entry code check (should start with 48e7 or 4e f9 etc):", out[:8].hex())
