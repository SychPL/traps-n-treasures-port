#!/usr/bin/env python3
"""Locate depacker-like routines: dense shift/rotate/test instruction clusters in loops."""
import sys, re
from capstone import Cs, CS_ARCH_M68K, CS_MODE_BIG_ENDIAN

md = Cs(CS_ARCH_M68K, CS_MODE_BIG_ENDIAN)
md.skipdata = True

BIT_OPS = re.compile(r'^(lsl|lsr|asl|asr|rol|ror|roxl|roxr|btst|bset|bclr|bchg|addx|subx|negx|scs|scc)\b', re.I)
LOOP = re.compile(r'^(dbra|dbf|dbra\.w|bra|bcc|bcs|beq|bne|bmi|bpl|bgt|blt|bhi|bls|bge|ble|bvs|bvc)\b', re.I)

def scan(path, base, lo, hi):
    data = open(path, 'rb').read()
    regions = []
    off = lo
    while off < hi:
        chunk = data[off:off+0x1000]
        bitn = loopn = 0
        first = None
        for insn in md.disasm(chunk, base + off):
            if BIT_OPS.match(insn.mnemonic):
                bitn += 1
                first = first if first is not None else insn.address - base
            if LOOP.match(insn.mnemonic):
                loopn += 1
        if bitn >= 18 and loopn >= 6:
            regions.append((off, bitn, loopn))
            off += 0x800
        else:
            off += 0x400
    print(f"{path} [{lo:#x}..{hi:#x}]: {len(regions)} bit-dense regions")
    for off, b, l in regions:
        print(f"  +{off:#07x} (abs {base+off:#08x}): bit_ops={b} loops={l}")

if __name__ == '__main__':
    scan(r"I:\Projekty\pirat\extracted\stage2a.bin", 0x70000, 0x7A000, 0x7DB18)   # GAME EXEC kernel
    for f in ("d2_00940c", "d2_03c314", "d2_056db0"):
        scan(rf"I:\Projekty\pirat\extracted\files\{f}.hunk", 0x10000, 0x18, 0x100000)
