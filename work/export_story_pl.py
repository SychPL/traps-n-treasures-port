#!/usr/bin/env python3
"""Polska wersja przewijanej historii z intra, zlozona z liter ozdobnego fontu wycietych z game/assets/story_text.png.

Litery w slowach stykaja sie obwodka, wiec przerwy w kolumnach dziela tylko slowa. Szerokosci liter: najmniejsze
kwadraty (szerokosc slowa = suma szerokosci liter; srednio 0,7 px bledu), ciecia doprowadzone do najrzadszej
kolumny w +-3 px. Wiersz tekstu co 42 px, linie wysrodkowane. Polskie znaki: litera + kropka z 'i' (kreska / kropka)
albo przecinek (ogonek), l z kreska z '-'. Tekst angielski w pamieci gry (work/dumps/map1_fast.bin, 'The previous
history'). Wyjscie: game/assets/story_text_pl.png. Uzycie: python work/export_story_pl.py (po work/export_story.py)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PITCH, MAXW = 42, 304

PL = """Dotychczasowa historia:
-------

Jest rok 1641.

Jeremy Flynn, kapitan statku Posejdon, od wielu dni żegluje z załogą liczącą 37 marynarzy.

23 maja wpływają na niebezpieczne wody wokół Tortugi...

*****

Dziennik J. Flynna:


> 23 maja 1641 <

Wciąż panuje cisza, a dziś rano zepsuł się kompas.

Dokładna nawigacja jest teraz niemożliwa, przynajmniej za dnia.

Wciąż jesteśmy na niezwykle niebezpiecznych wodach. Do tego kończą się zapasy.


> 25 maja 1641 <

Jesteśmy dalej od pierwotnego kursu, niż sądziłem. Dryfujące drewno, które wypatrzył nasz człowiek na bocianim gnieździe, mówi mi, że ląd musi być blisko.

Teraz mogę ustalić przybliżoną pozycję za pomocą mapy morskiej.

Po bliższym przyjrzeniu się mogę wykluczyć, że ten ląd jest kontynentem.


> 26 maja 1641 <

Moje obawy się potwierdziły. To Diabla Wyspa, baza Rudobrodego i jego rzezimieszków.
Niestety zrozumiałem to dopiero teraz, gdy ludzie Rudobrodego podstępnie napadli nas zeszłej nocy.

Doszedłem do wniosku, że wśród moich ludzi musi być zdrajca, który zniszczył kompas i tej nocy obezwładnił wartę.

W ostatniej chwili ukryłem się w podwójnej ścianie kajuty, gdy te łotry przyszły szukać pieniędzy.

Teraz spróbuję dostać się na wyspę, uwolnić moich ludzi i odzyskać mój majątek, a może nawet trochę więcej...

*****"""
ACC = {'ą': 'ao', 'ć': 'ca', 'ę': 'eo', 'ł': 'ls', 'ń': 'na', 'ó': 'oa', 'ś': 'sa', 'ź': 'za', 'ż': 'zd'}


def story_lines():
    b = open(os.path.join(ROOT, 'work', 'dumps', 'map1_fast.bin'), 'rb').read()
    i = b.find(b'The previous history')
    lines = [l.decode('latin1') for l in b[i:b.find(b'\xff', i)].split(b'\x00')]
    while lines and not lines[-1]:
        lines.pop()
    return lines


def runs(cols):
    out, x = [], 0
    while x < len(cols):
        if cols[x]:
            s = x
            while x < len(cols) and cols[x]:
                x += 1
            out.append((s, x))
        else:
            x += 1
    return out


if __name__ == '__main__':
    img = np.array(Image.open(os.path.join(ROOT, 'game', 'assets', 'story_text.png')))
    alpha = img[:, :, 3] > 0
    words = []                                          # (wiersz, x0, x1, tekst)
    for k, l in enumerate(story_lines()):
        if not l.strip():
            continue
        rs = runs(alpha[PITCH * k:PITCH * k + PITCH].any(axis=0))
        toks = l.split()
        if l.strip() == '*****':
            toks = list('*****')
        elif l.strip() == '37 sailors':
            toks = ['3', '7', 'sailors']
        if len(rs) == len(toks):
            words += [(k, s, e, w) for (s, e), w in zip(rs, toks)]
    chars = sorted({c for *_, w in words for c in w})
    ix = {c: i for i, c in enumerate(chars)}
    A = np.zeros((len(words), len(chars) + 1)); y = np.zeros(len(words))
    for r, (k, s, e, w) in enumerate(words):
        for c in w:
            A[r, ix[c]] += 1
        A[r, -1] = 1; y[r] = e - s
    wid = np.linalg.lstsq(A, y, rcond=None)[0]
    samples = {}
    for k, s, e, w in words:                            # ciecia: skumulowane szerokosci, dociagniete do rzadkiej kolumny
        sl = img[PITCH * k:PITCH * k + PITCH]
        cov = (sl[:, :, 3] > 0).sum(axis=0)
        ws = np.array([wid[ix[c]] for c in w]); cuts = [s]
        acc = s
        for c_w in ws[:-1] * (e - s) / ws.sum():
            acc += c_w
            lo, hi = int(acc) - 3, int(acc) + 4
            cuts.append(lo + int(np.argmin(cov[lo:hi])))
        cuts.append(e)
        for c, a, b in zip(w, cuts, cuts[1:]):
            if b > a:
                samples.setdefault(c, []).append(sl[:, a:b])
    from scipy import ndimage
    def clean(g):                                       # tylko plamy >= 12 px (okruchy z sasiednich wierszy precz)
        g = g.copy(); lab, n = ndimage.label(g[:, :, 3] > 0)
        for i in range(1, n + 1):
            if (lab == i).sum() < 12:
                g[lab == i] = 0
        return g
    glyph = {}
    for c, ss in samples.items():                       # probka o szerokosci najblizszej medianie
        med = np.median([g.shape[1] for g in ss])
        glyph[c] = clean(min(ss, key=lambda g: abs(g.shape[1] - med)))
    gaps = [b[1] - a[2] for a, b in zip(words, words[1:]) if a[0] == b[0] and a[3] != '*' and b[3] != '*']
    space = int(np.median(gaps)) if gaps else 8
    # kropka z 'i' (gorna plama) i przecinek na ogonek, kawalek '-' na l z kreska
    gi = glyph['i']; cnt = (gi[:, :, 3] > 0).sum(axis=1); rows = np.nonzero(cnt)[0]
    top = rows[0]; neck = top + 3 + int(np.argmin(cnt[top + 3:top + 12]))   # zwezenie miedzy kropka a laska
    dot = gi[top:neck]; dot = dot[:, (dot[:, :, 3] > 0).any(axis=0)]
    comma = glyph[','][:, (glyph[','][:, :, 3] > 0).any(axis=0)]
    crow = np.nonzero((comma[:, :, 3] > 0).any(axis=1))[0]
    comma = comma[crow[0]:crow[-1] + 1]
    dash = glyph['-']; drow = np.nonzero((dash[:, :, 3] > 0).any(axis=1))[0]
    dash = dash[drow[0]:drow[-1] + 1, 2:9]

    def paste(dst, src, x, y):
        h, w = src.shape[:2]; m = src[:, :, 3] > 0
        sub = dst[y:y + h, x:x + w]; sub[m[:sub.shape[0], :sub.shape[1]]] = src[:sub.shape[0], :sub.shape[1]][m[:sub.shape[0], :sub.shape[1]]]

    def letter(ch):                                     # (obraz, szerokosc) z polskim znakiem
        a = ACC.get(ch)
        base = glyph[a[0] if a else ch].copy()
        if not a:
            return base
        body = np.nonzero((base[:, :, 3] > 0).any(axis=1))[0]
        w = base.shape[1]
        if a[1] in 'ad':                                # kreska / kropka nad litera
            out = base.copy(); dy = max(0, body[0] - dot.shape[0] - 1)
            paste(out, dot, max(0, (w - dot.shape[1]) // 2 + (2 if a[1] == 'a' else 0)), dy)
            return out
        if a[1] == 'o':                                 # ogonek pod prawa strona
            out = base.copy(); paste(out, comma, max(0, w - comma.shape[1] - 1), min(PITCH - comma.shape[0], body[-1] - 2))
            return out
        # l z kreska: ukosna kreska 2 px w kolorach litery (wypelnienie = najczestszy jasny, obwodka = najciemniejszy)
        px = base[base[:, :, 3] > 0][:, :3].astype(int)
        dark = px[px.sum(axis=1).argmin()]
        bright = px[px.sum(axis=1) > np.median(px.sum(axis=1))]
        cols, cnt = np.unique(bright, axis=0, return_counts=True); fill = cols[cnt.argmax()]
        out = base.copy(); cx0, my = w // 2, (body[0] + body[-1]) // 2
        for d in range(-4, 5):                          # obwodka, potem srodek
            for t in (-2, -1, 0, 1, 2):
                yy, xx = my - d // 2 + t, cx0 + d
                if 0 <= yy < PITCH and 0 <= xx < w:
                    out[yy, xx] = (*dark, 255)
        for d in range(-3, 4):
            for t in (0, 1):
                yy, xx = my - d // 2 + t - 1, cx0 + d
                if 0 <= yy < PITCH and 0 <= xx < w:
                    out[yy, xx] = (*fill, 255)
        return out

    width = lambda t: sum(space if c == ' ' else letter(c).shape[1] for c in t)
    lines = []
    for par in PL.split('\n'):
        if not par.strip():
            lines.append(''); continue
        cur = ''
        for w in par.split():
            nxt = (cur + ' ' + w).strip()
            if cur and width(nxt) > MAXW:
                lines.append(cur); cur = w
            else:
                cur = nxt
        lines.append(cur)
    out = np.zeros((PITCH * len(lines), 320, 4), np.uint8)
    missing = set()
    for k, l in enumerate(lines):
        x = (320 - width(l)) // 2
        for c in l:
            if c == ' ':
                x += space; continue
            if (ACC.get(c, c)[0]) not in glyph:
                missing.add(c); continue
            g = letter(c); paste(out, g, x, PITCH * k); x += g.shape[1]
    Image.fromarray(out, 'RGBA').save(os.path.join(ROOT, 'game', 'assets', 'story_text_pl.png'))
    print(len(lines), 'linii, brak znakow:', ''.join(sorted(missing)) or '-', ', spacja', space)
