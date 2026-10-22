#!/usr/bin/env python3
"""Wspolne dane poziomow z pamieci gry (zrzuty z emulatora, uklad A: CODE = $2DC97C, A4 = $30CA80).

Listy obiektow poziomow (po relokacji, wskazniki bezwzgledne), rekord 26 B:
  {x, y (dol), flagi, typ.L = adres opisu typu, p0.L, p1.L = procedura startowa, p2.L = dane albo liczba,
   p3.L: bajt 0 = wytrzymalosc}
Opis typu = {flagi.W, skrypt startowy...}; skrypt zaczyna sie od 'base' ($FFB6, przesuniecie.L, zmienna banku.L).
Bank $30CD70 = BOB-y wrogow (plik poziomu) -> rekord jest aktorem; $30CD58 = przedmioty (wspolne).
Opis typu lezy w chip (program poziomu wczytany pod $9A4C, poziomy 1-2) albo w fast (glowny program).
"""
import struct
from PIL import Image
from dump_view import rgb

FB, CODE = 0x200000, 0x2DC97C
LISTS = {'level1': 0x2F53CE, 'level2': 0x2F71F6, 'level3': 0x2FADD8, 'level4': 0x301660}
ENEMY_BANK, ITEM_BANK = 0x30CD70, 0x30CD58


def reader(chip, fast):
    def rd(a, n):
        return chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    return rd


def records(fast, lst, width=10560):
    """rekordy listy; sekcje listy rozdzielaja krotkie przerwy - przeskakiwane po 2 bajty"""
    def ok(a):
        x, y, fl, t = struct.unpack_from('>HHHI', fast, a)
        return 0 < x < width and y < 768 and fl < 0x100 and (0x9000 <= t < 0x80000 or 0x2C0000 <= t < 0x320000)
    a, out, miss = lst - FB, [], 0
    while miss < 20:
        if ok(a):
            x, y, fl, t = struct.unpack_from('>HHHI', fast, a)
            out.append(dict(x=x, y=y, fl=fl, type=t, p=struct.unpack_from('>4I', fast, a + 10), addr=a + FB))
            a, miss = a + 26, 0
        else:
            a, miss = a + 2, miss + 1
    return out


def sections(fast, chip):
    """sekcje listy rekordow ($2DD23C): tablica poziomu ($30CD14) +$64 = wskazniki sekcji wg numeru obszaru
    (obszar +0.L); sekcja = rekordy po 26 B do x = 0. Petla $2E35A4 tworzy tylko aktorow sekcji obszaru -> [(adres, koniec)]"""
    rd = reader(chip, fast)
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    tab, out = L(L(0x30CD14) + 0x64), []
    for i in range(256):
        p = L(tab + 4 * i)
        if not 0x200000 <= p < 0x320000:
            break
        e = p
        while struct.unpack('>H', rd(e, 2))[0]:
            e += 26
        out.append((p, e))
    return out


def descriptor(rd, t):
    """-> (przesuniecie BOB, zmienna banku) z rozkazu 'base' na poczatku skryptu albo None"""
    w, off, var = struct.unpack('>HII', rd(t + 2, 10))
    return (off, var) if w == 0xFFB6 else None


def walk_bank(chip, base):
    """-> lista (adres, naglowek) kolejnych BOB-ow do terminatora $FFFFFFFF"""
    out, a = [], base
    while chip[a:a + 4] != b'\xff\xff\xff\xff':
        w, h, ax, ay = struct.unpack_from('>HHhh', chip, a)
        ps, size = struct.unpack_from('>HH', chip, a + 22)
        if not (0 < w <= 320 and 0 < h <= 256 and size == 26 + ps * bin(chip[a + 16]).count('1') + ps):
            break
        out.append((a, dict(w=w, h=h, ax=ax, ay=ay, box=list(struct.unpack_from('>hhhh', chip, a + 8)))))   # ramka kolizji x1, y1, x2, y2
        a += size
    return out


def bob_img(chip, a, pal):
    w, h = struct.unpack_from('>HH', chip, a)
    stored, forced = chip[a + 16], chip[a + 17]
    ps = struct.unpack_from('>H', chip, a + 22)[0]
    rb, d = ps // h, a + 26
    planes = [p for p in range(5) if stored >> p & 1]
    img = Image.new('RGBA', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            bit = lambda o: chip[o + y * rb + (x >> 3)] >> (7 - (x & 7)) & 1
            if bit(d):
                c = forced & ~stored
                for k, p in enumerate(planes):
                    c |= bit(d + ps * (k + 1)) << p
                px[x, y] = rgb(pal[c]) + (255,)
    return img
