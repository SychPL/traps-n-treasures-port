#!/usr/bin/env python3
"""Disassemble the loader entry code (M68k) with Capstone."""
import sys
from capstone import Cs, CS_ARCH_M68K, CS_MODE_BIG_ENDIAN

md = Cs(CS_ARCH_M68K, CS_MODE_BIG_ENDIAN)
md.skipdata = True

data = open(sys.argv[1], 'rb').read()
base = int(sys.argv[2], 0) if len(sys.argv) > 2 else 0x60020
length = int(sys.argv[3], 0) if len(sys.argv) > 3 else 0x130

for insn in md.disasm(data[:length], base):
    tgt = ''
    # annotate absolute addresses
    op = insn.op_str
    print(f"${insn.address:#08x}: {insn.bytes.hex():<20} {insn.mnemonic:<10} {op}")
