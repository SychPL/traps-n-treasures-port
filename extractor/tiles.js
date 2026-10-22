// Level tile banks: CHR! files on disk 2 (PowerPacker) -> level{n}_surface.png / _water.png (256 x 256, 16 tiles a row).
// CHR!: "CHR!", planes.W, 0.W, 32 colours (12 bit Amiga), then 16x16 tiles from +$46, 5 planes x 32 B (160 B a tile).
// Colour 1 is the sky (transparent in the atlas, the engine paints the sky gradient behind the tiles).
import { readFile } from './adf.js';
import { encodePNG } from './png.js';

export const CHR = {1: 0x2D5A4, 2: 0x46A1C, 3: 0x64284, 4: 0x80ED0};

export function chrPalette(chr) {
  const dv = new DataView(chr.buffer, chr.byteOffset, chr.byteLength);
  return Array.from({length: 32}, (_, i) => dv.getUint16(6 + 2 * i));
}

// chr: unpacked CHR! file, pal: 32 Amiga colours -> RGBA of a 256 x 256 atlas (tiles past 256 are dropped)
export function atlasRGBA(chr, pal) {
  const dv = new DataView(chr.buffer, chr.byteOffset, chr.byteLength), n = Math.min(256, (chr.length - 0x46) / 160 | 0);
  const px = new Uint8Array(256 * 256 * 4);
  for (let t = 0; t < n; t++)
    for (let y = 0; y < 16; y++) {
      const ws = [0, 1, 2, 3, 4].map(p => dv.getUint16(0x46 + t * 160 + p * 32 + y * 2));
      for (let x = 0; x < 16; x++) {
        let c = 0;
        for (let p = 0; p < 5; p++) c |= (ws[p] >> (15 - x) & 1) << p;
        if (c === 1) continue;
        const v = pal[c], k = (((t >> 4) * 16 + y) * 256 + (t & 15) * 16 + x) * 4;
        px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255;
      }
    }
  return px;
}

// underwater palette (copper at the water line): every colour but 0 shifted by a per-level delta in Amiga 4-bit units,
// clamped (measured on the copper lists of levels 1 and 4; levels 2 and 3 have no water line, same palette)
const WATER = {1: [-2, -2, 2], 4: [-5, 1, 3]};
export function waterPalette(pal, n) {
  const d = WATER[n];
  if (!d) return pal;
  const cl = v => Math.max(0, Math.min(15, v));
  return pal.map((v, c) => c === 0 ? v : cl((v >> 8 & 15) + d[0]) << 8 | cl((v >> 4 & 15) + d[1]) << 4 | cl((v & 15) + d[2]));
}

export function extractTiles(disks) {
  if (!disks[2]) return [];
  const out = [];
  for (const n of [1, 2, 3, 4]) {
    const chr = readFile(disks[2], CHR[n]);
    if (String.fromCharCode(...chr.subarray(0, 4)) !== 'CHR!') throw new Error(`tiles level ${n}: not a CHR! file`);
    const pal = chrPalette(chr);
    out.push({path: `level${n}_surface.png`, data: encodePNG(atlasRGBA(chr, pal), 256, 256)});
    out.push({path: `level${n}_water.png`, data: encodePNG(atlasRGBA(chr, waterPalette(pal, n)), 256, 256)});
  }
  return out;
}
