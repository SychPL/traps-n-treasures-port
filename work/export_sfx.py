#!/usr/bin/env python3
"""Efekty dzwiekowe: gra wstrzykuje je jako nuty instrumentow modulu muzycznego poziomu ($2E216C ->
kolejka $2E227C -> $2E21B8 wpisuje nute w biezaca linie bloku: instrument d0, nuta d1+1, kanal d2).
Dla kazdego poziomu powstaje kopia modulu z nowym utworem: po jednym bloku 64 linie na efekt (linia 0:
nuta na kanale 1, linia 40: F FF = wylacz nute), reszta kanalow pusta. Gra dekoduje caly utwor
(libopenmpt) i tnie go na rowne kawalki - jeden na efekt (kolejnosc jak w SOUNDS).
Wyjscie: game/assets/sfx/level<n>.med + sfx.json {nazwa: dlugosc}. Uzycie: python work/export_sfx.py
"""
import json, os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# nazwa: (instrument d0, nuta d1) z wywolan w kodzie gry (miejsca wywolan w komentarzu)
SOUNDS = {
    'pickup': (40, 12),     # $2E73AC: podniesienie przedmiotu ($2E73A2)
    'kill': (18, 2),        # $2E6C68: smierc wroga po trafieniu
    'free': (30, 4),        # $2E6FE6: uwolnienie czlonka zalogi
    'potion': (59, 38),     # $2E761C: mikstura
    'cannon': (37, 1),      # $2EFBBE: wystrzal armaty
    'mech': (58, 2),        # $2E45E8: mechanizm / podmiana kafli
    'gate': (56, 9),        # $2ED3B8: krata
    'locked': (28, 32),     # $2E45AA: drzwi bez klucza
    'door': (58, 0),        # $2E9E16: przejscie drzwiami ($30CC51)
    'unmech': (58, 1),      # $2E45D2: puszczona przytrzymywana plytka ($2E44DE)
    'throw': (48, 28),      # $2E4BDA: rzut kula
    'bomb': (45, 1),        # $2E4CC2: wybuch bomby
    'bombthrow': (44, 12),  # $2EA61C: rzut bomby
    'explode': (51, 0),     # $2E4D9C: sciana kruszona wybuchem
    'life_up': (48, 31),    # $2E73D4: dodatkowe zycie
    'splash': (33, 55),     # $2F02CE: plusk / woda
    'bounce': (43, 0),      # $2ECF6E: odbicie, upadek
    'crumble': (53, 10),    # $2F4B72: kruchy kamien peka
    'lift': (47, 48),       # $2E9E82: podniesienie skrzyni
    'put': (46, 48),        # $2EA840: postawienie skrzyni
    'rotten': (23, 54),     # $2E73FA: zgnily owoc
    'jump': (36, 28),       # $2E9878: skok
    'bonus': (19, 24),      # $2E653C: blok '?' uderzony
    'rope': (40, 36),       # $2EA75E: rzut lina
    'smash': (38, 7),       # $2E70BA: rozbity dzban
    'bell': (17, 38),       # $2E48CE: dzwon (narzedzie 8)
    'puff': (33, 55),       # $2F02C4: worek (narzedzie 13)
    'screech': (31, 55),    # $2EE124: nietoperz rusza na gracza
    'trap': (33, 12),       # $2E7266: pulapka (poziom 3)
    'gameover': (6, 22),    # $2E1AE6 / $2E1B10: napisy GAME OVER dojechaly (rozkaz $FFC0)
    'sword2': (33, 8),      # $2EA0A4: cios mieczem ze sklepu
    'crooked': (60, 10),    # $2EA514: cios krzywa szabla
    'falldie': (22, 53),    # $2F0CC8: smierc od upadku
    'land': (24, 0),        # $2E42D4: ladowanie po szybkim spadaniu
    'dark': (54, 8),        # $2DDF26: wejscie do ciemnego obszaru
    'cursor': (63, 30),     # $2E8ACC / $2DFAE4: kursor sklepu, wybor w kosciach, zmiana narzedzia
    'fire': (26, 0),        # $2E0A82: ognista kula zapala sie na ziemi (skrypt $2E0B60)
    'spring': (50, 24),     # $2EFCD4: trampolina wyrzuca gracza
    'warn': (49, 52),       # $3091B2: koniec czasu ucieczki
    'spike': (33, 1),       # $2E723C: ukryte kolce
    'tick': (42, 40),       # $2DF3E2/$2E42BC: naliczanie premii, litery w oknie
    'sword': (33, 12),      # $2EA016: pchniecie mieczem
    'swing': (37, 12),      # $2EA1C4: zamach bronia obuchowa
    'buy': (32, 14),        # $2E891C: zakup w sklepie
    'nobuy': (33, 32),      # $2E892C: brak zlota / nie mozna kupic
    'hurt': (35, 12),       # $2E66D0: gracz trafiony
    'die': (29, 43),        # $2E66C2: utrata zycia
    'clink': (62, 30),      # $2EF680: odbicie monety/mikstury (opis typu: $2EFA7A/$2EFA80)
    'sack': (39, 0),        # $2EF680: odbicie sakwy z lupu ($2E807E: $2EFA7A = $27, $2EFA80 = 0)
    'hit': (34, 17),        # $2E6ACC: trafiony wrog przezyl
    'kill2': (21, 48),      # $2E6E9A: smierc aktorow $B85C/$B8AA (procedura $2E6E2A)
    'item': (20, 48),       # $2E753E: przedmiot questu, mapa
    'dia0': (48, 48), 'dia1': (48, 47), 'dia2': (48, 46),   # $2E7556..$2E7576: diamenty biegu po skarb
    'heart': (57, 40),      # $2E75AA: serce w biegu po skarb (+1 zycie)
    'cheer': (57, 53),      # $2EE17C: wiwat w bezczynnosci ($2F1ADC)
    'yawn': (27, 28),       # $2EE18C: ziewniecie ($2F1B3C)
    'whirl': (25, 29),      # $2F167E: silny prad wodny porywa gracza
    'bubble': (32, 12),     # $2F10AA: babelek gracza pod woda
    'balls': (60, 20),      # $2ED824: pomylka w zamku czterech bogow - kule
    'gate_close': (52, 0),  # $2ED3CC: krata opada
    'keydrop': (62, 24),    # $2EEB72: odbicie klucza ($E/$10 mozgu)
    'crash': (31, 40),      # $2EE96E: stalaktyt rozbija sie (obok smash)
    'spark': (55, 0),       # $2E6D2A: smierc z iskrami (procedura $2E6C82, obok kill)
    **{'tick%d' % i: (61, n) for i, n in enumerate((24, 26, 28, 29, 31, 33, 35, 36))},   # $2E439E: przelacznik czasowy ($30B8EA)
}
LINES, OFF_LINE = 64, 40
# dlugosc w klatkach 50 Hz (parametr d3 wywolania - gra ucina efekt po tym czasie)
DUR = {'pickup': 50, 'kill': 60, 'free': 50, 'potion': 50, 'cannon': 30, 'mech': 50, 'gate': 50, 'locked': 30, 'door': 80, 'throw': 50, 'bomb': 80, 'bombthrow': 100, 'explode': 130, 'life_up': 50, 'splash': 20, 'bounce': 50, 'crumble': 20, 'lift': 20, 'put': 20, 'rotten': 80, 'jump': 30, 'bonus': 80, 'rope': 40, 'smash': 50, 'bell': 80, 'puff': 20, 'screech': 80, 'trap': 40, 'spring': 50, 'warn': 60, 'spike': 40, 'tick': 4, 'sword': 10, 'swing': 50, 'buy': 100, 'nobuy': 25, 'hurt': 30, 'die': 50, 'clink': 20, 'hit': 60, 'kill2': 60, 'item': 50, 'dia0': 40, 'dia1': 40, 'dia2': 40, 'heart': 80, 'cheer': 20, 'yawn': 50, 'whirl': 50, 'bubble': 30, 'balls': 60, 'gate_close': 50, 'crash': 80, 'keydrop': 20, 'spark': 30, 'gameover': 60, 'sword2': 10, 'crooked': 30, 'cursor': 12, 'dark': 60, 'falldie': 60, 'land': 20, 'fire': 40, 'sack': 20, 'unmech': 50, **{'tick%d' % i: 30 for i in range(8)}}


def build(mod):
    d = bytearray(mod)
    song, = struct.unpack_from('>I', d, 8)
    o = song + 63 * 8
    blocks = []
    for name, (instr, note) in SOUNDS.items():
        b = bytearray(2 + LINES * 4 * 3)
        b[0], b[1] = 4, LINES - 1
        n = note + 1
        b[2] = (n & 0x3F) | ((instr >> 4 & 1) << 7) | ((instr >> 5 & 1) << 6)
        b[3] = (instr & 0x0F) << 4
        p = 2 + OFF_LINE * 12
        b[p + 1], b[p + 2] = 0x0F, 0xFF               # komenda F FF: koniec nuty
        blocks.append(b)
    while len(d) % 4:
        d.append(0)
    arr = len(d)
    d += bytes(4 * len(blocks))
    for i, b in enumerate(blocks):
        struct.pack_into('>I', d, arr + 4 * i, len(d))
        d += b
        while len(d) % 2:
            d.append(0)
    struct.pack_into('>I', d, 16, arr)                # blockarr
    struct.pack_into('>HH', d, o, len(blocks), len(blocks))   # numblocks, songlen
    for i in range(256):
        d[o + 4 + i] = i if i < len(blocks) else 0
    struct.pack_into('>I', d, 4, len(d))              # modlen
    return bytes(d)


if __name__ == '__main__':
    out = os.path.join(ROOT, 'game', 'assets', 'sfx')
    os.makedirs(out, exist_ok=True)
    for n in (1, 2, 3, 4):
        mod = open(os.path.join(ROOT, 'game', 'assets', 'music', 'level%d.med' % n), 'rb').read()
        open(os.path.join(out, 'level%d.med' % n), 'wb').write(build(mod))
    json.dump({k: DUR[k] for k in SOUNDS}, open(os.path.join(out, 'sfx.json'), 'w'))
    print(len(SOUNDS), 'efektow x 4 poziomy ->', out)
