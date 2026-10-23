// Level tables (level{n}.json minus the palette fields): a layout-A memory image of one stage - the relocated main
// program, the stage's area hunk at its chip address and the level variables - read by the same rules as
// work/export_level.py reads the emulator dumps.
import { readFile } from './adf.js';
import { mainProgram, MAIN } from './seg2.js';
import { LEV } from './levels.js';

const FB = 0x200000;
// area hunk on disk 2 (HUNK_HEADER, one DATA hunk; the game reads it unrelocated, offsets are added to its base) and
// the chip address the game loaded it to in layout A ($30CD98)
const HUNK = {1: 0x21AA4, 2: 0x3C314, 3: 0x56DB0, 4: 0x72500};
const BASE = {1: 0x9014, 2: 0x52024, 3: 0x52024, 4: 0x52024};
const ATTR = {1: 0xFAF4, 2: 0xF8F4, 3: 0xFCF4, 4: 0xFEF4};   // tile attributes (word per tile, seg2)
const STAGES = 0x30B70E;                                      // per stage {x.W, y.W, level table.L} ($2DCE44)
const ITEMS = {at: 0x16E68, chip: 0x1EDA4};                   // item bank: raw file on disk 2, its chip address ($30CD58)
// message font ($30CD5C) and HUD bank (tool icons, compass: $30CD60): raw files on disk 2, chip addresses in layout A
const MSGFONT = {at: 0x15028, chip: 0x71B4}, HUDBANK = {at: 0x1F53C, chip: 0x2747C};
// enemy BOB banks (PowerPacker on disk 2) and their chip addresses in layout A ($30CD70)
const ENEMIES = {1: [0x34660, 0x65484], 2: [0x4DBB0, 0x64694], 3: [0x6B90C, 0x67494], 4: [0x88924, 0x68BA4]};

const hex = v => v.toString(16);
const find = (b, pat, from = 0, to = b.length) => {
  for (let i = Math.max(0, from); i + pat.length <= to; i++) if (pat.every((v, k) => b[i + k] === v)) return i;
  return -1;
};
const rfind = (b, pat, from, to) => {
  for (let i = to - pat.length; i >= Math.max(0, from); i--) if (pat.every((v, k) => b[i + k] === v)) return i;
  return -1;
};
const bytes = s => s.match(/../g).map(x => parseInt(x, 16));
const cstr = b => { const i = b.indexOf(0); return String.fromCharCode(...(i < 0 ? b : b.subarray(0, i))); };   // latin1

export function hunkData(adf, at) {
  const dv = new DataView(adf.buffer, adf.byteOffset, adf.byteLength);
  if (dv.getUint32(at) !== 0x3F3 || dv.getUint32(at + 4) || dv.getUint32(at + 8) !== 1) throw new Error(`no one-hunk file at $${hex(at)}`);
  if ((dv.getUint32(at + 24) & 0x3FFFFFFF) !== 0x3EA) throw new Error(`no HUNK_DATA at $${hex(at + 24)}`);
  return adf.subarray(at + 32, at + 32 + dv.getUint32(at + 28) * 4);
}

export function stageMemory(disks, n) {
  const {seg1, seg2} = mainProgram(disks[1]), chip = new Uint8Array(FB), fast = new Uint8Array(FB);
  fast.set(seg1, MAIN.bases[0] - FB); chip.set(seg2, MAIN.bases[1]);
  const hunk = hunkData(disks[2], HUNK[n]), base = BASE[n];
  chip.set(hunk, base);
  chip.set(readFile(disks[2], ITEMS.at), ITEMS.chip);              // item BOBs, shared by every stage
  chip.set(readFile(disks[2], ENEMIES[n][0]), ENEMIES[n][1]);       // the stage's enemy BOBs
  for (const b of [MSGFONT, HUDBANK]) chip.set(readFile(disks[2], b.at), b.chip);
  const lev = readFile(disks[2], LEV[n]), ld = new DataView(lev.buffer, lev.byteOffset);
  const w = ld.getUint16(10) * ld.getUint16(14), h = ld.getUint16(12) * ld.getUint16(16);
  const fv = new DataView(fast.buffer), set = (a, v) => fv.setUint32(a - FB, v);
  set(0x30CD14, fv.getUint32(STAGES + 8 * (n - 1) + 4 - FB));   // level table
  set(0x30CD98, base);                                             // area data
  set(0x30CBA2, base + new DataView(hunk.buffer, hunk.byteOffset).getUint32(4));   // start area
  set(0x30CD58, ITEMS.chip);                                       // item bank
  set(0x30CD70, ENEMIES[n][1]);                                    // enemy bank
  set(0x30CD5C, MSGFONT.chip); set(0x30CD60, HUDBANK.chip);
  fv.setUint16(0x30CAA2 - FB, w);                                  // A4+$22: map width
  return {chip, fast, base, w, h, map: lev.subarray(18)};
}

export function reader({chip, fast}) {
  const cv = new DataView(chip.buffer), fv = new DataView(fast.buffer);
  const rd = (a, k) => a < FB ? chip.subarray(a, a + k) : fast.subarray(a - FB, a - FB + k);
  return {rd, B: a => rd(a, 1)[0], L: a => a < FB ? cv.getUint32(a) : fv.getUint32(a - FB),
    W: a => a < FB ? cv.getUint16(a) : fv.getUint16(a - FB), S: a => a < FB ? cv.getInt16(a) : fv.getInt16(a - FB)};
}

function areas({L, W}) {
  const base = L(0x30CD98), start = L(0x30CBA2) - base, out = {}, todo = [start];
  while (todo.length) {
    const off = todo.pop();
    if (off in out) continue;
    const s = base + off, wy = W(s + 0x10);
    const ar = {cam: [W(s + 8), W(s + 0xA), W(s + 0xC), W(s + 0xE)], water: wy === 0xFFFF ? null : wy, doors: []};
    ar.target = [W(s + 0x16), W(s + 0x18)];
    if (W(s + 0x14)) ar.dark = 1;
    ar.sect = hex(L(L(L(0x30CD14) + 0x64) + 4 * L(s)));
    out[off] = ar;
    let d = base + L(s + 4);
    for (let i = 0; i < 64; i++, d += 6) {
      const tile = W(d);
      if (!tile) break;
      const t = base + L(d + 2);
      if (W(t) === 0xFFFF) ar.doors.push({tile, shop: L(t + 4)});
      else if (W(t) === 0) ar.doors.push({tile, exit: 1});
      else { ar.doors.push({tile, x: W(t), y: W(t + 2), area: L(t + 4)}); todo.push(L(t + 4)); }
    }
  }
  return [start, out];
}

const SHOP_ACT = {0x2E4FE8: 'life1', 0x2E4FF0: 'life2', 0x2E4FF8: 'life3', 0x2E50BC: 'maxlife', 0x2E4F88: 'magnifier',
  0x2E5032: 'bomb', 0x2E506E: 'map', 0x2E4F32: 'sword', 0x2E4F3A: 'morning_star', 0x2E4F42: 'crooked_sword',
  0x2E4F4A: 'iron_balls', 0x2E4F52: 'iron_balls', 0x2E4F5A: 'special_balls', 0x2E4F62: 'fireball', 0x2DDB2E: 'dice',
  0x2E4F6A: 'life_up'};

function shops({rd, L, W}) {
  const tab = L(0x30CD14), out = {};
  for (let i = 0; i < 8; i++) {
    const p = L(tab + 0x7A + 4 * i), items = [];
    if (!(FB <= p && p < 0x400000)) continue;
    for (let k = 0; k < 6; k++) {
      const e = p + 14 * k, price = W(e), off = L(e + 2), txt = L(e + 6), act = L(e + 10);
      if (!(price > 0 && price < 2000 && FB <= txt && txt < 0x400000 && act in SHOP_ACT)) break;
      items.push({price, bob: hex(off), item: cstr(rd(txt, 20)).trim().toLowerCase().split(' ').join('_'), act: SHOP_ACT[act]});
    }
    if (items.length) out[i] = items;
  }
  return out;
}

const ACT = {0x2E3E14: 'msg', 0x2E4590: 'lock', 0x2E441C: 'lever_state', 0x2E43B4: 'toggle_state', 0x2E4478: 'lever_tiles',
  0x2E4336: 'set_state', 0x2E434C: 'not_state', 0x2E4544: 'plate', 0x2E4532: 'plate_hold', 0x2E435C: 'timed',
  0x2EBCAC: 'summon', 0x2EBCD0: 'hazard'};

function combo({rd}, h) {
  let code = rd(h, 0xC0);
  code = code.subarray(0, find(code, bytes('4e75')) + 2);
  const cv = new DataView(code.buffer, code.byteOffset, code.byteLength), L = i => cv.getUint32(i);
  let k = find(code, bytes('227c'));
  if (code[0] !== 0x22 || code[1] !== 0x79 || k < 0) return null;
  const e = {kind: 'combo', id: hex(L(2)), seq: [...cstrBytes(rd(L(k + 2), 32))]};
  k = find(code, bytes('13fc0001'));
  if (k >= 0) e.state = hex(L(k + 4));
  k = find(code, bytes('41f9'));
  if (k >= 0 && code[k + 6] === 0x72 && code[k + 7] === 0x04) e.block = L(k + 2);
  return e;
}
const cstrBytes = b => { const i = b.indexOf(0); return i < 0 ? b : b.subarray(0, i); };

function actions(m) {
  const {rd, L, W} = m;
  const tiles = d => {
    const idx = [];
    for (let k = d + 12; W(k) && idx.length < 64; k += 2) idx.push(W(k));
    return {idx, a: [...rd(L(d + 4), idx.length)], b: [...rd(L(d + 8), idx.length)]};
  };
  const tab = L(L(0x30CD14) + 8), lever = [...rd(tab + 4, 2)], out = [];
  for (let a = tab + 6; W(a) && out.length < 300; a += 10) {
    const tile = W(a), par = L(a + 2), h = L(a + 6);
    let e = {tile, kind: ACT[h] || 'h' + hex(h)};
    const c = h in ACT ? null : combo(m, h);
    if (c) {
      Object.assign(e, c, {button: par});
      if ('block' in c) { const blk = c.block; delete c.block; Object.assign(e, tiles(blk)); delete e.block; }
    } else if (e.kind === 'msg') e.text = cstr(rd(par, 600));
    else if (['lever_tiles', 'plate', 'plate_hold'].includes(e.kind)) {
      const proc = L(par);
      if (proc === 0x2E472A) Object.assign(e, tiles(par));
      else if (proc === 0x2E4554 || proc === 0x2E4558)
        Object.assign(e, {kind: 'water', area: L(L(0x30CD98) + 8 + 4 * L(par + 4)), level: W(par + 8), delay: W(par + 10),
          event: proc === 0x2E4554 ? 0x10 : 0x11});
      else e.kind = 'h' + hex(proc);
    } else if (e.kind === 'summon') Object.assign(e, {x: W(par), y: W(par + 2), script: L(par + 4) + 2});
    else if (e.kind === 'hazard') e.script = 0x2F2FA2;
    else if (e.kind === 'timed') Object.assign(e, {time: W(par), state: hex(L(par + 2))});
    else e.state = hex(par);
    out.push(e);
  }
  return {lever, list: out};
}

function brittle({B, L, W}) {
  const tab = L(L(0x30CD14) + 0x20), out = [];
  for (let a = tab + 2; W(a) && out.length < 300; a += 4)
    if (W(a) < 0x8000) {
      const e = {idx: W(a), under: B(a + 2)}, item = B(a + 3);
      if (item) e.item = hex(L(0x2F24A0 + 4 * item));
      out.push(e);
    }
  return {tile: W(tab), list: out};
}

function tileList({B, L, W}, slot) {   // crates (+$18) and bomb walls (+$1C): {tile, entries {idx, under}}
  const tab = L(L(0x30CD14) + slot), out = [];
  for (let a = tab + 2; W(a) && out.length < 300; a += 4) if (W(a) > 1) out.push({idx: W(a), under: B(a + 2)});
  return {tile: W(tab) & 0xFF, list: out};
}

function traps({L, W}) {
  const out = [];
  for (let a = L(L(0x30CD14) + 0x0C); W(a) && out.length < 100; a += 2) out.push(W(a));
  return out;
}

function bonus({rd, L, W}) {
  const b = L(L(0x30CD14) + 0x76), ar = L(b + 4), weights = [...rd(0x2F24CE, W(0x2F24CC))], gen = {};
  const F = {0x0EFE: 'x', 0x10FE: 'y', 0xA0FE: 'n'}, WIDTH = {0x2EFF62: 176, 0x2EFFF4: 256, 0x2F0086: 64};
  for (let i = 0, a = L(ar); i < 40; i++) {
    const w = W(a);
    if (w in F) { gen[F[w]] = W(a + 2); a += 4; }
    else if (w === 0x7AFC) { gen.w = WIDTH[L(a + 2)]; a += 6; }
    else if (w === 0xFFB6) a += 10;
    else if (w === 0x4CFE) a += 4;
    else break;
  }
  return {x: W(b), y: W(b + 2), cam: [W(ar + 8), W(ar + 0xA), W(ar + 0xC), W(ar + 0xE)],
    items: weights.map(i => hex(L(0x2F2510 + 4 * i))), count: gen.n, gen};
}

function chests({B, L, W}) {
  const tab = L(L(0x30CD14) + 0x14), out = [];
  for (let a = tab + 6; W(a) && out.length < 200; a += 12) {
    const items = [];
    for (let q = L(a + 8); FB <= q && q < 0x400000 && items.length < 32; q += 4) {
      const v = L(q);
      if (!v) break;
      if (v !== 0xFFFFFFFF && FB <= v && v < 0x400000 && W(v) < 0x8000) items.push(hex(v));
    }
    out.push({idx: W(a), x: W(a + 2), y: W(a + 4), items});
  }
  return {shut: B(tab + 4), open: B(tab + 5), list: out};
}

function currents({L, S}) {
  const out = [];
  for (let t = L(L(0x30CD14) + 0x28); t && out.length < 100; t += 12) {
    const e = [0, 2, 4, 6, 8, 10].map(k => S(t + k));
    if (!e[0]) break;
    out.push(e);
  }
  return out;
}

function treasure({L, S}) {
  const b = L(L(0x30CD14) + 0x72), ar = L(b + 4), items = [];
  for (let a = L(ar); S(a) && items.length < 400; a += 6) items.push([S(a), S(a + 2), S(a + 4)]);
  return {x: S(b), y: S(b + 2), cam: [S(ar + 8), S(ar + 0xA), S(ar + 0xC), S(ar + 0xE)], items};
}

function quest({chip, fast}, {rd, L, W, S}) {
  const rec = new Map();
  for (let a = 0x30992E; W(a + 2) === 1; a += 14) rec.set(a, L(a + 10));
  const items = {}, fv = new DataView(fast.buffer);
  for (let i = 0; i + 10 <= fast.length; i++) {
    if (fast[i] !== 0x23 || fast[i + 1] !== 0xFC || fast[i + 2] !== 0x00 || fast[i + 3] !== 0x30 ||
        fv.getUint32(i + 6) !== 0x00309926) continue;
    const r = fv.getUint32(i + 2), num = rec.has(r) ? rec.get(r) : 99;
    i += 9;
    if (!(num > 0 && num < 16)) continue;
    const h = rfind(fast, bytes('4e75'), 0, i - 9) + 2 + FB, pat = [0x72, 0xFC, h >>> 24, h >> 16 & 255, h >> 8 & 255, h & 255];
    for (const [buf, base] of [[fast, FB], [chip, 0]])
      for (let x = find(buf, pat); x >= 0; x = find(buf, pat, x + pat.length)) {
        const q = rfind(buf, bytes('ffb6'), x - 80, x);
        items[hex(q + base - 2)] = num;
      }
  }
  const base = L(0x30CD98), spots = [];
  for (let a = L(L(0x30CD14) + 0x10); W(a) && spots.length < 40; a += 22) {
    const area = L(a + 10), h = L(a + 14), par = L(a + 18);
    const e = {id: W(a), rect: [S(a + 2), S(a + 4), S(a + 6), S(a + 8)], area: String(L(base + 8 + 4 * area)), handler: hex(h)};
    if (h === 0x2E4886) {
      const ptr = L(par), idx = [];
      for (let k = par + 4; W(k) && idx.length < 64; k += 2) idx.push(W(k));
      Object.assign(e, {idx, tiles: [...rd(ptr, idx.length)]});
    } else if (h === 0x2E48C4) {
      const xs = [];
      for (let k = par; W(k) < 0x8000 && xs.length < 32; k += 2) xs.push(W(k));
      e.xs = xs;
    }
    spots.push(e);
  }
  const ropes = [];
  for (let a = L(L(0x30CD14) + 0x24); L(a) && ropes.length < 40; a += 4) {
    const p = L(a);
    if (p === 0xFFFFFFFF) continue;
    const st = W(p), en = W(p + 2);
    ropes.push({start: st, end: en, tiles: [...rd(p + 4, Math.floor((en - st) / Math.max(1, W(0x30CA80 + 0x22))) + 1)]});
  }
  return {items, spots, ropes};
}

// Measured on the emulator, not stored as such in the program: the window of the sky gradient the engine draws (the
// level table +$54 points to one colour per 4 lines, drawn as [k, previous, k, k]; at: byte offset of the window's first
// group, phase: line of that group the window starts at, n: lines, row0: screen row of the first line at camera y 0,
// top: colour for the top of the playfield, as a group index), the world y of the water line, the 2 lines of the water
// mirror and the water background (copper colour 1 under the water line)
const RECIPE = {
  1: {sky: {at: 0x50, phase: 0, n: 63, row0: 174, top: -1}, waterY: 325, water: 0x003},
  2: {sky: {at: 0x0C, phase: 2, n: 159, row0: 40, top: 0}, waterY: 99999},
  3: {sky: {at: 0x00, phase: 2, n: 159, row0: 16, top: 0}, waterY: 99999},
  4: {sky: {at: 0x48, phase: 2, n: 133, row0: 160, top: 0}, waterY: 453, water: 0x003},
};
const SURFACE = {1: ['#002fcf', '#000faf'], 4: ['#007fef', '#003faf']};
const rgb = v => '#' + [v >> 8, v >> 4, v].map(c => ((c & 15) * 17).toString(16).padStart(2, '0')).join('');

// disks -> level{n}.json (the same fields as work/export_level.py writes)
export function levelJSON(disks, n) {
  const t = levelTables(disks, n), R = RECIPE[n], m = reader(stageMemory(disks, n));
  const T = m.L(m.L(0x30B70E + 8 * (n - 1) + 4) + 0x54) + R.sky.at, E = g => m.W(T + 2 * g);
  const sky = [...Array(R.sky.n)].map((_, i) => { const q = i + R.sky.phase, g = q >> 2; return rgb(E((q & 3) === 1 ? g - 1 : g)); });
  const skyTop = rgb(E(R.sky.top));
  return {w: t.w, h: t.h, tile: 16, tiles: Math.max(...t.map) + 1, waterY: R.waterY, skyTop, sky, skyRow0: R.sky.row0,
    waterColor: R.water ? rgb(R.water) : skyTop, surfaceLine: SURFACE[n] || [], ...t, map: undefined};
}

export function extractLevels(disks) {
  if (!disks[1] || !disks[2]) return [];
  return [1, 2, 3, 4].map(n => ({path: `level${n}.json`, data: new TextEncoder().encode(JSON.stringify(levelJSON(disks, n)))}));
}

// disks -> {n: level table fields} (the fields export_level.py takes from the level table, plus map size and attributes)
export function levelTables(disks, n) {
  const mem = stageMemory(disks, n), m = reader(mem), {rd, L, W} = m;
  const [area, areasOut] = areas(m), lt = L(0x30CD14), ev = L(lt + 0x34);
  // the game lays the crates, then the bomb walls, then the brittle stones over the map when the stage starts, each
  // taking the tile it covers (crate under a stone: the stone keeps the crate tile)
  const map = mem.map.slice(), lay = t => { for (const e of t.list) { e.under = map[e.idx]; map[e.idx] = t.tile; } return t; };
  const crates = lay(tileList(m, 0x18)), bombwalls = lay(tileList(m, 0x1C)), stones = lay(brittle(m));
  return {w: mem.w, h: mem.h, attr: [...Array(256)].map((_, i) => W(ATTR[n] + 2 * i)), start: [W(mem.base), W(mem.base + 2)],
    area, areas: areasOut, shops: shops(m), actions: actions(m), brittle: stones, crates,
    bombwalls, traps: traps(m), bonus: bonus(m), treasure: treasure(m), chests: chests(m),
    currents: currents(m), quest: quest(mem, m), music_events: [...rd(ev, 32)], keydoor: [...rd(L(lt + 0x68), 4)],
    escape: W(lt + 0x58) * 60 + W(lt + 0x5A), map};
}
