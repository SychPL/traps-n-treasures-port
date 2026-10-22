#!/usr/bin/env python3
"""Odtwarza obraz ekranu Amigi ze zrzutu chip RAM (wyrocznia z emulatora).

Szuka w zrzucie copper list (MOVE do BPL1PTH/BPL1PTL), symuluje je linia po linii
(wskazniki bitplanow, modulo, palety, zmiany w trakcie ramki) i zapisuje PNG
dla kazdej kandydatki: work/dumps/<zrzut>_cop<adres>.png

Uzycie: python work/dump_view.py work/dumps/tytul_chip.bin
        python work/dump_view.py --test
Obslugiwane: lowres/hires, 1-6 bitplanow, EHB, HAM6. Pomijane: dual playfield,
sprite'y, BPLCON1 (scroll), ponytail: dodac gdy jakis ekran tego wymaga.
"""
import struct, sys, os
from PIL import Image

BPLCON0, BPL1MOD, BPL2MOD = 0x100, 0x108, 0x10A
DIWSTRT, DIWSTOP, DDFSTRT, DDFSTOP = 0x08E, 0x090, 0x092, 0x094


def words(d, a, n):
    return struct.unpack_from('>%dH' % n, d, a)


def find_copper_lists(d):
    """Zwraca liste (start, instrukcje[(ir1, ir2)]) z MOVE do BPL1PTH i BPL1PTL."""
    def plausible(a):
        if a < 0 or a + 4 > len(d):
            return False
        ir1, ir2 = words(d, a, 2)
        if ir1 & 1:                      # WAIT/SKIP
            return True
        return 0x20 <= ir1 < 0x200      # MOVE do rejestru custom
    starts = set()
    for a in range(0, len(d) - 8, 2):
        if words(d, a, 1)[0] == 0x00E0 and words(d, a + 4, 1)[0] == 0x00E2:
            s = a
            while plausible(s - 4) and words(d, s - 4, 2) != (0xFFFF, 0xFFFE):
                s -= 4
            starts.add(s)
    out = []
    for s in sorted(starts):
        ins, a = [], s
        while plausible(a) and len(ins) < 4000:
            ir = words(d, a, 2)
            if ir == (0xFFFF, 0xFFFE):
                break
            ins.append(ir)
            a += 4
        out.append((s, ins))
    return out


def events(ins):
    """Copper -> lista (linia, rejestr, wartosc). WAIT cofajacy linie = przejscie przez 256."""
    ev, line, hi = [], 0, 0
    for ir1, ir2 in ins:
        if ir1 & 1:
            if ir2 & 1:
                continue                 # SKIP: ignorujemy
            vp = ir1 >> 8
            if vp + hi < line - 128:
                hi = 256
            line = vp + hi
        else:
            ev.append((line, ir1 & 0x1FE, ir2))
    return ev


def rgb(w):
    return ((w >> 8 & 15) * 17, (w >> 4 & 15) * 17, (w & 15) * 17)


def render(d, ins):
    ev = events(ins)
    regs = {DIWSTRT: 0x2C81, DIWSTOP: 0x2CC1, DDFSTRT: 0x38, DDFSTOP: 0xD0, BPLCON0: 0, BPL1MOD: 0, BPL2MOD: 0}
    ptr = [0] * 6
    pal = [0] * 32
    def apply(reg, val):
        if 0x0E0 <= reg <= 0x0F6:        # BPLxPTH/L
            i, lo = (reg - 0x0E0) // 4, (reg - 0x0E0) % 4
            ptr[i] = (ptr[i] & 0xFFFF) | (val << 16) if lo == 0 else (ptr[i] & 0xFFFF0000) | val
        elif 0x180 <= reg <= 0x1BE:
            pal[(reg - 0x180) // 2] = val
        else:
            regs[reg] = val
    # okno i fetch: ostatnie wartosci z listy (rzadko zmieniane w trakcie ramki)
    win = dict(regs)
    for _, reg, val in ev:
        if reg in (DIWSTRT, DIWSTOP, DDFSTRT, DDFSTOP, BPLCON0):
            win[reg] = val
    vstart = win[DIWSTRT] >> 8
    vstop = win[DIWSTOP] >> 8
    vstop += 256 if vstop < 0x80 else 0
    hires = win[BPLCON0] >> 15 & 1
    # sprzet konczy rozpoczety blok pobierania, wiec zaokraglamy w gore (DDF 30-D4 -> 22 slowa)
    step = 4 if hires else 8
    nwords = (win[DDFSTOP] - win[DDFSTRT] + step - 1) // step + (2 if hires else 1)
    i = 0
    while i < len(ev) and ev[i][0] < vstart:   # ustawienia sprzed okna (wskazniki, paleta)
        apply(*ev[i][1:]); i += 1
    width, height = nwords * 16, max(1, vstop - vstart)
    img = Image.new('RGB', (width, height))
    px = img.load()
    for y in range(vstart, vstop):
        while i < len(ev) and ev[i][0] <= y:
            apply(*ev[i][1:]); i += 1
        con0 = regs[BPLCON0]
        n = min(6, con0 >> 12 & 7)
        ham = con0 >> 11 & 1
        rows = []
        for p in range(n):
            a = ptr[p] & (len(d) - 1)
            rows.append(d[a:a + nwords * 2])
            mod = regs[BPL1MOD if p % 2 == 0 else BPL2MOD]
            ptr[p] += nwords * 2 + (mod - 0x10000 if mod & 0x8000 else mod)
        prev = rgb(pal[0])
        for x in range(width):
            c = 0
            for p in range(n):
                r = rows[p]
                if x // 8 < len(r) and r[x // 8] >> (7 - x % 8) & 1:
                    c |= 1 << p
            if ham and n == 6:
                ctl, v = c >> 4, (c & 15) * 17
                col = rgb(pal[c & 15]) if ctl == 0 else \
                    (prev[0], prev[1], v) if ctl == 1 else (v, prev[1], prev[2]) if ctl == 2 else (prev[0], v, prev[2])
            elif c >= 32:                # EHB
                col = tuple(v // 2 for v in rgb(pal[c - 32]))
            else:
                col = rgb(pal[c])
            px[x, y - vstart] = prev = col
    info = 'planes=%d hires=%d ham=%d diw=%04x-%04x ddf=%02x-%02x %dx%d' % (
        win[BPLCON0] >> 12 & 7, hires, win[BPLCON0] >> 11 & 1,
        win[DIWSTRT], win[DIWSTOP], win[DDFSTRT], win[DDFSTOP], width, height)
    return img, info


def test():
    # 2 bitplany, 1 slowo na linie, 1 linia: piksel 0 -> kolor 3, piksel 1 -> kolor 1, piksel 2 -> kolor 2
    d = bytearray(0x10000)
    d[0x1000:0x1002] = b'\xC0\x00'       # plane 1: piksele 0,1
    d[0x2000:0x2002] = b'\xA0\x00'       # plane 2: piksele 0,2
    cop = [(0x08E, 0x8081), (0x090, 0x81C1), (0x092, 0x38), (0x094, 0x38), (0x100, 0x2200),
           (0x0E0, 0), (0x0E2, 0x1000), (0x0E4, 0), (0x0E6, 0x2000),
           (0x180, 0x000), (0x182, 0xF00), (0x184, 0x0F0), (0x186, 0x00F)]
    img, _ = render(bytes(d), cop)
    assert img.size == (16, 1), img.size
    assert [img.getpixel((x, 0)) for x in range(4)] == [(0, 0, 255), (255, 0, 0), (0, 255, 0), (0, 0, 0)]
    a = 0x3000
    for ir in cop:
        struct.pack_into('>HH', d, a, *ir); a += 4
    struct.pack_into('>HH', d, a, 0xFFFF, 0xFFFE)
    assert [s for s, _ in find_copper_lists(bytes(d))] == [0x3000]
    print('test OK')


if __name__ == '__main__':
    if sys.argv[1:] == ['--test']:
        test(); sys.exit()
    # --gray: paleta szara (32 odcienie) - widac tresc nawet przy wygaszonej palecie (fade)
    gray = '--gray' in sys.argv
    path = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    d = open(path, 'rb').read()
    base = os.path.splitext(path)[0] + ('_gray' if gray else '')
    ramp = [(0x180 + 2 * i, (i // 2) * 0x111) for i in range(32)]
    for s, ins in find_copper_lists(d):
        if gray:
            ins = [ir for ir in ins if not 0x180 <= ir[0] <= 0x1BE]
            ins = ins[:1] + ramp + ins[1:] if ins and ins[0][0] & 1 else ramp + ins
        img, info = render(d, ins)
        out = '%s_cop%06x.png' % (base, s)
        img.save(out)
        print('copper @%06x  %4d instr  %s  -> %s' % (s, len(ins), info, os.path.basename(out)))
