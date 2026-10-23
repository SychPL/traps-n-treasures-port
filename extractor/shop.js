// Shop, as work/export_shop.py: shop_bg.png (disk 2 $B503C, PowerPacker, 320x160, 5 planes one after another),
// shop_items.png/json (BOB bank disk 2 $B89C0, PowerPacker; the shop offers point to offsets in it), shop_keeper.json
// (the keeper actors $2E1B40 with animation blocks from the main program). Palette: the fade-in target $30B9BA.
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { mainProgram, MAIN } from './seg2.js';
import { bob } from './objects.js';

const BG = 0xB503C, BANK = 0xB89C0, PAL = 0x30B9BA;
const KEEPER = [[0x000, 269, 82, 0x2E1C74], [0x710, 289, 112, 0x2E1CD2], [0x710, 283, 126, 0x2E1D66]];   // base, x, y, block
const hex = v => v.toString(16);

export function extractShop(disks) {
  if (!disks[1] || !disks[2]) return [];
  const {seg1} = mainProgram(disks[1]), fv = new DataView(seg1.buffer), W = a => fv.getUint16(a - MAIN.bases[0]);
  const pal = [...Array(32)].map((_, i) => W(PAL + 2 * i)), out = [];
  const bg = readFile(disks[2], BG), px = new Uint8Array(320 * 160 * 4);
  for (let y = 0; y < 160; y++)
    for (let x = 0; x < 320; x++) {
      let c = 0;
      for (let p = 0; p < 5; p++) c |= (bg[p * 6400 + y * 40 + (x >> 3)] >> (7 - (x & 7)) & 1) << p;
      const v = pal[c], k = (y * 320 + x) * 4;
      px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255;
    }
  out.push({path: 'shop_bg.png', data: encodePNG(px, 320, 160)});
  // item BOBs one after another (total size in the header at +24), shelf-packed into 512 px
  const bank = readFile(disks[2], BANK), bv = new DataView(bank.buffer, bank.byteOffset, bank.byteLength), frames = [];
  for (let a = 0; a + 26 < bank.length;) {
    const w = bv.getUint16(a), h = bv.getUint16(a + 2), ps = bv.getUint16(a + 22), size = bv.getUint16(a + 24);
    let bits = 0; for (let v = bank[a + 16]; v; v >>= 1) bits += v & 1;
    if (!(w > 0 && w <= 320 && h > 0 && h <= 256 && size === 26 + ps * (bits + 1))) break;
    frames.push([a, w, h]); a += size;
  }
  let x = 0, y = 0, row = 0;
  const pos = new Map();
  for (const [off, w, h] of frames) {
    if (x + w > 512) { x = 0; y += row + 1; row = 0; }
    pos.set(off, [x, y, w, h]); x += w + 1; row = Math.max(row, h);
  }
  const H = y + row + 1, ipx = new Uint8Array(512 * H * 4);
  for (const [off] of frames) bob(bank, off, pal, ipx, 512, pos.get(off)[0], pos.get(off)[1]);
  out.push({path: 'shop_items.png', data: encodePNG(ipx, 512, H)});
  const items = Object.fromEntries(frames.map(([off]) => [hex(off), [...pos.get(off), bv.getInt16(off + 4), bv.getInt16(off + 6)]]));
  out.push({path: 'shop_items.json', data: new TextEncoder().encode(JSON.stringify(items))});
  // keeper: frames of the block, 'sleep n' ($FFCA) = the same frame for n more steps
  const seq = blk => {
    const s = [];
    for (let a = blk; s.length < 200;) {
      const w = W(a);
      if (w < 0x8000) { s.push(w); a += 2; } else if (w === 0xFFCA) { for (let k = W(a + 2); k > 0; k--) s.push(s[s.length - 1]); a += 4; } else break;
    }
    return s;
  };
  const keeper = KEEPER.map(([b, kx, ky, blk]) => ({base: hex(b), x: kx - 32, y: ky - 32, delay: 7, seq: seq(blk)}));
  out.push({path: 'shop_keeper.json', data: new TextEncoder().encode(JSON.stringify({order: frames.map(([o]) => hex(o)), keeper}))});
  return out;
}
