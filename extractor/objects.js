// Level objects (items, fixed BOBs): level{n}_objects.json and the _surface / _water atlases of their BOBs, read from the
// stage memory by the same rules as work/export_objects.py reads the emulator dumps.
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { CHR, chrPalette, waterPalette } from './tiles.js';
import { stageMemory, reader, levelJSON } from './tables.js';

const FB = 0x200000, CELL = 48;
const LISTS = {1: 0x2F53CE, 2: 0x2F71F6, 3: 0x2FADD8, 4: 0x301660};   // object records, 26 B each
const ENEMY_BANK = 0x30CD70;
// fruits from pots ($2E6990: random pick from $2E84A2, descriptors $2E84C6; type = descriptor - 2 as in the list)
const POT_FRUITS = [0x2E7D20, 0x2E7D94, 0x2E7DCE, 0x2E7E08, 0x2E7E42, 0x2E7E7C, 0x2E7EB6, 0x2E7EF0, 0x2E7F2A];
const hex = v => v.toString(16);

// actor script ops (work/actor_script.py): code -> [name, length in bytes]
const OPS = {
  0xFFFA: ['restart', 2], 0xFFF8: ['end', 2], 0xFFF6: ['kill', 2], 0xFFF4: ['layer', 4], 0xFFF2: ['gflag_set', 4],
  0xFFF0: ['gflag_wait', 4], 0xFFEE: ['call', 10], 0xFFEC: ['gflag_loop', 6], 0xFFEA: ['gflag2_loop', 6], 0xFFE8: ['poke_b', 8],
  0xFFE6: ['poke_w', 8], 0xFFE4: ['poke_l', 10], 0xFFE2: ['set44', 4], 0xFFE0: ['sub1ce0', 6], 0xFFDE: ['path', 6],
  0xFFDC: ['clip', 12], 0xFFDA: ['bob', 6], 0xFFD8: ['move_delay', 4], 0xFFD6: ['delay', 4], 0xFFD4: ['pri', 4],
  0xFFD2: ['loop_n', 4], 0xFFD0: ['loop_back', 4], 0xFFCE: ['flag_set', 4], 0xFFCC: ['flag_wait', 4], 0xFFCA: ['sleep', 4],
  0xFFC8: ['sleep_rnd', 6], 0xFFC6: ['spawn_once', 6], 0xFFC4: ['frame_rnd', 6], 0xFFC2: ['glide', 8], 0xFFC0: ['sound', 6],
  0xFFBE: ['remap', 10], 0xFFBC: ['pingpong', 6], 0xFFBA: ['jump', 6], 0xFFB8: ['spawn_at', 10], 0xFFB6: ['base', 10],
  0xFFB4: ['spawn_child', 10], 0xFFB2: ['test_g', 4], 0xFFB0: ['test_bit', 8], 0xFFAE: ['br_set', 4], 0xFFAC: ['br_clr', 4],
};

// -> op texts as actor_script.decode prints them (ends on restart / end / kill / jump or after n ops)
function decode({W, rd}, a, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const w = W(a);
    if (w < 0x8000 && (w & 0xFF) !== 0xFE && (w & 0xFF) !== 0xFC) { out.push('frame ' + w); a += 2; continue; }
    if ((w & 0xFF) === 0xFE || (w & 0xFF) === 0xFC) {
      const ln = (w & 0xFF) === 0xFE ? 4 : 6;
      out.push(`set${ln === 4 ? 'w' : 'l'} +$${hex(w >> 8).padStart(2, '0')} = $${[...rd(a + 2, ln - 2)].map(b => hex(b).padStart(2, '0')).join('')}`);
      a += ln; continue;
    }
    const [name, ln] = OPS[w] || ['?' + hex(w).padStart(4, '0'), 2], args = [];
    for (let k = 2; k < ln; k += 2) args.push(hex(W(a + k)).padStart(4, '0'));
    out.push(name + ' ' + args.join(' '));
    a += ln;
    if (['restart', 'end', 'kill', 'jump'].includes(name)) break;
  }
  return out;
}
const int10 = s => { if (!/^\d+$/.test(s)) throw new Error(`frame number ${s}`); return +s; };

// descriptor script (type + 2): animation block 'sub1ce0' (a simple loop of frames) and 'delay' -> [frames | null, delay]
function anim(m, t) {
  let blk = 0, delay = 1;
  for (const s of decode(m, t + 2, 20)) {
    const w = s.split(/\s+/).filter(Boolean);
    if (w[0] === 'sub1ce0') blk = parseInt(w[1] + w[2], 16);
    if (w[0] === 'delay') delay = parseInt(w[1], 16);
  }
  if (!blk) return [null, 1];
  const ops = decode(m, blk, 64);
  if (ops[ops.length - 1].trim() !== 'restart' || !ops.slice(0, -1).every(s => s.startsWith('frame'))) return [null, 1];
  const seq = ops.slice(0, -1).map(s => int10(s.split(/\s+/)[1]));
  return [new Set(seq).size > 1 ? seq : null, delay];
}

export function records({fast}, lst, width) {
  const fv = new DataView(fast.buffer), out = [];
  const ok = a => {
    const x = fv.getUint16(a), y = fv.getUint16(a + 2), fl = fv.getUint16(a + 4), t = fv.getUint32(a + 6);
    return x > 0 && x < width && y < 768 && fl < 0x100 && (t >= 0x9000 && t < 0x80000 || t >= 0x2C0000 && t < 0x320000);
  };
  for (let a = lst - FB, miss = 0; miss < 20;)
    if (ok(a)) {
      out.push({x: fv.getUint16(a), y: fv.getUint16(a + 2), fl: fv.getUint16(a + 4), type: fv.getUint32(a + 6),
        p: [0, 1, 2, 3].map(k => fv.getUint32(a + 10 + 4 * k)), addr: a + FB});
      a += 26; miss = 0;
    } else { a += 2; miss++; }
  return out;
}

export function sections({L, W}) {
  const tab = L(L(0x30CD14) + 0x64), out = [];
  for (let i = 0; i < 256; i++) {
    const p = L(tab + 4 * i);
    if (!(p >= 0x200000 && p < 0x320000)) break;
    let e = p;
    while (W(e)) e += 26;
    out.push([p, e]);
  }
  return out;
}

// BOB: {w, h, ax, ay, ..., stored planes (+16), forced planes (+17), plane size (+22)}, mask plane at +26, then the planes
export function bob(chip, a, pal, px, W, cx, cy) {   // W: atlas width
  const dv = new DataView(chip.buffer), w = dv.getUint16(a), h = dv.getUint16(a + 2);
  const stored = chip[a + 16], forced = chip[a + 17], ps = dv.getUint16(a + 22), rb = ps / h | 0, d = a + 26;
  const planes = [0, 1, 2, 3, 4].filter(p => stored >> p & 1);
  const bit = (o, x, y) => chip[o + y * rb + (x >> 3)] >> (7 - (x & 7)) & 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!bit(d, x, y)) continue;
      let c = forced & ~stored;
      planes.forEach((p, k) => { c |= bit(d + ps * (k + 1), x, y) << p; });
      const v = pal[c], k = ((cy + y) * W + cx + x) * 4;
      px[k] = (v >> 8 & 15) * 17; px[k + 1] = (v >> 4 & 15) * 17; px[k + 2] = (v & 15) * 17; px[k + 3] = 255;
    }
}

// BOB palettes of a stage: the copper palette above the water (colour 1 = the sky at the top) and under it (colour 1 =
// water background; colours 2 and 3 are tinted only on the 2 mirror lines, below them the copper sets them back - level 1
// copper list)
export function stagePalettes(disks, n, lvl) {
  const w12 = c => parseInt(c[1], 16) << 8 | parseInt(c[3], 16) << 4 | parseInt(c[5], 16);
  const chr = chrPalette(readFile(disks[2], CHR[n]));
  return [chr.map((v, c) => c === 1 ? w12(lvl.skyTop) : v),
    waterPalette(chr, n).map((v, c) => c === 1 ? w12(lvl.waterColor) : c === 2 || c === 3 ? chr[c] : v)];
}

export function levelObjects(disks, n) {
  const mem = stageMemory(disks, n), m = reader(mem), {L, W, S, B} = m, lvl = levelJSON(disks, n);
  const recs = records(mem, LISTS[n], 0x7FFF);
  const hidden = [...lvl.brittle.list.filter(e => e.item).map(e => parseInt(e.item, 16)), ...POT_FRUITS.map(d => d - 2),
    ...lvl.bonus.items.map(t => parseInt(t, 16))];
  const gfx = {}, cells = [], actors = new Set();
  const dims = c => [W(cells[c]), W(cells[c] + 2), S(cells[c] + 4), S(cells[c] + 6)];
  for (const t of [...new Set([...recs.map(r => r.type), ...hidden])].sort((a, b) => a - b)) {
    if (W(t + 2) !== 0xFFB6) continue;                 // descriptor script starts with 'base' (offset, bank variable)
    const off = L(t + 4), v = L(t + 8);
    if (v === ENEMY_BANK) { actors.add(t); continue; }
    if (!(v >= FB && v < 0x400000)) continue;
    const a = L(v) + off, w = W(a), h = W(a + 2);
    if (w < 2 || h < 2 || w > CELL || h > CELL) continue;
    cells.push(a);
    const g = gfx[hex(t)] = {cell: cells.length - 1, w, h, ax: S(a + 4), ay: S(a + 6)};
    if (t === 0x2F2FE2) {                               // cage with a prisoner ($2F301A): frames 0 1 2 (2 = empty) + HELP ($2F3072)
      const c0 = cells.length - 1;
      let b = a;
      for (let k = 0; k < 2; k++) { b += W(b + 24); cells.push(b); }
      cells.push(L(v) + 0x4B02);
      Object.assign(g, {frames: [0, 1, 2].map(k => [c0 + k, ...dims(c0 + k)]), help: [c0 + 3, ...dims(c0 + 3)]});
    }
    const [seq, delay] = anim(m, t);
    if (seq) {                                          // the next BOBs of the bank = frames 1, 2, ...
      const c0 = cells.length - 1;
      let b = a;
      for (let k = 0; k < Math.max(...seq); k++) { b += W(b + 24); cells.push(b); }
      Object.assign(g, {anim: seq.map(k => [c0 + k, ...dims(c0 + k)]), delay});
    }
  }
  const text = r => {                                  // prisoner / book text (ASCII, '^' = new line)
    const p2 = r.p[2];
    if (!(p2 >= FB && p2 < 0x400000)) return {};
    const b = m.rd(p2, 600), i = b.indexOf(0), s = i < 0 ? b : b.subarray(0, i);
    return s.length > 4 && s.every(c => c >= 32 && c < 127) ? {text: String.fromCharCode(...s)} : {};
  };
  const FLAG = {0x2EFAFA: [0x30CAF1, 2], 0x2EFB0E: [0x30CAF2, 2], 0x2EFB22: [0x30CAF3, 2]};
  const emit = r => {                                  // drip emitters ($2EF8A8): {dx, dy, period, counter} to $FFFF
    const [, p1, p2] = r.p;
    let flag = FLAG[p1];
    if (![0x2EFAA4, 0x2EFAFA, 0x2EFB0E, 0x2EFB22, 0x2EFB36].includes(p1) || !(p2 >= FB && p2 < 0x400000)) return {};
    let a = p2;
    if (p1 === 0x2EFB36) { flag = [L(a), 1]; a += 4; }   // first long = lever byte, emits while != 1
    const lst = [];
    for (; lst.length < 16; a += 8) {
      const e = [0, 2, 4, 6].map(k => S(a + k));
      if (e[0] === -1) break;
      lst.push(e);
    }
    const out = {emit: lst};
    if (flag) Object.assign(out, {eflag: hex(flag[0]), enot: flag[1]});
    if (r.type === 0x2F2EEE) out.enear = 1;             // $2EF8B6: only with the player within 100 px
    return out;
  };
  const SECT = sections(m), sectOf = a => { const s = SECT.find(([p, e]) => p <= a && a < e); return s ? hex(s[0]) : null; };
  const objects = recs.map(r => ({x: r.x, y: r.y, type: hex(r.type), sect: sectOf(r.addr), ...(actors.has(r.type) ? {actor: 1} : {}),
    ...text(r), ...emit(r)}));
  const [surf, water] = stagePalettes(disks, n, lvl);
  const H = CELL * Math.max(1, Math.ceil(cells.length / 16)), png = pal => {
    const px = new Uint8Array(CELL * 16 * H * 4);
    cells.forEach((a, i) => bob(mem.chip, a, pal, px, CELL * 16, i % 16 * CELL, (i >> 4) * CELL));
    return encodePNG(px, CELL * 16, H);
  };
  return {json: {cell: CELL, objects, gfx}, surface: png(surf), water: png(water)};
}

export function extractObjects(disks) {
  if (!disks[1] || !disks[2]) return [];
  return [1, 2, 3, 4].flatMap(n => {
    const o = levelObjects(disks, n);
    return [{path: `level${n}_objects.json`, data: new TextEncoder().encode(JSON.stringify(o.json))},
      {path: `level${n}_objects_surface.png`, data: o.surface}, {path: `level${n}_objects_water.png`, data: o.water}];
  });
}
