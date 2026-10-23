#!/usr/bin/env python3
"""Bank grafik sklepu: spakowany plik z dysku 2 (offset $B89C0, PowerPacker bez naglowka) z BOB-ami
ikon towarow; oferty sklepow (work/export_level.py shops) wskazuja przesuniecia w tym banku.
Paleta sklepu: tablica docelowa rozjasniania $30B9BA (32 kolory, $2DFD3C gdy $30CC83) z glownego programu (zrzut lvl1_h);
wczesniej dopasowana do zrzutu ekranu w trakcie rozjasniania (kolory 16-29 o stopien za ciemne, 30-31 zgadniete).
Tlo sklepu: plik z dysku 2 $B503C (320x160, 5 planow kolejno), wczytywany przez $2DDD88 do bufora planszy.
Wyjscie: game/assets/shop_items.png + .json {przesuniecie_hex: [sx, sy, w, h]}, game/assets/shop_bg.png.
Uzycie: python work/export_shop.py
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ppdepack import unpack_file
from level_data import bob_img
from export_level import pal_fn, LEVELS

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADF2 = os.path.join(ROOT, 'Traps-n-Treasures_Amiga_EN', "Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk 2 of 2).adf")
START = 0xB89C0
BG = 0xB503C
SHOP_PAL = 0x30B9BA

if __name__ == '__main__':
    adf = open(ADF2, 'rb').read()
    flag, = struct.unpack_from('>I', adf, START - 4)
    bank = unpack_file(adf, START, flag & 0x7FFFFFFF)
    fast = open(os.path.join(ROOT, 'work', 'dumps', 'lvl1_h_fast.bin'), 'rb').read()
    pal = list(struct.unpack_from('>32H', fast, SHOP_PAL - 0x200000))
    flag, = struct.unpack_from('>I', adf, BG - 4)
    bg = unpack_file(adf, BG, flag & 0x7FFFFFFF)
    img = Image.new('RGB', (320, 160))
    px = img.load()
    for y in range(160):
        for x in range(320):
            c = sum(((bg[p * 6400 + y * 40 + x // 8] >> (7 - x % 8)) & 1) << p for p in range(5))
            v = pal[c]; px[x, y] = ((v >> 8 & 15) * 17, (v >> 4 & 15) * 17, (v & 15) * 17)
    img.save(os.path.join(ROOT, 'game', 'assets', 'shop_bg.png'))
    frames, a = [], 0
    while a + 26 < len(bank):                          # kolejne BOB-y: rozmiar calkowity w naglowku (+24)
        w, h = struct.unpack_from('>HH', bank, a)
        ps, size = struct.unpack_from('>HH', bank, a + 22)
        if not (0 < w <= 320 and 0 < h <= 256 and size == 26 + ps * (bin(bank[a + 16]).count('1') + 1)):
            break
        frames.append((a, w, h)); a += size
    x = y = row = 0
    pos = {}
    for off, w, h in frames:
        if x + w > 512:
            x, y, row = 0, y + row + 1, 0
        pos[off] = (x, y, w, h); x, row = x + w + 1, max(row, h)
    atl = Image.new('RGBA', (512, y + row + 1))
    for off, w, h in frames:
        atl.paste(bob_img(bank, off, pal), pos[off][:2])
    atl.save(os.path.join(ROOT, 'game', 'assets', 'shop_items.png'))
    anchor = {off: struct.unpack_from('>hh', bank, off + 4) for off, w, h in frames}
    json.dump({'%x' % o: list(p) + list(anchor[o]) for o, p in pos.items()}, open(os.path.join(ROOT, 'game', 'assets', 'shop_items.json'), 'w'))
    # sprzedawca ($2E1B40): aktorzy z baza w banku sklepu, polozenie swiata - 32 = ekran; bloki animacji z kodu gry
    W = lambda a: struct.unpack_from('>H', fast, a - 0x200000)[0]
    def seq(blk):
        out, a = [], blk
        while len(out) < 200:
            w = W(a)
            if w < 0x8000: out.append(w); a += 2
            elif w == 0xFFCA: out += [out[-1]] * W(a + 2); a += 4      # uspienie = ta sama klatka przez n krokow
            else: break
        return out
    keeper = [dict(base='%x' % b, x=x - 32, y=y - 32, delay=7, seq=seq(blk)) for b, x, y, blk in
              ((0x000, 269, 82, 0x2E1C74), (0x710, 289, 112, 0x2E1CD2), (0x710, 283, 126, 0x2E1D66))]
    json.dump(dict(order=['%x' % o for o, w, h in frames], keeper=keeper), open(os.path.join(ROOT, 'game', 'assets', 'shop_keeper.json'), 'w'))
    print(len(frames), 'BOB-ow sklepu, koniec', hex(a), '/', hex(len(bank)))
