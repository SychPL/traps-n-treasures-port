// Player frames (hardware sprites): player.json and player_surface.png / player_water.png, as work/export_player.py.
// Bank = the data hunk on disk 2 at $940C (chip $131A4 in the game): 108 longs = frame offsets from the bank (0 = none);
// a frame is 8 words (w, h, anchor x/y = feet, collision box x1 y1 x2 y2 from the feet) + 4 sprite offsets (2 attached
// pairs, 16 px each), a sprite is pos, ctl, then h x (DATA, DATB). Colours 16-31 of the level 1 palette.
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { CHR, chrPalette, waterPalette } from './tiles.js';
import { hunkData } from './tables.js';

const N = 108, CW = 32, CH = 48, COLS = 12;

function sheet(bank, pal) {
  const dv = new DataView(bank.buffer, bank.byteOffset, bank.byteLength), W = COLS * CW, H = Math.ceil(N / COLS) * CH;
  const px = new Uint8Array(W * H * 4);
  for (let i = 0; i < N; i++) {
    const f = dv.getUint32(4 * i);
    if (!f) continue;
    const h = dv.getInt16(f + 2), sp = [0, 1, 2, 3].map(k => dv.getUint32(f + 16 + 4 * k));
    const ox = i % COLS * CW, oy = (i / COLS | 0) * CH;
    for (let half = 0; half < 2; half++) {
      const s0 = sp[2 * half], s1 = sp[2 * half + 1];
      for (let y = 0; y < Math.min(h, CH); y++) {
        const a0 = dv.getUint16(s0 + 4 + 4 * y), b0 = dv.getUint16(s0 + 6 + 4 * y);
        const a1 = dv.getUint16(s1 + 4 + 4 * y), b1 = dv.getUint16(s1 + 6 + 4 * y);
        for (let x = 0; x < 16; x++) {
          const s = 15 - x, c = (a0 >> s & 1) | (b0 >> s & 1) << 1 | (a1 >> s & 1) << 2 | (b1 >> s & 1) << 3;
          if (!c) continue;
          const v = pal[16 + c], k = ((oy + y) * W + ox + half * 16 + x) * 4;
          px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255;
        }
      }
    }
  }
  return encodePNG(px, W, H);
}

export function extractPlayer(disks) {
  if (!disks[2]) return [];
  const bank = hunkData(disks[2], 0x940C), dv = new DataView(bank.buffer, bank.byteOffset, bank.byteLength);
  const pal = chrPalette(readFile(disks[2], CHR[1]));
  const frames = [...Array(N)].map((_, i) => {
    const f = dv.getUint32(4 * i);
    return f ? {h: dv.getInt16(f + 2), ax: dv.getInt16(f + 4), ay: dv.getInt16(f + 6), box: [8, 10, 12, 14].map(k => dv.getInt16(f + k))} : null;
  });
  return [{path: 'player.json', data: new TextEncoder().encode(JSON.stringify({cell: [CW, CH], cols: COLS, frames}))},
    {path: 'player_surface.png', data: sheet(bank, pal)}, {path: 'player_water.png', data: sheet(bank, waterPalette(pal, 1))}];
}
