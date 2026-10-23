// Screens and runs outside the stages: treasure.png/json (work/export_treasure.py), gameover.png
// (work/export_gameover.py) and title.png (the title picture as the emulator showed it).
import { readFile } from './adf.js';
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
  return out;
}
