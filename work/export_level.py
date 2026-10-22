#!/usr/bin/env python3
"""Eksport poziomu ze zrzutu (wyrocznia) do nowej wersji gry: game/assets/<nazwa>.*

  <nazwa>_surface.png / <nazwa>_water.png - atlas 16x16 kafli (16 w rzedzie), paleta nad / pod woda,
                                             kolor 1 (niebo/woda, gradient z coppera) przezroczysty
  <nazwa>.bin                              - mapa, 1 bajt/kafel, wierszami
  <nazwa>.json                             - wymiary, linia wody, gradient nieba, kolory tla

Uzycie: python work/export_level.py work/dumps/lvl1_f level1
        python work/export_level.py work/dumps/lvl1_h level1 --data   (tylko dane tablicy poziomu do istniejacego json)
Stale dla poziomu 1 (zrzut lvl1_f) - patrz RESEARCH.md. ponytail: inne poziomy dostana tu swoj wpis.
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dump_view import find_copper_lists, events, rgb
from tiles import FAST_BASE, TILE

LEVELS = {
    # mapa, szer, wys, bank, copper, linia startu planszy, linia wody na ekranie, swiat_y = linia + dy
    # attr: tablica atrybutow kafli (slowo/kafel, chip): b0 podloga, b1 sciana, b2 sufit, b3 drabina, b15 smierc
    'level1': dict(start=(53, 271), attr=0xFAF4, map=0x2B0DF6, w=540, h=48, bank=0x2A6D32, cop=0xCDC0, pf=55, water=143, dy=182,
                   surface=['#002fcf', '#000faf'],    # 2 linie lustra wody zmierzone na ekranie emulatora
                   # gradient nieba (kolor 1) to paralaksa 1/2: zaczyna sie w linii 230 - kamera_y/2;
                   # pelny przebieg ze zrzutu lvl1_g (kamera y=176, woda w linii 205)
                   sky_dump='work/dumps/lvl1_g', sky_lines=(142, 205), sky_line0=230),
    # poziom 2 (zrzut lvl2_a, A4 $30CA80: mapa A4+$50, atrybuty A4+$2C, bank kafli A4+$48, kamera y A4+2 = 32):
    # bez wody; gradient tla (kolor 1) z jednego zrzutu - ponytail: paralaksa 1/2 przyjeta jak w poziomie 1
    'level2': dict(start=(86, 175), attr=0xF8F4, map=0x2A44F6, w=600, h=48, bank=0x29A432, cop=0xCDC0, pf=55, water=None, dy=24,
                   sky_dump='work/dumps/lvl2_a', sky_lines=(56, 215), sky_line0=96),
    # poziomy 3-4 (zrzuty lvl3_a, lvl4_a): kamera y A4+2 = -16 / 272 -> dy = A4.y - 8, gradient od gory ekranu
    'level3': dict(start=(72, 111), attr=0xFCF4, map=0x2A45B6, w=600, h=48, bank=0x29A4F2, cop=0xCDC0, pf=55,
                   water=None, dy=-24, sky_dump='work/dumps/lvl3_a', sky_lines=(56, 215), sky_line0=72),
    'level4': dict(start=(60, 415), attr=0xFEF4, map=0x2A42C6, w=660, h=48, bank=0x29A2A2, cop=0xCDC0, pf=55,
                   water=189, dy=264, surface=['#007fef', '#003faf'],   # morze pod twierdza, linia wody y=453
                   sky_dump='work/dumps/lvl4_a', sky_lines=(56, 189), sky_line0=216),
}


def pal_fn(chip, cop):
    ev = events(dict(find_copper_lists(chip[:0x70000]))[cop])
    def pal_at(line):
        pal = [0] * 32
        for ln, reg, val in ev:
            if ln <= line and 0x180 <= reg <= 0x1BE:
                pal[(reg - 0x180) // 2] = val
        return pal
    return pal_at


def palettes(chip, L):
    """paleta nad woda (linia pf), pod woda (linia water) i gradient koloru 1 (linie pf+1..water-1)."""
    pal_at = pal_fn(chip, L['cop'])
    water = L['water'] or L['pf'] + 1                 # poziom bez wody: paleta podwodna = zwykla
    grad = [pal_at(line)[1] for line in range(L['pf'] + 1, max(water, L['pf'] + 2))]
    return pal_at(L['pf']), pal_at(water), grad


def hexc(w):
    return '#%02x%02x%02x' % rgb(w)


def atlas(fast, bank, pal, count=256):
    img = Image.new('RGBA', (256, 16 * ((count + 15) // 16)))
    px = img.load()
    for t in range(count):
        a = bank - FAST_BASE + t * TILE
        for y in range(16):
            ws = [fast[a + p * 32 + y * 2] << 8 | fast[a + p * 32 + y * 2 + 1] for p in range(5)]
            for x in range(16):
                c = sum((ws[p] >> (15 - x) & 1) << p for p in range(5))
                px[t % 16 * 16 + x, t // 16 * 16 + y] = (0, 0, 0, 0) if c == 1 else rgb(pal[c]) + (255,)
    return img


def areas(chip, fast, w):
    """obszary poziomu i drzwi (dane poziomu w chip pod baza ze zmiennej $30CD98, biezacy obszar $30CBA2):
    obszar (26 B): +2 numer, +4 lista drzwi {indeks kafla.W, cel.L} (zaraz za struktura), +8/+$A x/y min,
    +$C/+$E x/y max kamery (zmienna kamery A4+0/+2; pokoj jednoekranowy: min = max), +$10 linia wody;
    cel {x.W, y.W, obszar.L}; x = 0 -> wyjscie z etapu, $FFFF -> sklep (numer w +4). Indeks kafla drzwi =
    ((y - 6) >> 4) * szer + (x >> 4) pod graczem (kod $2F0A5C, sprawdzane tez indeks - 1)."""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    base = L(0x30CD98)
    start = L(0x30CBA2) - base
    out, todo = {}, [start]
    while todo:
        off = todo.pop()
        if off in out:
            continue
        s = base + off
        wy = W(s + 0x10)
        ar = dict(cam=[W(s + 8), W(s + 0xA), W(s + 0xC), W(s + 0xE)],   # granice kamery gry (x min, y min, x max, y max)
                  water=None if wy == 0xFFFF else wy, doors=[])
        ar['target'] = [W(s + 0x16), W(s + 0x18)]      # +$16/+$18: cel igly kompasu ($308FF4)
        if W(s + 0x14):
            ar['dark'] = 1                              # +$14: ciemny obszar - wejscie tylko z lampa ($2DF50A -> $2DDDC4)
        ar['sect'] = '%x' % L(L(L(0x30CD14) + 0x64) + 4 * L(s))   # $2DD23C: sekcja rekordow obszaru (numer +0.L)
        out[off] = ar
        d = base + L(s + 4)
        for _ in range(64):
            tile = W(d)
            if not tile:
                break
            t = base + L(d + 2)
            if W(t) == 0xFFFF:
                ar['doors'].append(dict(tile=tile, shop=L(t + 4)))
            elif W(t) == 0:
                ar['doors'].append(dict(tile=tile, exit=1))
            else:
                ar['doors'].append(dict(tile=tile, x=W(t), y=W(t + 2), area=L(t + 4)))
                todo.append(L(t + 4))
            d += 6
    return start, {str(k): v for k, v in out.items()}


# procedury zakupow w sklepie (kod gry $2E4F32-$2E50BC) -> efekt w silniku
SHOP_ACT = {0x2E4FE8: 'life1', 0x2E4FF0: 'life2', 0x2E4FF8: 'life3', 0x2E50BC: 'maxlife', 0x2E4F88: 'magnifier',
            0x2E5032: 'bomb', 0x2E506E: 'map', 0x2E4F32: 'sword', 0x2E4F3A: 'morning_star', 0x2E4F42: 'crooked_sword',
            0x2E4F4A: 'iron_balls', 0x2E4F52: 'iron_balls', 0x2E4F5A: 'special_balls', 0x2E4F62: 'fireball',
            0x2DDB2E: 'dice', 0x2E4F6A: 'life_up'}


def shops(chip, fast):
    """oferty sklepow ($30CD14 + $7A + 4 * numer): do 6 pozycji po 14 B {cena.W, BOB w banku przedmiotow.L,
    tekst (nazwa, opis).L, procedura.L}; nazwa -> klucz w lang (shop.items)"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    tab, items_bank, out = L(0x30CD14), L(0x30CD58), {}
    for i in range(8):
        p, items = L(tab + 0x7A + 4 * i), []
        if not FB <= p < 0x400000:
            continue
        for k in range(6):
            e = p + 14 * k
            price, off, txt, act = W(e), L(e + 2), L(e + 6), L(e + 10)
            if not (0 < price < 2000 and FB <= txt < 0x400000 and act in SHOP_ACT):
                break
            name = rd(txt, 20).split(bytes(1))[0].decode('latin1').strip()
            items.append(dict(price=price, bob='%x' % off, item=name.lower().replace(' ', '_'), act=SHOP_ACT[act]))   # bob: przesuniecie w banku sklepu (work/export_shop.py)
        if items:                                      # lista konczy sie pozycja z cena 0 (2-6 pozycji)
            out[str(i)] = items
    return out


# procedury akcji na kaflach (tablica poziomu +8, wpisy od +6 po 10 B {indeks kafla, parametr, procedura};
# kafel = jeden wiersz nad kaflem drzwi gracza, kod $2E42EC) -> rodzaj w silniku
ACT = {0x2E3E14: 'msg', 0x2E4590: 'lock', 0x2E441C: 'lever_state', 0x2E43B4: 'toggle_state', 0x2E4478: 'lever_tiles',
       0x2E4336: 'set_state', 0x2E434C: 'not_state', 0x2E4544: 'plate', 0x2E4532: 'plate_hold', 0x2E435C: 'timed',
       0x2EBCAC: 'summon', 0x2EBCD0: 'hazard'}


def combo(rd, h):
    """przyciski kombinacji ($2ED696...): kazda procedura ma wlasny wskaznik postepu (movea.l abs,a1), poczatek sekwencji
    (movea.l #imm,a1; bajty numerow przyciskow do 0) i nagrode: bajt stanu = 1 (move.b #1,abs) albo zestaw kafli A
    (lea abs,a0; moveq #4,d1; jmp $2E472A). None gdy to nie ten wzorzec."""
    code, op = rd(h, 0xC0), bytes.fromhex
    code = code[:code.find(op('4e75')) + 2]            # tylko do rts tej procedury
    L = lambda i: struct.unpack_from('>I', code, i)[0]
    k = code.find(op('227c'))
    if code[:2] != op('2279') or k < 0:
        return None
    e = dict(kind='combo', id='%x' % L(2), seq=list(rd(L(k + 2), 32).split(bytes(1))[0]))
    k = code.find(op('13fc0001'))
    if k >= 0:
        e['state'] = '%x' % L(k + 4)
    k = code.find(op('41f9'))
    if k >= 0 and code[k + 6:k + 8] == op('7204'):
        e['block'] = L(k + 2)
    return e


def actions(chip, fast):
    """akcje poziomu: tabliczki (tekst), zamek (bajt stanu, czerwony klucz), dzwignie (kafel dzwigni +4/+5 tablicy
    poziomu; bajt stanu albo zestaw kafli A/B przez $2E472A), plytki (zestaw A)"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    def tiles(d):                                      # blok {procedura $2E472A, stan A, stan B, indeksy kafli...}
        idx, k = [], d + 12
        while W(k) and len(idx) < 64:
            idx.append(W(k)); k += 2
        return dict(idx=idx, a=list(rd(L(d + 4), len(idx))), b=list(rd(L(d + 8), len(idx))))
    tab = L(L(0x30CD14) + 8)
    lever = list(rd(tab + 4, 2))                       # wartosci kafla dzwigni: wlaczona, wylaczona
    out, a = [], tab + 6
    while W(a) and len(out) < 300:
        tile, par, h = W(a), L(a + 2), L(a + 6)
        e = dict(tile=tile, kind=ACT.get(h, 'h%x' % h))
        c = combo(rd, h) if h not in ACT else None
        if c:
            e.update(c, button=par)
            if 'block' in c:
                e.update(tiles(c.pop('block'))); del e['block']
        elif e['kind'] == 'msg':
            e['text'] = rd(par, 600).split(bytes(1))[0].decode('latin1')
        elif e['kind'] in ('lever_tiles', 'plate', 'plate_hold'):   # parametr = blok z procedura na poczatku (jsr (a1))
            proc = L(par)
            if proc == 0x2E472A:
                e.update(tiles(par))
            elif proc in (0x2E4554, 0x2E4558):
                # {procedura, numer obszaru.L, cel linii wody.W, opoznienie.W}: gdy cel != obszar +$12 - dzingiel
                # (zdarzenie muzyczne $10 / $11, $2E22BE), obszar +$12 = cel, $9DE4 = opoznienie; $2F0E08 przesuwa linie
                # wody biezacego obszaru (+$10) o 1 px ku celowi co opoznienie + 1 klatek; area = przesuniecie jak w drzwiach
                e.update(kind='water', area=L(L(0x30CD98) + 8 + 4 * L(par + 4)), level=W(par + 8), delay=W(par + 10),
                         event=0x10 if proc == 0x2E4554 else 0x11)
            else:
                e['kind'] = 'h%x' % proc               # nieznana procedura bloku
        elif e['kind'] == 'summon':                    # $2EBCAC: aktor (opis +4, skrypt +2) w (x, y) z danych
            e.update(x=W(par), y=W(par + 2), script=L(par + 4) + 2)
        elif e['kind'] == 'hazard':                    # $2EBCD0: raniacy obiekt $2F2FA2 w miejscu gracza
            e['script'] = 0x2F2FA2
        elif e['kind'] == 'timed':                     # {czas.W, bajt stanu.L}: otwarte przez czas, potem stan 2
            e.update(time=W(par), state='%x' % L(par + 2))
        else:
            e['state'] = '%x' % par
        out.append(e)
        a += 10
    return dict(lever=lever, list=out)


def brittle(chip, fast):
    """kruche kamienie (tablica poziomu +$20, $2F4B1A): kafel kamienia + wpisy {indeks, kafel pod spodem, przedmiot};
    pekaja po wyladowaniu w kucki z ciosem, przedmiot (indeks tablicy opisow $2F24A0) pojawia sie w miejscu kamienia"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    tab = L(L(0x30CD14) + 0x20)
    out, a = [], tab + 2
    while W(a) and len(out) < 300:
        if W(a) < 0x8000:                              # $FFFF = juz rozbity
            e, item = dict(idx=W(a), under=rd(a + 2, 1)[0]), rd(a + 3, 1)[0]
            if item:
                e['item'] = '%x' % L(0x2F24A0 + 4 * item)
            out.append(e)
        a += 4
    return dict(tile=W(tab), list=out)


def crates(chip, fast):
    """skrzynie do noszenia (tablica poziomu +$18, $2E3B5A): kafel skrzyni + wpisy {indeks, kafel pod spodem};
    FIRE przy skrzyni podnosi ($2E9E74), drugi raz stawia przed graczem ($2EA840), skrzynie spadaja kafel na takt ($2E3D58)"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    tab = L(L(0x30CD14) + 0x18)
    out, a = [], tab + 2
    while W(a) and len(out) < 300:
        if W(a) > 1:                                   # 1 = niesiona w chwili zrzutu
            out.append(dict(idx=W(a), under=rd(a + 2, 1)[0]))
        a += 4
    return dict(tile=W(tab) & 0xFF, list=out)


def bombwalls(chip, fast):
    """sciany do wysadzenia (tablica poziomu +$1C, $2E4CC8): kafel + wpisy {indeks, kafel pod spodem}; wybuch bomby
    w oknie 5x5 kafli odslania kafel pod spodem po 25 taktach ($2E4DFE)"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    tab = L(L(0x30CD14) + 0x1C)
    out, a = [], tab + 2
    while W(a) and len(out) < 300:
        if W(a) > 1:
            out.append(dict(idx=W(a), under=rd(a + 2, 1)[0]))
        a += 4
    return dict(tile=W(tab) & 0xFF, list=out)


def traps(chip, fast):
    """kafle akcji, ktore sa pulapkami (tablica poziomu +$0C) - lupa ($2EA7F2) ostrzega przed nimi"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    out, a = [], L(L(0x30CD14) + 0x0C)
    while W(a) and len(out) < 100:
        out.append(W(a)); a += 2
    return out


def bonus(chip, fast):
    """pokoj premii za blokiem '?' ($2E6452 -> $2DEAF4): start gracza i obszar z tablicy poziomu +$76; obszar: +0 skrypt
    generatora deszczu przedmiotow ($2EFF62: co 6 taktow licznik +$A0 = 58, przedmiot gdy > 8, koniec przy 0), +8..+E kamera;
    przedmioty z wazonej tablicy $2F24CE (liczba $2F24CC) -> opisy $2F2510"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    b = L(L(0x30CD14) + 0x76); ar = L(b + 4)
    weights = list(rd(0x2F24CE, W(0x2F24CC)))
    # skrypt generatora (obszar +0): pola x ($0EFE), y ($10FE), licznik ($A0FE), mozg ($7AFC) - szerokosc losowania x:
    # $2EFF62 rnd(176), $2EFFF4 rnd(256), $2F0086 rnd(64)
    gen, a = {}, L(ar)
    for _ in range(40):
        w = W(a)
        if w in (0x0EFE, 0x10FE, 0xA0FE): gen[{0x0EFE: 'x', 0x10FE: 'y', 0xA0FE: 'n'}[w]] = W(a + 2); a += 4
        elif w == 0x7AFC: gen['w'] = {0x2EFF62: 176, 0x2EFFF4: 256, 0x2F0086: 64}[L(a + 2)]; a += 6
        elif w == 0xFFB6: a += 10
        elif w == 0x4CFE: a += 4
        else: break
    return dict(x=W(b), y=W(b + 2), cam=[W(ar + 8), W(ar + 0xA), W(ar + 0xC), W(ar + 0xE)],
                items=['%x' % L(0x2F2510 + 4 * i) for i in weights], count=gen['n'], gen=gen)


def chests(chip, fast):
    """skrzynie skarbow (tablica poziomu +$14, $2E4990): naglowek {.., kafel zamkniety (bajt 4), otwarty (bajt 5)},
    od +6 wpisy po 12 B {indeks kafla, x, y, uzyta, lista przedmiotow.L}; gracz w prostokacie x-24..x+40, y-24..y+16
    przy zamknietym kaflu -> kafel otwarty, co 5 klatek przedmiot z listy (typy do 0, $FFFFFFFF pomijane) wylatuje
    w (x + 2..13, y + 4) z vy -3..-5 i vx +-1 ($2E4ABE); pod woda babelki $2E14BC/$2E15A2/$2E15FC"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    tab = L(L(0x30CD14) + 0x14)
    out, a = [], tab + 6
    while W(a) and len(out) < 200:
        items, q = [], L(a + 8)
        while FB <= q < 0x400000 and len(items) < 32:
            v = L(q); q += 4
            if v == 0:
                break
            if v != 0xFFFFFFFF and FB <= v < 0x400000 and W(v) < 0x8000:
                items.append('%x' % v)
        out.append(dict(idx=W(a), x=W(a + 2), y=W(a + 4), items=items)); a += 12
    return dict(shut=rd(tab + 4, 1)[0], open=rd(tab + 5, 1)[0], list=out)


def currents(chip, fast):
    """prady wodne (tablica poziomu +$28 -> $30CBD2, $2F14D0): prostokaty {x1, y1, x2, y2, dx, dy} do x1 = 0"""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    t = struct.unpack('>I', rd(struct.unpack('>I', rd(0x30CD14, 4))[0] + 0x28, 4))[0]
    out = []
    while t and len(out) < 100:
        e = list(struct.unpack('>6h', rd(t, 12)))
        if not e[0]:
            break
        out.append(e); t += 12
    return out


def treasure(chip, fast):
    """bieg po skarb (6 kawalkow mapy -> $2DD69E): tablica poziomu +$72 {x, y gracza (kamera = -16), obszar.L};
    obszar +0 lista przedmiotow po 6 B {x, y, typ} do x = 0 (typ 0-2 diamenty, 3/4 serce = zycie; 3 nie liczy sie do
    procentu, 4 to ostatni), +8..+E granice kamery; przedmiot pojawia sie, gdy x <= kamera + $15A, w y - $240
    ($2E3786). Kafle biegu w wierszach 36-47 (zamiana wierszy jak w pokoju premii)."""
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>h', rd(a, 2))[0]
    b = L(L(0x30CD14) + 0x72); ar = L(b + 4)
    items, a = [], L(ar)
    while W(a) and len(items) < 400:
        items.append([W(a), W(a + 2), W(a + 4)]); a += 6
    return dict(x=W(b), y=W(b + 2), cam=[W(ar + 8), W(ar + 0xA), W(ar + 0xC), W(ar + 0xE)], items=items)


def quest(chip, fast):
    """przedmioty-narzedzia i miejsca ich uzycia. Narzedzia: rekordy od $30992E (14 B: licznik.L +2, ikona +8, id +$A);
    przedmiot daje narzedzie w procedurze dotyku (+$72) z 'move.l #rekord, $309926' -> {opis: id}. Miejsca (tablica
    poziomu +$10, 22 B, $2E47D8): {id, x0, y0, x1, y1, obszar (indeks w $30CD98+8), procedura, parametr}; procedura
    $2E4886 = blok kafli {wskaznik kafli.L, indeksy.W do 0}"""
    import re
    FB = 0x200000
    rd = lambda a, n: chip[a:a + n] if a < FB else fast[a - FB:a - FB + n]
    L = lambda a: struct.unpack('>I', rd(a, 4))[0]
    W = lambda a: struct.unpack('>H', rd(a, 2))[0]
    rec, a = {}, 0x30992E
    while W(a + 2) == 1:
        rec[a] = L(a + 10); a += 14
    items = {}
    for m in re.finditer(re.escape(bytes.fromhex('23fc0030')) + b'..' + re.escape(bytes.fromhex('00309926')), fast, re.S):
        r = struct.unpack_from('>I', fast, m.start() + 2)[0]
        if not 0 < rec.get(r, 99) < 16:
            continue                                    # tylko narzedzia z numerem (nie bron)
        h = fast.rfind(bytes.fromhex('4e75'), 0, m.start()) + 2 + FB
        for buf, base in ((fast, FB), (chip, 0)):
            for x in re.finditer(re.escape(bytes.fromhex('72fc') + struct.pack('>I', h)), buf):
                q = buf.rfind(bytes.fromhex('ffb6'), max(0, x.start() - 80), x.start())
                items['%x' % (q + base - 2)] = rec[r]
    base = L(0x30CD98)
    spots, a = [], L(L(0x30CD14) + 0x10)
    while W(a) and len(spots) < 40:
        tid, x0, y0, x1, y1 = struct.unpack('>Hhhhh', rd(a, 10))
        area, h, par = L(a + 10), L(a + 14), L(a + 18)
        e = dict(id=tid, rect=[x0, y0, x1, y1], area=str(L(base + 8 + 4 * area)), handler='%x' % h)
        if h == 0x2E4886:                               # blok kafli
            ptr, idx, k = L(par), [], par + 4
            while W(k) and len(idx) < 64:
                idx.append(W(k)); k += 2
            e.update(idx=idx, tiles=list(rd(ptr, len(idx))))
        elif h == 0x2E48C4:                             # dzwon: x spadajacych kamieni (slowa do ujemnego), y = $190
            xs, k = [], par
            while W(k) < 0x8000 and len(xs) < 32:
                xs.append(W(k)); k += 2
            e.update(xs=xs)
        spots.append(e); a += 22
    ropes, a = [], L(L(0x30CD14) + 0x24)              # punkty zaczepu liny (+$24, $2ED1BC): kolumna od..do, kafle liny
    while L(a) and len(ropes) < 40:
        p = L(a)
        if p != 0xFFFFFFFF:
            st, en = W(p), W(p + 2)
            ropes.append(dict(start=st, end=en, tiles=list(rd(p + 4, (en - st) // max(1, W(0x30CA80 + 0x22)) + 1))))
        a += 4
    return dict(items=items, spots=spots, ropes=ropes)


def table_data(meta, chip, fast, w):
    """dane z tablicy poziomu (zrzut z A4 = $30CA80): obszary, sklepy, akcje, kruche kamienie, czas ucieczki"""
    meta['area'], meta['areas'] = areas(chip, fast, w)
    meta['shops'] = shops(chip, fast)
    meta['actions'] = actions(chip, fast)
    meta['brittle'] = brittle(chip, fast)
    meta['crates'] = crates(chip, fast)
    meta['bombwalls'] = bombwalls(chip, fast)
    meta['traps'] = traps(chip, fast)
    meta['bonus'] = bonus(chip, fast)
    meta['treasure'] = treasure(chip, fast)
    meta['chests'] = chests(chip, fast)
    meta['currents'] = currents(chip, fast)
    meta['quest'] = quest(chip, fast)
    lt = struct.unpack_from('>I', fast, 0x30CD14 - 0x200000)[0]
    ev = struct.unpack_from('>I', fast, lt + 0x34 - 0x200000)[0]      # zdarzenie muzyczne -> pozycja utworu ($2E22BE)
    meta['music_events'] = list(fast[ev - 0x200000:ev - 0x200000 + 32])
    lt = struct.unpack_from('>I', fast, 0x30CD14 - 0x200000)[0]       # kafle otwartych drzwi na klucz 2x2 (tablica +$68)
    door = struct.unpack_from('>I', fast, lt + 0x68 - 0x200000)[0]
    meta['keydoor'] = list((chip[door:door + 4] if door < 0x200000 else fast[door - 0x200000:door - 0x200000 + 4]))
    tab = struct.unpack_from('>I', fast, 0x30CD14 - 0x200000)[0] - 0x200000   # czas ucieczki po uwolnieniu zalogi (min, s)
    meta['escape'] = struct.unpack_from('>H', fast, tab + 0x58)[0] * 60 + struct.unpack_from('>H', fast, tab + 0x5A)[0]


if __name__ == '__main__':
    prefix, name = sys.argv[1], sys.argv[2]
    L = LEVELS[name]
    chip = open(prefix + '_chip.bin', 'rb').read()
    fast = open(prefix + '_fast.bin', 'rb').read()
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'game', 'assets')
    os.makedirs(out, exist_ok=True)
    if '--data' in sys.argv:                           # tylko dane z tablicy poziomu, mapa i grafika bez zmian
        meta = json.load(open(os.path.join(out, name + '.json')))
        table_data(meta, chip, fast, L['w'])
        json.dump(meta, open(os.path.join(out, name + '.json'), 'w'), indent=1)
        sys.exit(print(name, 'dane tablicy poziomu, kruche kamienie:', len(meta['brittle']['list'])))
    surf, water, grad = palettes(chip, L)
    sky_at = pal_fn(open(L['sky_dump'] + '_chip.bin', 'rb').read(), L['cop'])
    sky = [hexc(sky_at(line)[1]) for line in range(*L['sky_lines'])]
    m = fast[L['map'] - FAST_BASE: L['map'] - FAST_BASE + L['w'] * L['h']]
    count = max(m) + 1
    atlas(fast, L['bank'], surf, count).save(os.path.join(out, name + '_surface.png'))
    atlas(fast, L['bank'], water, count).save(os.path.join(out, name + '_water.png'))
    open(os.path.join(out, name + '.bin'), 'wb').write(m)
    meta = dict(w=L['w'], h=L['h'], tile=16, tiles=count, start=L['start'],   # start gracza (stopy) z rekordu gracza
                waterY=L['water'] + L['dy'] if L['water'] else 99999,
                skyTop=hexc(grad[0]), sky=sky, skyRow0=L['sky_line0'] - L['pf'] - 1,   # wiersz planszy = skyRow0 - kamera_y/2
                waterColor=hexc(water[1]), surfaceLine=L.get('surface', []),
                attr=list(struct.unpack_from('>256H', chip, L['attr'])))
    table_data(meta, chip, fast, L['w'])
    json.dump(meta, open(os.path.join(out, name + '.json'), 'w'), indent=1)
    print(name, L['w'], 'x', L['h'], 'tiles', count, 'waterY', meta['waterY'], '->', out)
