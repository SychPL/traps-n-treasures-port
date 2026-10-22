#!/usr/bin/env python3
"""Eksport aktorow poziomu (wrogowie) dla silnika skryptow w game/actors.js.

Zrodla: work/level_data.py (lista obiektow po relokacji, opisy typow, banki BOB-ow).
- aktor = rekord, ktorego skrypt startowy ustawia baze w banku wrogow ($30CD70); skrypt = typ + 2
  (chip $9A4C+ w poziomach 1-2, fast w 3-4).
- klatka i skryptu = i-ty BOB liczac od bazy (rozkaz 'base' $FFB6); wszystkie BOB-y obu bankow -> atlas.
- p1 = procedura startowa (adres w kodzie), p2 = dane (zasieg, dystans, predkosc) albo liczba (np. predkosc
  skoku); z procedury startowej czytane sa bloki animacji (move.l #blok,$1e/$22/...(a1)) i procedura co takt ($7a).
- pamiec skryptow: okna chip/fast obejmujace skrypty i bloki animacji (JSON 'mem').
Wyjscie: game/assets/<poziom>_actors.json, <poziom>_actors_surface.png, <poziom>_actors_water.png
Uzycie: python work/export_actors.py <zrzut> <poziom>   (np. work/dumps/lvl1_h level1)
"""
import json, os, struct, sys
import capstone
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_level import pal_fn, LEVELS
from level_data import FB, CODE, LISTS, ENEMY_BANK, ITEM_BANK, reader, records, sections, descriptor, walk_bank, bob_img

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# okna pamieci ze skryptami (bloki animacji/sciezek, skrypty tworzonych aktorow): program poziomu w chip,
# skrypty glownego programu w fast (poziomy 3-4: $2FF000-$309000)
MEM = [(0x9800, 0xC800), (0x2FF000, 0x309000), (0x2E0F00, 0x2E1A60), (0x2F2B00, 0x2F2C80), (0x2F2E30, 0x2F3040), (0x2EB200, 0x2EB900), (0x2E0D00, 0x2E0EA0)]
# procedury startowe (adres) -> zachowanie w silniku; aktorzy bez p1 dostaja zachowanie po polu $7A
# ze skryptu startowego (game/actors.js, TICKS)
BEHAVIOR = {CODE + k: v for k, v in {0xF9FC: 'clam', 0xFA24: 'swordfish', 0x11A90: 'walker', 0x11B14: 'walker',
            0x11B5E: 'crab', 0x11C26: 'dropper', 0x11D6E: 'walker', 0x124AC: 'starfish'}.items()}
BEHAVIOR.update({0x2EC4A4: 'runner', 0x2EC04A: 'pirate', 0x2EBF2E: 'axeman', 0x2ED34A: 'gate', 0x2EE724: 'swimmer'})
# poziomy 2-4: procedury z kodu gry (opis w game/actors.js); p2 = dane w pamieci albo liczba, bajt stanu dla zapadni/scian
BEHAVIOR.update({0x2ED33A: 'gate', 0x2ED41E: 'trapdoor', 0x2ED2EC: 'vanish', 0x2EE19C: 'bob', 0x2EC476: 'roamer',
                 0x2EC750: 'ghoul', 0x2EEF64: 'skull', 0x2EED08: 'roller', 0x2ECF94: 'mace', 0x2ECF04: 'macefast',
                 0x2EC1B8: 'crawler'})
STATE_BEH = {'gate', 'trapdoor', 'vanish'}
# ruch po programie ($2EF23E): program = p2 albo stala $300BFA (stop) dla wariantow $2EFC4C/$2EFC5C/$2EF1F0
MOVER = {0x2EF23E: None, 0x2EFC4C: 0x300BFA, 0x2EFC5C: 0x300BFA, 0x2EF1F0: 0x300BFA}


# inne procedury startowe z ta sama procedura co takt ($7A) -> to samo zachowanie (inne bloki animacji)
TICK_BEH = {0x2EE86A: 'walker', 0x2EE50E: 'crab', 0x2EC3D4: 'swordfish', 0x2EEE52: 'starfish', 0x2EC396: 'clam',
            0x2EC4DE: 'runner', 0x2EC0A4: 'pirate', 0x2EBF78: 'axeman'}


def init_routine(fast, p1):
    """bloki animacji (pole mozgu -> adres) z procedury startowej; bloki z 'lea.l $blok.l, a1' w procedurze
    co takt (np. rozgwiazda: lewo, prawo) dopisane jako 'l0', 'l1'..."""
    md = capstone.Cs(capstone.CS_ARCH_M68K, capstone.CS_MODE_BIG_ENDIAN | capstone.CS_MODE_M68K_000)
    anims, tick = {}, None
    for i in md.disasm(fast[p1 - FB:p1 - FB + 0x80], p1):
        if i.mnemonic == 'rts':
            break
        if i.mnemonic == 'move.l' and i.op_str.startswith('#$'):
            imm, dst = i.op_str.split(', ')
            if dst.endswith('(a1)'):
                anims[dst[1:3]] = int(imm[2:], 16)
            elif dst == '$7a(a0)':
                tick = int(imm[2:], 16)
    if tick and tick != p1:
        for i in md.disasm(fast[tick - FB:tick - FB + 0x60], tick):
            if i.mnemonic == 'rts':
                break
            if i.mnemonic == 'lea.l' and i.op_str.endswith('.l, a1'):
                anims['l%d' % sum(k[0] == 'l' for k in anims)] = int(i.op_str[1:].split('.')[0], 16)
    return anims, tick


def script_mem(actors):
    """okno chip ze skryptami programu poziomu ($9A4C+) powiekszone do najwiekszego skryptu + okna fast skryptow"""
    top = max([MEM[0][1]] + [a['script'] + 0x800 for a in actors if a['script'] < FB])
    out = [(0x9800, top)] + MEM[1:]
    for a in actors:
        if a['script'] >= FB and not any(lo <= a['script'] < hi - 0x100 for lo, hi in out):
            out.append((a['script'] - 2, a['script'] + 0x300))
        if a.get('prog') and not any(lo <= a['prog'] < hi - 0x100 for lo, hi in out):
            out.append((a['prog'], a['prog'] + 0x200))       # program ruchu
    return out


def trigger_mem(triggers):
    """okna ze skryptami i programami ruchu aktorow tworzonych przez wyzwalacze"""
    out = []
    for t in triggers:
        for a in [t.get('script', 0)] + t.get('progs', []):
            if a and not any(lo <= a < hi - 0x100 for lo, hi in MEM + out):
                out.append((a - 2, a + 0x200))
    return out


def extra_mem(actors):
    """okna pamieci fast z blokami animacji spoza MEM (inne poziomy maja bloki w innych miejscach) i danymi p2"""
    out = []
    for a in actors:
        p2 = a.get('p2', 0)
        if FB <= p2 < 0x320000 and not any(lo <= p2 < hi - 0x20 for lo, hi in MEM + out):
            out.append((p2, p2 + 0x40))
        for blk in a.get('anims', {}).values():
            if blk >= FB and not any(lo <= blk < hi for lo, hi in MEM + out):
                out.append((blk - 0x40, blk + 0x100))
    return out


if __name__ == '__main__':
    dump, level = sys.argv[1], sys.argv[2]
    chip = open(dump + '_chip.bin', 'rb').read()
    fast = open(dump + '_fast.bin', 'rb').read()
    L = LEVELS[level]
    pal_at = pal_fn(chip, L['cop'])
    pals = {'surface': pal_at(L['pf'] + 1), 'water': pal_at(L['water'] + 50) if L['water'] else pal_at(L['pf'] + 1)}
    BANKS = {v: struct.unpack_from('>I', fast, v - FB)[0] for v in (ENEMY_BANK, ITEM_BANK)}
    frames = []
    for var, base in BANKS.items():
        frames += walk_bank(chip, base)
    # pakowanie polkowe do atlasu 512 px
    x = y = row = 0
    for a, f in frames:
        if x + f['w'] > 512:
            x, y, row = 0, y + row + 1, 0
        f.update(sx=x, sy=y)
        x, row = x + f['w'] + 1, max(row, f['h'])
    for name, pal in pals.items():
        atl = Image.new('RGBA', (512, y + row + 1))
        for a, f in frames:
            atl.paste(bob_img(chip, a, pal), (f['sx'], f['sy']))
        atl.save(os.path.join(ROOT, 'game', 'assets', '%s_actors_%s.png' % (level, name)))
    rdm = reader(chip, fast)
    rd = lambda a, b: rdm(a, b - a)
    SECT = sections(fast, chip)                         # rekord -> sekcja obszaru (wskaznik poczatku sekcji)
    sect_of = lambda a: next(('%x' % p for p, e in SECT if p <= a < e), None)
    actors = []
    # x do $7FFF: $2E35A4 idzie po 26 B, rekord poza mapa (poziom 3: biegacz w x 13464) nie moze rozjechac odczytu
    for r in records(fast, LISTS[level], 0x7FFF):
        d = descriptor(rdm, r['type'])
        if not d or d[1] != ENEMY_BANK:                  # aktor = skrypt z baza w banku wrogow
            continue
        p1, p2 = r['p'][1], r['p'][2]
        hp, hurt = rdm(r['type'], 2)                     # $2E3600: 2 bajty opisu -> rekord +$16 wytrzymalosc, +$18 obrazenia gracza
        act = dict(x=r['x'], y=r['y'], type='%x' % r['type'], script=r['type'] + 2, hp=hp, hurt=hurt)
        if BEHAVIOR.get(p1) in STATE_BEH:
            act['state'] = '%x' % p2                     # krata/zapadnia/sciana: bajt stanu ustawiany dzwignia/zamkiem
        if p1 == 0x2EFAD8 and FB <= p2 < 0x320000:       # polozenie z danych (x, y)
            act['x'], act['y'] = struct.unpack_from('>hh', fast, p2 - FB)
        if BEHAVIOR.get(p1) in ('ghoul', 'bob', 'crawler', 'skull', 'roller', 'mace', 'macefast'):
            act['p2'] = p2 - ((p2 >> 31) << 32)
        if p1 in MOVER:
            act['beh'], act['prog'] = 'mover', MOVER[p1] or p2
            if p1 in (0x2EFC4C, 0x2EFC5C):                # $7E = p2: program po wejsciu gracza ($2E6430) / sekwencja trampoliny
                act['p7e'] = p2
            if p1 == 0x2EFC4C and FB <= p2 < 0x320000:    # trampolina ($2EFC6C -> $2F48E0): dy gracza na klatke od +8 do $0FFC
                lift, q = [], p2 + 8
                while len(lift) < 400:
                    v = struct.unpack('>h', rdm(q, 2))[0]
                    if v == 0x0FFC:
                        break
                    lift.append(v); q += 2
                act['lift'] = lift
        elif FB <= p1 < 0x320000:
            act['anims'], tick = init_routine(fast, p1)
            act['beh'] = BEHAVIOR.get(p1) or TICK_BEH.get(tick) or 'p1_%x' % p1
            act['p3'] = list(struct.unpack_from('>3h', fast, p2 - FB)) if FB <= p2 < 0x320000 else p2 - ((p2 >> 31) << 32)
        if p1 == 0x2EFA92 and FB <= p2 < 0x320000:       # pojemnik ($2E62D2 przy dotyku): lista {opis.L, dx.W, dy.W} do ujemnego
            items, q = [], p2
            while len(items) < 8:
                v, dx, dy = struct.unpack('>ihh', rdm(q, 8))
                if v < 0 or not 0 < v < 0x320000:
                    break
                sc = v + 2 if not items else v           # pierwszy opis: 2 bajty (rekord +$18/+$16), potem skrypt
                if rdm(sc, 2) != bytes.fromhex('ffb6'):
                    items = []; break
                items.append([sc, dx, dy] + ([] if items else list(rdm(v, 2)))); q += 8   # $2E6338: pierwszy dostaje hp, obrazenia
            if items:
                act['burst'] = items
        act['sect'] = sect_of(r['addr'])
        actors.append(act)
    # wyzwalacze (niewidzialny typ 160AC) z procedurami: generatory aktorow, rzedy platform, podmiana kafli
    triggers = []
    W16 = lambda a: struct.unpack('>h', rdm(a, 2))[0]
    L32 = lambda a: struct.unpack('>I', rdm(a, 4))[0]
    for r in records(fast, LISTS[level], 0x7FFF):
        p1, p2 = r['p'][1], r['p'][2]
        t = dict(x=r['x'], y=r['y'])
        if p1 == 0x2EDF14:                               # licznik, okres, dx, dy: przy 0 aktor $A302 w (x+dx, y+dy); znika jak $2E3694
            e, a = [], p2
            while W16(a) >= 0 and len(e) < 64:
                e.append([W16(a + 2), W16(a + 4), W16(a + 6), W16(a)]); a += 8
            t.update(kind='spawn', script=0xA302, entries=e, despawn='win')
        elif p1 in (0x2EBCF8, 0x2EBD0E):                 # licznik, okres, predkosc: beczka $B34C ($2EED08) w miejscu wyzwalacza
            e, a = [], p2
            while W16(a) >= 0 and len(e) < 64:
                e.append([W16(a + 2), 0, 0, W16(a), W16(a + 4)]); a += 6
            t.update(kind='spawn', script=0xB34C, entries=e, beh='roller', despawn='win' if p1 == 0x2EBCF8 else 'far')
        elif p1 in (0x2EF0E4, 0x2EF13A):                 # rzad platform $308038 co 16 px z programami ruchu z listy
            progs, a = [], p2
            while L32(a) and len(progs) < 32:
                progs.append(L32(a)); a += 4
            dy = 16 if p1 == 0x2EF0E4 else 0
            t.update(kind='row', parts=[[0x308038, 16 * (k + 1), dy, pr] for k, pr in enumerate(progs)])
        elif p1 == 0x2EF184:                             # kolumna: podstawa $308294 w y + 6, wyzej co 16 px $308294 z programami, szczyt $308246
            progs, a = [], p2
            while L32(a) and len(progs) < 32:
                progs.append(L32(a)); a += 4
            parts = [[0x308294, 0, 6, 0]] + [[0x308294 if k < len(progs) - 1 else 0x308246, 0, 6 - 16 * (k + 1), pr]
                                             for k, pr in enumerate(progs)]
            t.update(kind='row', parts=parts)
        elif p1 == 0x2EF978:                             # co rnd(50) + 50 taktow spadajacy $3088E8, dystans p2
            t.update(kind='fall', dist=p2 & 0xFFFF)
        elif p1 == 0x2EFD92:                             # duchy $307E2C: zwloka, potem co okres (slowa pod p2)
            t.update(kind='ghosts', delay=W16(p2), period=W16(p2 + 2))
        elif p1 == 0x2EDDEE:                             # jak $2EDF14: aktor $B5B8 (opis $B5B6 + 2) w (x+dx, y+dy)
            e, a = [], p2
            while W16(a) >= 0 and len(e) < 64:
                e.append([W16(a + 2), W16(a + 4), W16(a + 6), W16(a)]); a += 8
            t.update(kind='spawn', script=0xB5B8, entries=e, despawn='win')
        elif p1 == 0x2EDF6E:                             # {licznik, okres, y, strona}: $A5CC od lewej krawedzi ekranu / $A580 od prawej
            e, a = [], p2
            while W16(a) >= 0 and len(e) < 64:
                e.append([W16(a + 2), W16(a + 4), W16(a + 6), W16(a)]); a += 8
            t.update(kind='edge', entries=e, despawn='win')
        elif p1 == 0x2EBD72:                             # bajt stanu p2 (kombinacja) -> beczka $B34C, jedna naraz ($30CC70)
            t.update(kind='flagroll', state='%x' % p2, despawn='far')
        elif p1 == 0x2EC5A0:                             # gracz y >= 500, A4 x <= 800: $AC78 z boku ekranu co rnd(30) + 20 taktow
            t.update(kind='sides', despawn='far')
        elif p1 == 0x2ED4F6:                             # plyta: blok kafli $2F9598 na stale w procedurze (+4 nacisk, +8 zejscie)
            blk, idx = 0x2F9598, []
            a = blk + 12
            while W16(a) and len(idx) < 64:
                idx.append(W16(a) & 0xFFFF); a += 2
            t.update(kind='plate', idx=idx, a=list(rdm(L32(blk + 4), len(idx))), b=list(rdm(L32(blk + 8), len(idx))),
                     doneTile=0xFD0, doneVal=0x8C, despawn='win')
        elif p1 == 0x2EBA74:                             # poziom 3: co 46 taktow suwak $300E12 z jednego konca (bajt stanu p2)
            t.update(kind='sliders', state='%x' % p2)
        elif p1 == 0x2EBB38:                             # rzutki, gdy y gracza przekroczy wysokosc wpisu {x, y, kierunek}
            e, a = [], p2
            while W16(a) >= 0 and len(e) < 64:
                e.append([W16(a), W16(a + 2), W16(a + 4)]); a += 6
            t.update(kind='vdarts', entries=e, despawn='win')
        elif p1 == 0x2EB970:                             # generator deszczu (poziom 4, $30CC9F): krople $307FAA / $307FEC co 5 taktow
            t.update(kind='rain')
        elif r['type'] == 0x300DE2 and FB <= p2 < 0x320000:   # $2E7BDC: pulapka z rzutkami {x, y, kierunek, zwloka} do ujemnego
            e, a = [], p2
            while W16(a) >= 0 and len(e) < 64:
                e.append([W16(a), W16(a + 2), W16(a + 4), W16(a + 6)]); a += 8
            t.update(kind='darts', entries=e)
        elif r['type'] in (0x300DAA, 0x300DC6) and p2:   # $2E658C/$2E659C: dotyk ustawia bajt stanu 1/2 (chyba ze 3/4)
            t.update(kind='flag', addr='%x' % p2, val=1 if r['type'] == 0x300DAA else 2)
            if p1 == 0x2ED3EE:                           # $7E = $30CB05; przy bajcie 3 rekord znika na zawsze ($2E3802)
                t.update(addr='30cb05', gone=3)
        elif p1 == 0x2EFA92 and r['type'] == 0x2F2578:  # $2E701E: niewidoczny, dotkniety -> aktor (opis +4) w (x, y) z danych
            t.update(kind='ambush', sx=W16(p2), sy=W16(p2 + 2), script=L32(p2 + 4) + 2)
        elif p1 in (0x2ED58E, 0x2ED616):                 # gracz w oknie x+-16, y-8..+32 -> kafle 'otwarte' (ptrB)
            idx, a = [], p2 + 12
            while W16(a) and len(idx) < 64:
                idx.append(W16(a) & 0xFFFF); a += 2
            vals = list(rdm(L32(p2 + 8), len(idx)))
            t.update(kind='tiles', idx=idx, vals=vals)
        else:
            continue
        t['sect'] = sect_of(r['addr'])
        triggers.append(t)
    out = dict(banks={'%x' % v: b for v, b in BANKS.items()}, triggers=triggers,
               frames={'%x' % a: [f['sx'], f['sy'], f['w'], f['h'], f['ax'], f['ay']] + f['box'] for a, f in frames},   # + ramka kolizji
               order=['%x' % a for a, f in frames],
               mem=[[a, rd(a, b).hex()] for a, b in script_mem(actors) + extra_mem(actors) + trigger_mem(triggers)], actors=actors)
    json.dump(out, open(os.path.join(ROOT, 'game', 'assets', level + '_actors.json'), 'w'), separators=(',', ':'))
    print(len(frames), 'klatek BOB,', len(actors), 'aktorow,', len(triggers), 'wyzwalaczy,', sorted({a.get('beh', '-') for a in actors}))
