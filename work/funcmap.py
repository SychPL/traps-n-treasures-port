#!/usr/bin/env python3
"""Iterative function discovery for M68k code via branch targets."""
import sys
from capstone import Cs, CS_ARCH_M68K, CS_MODE_BIG_ENDIAN

md = Cs(CS_ARCH_M68K, CS_MODE_BIG_ENDIAN)
md.skipdata = True

data = open(sys.argv[1], 'rb').read()
base = int(sys.argv[2], 0)
seed = int(sys.argv[3], 0)

pending = {seed, 0x480 + base if base == 0x70000 else seed}
visited = {}   # addr -> insn
funcs = set()

def branch_target(insn):
    if insn.mnemonic in ('bsr', 'jsr', 'bra', 'jmp', 'bsr.w', 'bra.w', 'jsr.l'):
        op = insn.op_str
        if op.startswith('$'):
            return int(op.strip().rstrip('.l').rstrip('.w').lstrip('$'), 16)
    return None

def cond_target(insn):
    m = insn.mnemonic
    if m.startswith('b') and m not in ('bra', 'bset', 'bclr', 'bchg', 'btst', 'bsr', 'bmi', 'bkpt'):
        op = insn.op_str.split(',')[-1].strip()
        if op.startswith('$'):
            try:
                return int(op.lstrip('$'), 16)
            except ValueError:
                return None
    return None

while pending:
    addr = pending.pop()
    if addr in funcs or addr < base or addr >= base + len(data):
        continue
    funcs.add(addr)
    off = addr - base
    count = 0
    for insn in md.disasm(data[off:off+0x1000], addr):
        visited[insn.address] = insn
        count += 1
        t = branch_target(insn)
        if t is not None and t not in funcs:
            pending.add(t)
        t = cond_target(insn)
        if t is not None and t >= base and t < base + len(data) and t not in visited:
            # conditional target: disassemble as new flow
            pending.add(t)
        if insn.mnemonic in ('rts', 'rte', 'rtr') and count > 3:
            break
        if count > 400:
            break

print(f"discovered {len(funcs)} function entries:")
for f in sorted(funcs):
    print(f"  ${f:#08x}")
