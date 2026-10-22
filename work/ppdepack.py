#!/usr/bin/env python3
"""Rozpakowanie plikow z dysku 2 (poziomy, grafika): PowerPacker 2.0 bez naglowka 'PP20'.

GAME EXEC (chip $1252/$190C): wpis katalogu {$80000000 | dlugosc spakowana, dlugosc po rozpakowaniu},
plik = [dlugosc po rozpakowaniu.L][tabela dlugosci offsetow 4 B][strumien][dlugosc.3 B + bity do pominiecia.1 B].
Strumien czytany od konca (algorytm PP20). Pliki leza ciagiem w ADF.
Uzycie: python work/ppdepack.py <adf> <offset_hex> <wyjscie>   (offset = poczatek pliku: dlugosc po rozpakowaniu)
        python work/ppdepack.py --test
"""
import struct, sys


def unpack(src, eff, dest_len, skip):
    """PP20: src = strumien bez tabeli i stopki; eff = 4 dlugosci offsetow"""
    out = bytearray(dest_len)
    pos, bits, nbits = len(src), 0, 0

    def read(n):
        nonlocal pos, bits, nbits
        while nbits < n:
            pos -= 1
            if pos < 0:
                raise ValueError('koniec danych')
            bits |= src[pos] << nbits
            nbits += 8
        v = 0
        for _ in range(n):
            v = v << 1 | bits & 1
            bits >>= 1
        nbits -= n
        return v

    o = dest_len
    read(skip)
    while o > 0:
        if read(1) == 0:                        # literaly
            todo = 1
            while True:
                x = read(2); todo += x
                if x != 3:
                    break
            for _ in range(todo):
                o -= 1; out[o] = read(8)
            if o == 0:
                break
        x = read(2)                             # kopia z wczesniejszych danych
        offbits, todo = eff[x], x + 2
        if x == 3:
            if read(1) == 0:
                offbits = 7
            off = read(offbits)
            while True:
                x = read(3); todo += x
                if x != 7:
                    break
        else:
            off = read(offbits)
        for _ in range(todo):
            o -= 1; out[o] = out[o + off + 1]
    return bytes(out)


def unpack_file(data, start, packed_len):
    """plik zaczynajacy sie od [dlugosc po rozpakowaniu.L]; packed_len z katalogu (bez bitu 31)"""
    total, = struct.unpack_from('>I', data, start)
    eff = data[start + 4:start + 8]
    tail, = struct.unpack_from('>I', data, start + packed_len - 4)
    dest_len, skip = tail >> 8, tail & 0xFF
    assert dest_len == total, (hex(dest_len), hex(total))
    return unpack(data[start + 8:start + packed_len - 4], eff, dest_len, skip)


def directory(adf):
    """wpisy {$8000xxxx, dlugosc} tuz przed spakowanymi plikami: [(offset pliku, dl. spakowana, dl. po rozpakowaniu)]"""
    out = []
    for a in range(0, len(adf) - 12, 2):
        flag, total = struct.unpack_from('>II', adf, a)
        if flag >> 16 == 0x8000 and 0x100 < (flag & 0xFFFF) and total == struct.unpack_from('>I', adf, a + 4)[0] \
                and 0x1000 < total < 0x40000 and adf[a + 8] in range(9, 16) and adf[a + 9] in range(9, 16):
            out.append((a + 4, flag & 0xFFFF, total))
    return out


if __name__ == '__main__':
    if sys.argv[1:] == ['--test']:
        # samotest: plik z jednym literalem 'A' i kopia 3 bajtow -> 'AAAA'
        # skonstruowany recznie nie jest trywialny; test na prawdziwym pliku poziomu 1 w work/test_levels.py
        print('uzyj: python work/ppdepack.py <adf> <offset_hex> <wyjscie>')
        sys.exit(0)
    adf = open(sys.argv[1], 'rb').read()
    start = int(sys.argv[2], 16)
    flag, = struct.unpack_from('>I', adf, start - 4)
    open(sys.argv[3], 'wb').write(unpack_file(adf, start, flag & 0x7FFFFFFF))
