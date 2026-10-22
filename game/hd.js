'use strict';
// HD: skalowanie gotowej klatki 320x211 w WebGL2 (work/upscale/RAPORT.md, rozdz. 6).
// main.js rysuje dalej na #c (2D, 1x). W trybie HD #c jest schowany, a po kazdej klatce idzie jako tekstura
// do jednego fragment shadera, ktory rysuje 2x na widocznym canvasie WebGL 640x422 (rozmiar CSS jak #c, fit()).
// Tryby: mmpx (domyslny, tylko kolory oryginalu), xbr (xBR-lv2, gladki), nearest, off (= dzisiejsze rysowanie).
// Wybor: ?hd=mmpx|xbr|nearest|off (domyslnie off = oryginal), zapis w localStorage, klawisz H. Bez WebGL2 gra rysuje jak dotad.
// Shadery to porty mmpx() i xbr() z work/upscale/scalers.py - wynik ma byc taki sam piksel w piksel.
(() => {
  const MODES = ['mmpx', 'xbr', 'nearest', 'off'], ID = {nearest: 0, mmpx: 1, xbr: 2};
  const src = document.getElementById('c'), out = document.createElement('canvas');
  out.width = src.width * 2; out.height = src.height * 2;
  const gl = out.getContext('webgl2', {alpha: false, antialias: false, depth: false});
  if (!gl) return;
  src.after(out);

  const VS = `#version 300 es
void main() { gl_Position = vec4(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1., 0., 1.); }`;

  const FS = `#version 300 es
precision highp float; precision highp int;
uniform highp sampler2D T;
uniform int mode;
out vec4 o;
ivec2 P0, SZ;

// piksel zrodla 0..255, przezroczysty -> 0 (clean() w scalers.py), poza obrazem powielony brzeg
ivec4 at(int dx, int dy) {
  ivec4 v = ivec4(texelFetch(T, clamp(P0 + ivec2(dx, dy), ivec2(0), SZ - 1), 0) * 255. + .5);
  return v.a == 0 ? ivec4(0) : v;
}

// --- MMPX (McGuire, Gagiu 2021); kolejnosc regul ma znaczenie ---
int luma(ivec4 c) { return (c.r + c.g + c.b + 1) * (256 - c.a); }
ivec4 mmpx(ivec2 q) {
  ivec4 A = at(-1, -1), B = at(0, -1), C = at(1, -1), D = at(-1, 0), E = at(0, 0), F = at(1, 0),
        G = at(-1, 1), H = at(0, 1), I = at(1, 1), P = at(0, -2), S = at(0, 2), Q = at(-2, 0), R = at(2, 0);
  int Bl = luma(B), Dl = luma(D), El = luma(E), Fl = luma(F), Hl = luma(H);
  ivec4 J = E, K = E, L = E, M = E;
  if (!(E == A && E == B && E == C && E == D && E == F && E == G && E == H && E == I)) {
    // 1:1 - ukosy
    if (D == B && D != H && D != F && (El >= Dl || E == A) && (E == A || E == C || E == G) &&
        (El < Dl || A != D || E != P || E != Q)) J = D;
    if (B == F && B != D && B != H && (El >= Bl || E == C) && (E == A || E == C || E == I) &&
        (El < Bl || C != B || E != P || E != R)) K = B;
    if (H == D && H != F && H != B && (El >= Hl || E == G) && (E == A || E == G || E == I) &&
        (El < Hl || G != H || E != S || E != Q)) L = H;
    if (F == H && F != B && F != D && (El >= Fl || E == I) && (E == C || E == G || E == I) &&
        (El < Fl || I != H || E != R || E != S)) M = F;
    // przeciecia
    if (E != F && E == C && E == I && E == D && E == Q && F == B && F == H && F != at(3, 0)) { K = F; M = F; }
    if (E != D && E == A && E == G && E == F && E == R && D == B && D == H && D != at(-3, 0)) { J = D; L = D; }
    if (E != H && E == G && E == I && E == B && E == P && H == D && H == F && H != at(0, 3)) { L = H; M = H; }
    if (E != B && E == A && E == C && E == H && E == S && B == D && B == F && B != at(0, -3)) { J = B; K = B; }
    // czubki trojkatow
    if (Bl < El && E == G && E == H && E == I && E == S && E != A && E != D && E != C && E != F) { J = B; K = B; }
    if (Hl < El && E == A && E == B && E == C && E == P && E != D && E != G && E != I && E != F) { L = H; M = H; }
    if (Fl < El && E == A && E == D && E == G && E == Q && E != B && E != C && E != I && E != H) { K = F; M = F; }
    if (Dl < El && E == C && E == F && E == I && E == R && E != B && E != A && E != G && E != H) { J = D; L = D; }
    // 2:1 - lagodne zbocza (przypisania z biezacych J/K/L/M)
    if (H != B) {
      if (H != A && H != E && H != C) {
        if (H == G && H == F && H == R && H != D && H != at(2, -1)) L = M;
        if (H == I && H == D && H == Q && H != F && H != at(-2, -1)) M = L;
      }
      if (B != I && B != G && B != E) {
        if (B == A && B == F && B == R && B != D && B != at(2, 1)) J = K;
        if (B == C && B == D && B == Q && B != F && B != at(-2, 1)) K = J;
      }
    }
    if (F != D) {
      if (D != I && D != E && D != C) {
        if (D == A && D == H && D == S && D != B && D != at(1, 2)) J = L;
        if (D == G && D == B && D == P && D != H && D != at(1, -2)) L = J;
      }
      if (F != E && F != A && F != G) {
        if (F == C && F == H && F == S && F != B && F != at(-1, 2)) K = M;
        if (F == I && F == B && F == P && F != H && F != at(-1, -2)) M = K;
      }
    }
  }
  return q.y == 0 ? (q.x == 0 ? J : K) : (q.x == 0 ? L : M);
}

// --- xBR 2x (Hyllian), jak vf_xbr.c z ffmpeg; mieszanie w premultiplied alpha ---
struct Px { ivec4 c, y, m; };                  // kolor (rownosc), YUV (odleglosc), premultiplied (mieszanie)
int tdiv(int x) { return x < 0 ? -(-x / 1000) : x / 1000; }
Px px(int dx, int dy) {
  ivec4 c = at(dx, dy), k = c.a == 0 ? ivec4(255, 0, 255, 0) : c;   // przezroczysty: daleko od wszystkiego
  int g0 = max(max(k.g - k.b, k.g - k.r), 0);
  ivec4 y = ivec4((299 * (k.r - k.g) + 1000 * g0 + 114 * (k.b - k.g)) / 1000 + k.g - g0,
                  tdiv(-169 * k.r - 331 * k.g + 500 * k.b) + 128, tdiv(500 * k.r - 419 * k.g - 81 * k.b) + 128, k.a);
  return Px(c, y, ivec4(c.rgb * c.a / 255, c.a));
}
int df(Px u, Px v) { ivec4 d = abs(u.y - v.y); return d.r + d.g + d.b + 2 * d.a; }
bool eq(Px u, Px v) { return df(u, v) < 155; }
bool ne(Px u, Px v) { return u.c != v.c; }
ivec4 blend(ivec4 dst, ivec4 src, int m, int s) { return dst + (((src - dst) * m) >> s); }
void filt(Px PE, Px PI, Px PH, Px PF, Px PG, Px PC, Px PD, Px PB, Px F4, Px I4, Px H5, Px I5,
          inout ivec4 N1, inout ivec4 N2, inout ivec4 N3) {
  int e = df(PE, PC) + df(PE, PG) + df(PI, H5) + df(PI, F4) + 4 * df(PH, PF);
  int i = df(PH, PD) + df(PH, I5) + df(PF, I4) + df(PF, PB) + 4 * df(PE, PI);
  if (!(ne(PE, PH) && ne(PE, PF) && e <= i)) return;
  ivec4 p = df(PE, PF) <= df(PE, PH) ? PF.m : PH.m;
  bool strong = e < i && ((!eq(PF, PB) && !eq(PH, PD)) || (eq(PE, PI) && !eq(PF, I4) && !eq(PH, I5)) ||
                          eq(PE, PG) || eq(PE, PC));
  int ke = df(PF, PG), ki = df(PH, PC);
  bool left = strong && 2 * ke <= ki && ne(PE, PG) && ne(PD, PG);
  bool up = strong && ke >= 2 * ki && ne(PE, PC) && ne(PB, PC);
  N3 = left && up ? blend(N3, p, 7, 3) : left != up ? blend(N3, p, 3, 2) : blend(N3, p, 1, 1);
  if (left) N2 = blend(N2, p, 1, 2);
  if (left && up) N1 = N2; else if (up) N1 = blend(N1, p, 1, 2);
}
ivec4 xbr(ivec2 q) {
  Px A = px(-1, -1), B = px(0, -1), C = px(1, -1), D = px(-1, 0), E = px(0, 0), F = px(1, 0),
     G = px(-1, 1), H = px(0, 1), I = px(1, 1), A1 = px(-1, -2), B1 = px(0, -2), C1 = px(1, -2),
     A0 = px(-2, -1), D0 = px(-2, 0), G0 = px(-2, 1), C4 = px(2, -1), F4 = px(2, 0), I4 = px(2, 1),
     G5 = px(-1, 2), H5 = px(0, 2), I5 = px(1, 2);
  ivec4 E0 = E.m, E1 = E.m, E2 = E.m, E3 = E.m;
  filt(E, I, H, F, G, C, D, B, F4, I4, H5, I5, E1, E2, E3);     // 4 obroty jak xbr2x() w ffmpeg
  filt(E, C, F, B, I, A, H, D, B1, C1, F4, C4, E0, E3, E1);
  filt(E, A, B, D, C, G, F, H, D0, A0, B1, A1, E2, E1, E0);
  filt(E, G, D, H, A, I, B, F, H5, G5, D0, G0, E3, E0, E2);
  ivec4 r = q.y == 0 ? (q.x == 0 ? E0 : E1) : (q.x == 0 ? E2 : E3);
  return r.a > 0 ? ivec4(min(ivec3(255), (r.rgb * 255 + r.a / 2) / r.a), r.a) : ivec4(0);
}

void main() {
  SZ = textureSize(T, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  p.y = 2 * SZ.y - 1 - p.y;                    // tekstura od gornego wiersza, gl_FragCoord od dolu
  P0 = p >> 1;
  ivec2 q = p & 1;
  o = vec4(mode == 1 ? mmpx(q) : mode == 2 ? xbr(q) : at(0, 0)) / 255.;
}`;

  let uMode;
  function init() {
    const prog = gl.createProgram();
    for (const [type, code] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]]) {
      const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s); gl.attachShader(prog, s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) console.error('hd.js:', gl.getShaderInfoLog(s));
    }
    gl.linkProgram(prog); gl.useProgram(prog);
    uMode = gl.getUniformLocation(prog, 'mode');
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    return gl.getProgramParameter(prog, gl.LINK_STATUS);
  }
  let ok = init();

  let mode = new URLSearchParams(location.search).get('hd');
  try { mode = mode || localStorage.getItem('tnt.hd'); } catch (e) {}
  if (!MODES.includes(mode)) mode = 'off';             // domyslnie oryginal, H przelacza tryby HD
  const show = () => {                          // utrata kontekstu albo blad shadera: #c jak dotad
    const on = ok && mode !== 'off' && !gl.isContextLost();
    src.style.display = on ? 'none' : ''; out.style.display = on ? '' : 'none';
  };
  show();
  out.addEventListener('webglcontextlost', e => { e.preventDefault(); show(); });
  out.addEventListener('webglcontextrestored', () => { ok = init(); show(); });

  const tip = document.createElement('div');
  tip.style.cssText = 'position:fixed;top:8px;left:12px';
  document.body.append(tip);
  addEventListener('keydown', e => {
    if (e.code !== 'KeyH' || !ok) return;
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; show();
    try { localStorage.setItem('tnt.hd', mode); } catch (e) {}
    tip.textContent = 'HD: ' + mode; clearTimeout(tip.t); tip.t = setTimeout(() => { tip.textContent = ''; }, 1500);
  });

  // menu opcji (main.js): tryby i wybor bez klawisza H
  window.HD = {MODES, get ok() { return ok; }, get mode() { return mode; },
    set(m) { mode = m; show(); try { localStorage.setItem('tnt.hd', mode); } catch (e) {} }};

  // po kazdej klatce gry (main.js rysuje w requestAnimationFrame) klatka #c idzie przez shader
  function present() {
    if (src.style.display !== 'none') return;
    if (out.width !== src.width * 2 || out.height !== src.height * 2) {   // ekran tytulowy ma inny rozmiar (352x289)
      out.width = src.width * 2; out.height = src.height * 2; gl.viewport(0, 0, out.width, out.height);
    }
    if (out.style.width !== src.style.width) { out.style.width = src.style.width; out.style.height = src.style.height; }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform1i(uMode, ID[mode]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const raf = requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { cb(t); present(); });
})();
