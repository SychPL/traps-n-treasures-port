// Screens and runs outside the stages: treasure.png/json (work/export_treasure.py), gameover.png
// (work/export_gameover.py), title.png (the title picture as the emulator showed it) and the ending
// (ending_bg.png, ending_dark.png, ending_sky.png, ending.json; the export cut them from emulator screenshots).
import { readFile } from './adf.js';
import { loadSeg2 } from './seg2.js';
import { encodePNG } from './png.js';
import { stageMemory, reader, levelJSON } from './tables.js';
import { bob, stagePalettes } from './objects.js';

const enc = o => new TextEncoder().encode(JSON.stringify(o));

// treasure run: diamonds = bank $30CD80 (disk 2 $B13B0, loaded for the run), 3 kinds of 8 frames at 0, $468, $8D0;
// heart = BOB 0 of the item bank; sky: the copper colour lists $30BF68 / $30C01E / $30C082 / $30BFC4 of stages 1-4
const DIAMONDS = 0xB13B0, SKY = [0x30BF68, 0x30C01E, 0x30C082, 0x30BFC4];
// game over: skull wallpaper (disk 2 $97EFC, 320x160, 2 planes, raw) and 2 BOBs of the bank at $96F0C (72x36, 66x31),
// in each stage's palette with colour 1 = $512 (gradient $30C1B8 on every line)
const WALL = 0x97EFC, GO_BANK = [0x96F0C, 0xFEC];
// title: disk 1 PP $CC20, 352 x 290, 6 planes one after another (44 B a line), extra half-bright; 289 lines shown;
// palette = 32 colours in the boot module (disk 1 $646E = SEG2 $3214 +$325A), the same on every line
const TITLE = {at: 0xCC20, pal: 0x646E, w: 352, h: 289, lines: 290};
// ending: SEG2 on disk 2 at $BC098 ($6148 B); picture disk 2 PP $C21E4, 320 x 256, 5 planes (the 6th plane is the
// scrolling text); $438 writes 32 colours from seg1 +$6E0 to its copper list (seg2 +$96), 30 colours from +$720 for the
// sea (seg2 +$632, from line 202) and the sky gradient of colour 27 (table +$111C as t[k], t[k+1], t[k] on the lines
// from seg2 +$122 to +$62C). Shown: 243 lines from line 44. Sky = lines 0-158 where the pixel has the line's colour.
// Text: zero-terminated strings from ' CONGRATULATIONS' to the panel end mark $02; the glyphs the game font lacks
// ('<' '>' '@') come from the ending's own font (seg1 +$F08, ASCII from 32, 9 B a glyph: the code reads from $F12 +
// (ASCII - $21) x 9, i.e. one byte later; starting a byte early gives the 9-row cell as the screen shows it, with the
// empty row above, on the same line as the game font's letters).
const END = {at: 0xBC098, len: 0x6148, pic: 0xC21E4, h: 243, line0: 44, sky: 159, font: 0xF08};

export function extractScreens(disks) {
  if (!disks[1] || !disks[2]) return [];
  const mem = stageMemory(disks, 1), {L, W, S} = reader(mem), out = [];
  const pals = [1, 2, 3, 4].map(n => stagePalettes(disks, n, levelJSON(disks, n))[0]);
  // treasure
  const bank = readFile(disks[2], DIAMONDS), bv = new DataView(bank.buffer, bank.byteOffset, bank.byteLength), cells = [];
  for (const off of [0, 0x468, 0x8D0]) for (let k = 0, a = off; k < 8; k++, a += bv.getUint16(a + 24)) cells.push([bank, a]);
  cells.push([mem.chip, L(0x30CD58)]);
  const tpx = new Uint8Array(16 * cells.length * 16 * 4), frames = [];
  cells.forEach(([buf, a], i) => {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    bob(buf, a, pals[0], tpx, 16 * cells.length, 16 * i, 0);
    frames.push([16 * i, 0, v.getUint16(a), v.getUint16(a + 2), v.getInt16(a + 4), v.getInt16(a + 6)]);
  });
  const sky = SKY.map(b => [...Array(46)].map((_, i) => { const v = W(b + 2 * i); return '#' + [v >> 8, v >> 4, v].map(c => (c & 15).toString(16)).join(''); }));
  out.push({path: 'treasure.png', data: encodePNG(tpx, 16 * cells.length, 16)},
    {path: 'treasure.json', data: enc({frames, diamond: [0, 8, 16].map(s => [...Array(8)].map((_, k) => s + k)), heart: 24, sky})});
  // game over
  const wall = disks[2].subarray(WALL, WALL + 12800), gb = disks[2].slice(GO_BANK[0], GO_BANK[0] + GO_BANK[1]);
  const GW = 320 + 72 + 66, gpx = new Uint8Array(GW * 640 * 4);
  pals.forEach((p, n) => {
    const pal = p.map((v, c) => c === 1 ? 0x512 : v);
    for (let y = 0; y < 160; y++)
      for (let x = 0; x < 320; x++) {
        let c = 0;
        for (let q = 0; q < 2; q++) c |= (wall[q * 6400 + y * 40 + (x >> 3)] >> (7 - (x & 7)) & 1) << q;
        const v = pal[c], k = ((160 * n + y) * GW + x) * 4;
        gpx[k] = (v >> 8 & 15) * 17; gpx[k + 1] = (v >> 4 & 15) * 17; gpx[k + 2] = (v & 15) * 17; gpx[k + 3] = 255;
      }
    bob(gb, 0, pal, gpx, GW, 320, 160 * n);
    bob(gb, 0x88A, pal, gpx, GW, 392, 160 * n);
  });
  out.push({path: 'gameover.png', data: encodePNG(gpx, GW, 640)});
  // title (half-bright halves the 8-bit component, as the render of the emulator memory the export came from)
  const pic = readFile(disks[1], TITLE.at), d1 = new DataView(disks[1].buffer, disks[1].byteOffset, disks[1].byteLength);
  const tpal = [...Array(32)].map((_, i) => d1.getUint16(TITLE.pal + 2 * i)), ppx = new Uint8Array(TITLE.w * TITLE.h * 4);
  for (let y = 0; y < TITLE.h; y++)
    for (let x = 0; x < TITLE.w; x++) {
      let c = 0;
      for (let q = 0; q < 6; q++) c |= (pic[q * 44 * TITLE.lines + y * 44 + (x >> 3)] >> (7 - (x & 7)) & 1) << q;
      const v = tpal[c & 31], k = (y * TITLE.w + x) * 4, f = c >= 32 ? 2 : 1;
      ppx[k] = (v >> 8 & 15) * 17 / f | 0; ppx[k + 1] = (v >> 4 & 15) * 17 / f | 0; ppx[k + 2] = (v & 15) * 17 / f | 0; ppx[k + 3] = 255;
    }
  out.push({path: 'title.png', data: encodePNG(ppx, TITLE.w, TITLE.h)});
  // wide title for wide screens: the export has a hand-painted widening; here the title in the middle on black
  // (ponytail: a plain stand-in, replace the file with a better one if you have it)
  const WW = 626, ox = WW - TITLE.w >> 1, wpx = new Uint8Array(WW * TITLE.h * 4);
  for (let k = 3; k < wpx.length; k += 4) wpx[k] = 255;
  for (let y = 0; y < TITLE.h; y++) wpx.set(ppx.subarray(y * TITLE.w * 4, (y + 1) * TITLE.w * 4), (y * WW + ox) * 4);
  out.push({path: 'title_wide.png', data: encodePNG(wpx, WW, TITLE.h)});
  out.push(...ending(disks));
  return out;
}

function ending(disks) {
  const seg = loadSeg2(disks[2], END.at, [0, 0x10000, 0x20000]), s1 = new DataView(seg.seg1.buffer);
  const cop = seg.seg2.slice(), cv = new DataView(cop.buffer), W1 = a => s1.getUint16(a);
  for (let i = 0; i < 32; i++) cv.setUint16(0x96 + 4 * i, W1(0x6E0 + 2 * i));
  for (let i = 0; i < 30; i++) cv.setUint16(0x632 + 4 * i, W1(0x720 + 2 * i));
  for (let a0 = 0x122, a1 = 0x111C; ;) {                // as $4CE: d0, d1, d0 on every 8th byte, then the next pair
    const d0 = W1(a1), d1 = W1(a1 + 2);
    if (a0 >= 0x62C) break; cv.setUint16(a0, d0); a0 += 8;
    if (a0 >= 0x62C) break; cv.setUint16(a0, d1); a0 += 8;
    cv.setUint16(a0, d0); a0 += 8;
    if (a0 >= 0x62C) break; a1 += 2;
  }
  const pal = new Array(32).fill(0), lines = [];        // palette of each screen line (moves apply from the next wait)
  let line = 0;
  for (let a = 0; a + 4 <= cop.length; a += 4) {
    const r = cv.getUint16(a), v = cv.getUint16(a + 2);
    if (r === 0xFFFF && v === 0xFFFE) break;
    if (r & 1) { for (; line < r >> 8; line++) lines[line] = pal.slice(); continue; }
    if (r >= 0x180 && r <= 0x1BE) pal[(r - 0x180) / 2] = v;
  }
  const pic = readFile(disks[2], END.pic), bg = new Uint8Array(320 * END.h * 4), dark = bg.slice(), sky = bg.slice();
  const col = new Uint16Array(320 * END.h);
  for (let y = 0; y < END.h; y++) {
    const p = lines[END.line0 + y] || pal;
    for (let x = 0; x < 320; x++) {
      let c = 0;
      for (let q = 0; q < 5; q++) c |= (pic[q * 40 * 256 + y * 40 + (x >> 3)] >> (7 - (x & 7)) & 1) << q;
      const v = col[y * 320 + x] = p[c], k = (y * 320 + x) * 4;
      bg[k] = (v >> 8 & 15) * 17; bg[k + 1] = (v >> 4 & 15) * 17; bg[k + 2] = (v & 15) * 17; bg[k + 3] = 255;
      dark[k] = (v >> 9 & 7) * 17; dark[k + 1] = (v >> 5 & 7) * 17; dark[k + 2] = (v >> 1 & 7) * 17; dark[k + 3] = 255;   // half-bright
    }
    if (y < END.sky) {
      const n = new Map();
      for (let x = 14; x < 306; x++) n.set(col[y * 320 + x], (n.get(col[y * 320 + x]) || 0) + 1);
      const mode = [...n].reduce((a, b) => b[1] > a[1] ? b : a)[0];
      for (let x = 0; x < 320; x++) if (col[y * 320 + x] === mode) sky.fill(255, (y * 320 + x) * 4, (y * 320 + x) * 4 + 4);
    }
  }
  const raw = disks[2].subarray(END.at, END.at + END.len), txt = String.fromCharCode(...raw);
  const a = txt.indexOf(' CONGRATULATIONS'), b = txt.indexOf('\x02', a);
  const glyphs = Object.fromEntries(['<', '>', '@'].map(ch => [ch, [...Array(9)].map((_, r) => {
    const v = seg.seg1[END.font + (ch.charCodeAt(0) - 32) * 9 + r];
    return [...Array(8)].map((_, c) => v >> (7 - c) & 1 ? '#' : '.').join('');
  })]));
  return [{path: 'ending_bg.png', data: encodePNG(bg, 320, END.h)}, {path: 'ending_dark.png', data: encodePNG(dark, 320, END.h)},
    {path: 'ending_sky.png', data: encodePNG(sky, 320, END.h)},
    {path: 'ending.json', data: enc({lines: txt.slice(a, b + 1).split('\x00'), glyphs})}];
}
