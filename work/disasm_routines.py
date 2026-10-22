#!/usr/bin/env python3
"""Deasemblacja procedur gry (fast) z podazaniem za procedura co takt ($7A) i bsr do pomocniczych.

Uzycie: python work/disasm_routines.py <zrzut> <adres_hex> [...] > plik.txt
Dla kazdego adresu: kod do pierwszego rts (max 120 instrukcji), potem kazda procedura ustawiona
jako 'move.l #X,$7a(a0)' i wywolania bsr.w/jsr do kodu gry (jeden poziom).
"""
import sys, capstone

FB = 0x200000
md = capstone.Cs(capstone.CS_ARCH_M68K, capstone.CS_MODE_BIG_ENDIAN | capstone.CS_MODE_M68K_000)
md.skipdata = True


def listing(fast, a, limit=120):
    out, refs = [], []
    for k, i in enumerate(md.disasm(fast[a - FB:a - FB + 0x400], a)):
        out.append('%06x  %-8s %s' % (i.address, i.mnemonic, i.op_str))
        if i.op_str.endswith('$7a(a0)') and i.op_str.startswith('#$'):
            refs.append(int(i.op_str[2:].split(',')[0], 16))
        if i.mnemonic in ('bsr.w', 'bsr.b', 'jsr') and i.op_str.startswith('$') and '(' not in i.op_str:
            t = int(i.op_str[1:], 16)
            if 0x2D0000 <= t < 0x310000:
                refs.append(t)
        if i.mnemonic in ('rts', 'rte') or k >= limit:
            break
    return out, refs


if __name__ == '__main__':
    fast = open(sys.argv[1] + '_fast.bin', 'rb').read()
    done = set()
    for s in sys.argv[2:]:
        a = int(s, 16)
        out, refs = listing(fast, a)
        print('=' * 20, '$%06x' % a); print('\n'.join(out))
        for r in refs:
            if r in done or r == a or not 0x2D0000 <= r < 0x310000:
                continue
            done.add(r)
            o2, _ = listing(fast, r, 80)
            print('-' * 10, 'sub $%06x' % r); print('\n'.join(o2))
