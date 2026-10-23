// Intro screens and the story scroll of the boot module (disk 1 SEG2 $3214; the export glued them from emulator frames):
// intro_starbyte.png, intro_nightingale.png (the 2 text screens), story_text.png (the scroll text, transparent where the
// copper bars show) and story_bg.png (the bar colour of each line). Letters = the BOB bank disk 1 PP $1BA58, the glyph
// of a character at the table $58AA; a letter advances by its box (x2 - x1 + 1), a space by 8. Palette $50B6 (the text
// screens set colours 0 and 2 to 000 first, $2718). Text screens ($2702): records {x.W, y.W, text} from $5AA6, $00
// = next record, $01 = end of the screen, $02 after it = the last one. Story ($2408): zero-terminated lines from $5240
// to $FF, centred on x 176, 42 lines apart. Bars: colour 0 of each line from the table $5AEE (to a negative word, then
// again). Offsets of the shown windows measured on the screenshots: text screens -64, -29; story -16 (and cropped to
// the rows with text, as the export).
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { loadSeg2 } from './seg2.js';

const BOOT = {at: 0x3214, bases: [0x2000, 0x2000 + 0x20D8, 0x2000 + 0x20D8 + 0x27FC]}, LETTERS = 0x1BA58;
const GLYPHS = 0x58AA, PAL = 0x50B6, SCREENS = 0x5AA6, STORY = 0x5240, BARS = 0x5AEE;
// Polish story (our translation, work/export_story_pl.py), set in the same letters: Polish characters = the base letter
// plus the dot of 'i' (acute: 2 px to the right, dot) above, the comma as an ogonek, or a 2 px stroke for l
const STORY_PL = `Dotychczasowa historia:
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

*****`;
const ACC = {'ą': 'ao', 'ć': 'ca', 'ę': 'eo', 'ł': 'ls', 'ń': 'na', 'ó': 'oa', 'ś': 'sa', 'ź': 'za', 'ż': 'zd'};
const PITCH = 42, MAXW = 304;

export function extractIntro(disks) {
  if (!disks[1]) return [];
  const s = loadSeg2(disks[1], BOOT.at, BOOT.bases), mem = new Uint8Array(0x8000);
  mem.set(s.seg1, 0x2000); mem.set(s.seg2, 0x40D8);
  const mv = new DataView(mem.buffer), W = a => mv.getUint16(a), L = a => mv.getUint32(a);
  const bank = readFile(disks[1], LETTERS), bv = new DataView(bank.buffer, bank.byteOffset, bank.byteLength);
  const pal = [...Array(32)].map((_, i) => W(PAL + 2 * i));
  // letters of a text from x0 on the baseline y0 -> [bank offset, top-left x, y]
  const glyphs = (x0, y0, t) => {
    const out = [];
    let x = x0;
    for (const ch of t) {
      const c = ch.charCodeAt(0);
      if (c === 32) { x += 8; continue; }
      const o = L(GLYPHS + 4 * c);
      x -= bv.getInt16(o + 8);
      out.push([o, x - bv.getInt16(o + 4), y0 - bv.getInt16(o + 6)]);
      x += bv.getInt16(o + 12) + 1;
    }
    return out;
  };
  const width = t => [...t].reduce((w, ch) => { const c = ch.charCodeAt(0); if (c === 32) return w + 8; const o = L(GLYPHS + 4 * c); return w + bv.getInt16(o + 12) - bv.getInt16(o + 8) + 1; }, 0);
  // draw letters into an RGBA image; colour 0 = transparent (0 / the bar colour on screen) unless `zero` is given
  const draw = (px, w, h, place, p, ox, oy, zero) => {
    for (const [o, X, Y] of place) {
      const bw = bv.getUint16(o), bh = bv.getUint16(o + 2), stored = bank[o + 16], forced = bank[o + 17], ps = bv.getUint16(o + 22), rb = ps / bh | 0, d = o + 26;
      const planes = [0, 1, 2, 3, 4].filter(q => stored >> q & 1), bit = (q, x, y) => bank[q + y * rb + (x >> 3)] >> (7 - (x & 7)) & 1;
      for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
          if (!bit(d, x, y)) continue;
          let c = forced & ~stored;
          planes.forEach((q, k) => { c |= bit(d + ps * (k + 1), x, y) << q; });
          const sx = X + x + ox, sy = Y + y + oy;
          if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
          const k = (sy * w + sx) * 4;
          if (!c && !zero) { px[k + 3] = 0; continue; }
          const v = p[c];
          px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255;
        }
    }
  };
  // text screens
  const screens = [];
  for (let a = SCREENS, cur = []; screens.length < 8;) {
    const x = W(a), y = W(a + 2);
    let t = '';
    for (a += 4; mem[a] > 2; a++) t += String.fromCharCode(mem[a]);
    cur.push([x, y, t]);
    if (mem[a++] === 0) continue;
    screens.push(cur); cur = [];
    if (mem[a] === 2) break;
  }
  const black = pal.map((v, c) => c === 0 || c === 2 ? 0 : v), out = [];
  screens.slice(0, 2).forEach((list, i) => {
    const px = new Uint8Array(320 * 200 * 4);
    for (let k = 3; k < px.length; k += 4) px[k] = 255;
    draw(px, 320, 200, list.flatMap(([x, y, t]) => glyphs(x, y, t)), black, -64, -29, true);
    out.push({path: i ? 'intro_nightingale.png' : 'intro_starbyte.png', data: encodePNG(px, 320, 200)});
  });
  // story scroll: all lines, then cropped to the rows with text
  const lines = [];
  for (let a = STORY; mem[a] !== 0xFF && lines.length < 400; a++) { let t = ''; for (; mem[a]; a++) t += String.fromCharCode(mem[a]); lines.push(t); }
  const H = 42 * lines.length + 64, tall = new Uint8Array(320 * H * 4);
  draw(tall, 320, H, lines.flatMap((t, i) => glyphs(0xB0 - (width(t) >> 1), 42 * i + 40, t)), pal, -16, 0, false);
  let top = 0, bottom = H - 1;
  const rowEmpty = y => { for (let x = 0; x < 320; x++) if (tall[(y * 320 + x) * 4 + 3]) return false; return true; };
  while (top < H && rowEmpty(top)) top++;
  while (bottom > top && rowEmpty(bottom)) bottom--;
  out.push({path: 'story_text.png', data: encodePNG(tall.subarray(top * 320 * 4, (bottom + 1) * 320 * 4), 320, bottom + 1 - top)});
  const bars = [];
  for (let a = BARS; (W(a) & 0x8000) === 0 && bars.length < 256; a += 2) bars.push(W(a));
  const bg = new Uint8Array(256 * 4);
  for (let y = 0; y < 256; y++) { const v = bars[y % bars.length]; bg.set([(v >> 8 & 15) * 17, (v >> 4 & 15) * 17, (v & 15) * 17, 255], 4 * y); }
  out.push({path: 'story_bg.png', data: encodePNG(bg, 1, 256)});
  out.push({path: 'story_text_pl.png', data: storyPl(bank, bv, L, pal)});
  return out;
}

// a letter as {px, w, h, top, adv, dx}: RGBA cell of w x h whose row `top` is the BOB's first row, the advance and the
// x of the cell relative to the pen; colour 0 transparent
function letterCell(bank, bv, L, pal, c, pad = 8) {
  const o = L(GLYPHS + 4 * c), bw = bv.getUint16(o), bh = bv.getUint16(o + 2), w = bw, h = bh + 2 * pad;
  const stored = bank[o + 16], forced = bank[o + 17], ps = bv.getUint16(o + 22), rb = ps / bh | 0, d = o + 26;
  const planes = [0, 1, 2, 3, 4].filter(q => stored >> q & 1), bit = (q, x, y) => bank[q + y * rb + (x >> 3)] >> (7 - (x & 7)) & 1;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      if (!bit(d, x, y)) continue;
      let col = forced & ~stored;
      planes.forEach((q, k) => { col |= bit(d + ps * (k + 1), x, y) << q; });
      if (!col) continue;
      const v = pal[col], k = ((y + pad) * w + x) * 4;
      px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255;
    }
  const x1 = bv.getInt16(o + 8), adv = bv.getInt16(o + 12) - x1 + 1;
  return {px, w, h, top: pad - (40 - bv.getInt16(o + 6)) + 40, ay: bv.getInt16(o + 6), adv, dx: -x1 - bv.getInt16(o + 4), pad};
}
const rowsOf = g => { const r = []; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.px[(y * g.w + x) * 4 + 3]) { r.push(y); break; } return r; };
const colsOf = g => { const c = []; for (let x = 0; x < g.w; x++) for (let y = 0; y < g.h; y++) if (g.px[(y * g.w + x) * 4 + 3]) { c.push(x); break; } return c; };
// part of a cell (rows y0..y1, all its opaque columns) as {px, w, h}
function piece(g, y0, y1) {
  const cols = []; for (let x = 0; x < g.w; x++) for (let y = y0; y <= y1; y++) if (g.px[(y * g.w + x) * 4 + 3]) { cols.push(x); break; }
  const x0 = cols[0], w = cols[cols.length - 1] - x0 + 1, h = y1 - y0 + 1, px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) px.set(g.px.subarray(((y0 + y) * g.w + x0) * 4, ((y0 + y) * g.w + x0 + w) * 4), y * w * 4);
  return {px, w, h};
}
const paste = (dst, src, x, y) => {
  for (let yy = 0; yy < src.h; yy++) for (let xx = 0; xx < src.w; xx++) {
    const k = (yy * src.w + xx) * 4, X = x + xx, Y = y + yy;
    if (!src.px[k + 3] || X < 0 || X >= dst.w || Y < 0 || Y >= dst.h) continue;
    dst.px.set(src.px.subarray(k, k + 4), (Y * dst.w + X) * 4);
  }
};

function storyPl(bank, bv, L, pal) {
  const cell = c => letterCell(bank, bv, L, pal, c.charCodeAt(0));
  // the dot of 'i': its top blob, down to the narrowest row under it
  const gi = cell('i'), ri = rowsOf(gi), cnt = y => { let n = 0; for (let x = 0; x < gi.w; x++) if (gi.px[(y * gi.w + x) * 4 + 3]) n++; return n; };
  let neck = ri[0] + 3; for (let y = ri[0] + 3; y < ri[0] + 12; y++) if (cnt(y) < cnt(neck)) neck = y;
  const dot = piece(gi, ri[0], neck - 1);
  const gc = cell(','), rc = rowsOf(gc), comma = piece(gc, rc[0], rc[rc.length - 1]);
  const letter = ch => {
    const a = ACC[ch], g = cell(a ? a[0] : ch);
    if (!a) return g;
    const body = rowsOf(g);
    if (a[1] === 'a' || a[1] === 'd') paste(g, dot, Math.max(0, (g.w - dot.w >> 1) + (a[1] === 'a' ? 2 : 0)), Math.max(0, body[0] - dot.h - 1));
    else if (a[1] === 'o') paste(g, comma, Math.max(0, g.w - comma.w - 1), Math.min(g.h - comma.h, body[body.length - 1] - 2));
    else {                                              // l with a stroke: outline = the darkest colour, fill = the commonest bright one
      const cols = [];
      for (let k = 0; k < g.px.length; k += 4) if (g.px[k + 3]) cols.push([g.px[k], g.px[k + 1], g.px[k + 2]]);
      const sum = c => c[0] + c[1] + c[2], dark = cols.reduce((m, c) => sum(c) < sum(m) ? c : m), med = cols.map(sum).sort((p, q) => p - q)[cols.length >> 1];
      const n = new Map(); for (const c of cols) if (sum(c) > med) n.set(c.join(), (n.get(c.join()) || 0) + 1);
      const fill = [...n].reduce((m, e) => e[1] > m[1] ? e : m)[0].split(',').map(Number);
      const cx0 = g.w >> 1, my = body[0] + body[body.length - 1] >> 1, set = (x, y, c) => { if (x >= 0 && x < g.w && y >= 0 && y < g.h) g.px.set([...c, 255], (y * g.w + x) * 4); };
      for (let d = -4; d <= 4; d++) for (let t = -2; t <= 2; t++) set(cx0 + d, my - Math.floor(d / 2) + t, dark);
      for (let d = -3; d <= 3; d++) for (let t = 0; t <= 1; t++) set(cx0 + d, my - Math.floor(d / 2) + t - 1, fill);
    }
    return g;
  };
  const width = t => [...t].reduce((w, ch) => w + (ch === ' ' ? 8 : letter(ch).adv), 0);
  const lines = [];
  for (const par of STORY_PL.split('\n')) {
    if (!par.trim()) { lines.push(''); continue; }
    let cur = '';
    for (const w of par.split(/\s+/).filter(Boolean)) { const nxt = (cur + ' ' + w).trim(); if (cur && width(nxt) > MAXW) { lines.push(cur); cur = w; } else cur = nxt; }
    lines.push(cur);
  }
  const H = PITCH * lines.length + 64, out = {px: new Uint8Array(320 * H * 4), w: 320, h: H};
  lines.forEach((t, k) => {
    let x = 0xB0 - (width(t) >> 1) - 16;
    for (const ch of t) {
      if (ch === ' ') { x += 8; continue; }
      const g = letter(ch);
      paste(out, g, x + g.dx, PITCH * k + 40 - g.ay - g.pad);
      x += g.adv;
    }
  });
  let top = 0, bottom = H - 1;
  const empty = y => { for (let x = 0; x < 320; x++) if (out.px[(y * 320 + x) * 4 + 3]) return false; return true; };
  while (top < H && empty(top)) top++;
  while (bottom > top && empty(bottom)) bottom--;
  return encodePNG(out.px.subarray(top * 320 * 4, (bottom + 1) * 320 * 4), 320, bottom + 1 - top);
}
