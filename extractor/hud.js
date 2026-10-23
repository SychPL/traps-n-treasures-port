// Small graphics from the main program and the HUD / font banks, as work/export_font.py, export_msgbox.py,
// export_tools.py, export_shots.py and export_compass.py: font.png/json, msgbox.png, msgfont.png/json,
// tool_icons.png, shots.png, compass.png/json.
import { encodePNG } from './png.js';
import { stageMemory, reader, levelJSON } from './tables.js';
import { bob, stagePalettes } from './objects.js';
import { walkBank } from './actors.js';

const FB = 0x200000, HUD_PAL = 0x30B6CE;   // HUD palette, 32 colours (main program +$2ED52; copper line 20)
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
  return out;
}
