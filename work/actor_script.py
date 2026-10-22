#!/usr/bin/env python3
"""Skrypty aktorow GAME EXEC (interpreter w chip $21B2-$223E, tablica rozkazow pod $1CA0).

Slowo >= 0 (i mlodszy bajt != $FE/$FC) = numer klatki: aktor pokazuje klatke i czeka do nastepnego
taktu animacji (+$32 = co ile wywolan, +$26 = klatka, +$2C/+$30 = blok skryptu / przesuniecie).
$xxFE / $xxFC = zapis slowa / dlugiego slowa do pola aktora o przesunieciu xx. Reszta: OPS ponizej
(dlugosc w bajtach razem z kodem). Uzycie: python work/actor_script.py <zrzut> <adres_hex> [...]
"""
import struct, sys

FB = 0x200000
# kod: (nazwa, dlugosc w bajtach)
OPS = {
    0xFFFA: ('restart', 2), 0xFFF8: ('end', 2), 0xFFF6: ('kill', 2), 0xFFF4: ('layer', 4),
    0xFFF2: ('gflag_set', 4), 0xFFF0: ('gflag_wait', 4), 0xFFEE: ('call', 10), 0xFFEC: ('gflag_loop', 6),
    0xFFEA: ('gflag2_loop', 6), 0xFFE8: ('poke_b', 8), 0xFFE6: ('poke_w', 8), 0xFFE4: ('poke_l', 10),
    0xFFE2: ('set44', 4), 0xFFE0: ('sub1ce0', 6), 0xFFDE: ('path', 6), 0xFFDC: ('clip', 12),
    0xFFDA: ('bob', 6), 0xFFD8: ('move_delay', 4), 0xFFD6: ('delay', 4), 0xFFD4: ('pri', 4),
    0xFFD2: ('loop_n', 4), 0xFFD0: ('loop_back', 4), 0xFFCE: ('flag_set', 4), 0xFFCC: ('flag_wait', 4),
    0xFFCA: ('sleep', 4), 0xFFC8: ('sleep_rnd', 6), 0xFFC6: ('spawn_once', 6), 0xFFC4: ('frame_rnd', 6),
    0xFFC2: ('glide', 8), 0xFFC0: ('sound', 6), 0xFFBE: ('remap', 10), 0xFFBC: ('pingpong', 6),
    0xFFBA: ('jump', 6), 0xFFB8: ('spawn_at', 10), 0xFFB6: ('base', 10), 0xFFB4: ('spawn_child', 10),
    0xFFB2: ('test_g', 4), 0xFFB0: ('test_bit', 8), 0xFFAE: ('br_set', 4), 0xFFAC: ('br_clr', 4),
}


def mem(chip, fast):
    def rd(a, n):
        return chip[a:a + n] if a < 0x200000 else fast[a - FB:a - FB + n]
    return rd


def decode(rd, a, n=40, stop=('restart', 'end', 'kill', 'jump')):
    """-> lista (adres, tekst); konczy na rozkazie z 'stop' albo po n rozkazach"""
    out = []
    for _ in range(n):
        w, = struct.unpack('>H', rd(a, 2))
        if w < 0x8000 and w & 0xFF not in (0xFE, 0xFC):
            out.append((a, 'frame %d' % w)); a += 2; continue
        if w & 0xFF in (0xFE, 0xFC):
            ln = 4 if w & 0xFF == 0xFE else 6
            val = rd(a + 2, ln - 2).hex()
            out.append((a, 'set%s +$%02x = $%s' % ('w' if ln == 4 else 'l', w >> 8, val))); a += ln; continue
        name, ln = OPS.get(w, ('?%04x' % w, 2))
        args = struct.unpack('>%dH' % ((ln - 2) // 2), rd(a + 2, ln - 2)) if ln > 2 else ()
        out.append((a, name + ' ' + ' '.join('%04x' % x for x in args)))
        a += ln
        if name in stop:
            break
    return out


if __name__ == '__main__':
    p = sys.argv[1]
    rd = mem(open(p + '_chip.bin', 'rb').read(), open(p + '_fast.bin', 'rb').read())
    for s in sys.argv[2:]:
        print('== $' + s)
        for a, t in decode(rd, int(s, 16)):
            print('  %06x  %s' % (a, t))
