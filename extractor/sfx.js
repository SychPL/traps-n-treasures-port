// Sound effects, as work/export_sfx.py: the game injects them as notes of the stage's music module instruments ($2E216C ->
// queue $2E227C -> $2E21B8 writes the note into the current block line). For each stage a copy of the module gets a new
// song: one 64-line block per effect (line 0: the note on channel 1, line 40: F FF = note off), the other channels
// empty; the engine renders the whole song and cuts it into equal parts, one per effect (order as in SOUNDS).
// Output: sfx/level<n>.med + sfx.json {name: length in 50 Hz frames}.
import { extractMusic } from './music.js';

// name: [instrument d0, note d1, length in frames (d3)] from the calls in the game code (see work/export_sfx.py)
const SOUNDS = {
  pickup: [40, 12, 50], kill: [18, 2, 60], free: [30, 4, 50], potion: [59, 38, 50], cannon: [37, 1, 30],
  mech: [58, 2, 50], gate: [56, 9, 50], locked: [28, 32, 30], door: [58, 0, 80], unmech: [58, 1, 50],
  throw: [48, 28, 50], bomb: [45, 1, 80], bombthrow: [44, 12, 100], explode: [51, 0, 130], life_up: [48, 31, 50],
  splash: [33, 55, 20], bounce: [43, 0, 50], crumble: [53, 10, 20], lift: [47, 48, 20], put: [46, 48, 20],
  rotten: [23, 54, 80], jump: [36, 28, 30], bonus: [19, 24, 80], rope: [40, 36, 40], smash: [38, 7, 50],
  bell: [17, 38, 80], puff: [33, 55, 20], screech: [31, 55, 80], trap: [33, 12, 40], gameover: [6, 22, 60],
  sword2: [33, 8, 10], crooked: [60, 10, 30], falldie: [22, 53, 60], land: [24, 0, 20], dark: [54, 8, 60],
  cursor: [63, 30, 12], fire: [26, 0, 40], spring: [50, 24, 50], warn: [49, 52, 60], spike: [33, 1, 40],
  tick: [42, 40, 4], sword: [33, 12, 10], swing: [37, 12, 50], buy: [32, 14, 100], nobuy: [33, 32, 25],
  hurt: [35, 12, 30], die: [29, 43, 50], clink: [62, 30, 20], sack: [39, 0, 20], hit: [34, 17, 60],
  kill2: [21, 48, 60], item: [20, 48, 50], dia0: [48, 48, 40], dia1: [48, 47, 40], dia2: [48, 46, 40],
  heart: [57, 40, 80], cheer: [57, 53, 20], yawn: [27, 28, 50], whirl: [25, 29, 50], bubble: [32, 12, 30],
  balls: [60, 20, 60], gate_close: [52, 0, 50], keydrop: [62, 24, 20], crash: [31, 40, 80], spark: [55, 0, 30],
  tick0: [61, 24, 30], tick1: [61, 26, 30], tick2: [61, 28, 30], tick3: [61, 29, 30], tick4: [61, 31, 30],
  tick5: [61, 33, 30], tick6: [61, 35, 30], tick7: [61, 36, 30]
};
const LINES = 64, OFF_LINE = 40;

function build(mod) {
  const blocks = Object.values(SOUNDS).map(([instr, note]) => {
    const b = new Uint8Array(2 + LINES * 4 * 3), n = note + 1;
    b[0] = 4; b[1] = LINES - 1;
    b[2] = (n & 0x3F) | (instr >> 4 & 1) << 7 | (instr >> 5 & 1) << 6;
    b[3] = (instr & 0x0F) << 4;
    b[2 + OFF_LINE * 12 + 1] = 0x0F; b[2 + OFF_LINE * 12 + 2] = 0xFF;   // F FF: note off
    return b;
  });
  const parts = [mod];
  let len = mod.length;
  const pad = k => { if (len % k) { const z = new Uint8Array(k - len % k); parts.push(z); len += z.length; } };
  pad(4);
  const arr = len, table = new Uint8Array(4 * blocks.length);
  parts.push(table); len += table.length;
  const tv = new DataView(table.buffer);
  blocks.forEach((b, i) => { tv.setUint32(4 * i, len); parts.push(b); len += b.length; pad(2); });
  const d = new Uint8Array(len);
  let o = 0; for (const p of parts) { d.set(p, o); o += p.length; }
  const dv = new DataView(d.buffer), song = dv.getUint32(8), s = song + 63 * 8;
  dv.setUint32(16, arr);                                     // blockarr
  dv.setUint16(s, blocks.length); dv.setUint16(s + 2, blocks.length);   // numblocks, songlen
  for (let i = 0; i < 256; i++) d[s + 4 + i] = i < blocks.length ? i : 0;
  dv.setUint32(4, len);                                      // modlen
  return d;
}

export function extractSfx(disks) {
  const music = Object.fromEntries(extractMusic(disks).map(f => [f.path, f.data]));
  if (![1, 2, 3, 4].every(n => music[`music/level${n}.med`])) return [];
  return [...[1, 2, 3, 4].map(n => ({path: `sfx/level${n}.med`, data: build(music[`music/level${n}.med`])})),
    {path: 'sfx/sfx.json', data: new TextEncoder().encode(JSON.stringify(Object.fromEntries(Object.entries(SOUNDS).map(([k, v]) => [k, v[2]]))))}];
}
