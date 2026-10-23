// Island map ($2F3770), as work/export_map.py and the marker of work/export_screens.py: island_clean.png (disk 2 PP
// $A5284, 320x191, 5 planes one after another, from screen line 17; lines 0-16 are colour 0), map_actors.png/json (BOB
// bank disk 2 $A3190: flags, marker, 5 ship frames, 4 boats; scripts $2F3BF0..$2F3F80 of the main program, run by the
// engine's script interpreter) and map_marker.png (BOB $5A). Palette: the fade-in target $2F3B70 ($2F3A8C).
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { mainProgram, MAIN } from './seg2.js';
import { bob } from './objects.js';
import { walkBank } from './actors.js';

const PIC = 0xA5284, BANK = 0xA3190, PAL = 0x2F3B70, BASE = 0x400000, MEM = [0x2F3BF0, 0x2F3F80];
const SCRIPTS = {flag1: 0x2F3BF0, flag2: 0x2F3C1C, sail: 0x2F3C88, anchor: 0x2F3E58};
const hex = v => v.toString(16);

export function extractMap(disks) {
  if (!disks[1] || !disks[2]) return [];
  const {seg1} = mainProgram(disks[1]), S1 = MAIN.bases[0], fv = new DataView(seg1.buffer), W = a => fv.getUint16(a - S1);
  const pal = [...Array(32)].map((_, i) => W(PAL + 2 * i)), out = [];
  const put = (px, w, x, y, v) => { const k = (y * w + x) * 4; px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255; };
  // clean map: 200 lines, 0-16 colour 0, then the picture (its first 183 lines)
  const pic = readFile(disks[2], PIC), px = new Uint8Array(320 * 200 * 4);
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < 320; x++) {
      let c = 0;
      if (y >= 17) for (let p = 0; p < 5; p++) c |= (pic[p * 40 * 191 + (y - 17) * 40 + (x >> 3)] >> (7 - (x & 7)) & 1) << p;
      put(px, 320, x, y, pal[c]);
    }
  out.push({path: 'island_clean.png', data: encodePNG(px, 320, 200)});
  // map actors: the bank in a row, 1 px apart, addresses shown as BASE + offset
  const raw = readFile(disks[2], BANK), bank = new Uint8Array(raw.length + 4);
  bank.set(raw); bank.fill(255, raw.length);
  const bobs = walkBank({chip: bank}, 0), AW = bobs.reduce((s, [, f]) => s + f.w + 1, 0), AH = Math.max(...bobs.map(([, f]) => f.h));
  const apx = new Uint8Array(AW * AH * 4), frames = {}, order = [];
  let x = 0;
  for (const [a, f] of bobs) {
    bob(bank, a, pal, apx, AW, x, 0);
    frames[hex(BASE + a)] = [x, 0, f.w, f.h, f.ax, f.ay]; order.push(hex(BASE + a)); x += f.w + 1;
  }
  out.push({path: 'map_actors.png', data: encodePNG(apx, AW, AH)});
  const mem = seg1.subarray(MEM[0] - S1, MEM[1] - S1);
  const pos = s => { let px0 = 0, py0 = 0; for (let k = s; k < s + 40; k += 2) { if (W(k) === 0x0EFE) px0 = W(k + 2); if (W(k) === 0x10FE) py0 = W(k + 2); } return [px0, py0]; };
  out.push({path: 'map_actors.json', data: new TextEncoder().encode(JSON.stringify({banks: {'30cdb4': BASE}, frames, order,
    mem: [[MEM[0], [...mem].map(b => b.toString(16).padStart(2, '0')).join('')]], actors: [],
    scripts: Object.fromEntries(Object.entries(SCRIPTS).map(([k, v]) => [k, [v, ...pos(v)]]))}))});
  // marker: BOB $5A, its own size
  const mw = new DataView(bank.buffer).getUint16(0x5A), mh = new DataView(bank.buffer).getUint16(0x5A + 2), mpx = new Uint8Array(mw * mh * 4);
  bob(bank, 0x5A, pal, mpx, mw, 0, 0);
  out.push({path: 'map_marker.png', data: encodePNG(mpx, mw, mh)});
  return out;
}
