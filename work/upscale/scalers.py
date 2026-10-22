#!/usr/bin/env python3
"""Skalery pixel-art 2x na tablicach numpy RGBA (H, W, 4) uint8.

  nearest  - powielenie piksela (punkt odniesienia, wyglad obecnej gry w 2x)
  scale2x  - Scale2x / EPX (A. Mazzoleni), tylko kopiuje kolory
  mmpx     - MMPX (M. McGuire, M. Gagiu 2021), reguly dla pixel-artu, tylko kopiuje kolory
  xbr      - xBR 2x (Hyllian), port vf_xbr.c z ffmpeg (te same decyzje, kanal +-1 przez inne
             zaokraglanie); mieszanie w premultiplied alpha, wiec dziala tez dla sprite'ow
  hq2x     - HQ2x z ffmpeg (-vf hqx=2); alfa: kolor-klucz + odmieszanie (ffmpeg interpoluje
             kanal alfa tymi samymi wagami co RGB)

Przezroczystosc: piksel z alfa 0 to zwykly "kolor" (0,0,0,0) - dla regul porownujacych kolory
(scale2x, mmpx) i dla xbr (roznica alfa liczona jako duza roznica koloru).
Brzegi obrazu: powielenie krawedzi (jak ffmpeg).

Samosprawdzenie: python work/upscale/scalers.py  (porownuje scale2x i xbr z ffmpeg epx / xbr).
"""
import os, subprocess, tempfile
import numpy as np
from PIL import Image


def clean(img):
    """kopia RGBA z przezroczystymi pikselami ujednoliconymi do (0,0,0,0)."""
    a = np.array(img, dtype=np.uint8, copy=True)
    a[a[..., 3] == 0] = 0
    return a


def pack(a):
    return (a[..., 0].astype(np.uint32) << 24) | (a[..., 1].astype(np.uint32) << 16) | \
           (a[..., 2].astype(np.uint32) << 8) | a[..., 3].astype(np.uint32)


def unpack(p):
    return np.stack([(p >> 24) & 255, (p >> 16) & 255, (p >> 8) & 255, p & 255], -1).astype(np.uint8)


def hood(p, r):
    """funkcja n(dx, dy) -> sasiad przesuniety o (dx, dy), brzegi powielone."""
    h, w = p.shape[:2]
    q = np.pad(p, [(r, r), (r, r)] + [(0, 0)] * (p.ndim - 2), mode='edge')
    return lambda dx, dy: q[r + dy:r + dy + h, r + dx:r + dx + w]


def interleave(e0, e1, e2, e3):
    """4 podpiksele (lewy-gorny, prawy-gorny, lewy-dolny, prawy-dolny) -> obraz 2x."""
    h, w = e0.shape[:2]
    out = np.empty((h * 2, w * 2) + e0.shape[2:], e0.dtype)
    out[0::2, 0::2], out[0::2, 1::2], out[1::2, 0::2], out[1::2, 1::2] = e0, e1, e2, e3
    return out


def nearest(a):
    return a.repeat(2, 0).repeat(2, 1)


def scale2x(a):
    p = pack(clean(a)); n = hood(p, 1)
    B, D, E, F, H = n(0, -1), n(-1, 0), p, n(1, 0), n(0, 1)
    e0 = np.where((B == D) & (B != F) & (D != H), D, E)
    e1 = np.where((B == F) & (B != D) & (F != H), F, E)
    e2 = np.where((D == H) & (D != B) & (H != F), D, E)
    e3 = np.where((H == F) & (H != D) & (B != F), F, E)
    return unpack(interleave(e0, e1, e2, e3))


def mmpx(a):
    """port implementacji referencyjnej MMPX (mmpx.js); kolejnosc regul ma znaczenie."""
    p = pack(clean(a)); n = hood(p, 3)
    c = clean(a).astype(np.int64)
    lum = hood((c[..., 0] + c[..., 1] + c[..., 2] + 1) * (256 - c[..., 3]), 3)
    A, B, C, D, E, F, G, H, I = (n(x, y) for y in (-1, 0, 1) for x in (-1, 0, 1))
    P, S, Q, R = n(0, -2), n(0, 2), n(-2, 0), n(2, 0)
    Bl, Dl, El, Fl, Hl = lum(0, -1), lum(-1, 0), lum(0, 0), lum(1, 0), lum(0, 1)
    eq = lambda x, *ys: np.logical_and.reduce([x == y for y in ys])
    anyeq = lambda x, *ys: np.logical_or.reduce([x == y for y in ys])
    noneq = lambda x, *ys: np.logical_and.reduce([x != y for y in ys])
    J, K, L, M = E.copy(), E.copy(), E.copy(), E.copy()

    def put(mask, *pairs):                      # put(mask, (J, D), (L, D)) - przypisania pod maska
        for dst, src in pairs:
            np.copyto(dst, src, where=mask)

    flat = eq(E, A, B, C, D, F, G, H, I)
    # 1:1 - ukosy
    put(~flat & (D == B) & (D != H) & (D != F) & ((El >= Dl) | (E == A)) & anyeq(E, A, C, G) &
        ((El < Dl) | (A != D) | (E != P) | (E != Q)), (J, D))
    put(~flat & (B == F) & (B != D) & (B != H) & ((El >= Bl) | (E == C)) & anyeq(E, A, C, I) &
        ((El < Bl) | (C != B) | (E != P) | (E != R)), (K, B))
    put(~flat & (H == D) & (H != F) & (H != B) & ((El >= Hl) | (E == G)) & anyeq(E, A, G, I) &
        ((El < Hl) | (G != H) | (E != S) | (E != Q)), (L, H))
    put(~flat & (F == H) & (F != B) & (F != D) & ((El >= Fl) | (E == I)) & anyeq(E, C, G, I) &
        ((El < Fl) | (I != H) | (E != R) | (E != S)), (M, F))
    # przeciecia
    put(~flat & (E != F) & eq(E, C, I, D, Q) & eq(F, B, H) & (F != n(3, 0)), (K, F), (M, F))
    put(~flat & (E != D) & eq(E, A, G, F, R) & eq(D, B, H) & (D != n(-3, 0)), (J, D), (L, D))
    put(~flat & (E != H) & eq(E, G, I, B, P) & eq(H, D, F) & (H != n(0, 3)), (L, H), (M, H))
    put(~flat & (E != B) & eq(E, A, C, H, S) & eq(B, D, F) & (B != n(0, -3)), (J, B), (K, B))
    # czubki trojkatow
    put(~flat & (Bl < El) & eq(E, G, H, I, S) & noneq(E, A, D, C, F), (J, B), (K, B))
    put(~flat & (Hl < El) & eq(E, A, B, C, P) & noneq(E, D, G, I, F), (L, H), (M, H))
    put(~flat & (Fl < El) & eq(E, A, D, G, Q) & noneq(E, B, C, I, H), (K, F), (M, F))
    put(~flat & (Dl < El) & eq(E, C, F, I, R) & noneq(E, B, A, G, H), (J, D), (L, D))
    # 2:1 - lagodne zbocza (przypisania z biezacych J/K/L/M, kolejno jak w oryginale)
    hb = ~flat & (H != B)
    h1 = hb & (H != A) & (H != E) & (H != C)
    put(h1 & eq(H, G, F, R) & noneq(H, D, n(2, -1)), (L, M))
    put(h1 & eq(H, I, D, Q) & noneq(H, F, n(-2, -1)), (M, L))
    b1 = hb & (B != I) & (B != G) & (B != E)
    put(b1 & eq(B, A, F, R) & noneq(B, D, n(2, 1)), (J, K))
    put(b1 & eq(B, C, D, Q) & noneq(B, F, n(-2, 1)), (K, J))
    fd = ~flat & (F != D)
    d1 = fd & (D != I) & (D != E) & (D != C)
    put(d1 & eq(D, A, H, S) & noneq(D, B, n(1, 2)), (J, L))
    put(d1 & eq(D, G, B, P) & noneq(D, H, n(1, -2)), (L, J))
    f1 = fd & (F != E) & (F != A) & (F != G)
    put(f1 & eq(F, C, H, S) & noneq(F, B, n(-1, 2)), (K, M))
    put(f1 & eq(F, I, B, P) & noneq(F, H, n(-1, -2)), (M, K))
    return unpack(interleave(J, K, L, M))


def _yuv(c):
    """YUV jak tablica rgbtoyuv w ffmpeg vf_xbr.c (dzielenie calkowite z obcieciem do zera)."""
    r, g, b = (c[..., i].astype(np.int64) for i in range(3))
    tdiv = lambda x: np.trunc(x / 1000).astype(np.int64)
    g0 = np.maximum(np.maximum(g - b, g - r), 0)                    # startg z petli w ffmpeg
    y = (299 * (r - g) + 1000 * g0 + 114 * (b - g)) // 1000 + g - g0
    return np.stack([y, tdiv(-169 * r - 331 * g + 500 * b) + 128, tdiv(500 * r - 419 * g - 81 * b) + 128, c[..., 3]], -1)


def xbr(a):
    a = clean(a)
    p = pack(a); n = hood(p, 2)
    key = a.copy(); key[a[..., 3] == 0] = (255, 0, 255, 0)       # przezroczyste: odlegle od wszystkiego
    yuv = hood(_yuv(key), 2)
    pm = a.astype(np.int64); pm[..., :3] = pm[..., :3] * pm[..., 3:] // 255    # premultiplied
    col = hood(pm, 2)
    E = [pm.copy() for _ in range(4)]
    df = lambda u, v: np.abs(yuv(*u)[..., :3] - yuv(*v)[..., :3]).sum(-1) + 2 * np.abs(yuv(*u)[..., 3] - yuv(*v)[..., 3])
    eq = lambda u, v: df(u, v) < 155
    ne = lambda u, v: n(*u) != n(*v)
    blend = lambda dst, src, m, s: dst + (((src - dst) * m) >> s)    # jak ALPHA_BLEND_*_W, kanal po kanale

    def filt(PE, PI, PH, PF, PG, PC, PD, PB, F4, I4, H5, I5, N1, N2, N3):
        e = df(PE, PC) + df(PE, PG) + df(PI, H5) + df(PI, F4) + 4 * df(PH, PF)
        i = df(PH, PD) + df(PH, I5) + df(PF, I4) + df(PF, PB) + 4 * df(PE, PI)
        hit = ne(PE, PH) & ne(PE, PF) & (e <= i)
        px = np.where((df(PE, PF) <= df(PE, PH))[..., None], col(*PF), col(*PH))
        strong = hit & (e < i) & ((~eq(PF, PB) & ~eq(PH, PD)) | (eq(PE, PI) & (~eq(PF, I4) & ~eq(PH, I5))) |
                                  eq(PE, PG) | eq(PE, PC))
        ke, ki = df(PF, PG), df(PH, PC)
        left = strong & (2 * ke <= ki) & ne(PE, PG) & ne(PD, PG)
        up = strong & (ke >= 2 * ki) & ne(PE, PC) & ne(PB, PC)
        w = lambda m: m[..., None]
        n3 = np.where(w(left & up), blend(E[N3], px, 7, 3),
             np.where(w(left ^ up), blend(E[N3], px, 3, 2),
             np.where(w(hit), blend(E[N3], px, 1, 1), E[N3])))
        n2 = np.where(w(left), blend(E[N2], px, 1, 2), E[N2])
        n1 = np.where(w(left & up), n2, np.where(w(up & ~left), blend(E[N1], px, 1, 2), E[N1]))
        E[N1], E[N2], E[N3] = n1, n2, n3

    o = dict(A=(-1, -1), B=(0, -1), C=(1, -1), D=(-1, 0), E=(0, 0), F=(1, 0), G=(-1, 1), H=(0, 1), I=(1, 1),
             A1=(-1, -2), B1=(0, -2), C1=(1, -2), A0=(-2, -1), D0=(-2, 0), G0=(-2, 1),
             C4=(2, -1), F4=(2, 0), I4=(2, 1), G5=(-1, 2), H5=(0, 2), I5=(1, 2))
    # 4 obroty jak w xbr2x() z ffmpeg: (PE, PI, PH, PF, PG, PC, PD, PB, F4, I4, H5, I5, N1, N2, N3)
    for names, (N1, N2, N3) in ((('E', 'I', 'H', 'F', 'G', 'C', 'D', 'B', 'F4', 'I4', 'H5', 'I5'), (1, 2, 3)),
                                (('E', 'C', 'F', 'B', 'I', 'A', 'H', 'D', 'B1', 'C1', 'F4', 'C4'), (0, 3, 1)),
                                (('E', 'A', 'B', 'D', 'C', 'G', 'F', 'H', 'D0', 'A0', 'B1', 'A1'), (2, 1, 0)),
                                (('E', 'G', 'D', 'H', 'A', 'I', 'B', 'F', 'H5', 'G5', 'D0', 'G0'), (3, 0, 2))):
        filt(*(o[k] for k in names), N1, N2, N3)
    out = interleave(*E)
    al = out[..., 3:]
    rgb = np.where(al > 0, np.minimum(255, (out[..., :3] * 255 + al // 2) // np.maximum(al, 1)), 0)
    return np.concatenate([rgb, al], -1).astype(np.uint8)


KEY = np.array([255, 0, 255])


def ffmpeg(a, vf):
    """filtr ffmpeg na RGBA; przezroczyste -> kolor-klucz, potem odmieszanie klucza wg alfy."""
    a = clean(a); k = a.copy(); k[a[..., 3] == 0, :3] = KEY
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, 'i.png'), os.path.join(d, 'o.png')
        Image.fromarray(k, 'RGBA').save(src)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src,
                        '-vf', 'format=rgba,' + vf, '-pix_fmt', 'rgba', dst], check=True)
        o = np.array(Image.open(dst).convert('RGBA')).astype(np.float64)
    w = o[..., 3:] / 255
    rgb = np.where(w > 0, (o[..., :3] - (1 - w) * KEY) / np.maximum(w, 1e-6), 0)
    return np.concatenate([np.clip(np.rint(rgb), 0, 255), o[..., 3:]], -1).astype(np.uint8)


def hq2x(a):
    return ffmpeg(a, 'hqx=2')


def palette_snap(out, src):
    """kolory wyniku -> najblizszy (RGB) kolor obecny w zrodle; alfa progowana na 50%."""
    s = clean(src)
    pal = np.unique(s[s[..., 3] > 0][:, :3], axis=0).astype(np.int64)
    o = out.copy(); op = o[..., 3] >= 128
    o[~op] = 0; o[op, 3] = 255
    if len(pal) and op.any():
        u, inv = np.unique(o[op][:, :3].astype(np.int64), axis=0, return_inverse=True)
        o[op, :3] = pal[((u[:, None] - pal[None]) ** 2).sum(-1).argmin(1)][inv.ravel()]
    return o


METHODS = {'nearest': nearest, 'scale2x': scale2x, 'mmpx': mmpx, 'xbr': xbr, 'hq2x': hq2x,
           'xbr_pal': lambda a: palette_snap(xbr(a), a)}


def pad_scale(fn, img, p=4, edge=False):
    """skalowanie pojedynczego obrazka: otoczenie przezroczyste (sprite) albo powielone (osobny plik kafla)."""
    q = np.pad(img, [(p, p), (p, p), (0, 0)], mode='edge' if edge else 'constant')
    return fn(q)[2 * p:-2 * p, 2 * p:-2 * p]


def strips(fn, a, rows=96, pad=4):
    """duze obrazy (cala mapa) w pasach z zakladka - ogranicza pamiec numpy."""
    out = []
    for y in range(0, a.shape[0], rows):
        y0, y1 = max(0, y - pad), min(a.shape[0], y + rows + pad)
        s = fn(a[y0:y1])
        out.append(s[2 * (y - y0):2 * (y - y0 + min(rows, a.shape[0] - y))])
    return np.concatenate(out)


def colors(a):
    """liczba roznych kolorow wsrod nieprzezroczystych pikseli."""
    v = a[a[..., 3] > 0][:, :3]
    return len(np.unique(v[:, 0].astype(np.int64) << 16 | v[:, 1].astype(np.int64) << 8 | v[:, 2]))


if __name__ == '__main__':
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'game', 'assets')
    surf = np.array(Image.open(os.path.join(root, 'level1_surface.png')).convert('RGBA'))
    opaque = surf.copy(); opaque[surf[..., 3] == 0] = (85, 153, 221, 255)    # kafle na tle nieba
    ref_epx = ffmpeg(opaque, 'epx=2')
    assert (scale2x(opaque) == ref_epx).all(), 'scale2x != ffmpeg epx'
    ref = ffmpeg(opaque, 'xbr=2')
    d = np.abs(xbr(opaque).astype(int) - ref.astype(int))
    print('xbr vs ffmpeg: pikseli rozniacych sie %.3f%%, max roznica kanalu %d' % (100 * (d.max(-1) > 0).mean(), d.max()))
    assert d.max() <= 1, 'xbr odbiega od ffmpeg'          # te same decyzje, roznice tylko w zaokragleniu o 1
    for name in ('nearest', 'scale2x', 'mmpx'):                # metody kopiujace nie dodaja kolorow
        o = METHODS[name](surf)
        assert o.shape == (512, 512, 4)
        assert colors(o) <= colors(surf), name
        flat = np.full((5, 7, 4), 77, np.uint8)
        assert (METHODS[name](flat) == 77).all(), name
    assert (strips(mmpx, surf, rows=40) == mmpx(surf)).all(), 'strips'
    assert colors(METHODS['xbr_pal'](surf)) <= colors(surf), 'xbr_pal'
    print('ok: scale2x == ffmpeg epx, xbr ~ ffmpeg xbr, nearest/scale2x/mmpx trzymaja palete')
