// Small graphics from the main program and the HUD / font banks, as work/export_font.py, export_msgbox.py,
// export_tools.py, export_shots.py and export_compass.py: font.png/json, msgbox.png, msgfont.png/json,
// tool_icons.png, shots.png, compass.png/json; and the HUD panels the export cut from emulator screenshots:
// hud_top.png, hud_top_vit.png, hud_bottom.png, hud_life_empty.png, hud_digits.png.
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { stageMemory, reader, levelJSON } from './tables.js';
import { bob, stagePalettes } from './objects.js';
import { walkBank } from './actors.js';

const FB = 0x200000, HUD_PAL = 0x30B6CE;   // HUD palette, 32 colours (main program +$2ED52; copper line 20)
// HUD panels: disk 2 $A0824, 320 x 53, 5 planes one after another; lines 0-11 = top bar (screen lines 44-55),
// 12-51 = bottom panel. The game draws into them: life fields = HUD bank BOB 0 (full) / $86 (empty), 11x9, at
// x = 47 + 11 k ($308FA6, anchor 8, -1); the vitamin bar copies pixel columns ($309750) from 5 planes of 64x8 (8 B a
// row, pointers at $309864) to x 256.., lines 1-8; the map box = BOB $1CF4 (19x25) at 249, 10 of the panel; digits
// = 10 BOBs 5x6 from $16BC. On line 55 the copper turns colour 27 to 000 from x 135 on.
const PANEL = 0xA0824, VIT = 0x309864;
// game font 8x9 (1 bit) at $30AC49, 64 glyphs; character -> glyph
const FONT = {at: 0x30AC49, h: 9, n: 64};
const CHARS = {'!': 1, '"': 2, '%': 3, '&': 6, "'": 7, '(': 8, ')': 9, '*': 10, '+': 11, ',': 12, '-': 13, '.': 14, ':': 26, '?': 31};
for (let d = 0; d < 10; d++) CHARS[d] = 16 + d;
for (let i = 0; i < 26; i++) CHARS[String.fromCharCode(65 + i)] = 33 + i;
const enc = o => new TextEncoder().encode(JSON.stringify(o));
const dims = (W, S, a) => [W(a), W(a + 2), S(a + 4), S(a + 6)];

export function extractHud(disks) {
  if (!disks[1] || !disks[2]) return [];
  const mem = stageMemory(disks, 1), m = reader(mem), {L, W, S, B} = m, out = [];
  const [surf1] = stagePalettes(disks, 1, levelJSON(disks, 1)), hud = [...Array(32)].map((_, i) => W(HUD_PAL + 2 * i));
  // font: white glyphs, 16 a row
  const fw = 16 * 8, fh = FONT.n / 16 * FONT.h, fpx = new Uint8Array(fw * fh * 4);
  for (let g = 0; g < FONT.n; g++)
    for (let y = 0; y < FONT.h; y++) {
      const b = B(FONT.at + g * FONT.h + y);
      for (let x = 0; x < 8; x++) if (b >> (7 - x) & 1) fpx.fill(255, ((g >> 4) * FONT.h + y) * fw * 4 + ((g & 15) * 8 + x) * 4, ((g >> 4) * FONT.h + y) * fw * 4 + ((g & 15) * 8 + x) * 4 + 4);
    }
  out.push({path: 'font.png', data: encodePNG(fpx, fw, fh)}, {path: 'font.json', data: enc(CHARS)});
  // message box frame: item bank + $2218; message font: 93 BOBs of the font bank + the 2 'next' arrows at +$1DC6
  const box = L(0x30CD58) + 0x2218, [bw, bh] = dims(W, S, box), bpx = new Uint8Array(bw * bh * 4);
  bob(mem.chip, box, surf1, bpx, bw, 0, 0);
  out.push({path: 'msgbox.png', data: encodePNG(bpx, bw, bh)});
  const chain = (a, n) => { const r = []; for (let i = 0; i < n; i++) { r.push(a); a += W(a + 24); } return r; };
  const fb = L(0x30CD5C), bobs = [...chain(fb, 93), ...chain(fb + 0x1DC6, 2)], d = bobs.map(a => dims(W, S, a));
  const mw = d.reduce((s, [w]) => s + w + 1, 0), mh = Math.max(...d.map(([, h]) => h)), mpx = new Uint8Array(mw * mh * 4), meta = [];
  let x = 0;
  bobs.forEach((a, i) => { bob(mem.chip, a, surf1, mpx, mw, x, 0); meta.push([x, ...d[i]]); x += d[i][0] + 1; });
  out.push({path: 'msgfont.png', data: encodePNG(mpx, mw, mh)}, {path: 'msgfont.json', data: enc({glyphs: meta.slice(0, 93), arrow: meta.slice(93)})});
  // tool icons: 17 BOBs 16x15 of the HUD bank, offsets in the tool records ($30992E, 14 B, +8), HUD palette
  const tpx = new Uint8Array(16 * 17 * 15 * 4);
  for (let k = 0; k < 17; k++) bob(mem.chip, L(0x30CD60) + W(0x30992E + 14 * k + 8), hud, tpx, 16 * 17, 16 * k, 0);
  out.push({path: 'tool_icons.png', data: encodePNG(tpx, 16 * 17, 15)});
  // shots: iron ball ($F7F2) and special ball ($F870), 10x10, a row per stage in the stage's palette
  const spx = new Uint8Array(20 * 40 * 4);
  for (let n = 1; n <= 4; n++) {
    const [pal] = stagePalettes(disks, n, levelJSON(disks, n));
    [0xF7F2, 0xF870].forEach((a, k) => bob(mem.chip, a, pal, spx, 20, 10 * k, 10 * (n - 1)));
  }
  out.push({path: 'shots.png', data: encodePNG(spx, 20, 40)});
  // compass needle: 8 BOBs of the HUD bank from +$1F66 (N, NE ... NW), HUD palette; anchor in the panel (x 100, y 24)
  const cpx = new Uint8Array(16 * 8 * 17 * 4), frames = [];
  walkBank(mem, L(0x30CD60) + 0x1F66).slice(0, 8).forEach(([a, f], i) => {
    bob(mem.chip, a, hud, cpx, 128, 16 * i, 0);
    frames.push([16 * i, 0, f.w, f.h, f.ax, f.ay]);
  });
  out.push({path: 'compass.png', data: encodePNG(cpx, 128, 17)}, {path: 'compass.json', data: enc({anchor: [100, 24], frames})});
  // HUD panels
  const pf = readFile(disks[2], PANEL), PH = pf.length / 200, hb = L(0x30CD60);
  const put = (px, w, x, y, v) => { const k = (y * w + x) * 4; px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255; };
  const panel = (y0, h, line55) => {
    const px = new Uint8Array(320 * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < 320; x++) {
        let c = 0;
        for (let p = 0; p < 5; p++) c |= (pf[p * 40 * PH + (y0 + y) * 40 + (x >> 3)] >> (7 - (x & 7)) & 1) << p;
        put(px, 320, x, y, y0 + y === line55 && x >= 135 && c === 27 ? 0 : hud[c]);
      }
    return px;
  };
  const top = panel(0, 12, 11);
  for (let i = 0; i < 5; i++) bob(mem.chip, hb, hud, top, 320, 50 + 11 * i, 1);      // 5 full life fields
  const vit = top.slice();
  for (let y = 0; y < 8; y++)
    for (let c = 0; c < 62; c++) {
      let v = 0;
      for (let p = 0; p < 5; p++) v |= B(L(VIT + 4 * p) + y * 8 + (c >> 3)) >> (7 - (c & 7)) & 1 ? 1 << p : 0;
      put(vit, 320, 256 + c, 1 + y, hud[v]);
    }
  const bot = panel(12, 40, -1);
  bob(mem.chip, hb + 0x1CF4, hud, bot, 320, 249, 10);                                  // map box
  for (const y of [12, 24]) for (let yy = y; yy < y + 6; yy++) for (let x = 147; x < 190; x++) put(bot, 320, x, yy, 0x304);   // score / gold: cleared
  const cell = new Uint8Array(11 * 9 * 4), empty = new Uint8Array(9 * 7 * 4);
  bob(mem.chip, hb + 0x86, hud, cell, 11, 0, 0);
  for (let y = 0; y < 7; y++) empty.set(cell.subarray(((y + 1) * 11 + 1) * 4, ((y + 1) * 11 + 10) * 4), y * 9 * 4);
  const dg = new Uint8Array(60 * 6 * 4);
  for (let i = 0, a = hb + 0x16BC; i < 10; i++, a += W(a + 24)) bob(mem.chip, a, hud, dg, 60, 6 * i, 0);
  for (let k = 0; k < dg.length; k += 4) if (dg[k] !== dg[k + 1] || dg[k] !== dg[k + 2] || dg[k] < 64) dg.fill(0, k, k + 4);   // the grey digit only
  out.push({path: 'hud_top.png', data: encodePNG(top, 320, 12)}, {path: 'hud_top_vit.png', data: encodePNG(vit, 320, 12)},
    {path: 'hud_bottom.png', data: encodePNG(bot, 320, 40)}, {path: 'hud_life_empty.png', data: encodePNG(empty, 9, 7)},
    {path: 'hud_digits.png', data: encodePNG(dg, 60, 6)});
  return out;
}
