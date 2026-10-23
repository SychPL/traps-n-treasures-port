// Weapon and sword sprites (hardware SPR4/5, an attached pair = 16 px, colours 16-31 of the level 1 palette), as
// work/export_weapons.py and work/export_sword.py: weapons.json + weapons_*.png from the frame table $308EA2 (main
// program) -> {w, h, anchor x/y, box 4 words, 2 sprite pointers} in seg2; sword_*.png = the 8-line stab sprites at
// $C298/$C2C0 (right) and $C300/$C328 (left), also in seg2. A sprite: pos, ctl, then rows of (DATA, DATB).
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { CHR, chrPalette, waterPalette } from './tiles.js';
import { mainProgram, MAIN } from './seg2.js';

const TAB = 0x308EA2, N = 0x30, CELL = 40, COLS = 12, SWORD = [[0xC298, 0xC2C0], [0xC300, 0xC328]];

// draws the attached pair (a: even sprite, b: odd sprite, chip addresses) into px at (x0, y0)
function pair(cv, a, b, h, pal, px, W, x0, y0) {
  for (let y = 0; y < h; y++) {
    const a0 = cv(a + 4 + 4 * y), b0 = cv(a + 6 + 4 * y), a1 = cv(b + 4 + 4 * y), b1 = cv(b + 6 + 4 * y);
    for (let x = 0; x < 16; x++) {
      const s = 15 - x, c = (a0 >> s & 1) | (b0 >> s & 1) << 1 | (a1 >> s & 1) << 2 | (b1 >> s & 1) << 3;
      if (!c) continue;
      const v = pal[16 + c], k = ((y0 + y) * W + x0 + x) * 4;
      px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255;
    }
  }
}

export function extractWeapons(disks) {
  if (!disks[1] || !disks[2]) return [];
  const {seg1, seg2} = mainProgram(disks[1]), S1 = MAIN.bases[0], S2 = MAIN.bases[1];
  const fv = new DataView(seg1.buffer), sv = new DataView(seg2.buffer);
  const inSeg2 = (a, n) => a >= S2 && a + n <= S2 + seg2.length;
  const W16 = a => sv.getUint16(a - S2), S16 = a => sv.getInt16(a - S2), L32 = a => sv.getUint32(a - S2);
  const surf = chrPalette(readFile(disks[2], CHR[1])), water = waterPalette(surf, 1);
  const out = [];
  // weapons: frames whose struct and both sprites lie in seg2 (the others are garbage or built at run time, unused)
  const W = COLS * CELL, H = Math.ceil(N / COLS) * CELL, px = {surface: new Uint8Array(W * H * 4), water: new Uint8Array(W * H * 4)};
  const meta = {};
  for (let i = 0; i < N; i++) {
    const f = fv.getUint32(TAB + 4 * i - S1);
    if (!inSeg2(f, 24)) continue;
    const w = S16(f), h = S16(f + 2), ax = S16(f + 4), ay = S16(f + 6), p0 = L32(f + 16), p1 = L32(f + 20);
    if (!(w > 0 && w <= 16 && h > 0 && h <= CELL) || !inSeg2(p0, 4 + 4 * h) || !inSeg2(p1, 4 + 4 * h)) continue;
    const x0 = i % COLS * CELL, y0 = (i / COLS | 0) * CELL;
    pair(W16, p0, p1, h, surf, px.surface, W, x0, y0);
    pair(W16, p0, p1, h, water, px.water, W, x0, y0);
    meta[i] = [x0, y0, w, h, ax, ay];
  }
  out.push({path: 'weapons.json', data: new TextEncoder().encode(JSON.stringify(meta))});
  for (const k of ['surface', 'water']) out.push({path: `weapons_${k}.png`, data: encodePNG(px[k], W, H)});
  // sword: 2 frames of 16 x 8 side by side
  for (const [k, pal] of [['surface', surf], ['water', water]]) {
    const s = new Uint8Array(32 * 8 * 4);
    SWORD.forEach(([a, b], i) => pair(W16, a, b, 8, pal, s, 32, 16 * i, 0));
    out.push({path: `sword_${k}.png`, data: encodePNG(s, 32, 8)});
  }
  return out;
}
