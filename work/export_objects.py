#!/usr/bin/env python3
"""Eksport obiektow poziomu (przedmioty, stale BOB-y) do game/assets.

Lista obiektow i opisy typow: work/level_data.py. Rekord z bankiem wrogow ($30CD70) jest aktorem
(work/export_actors.py) - tu dostaje tylko znacznik 'actor'. Grafika przedmiotu = BOB z banku
(naglowek 26 B z maska planow, work/level_data.bob_img), komorka atlasu 48x48.
Uzycie: python work/export_objects.py <zrzut> <poziom>      np. python work/export_objects.py work/dumps/lvl1_h level1
Wyjscie: game/assets/<poziom>_objects.json, <poziom>_objects_surface.png, <poziom>_objects_water.png
"""
import json, os, struct, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_level import pal_fn, LEVELS
from level_data import FB, LISTS, ENEMY_BANK, reader, records, descriptor, bob_img, sections
from actor_script import mem, decode


def anim(rd, t):
    """skrypt opisu (typ + 2): blok animacji 'sub1ce0' (np. monety $2F26C2: klatki 0 1 2 3 2 1) i 'delay' -> (klatki, co ile)"""
    blk, delay = None, 1
    for a, s in decode(rd, t + 2, 20):
        w = s.split()
        if w[0] == 'sub1ce0': blk = int(w[1] + w[2], 16)
        if w[0] == 'delay': delay = int(w[1], 16)
    if not blk:
        return None, 1
    ops = [s for a, s in decode(rd, blk, 64)]
    if ops[-1].strip() != 'restart' or not all(s.startswith('frame') for s in ops[:-1]):
        return None, 1                                   # tylko proste petle klatek (ruch i jednorazowe animacje maja aktorzy)
    seq = [int(s.split()[1]) for s in ops[:-1]]
    return (seq if len(set(seq)) > 1 else None), delay

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CELL = 48                                              # komorka atlasu 48x48
# owoce z dzbanow ($2E6990: los z $2E84A2, opisy $2E84C6; typ = opis - 2 jak w liscie obiektow)
POT_FRUITS = [0x2E7D20, 0x2E7D94, 0x2E7DCE, 0x2E7E08, 0x2E7E42, 0x2E7E7C, 0x2E7EB6, 0x2E7EF0, 0x2E7F2A]

if __name__ == '__main__':
    dump, level = sys.argv[1], sys.argv[2]
    chip = open(dump + '_chip.bin', 'rb').read()
    fast = open(dump + '_fast.bin', 'rb').read()
    rd = reader(chip, fast)
    srd = mem(chip, fast)
    L = LEVELS[level]
    pal_at = pal_fn(chip, L['cop'])
    surf = pal_at(L['pf'] + 1)                         # paleta nad woda / pod woda
    water = pal_at(L['water'] + 50) if L['water'] else surf
    # x do $7FFF: $2E35A4 idzie po 26 B, rekord poza mapa (poziom 3: biegacz w x 13464) nie moze rozjechac odczytu
    recs = records(fast, LISTS[level], 0x7FFF)
    gfx, cells, actors = {}, [], set()
    lvl = json.load(open(os.path.join(ROOT, 'game', 'assets', level + '.json')))
    hidden = {int(e['item'], 16) for e in lvl.get('brittle', {}).get('list', []) if 'item' in e}   # przedmioty pod kamieniami
    hidden |= {d - 2 for d in POT_FRUITS}                                                              # owoce z dzbanow
    hidden |= {int(t, 16) for t in lvl.get('bonus', {}).get('items', [])}                            # deszcz w pokoju premii
    for t in sorted({r['type'] for r in recs} | hidden):
        d = descriptor(rd, t)
        if not d:
            continue
        off, var = d
        if var == ENEMY_BANK:
            actors.add(t); continue
        if not FB <= var < 0x400000:
            continue
        a = struct.unpack_from('>I', fast, var - FB)[0] + off
        w, h, ax, ay = struct.unpack_from('>HHhh', chip, a)
        if w < 2 or h < 2 or w > CELL or h > CELL:
            continue                                     # np. wyzwalacze 1x1, duze BOB-y
        cells.append(a)
        gfx['%x' % t] = dict(cell=len(cells) - 1, w=w, h=h, ax=ax, ay=ay)
        if t == 0x2F2FE2:                                # klatka z wiezniem ($2F301A): klatki 0 1 2 (2 = pusta) + dymek HELP ($2F3072)
            c0, b = len(cells) - 1, a
            for k in range(2):
                b += struct.unpack_from('>H', chip, b + 24)[0]; cells.append(b)
            cells.append(struct.unpack_from('>I', fast, var - FB)[0] + 0x4B02)
            dims = lambda c: list(struct.unpack_from('>HHhh', chip, cells[c]))
            gfx['%x' % t].update(frames=[[c0 + k] + dims(c0 + k) for k in range(3)], help=[c0 + 3] + dims(c0 + 3))
        seq, delay = anim(srd, t)
        if seq:                                          # kolejne BOB-y banku za baza = klatki 1, 2, ...
            c0, b = len(cells) - 1, a
            for k in range(max(seq)):
                b += struct.unpack_from('>H', chip, b + 24)[0]; cells.append(b)
            dims = lambda c: list(struct.unpack_from('>HHhh', chip, cells[c]))
            gfx['%x' % t].update(anim=[[c0 + k] + dims(c0 + k) for k in seq], delay=delay)   # [komorka, w, h, ax, ay]
    out = os.path.join(ROOT, 'game', 'assets')
    for name, pal in (('surface', surf), ('water', water)):
        atl = Image.new('RGBA', (CELL * 16, CELL * max(1, (len(cells) + 15) // 16)))
        for i, a in enumerate(cells):
            atl.paste(bob_img(chip, a, pal), (i % 16 * CELL, i // 16 * CELL))
        atl.save(os.path.join(out, '%s_objects_%s.png' % (level, name)))
    def text(r):                                       # tekst wiezina w klatce / ksiazki (p2 -> ASCII, '^' = nowa linia)
        p2 = r['p'][2]
        if not FB <= p2 < 0x400000:
            return {}
        s = fast[p2 - FB:p2 - FB + 600].split(bytes(1))[0]
        return {'text': s.decode('latin1')} if len(s) > 4 and all(32 <= c < 127 for c in s) else {}
    def emit(r):                                       # emitery kropli ($2EF8A8): lista {dx, dy, okres, licznik} do $FFFF
        p1, p2 = r['p'][1], r['p'][2]
        flag = {0x2EFAFA: (0x30CAF1, 2), 0x2EFB0E: (0x30CAF2, 2), 0x2EFB22: (0x30CAF3, 2)}.get(p1)
        if p1 not in (0x2EFAA4, 0x2EFAFA, 0x2EFB0E, 0x2EFB22, 0x2EFB36) or not FB <= p2 < 0x400000:
            return {}
        a = p2
        if p1 == 0x2EFB36:                              # pierwszy dlugi = bajt dzwigni, emituje gdy != 1
            flag = (struct.unpack_from('>I', fast, a - FB)[0], 1); a += 4
        lst = []
        while len(lst) < 16:
            e = struct.unpack_from('>4h', fast, a - FB)
            if e[0] == -1:
                break
            lst.append(list(e)); a += 8
        out = dict(emit=lst)
        if flag:
            out.update(eflag='%x' % flag[0], enot=flag[1])
        if r['type'] == 0x2F2EEE:
            out['enear'] = 1                             # $2EF8B6: tylko gdy gracz w 100 px
        return out
    SECT = sections(fast, chip)                         # sekcja obszaru rekordu: obiekt istnieje tylko w obszarze z ta sekcja ($2E35A4)
    sect_of = lambda a: next(('%x' % p for p, e in SECT if p <= a < e), None)
    objs = [dict(x=r['x'], y=r['y'], type='%x' % r['type'], sect=sect_of(r['addr']), **({'actor': 1} if r['type'] in actors else {}), **text(r), **emit(r)) for r in recs]
    json.dump(dict(cell=CELL, objects=objs, gfx=gfx), open(os.path.join(out, level + '_objects.json'), 'w'), indent=0)
    shown = sum(1 for o in objs if o['type'] in gfx)
    print(len(objs), 'obiektow,', len(gfx), 'typow z grafika,', shown, 'do narysowania,', sum(o.get('actor', 0) for o in objs), 'aktorow')
