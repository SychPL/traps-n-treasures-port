// Level actors (enemies) for the script engine in game/actors.js: level{n}_actors.json and the _surface / _water
// atlases of both BOB banks (enemies, items), read from the stage memory by the same rules as work/export_actors.py.
import { encodePNG } from './png.js';
import { stageMemory, reader, levelJSON } from './tables.js';
import { records, sections, bob, stagePalettes } from './objects.js';

const FB = 0x200000, CODE = 0x2DC97C, ENEMY_BANK = 0x30CD70, ITEM_BANK = 0x30CD58;
const LISTS = {1: 0x2F53CE, 2: 0x2F71F6, 3: 0x2FADD8, 4: 0x301660};
const hex = v => v.toString(16);
// script memory windows: the level program in chip, scripts of the main program in fast
const MEM = [[0x9800, 0xC800], [0x2FF000, 0x309000], [0x2E0F00, 0x2E1A60], [0x2F2B00, 0x2F2C80], [0x2F2E30, 0x2F3040],
  [0x2EB200, 0x2EB900], [0x2E0D00, 0x2E0EA0]];
// start routines (p1) -> behaviour in the engine (game/actors.js)
const BEHAVIOR = Object.fromEntries([[0xF9FC, 'clam'], [0xFA24, 'swordfish'], [0x11A90, 'walker'], [0x11B14, 'walker'],
  [0x11B5E, 'crab'], [0x11C26, 'dropper'], [0x11D6E, 'walker'], [0x124AC, 'starfish']].map(([k, v]) => [CODE + k, v]));
Object.assign(BEHAVIOR, {0x2EC4A4: 'runner', 0x2EC04A: 'pirate', 0x2EBF2E: 'axeman', 0x2ED34A: 'gate', 0x2EE724: 'swimmer',
  0x2ED33A: 'gate', 0x2ED41E: 'trapdoor', 0x2ED2EC: 'vanish', 0x2EE19C: 'bob', 0x2EC476: 'roamer', 0x2EC750: 'ghoul',
  0x2EEF64: 'skull', 0x2EED08: 'roller', 0x2ECF94: 'mace', 0x2ECF04: 'macefast', 0x2EC1B8: 'crawler'});
const STATE_BEH = new Set(['gate', 'trapdoor', 'vanish']);
const MOVER = {0x2EF23E: null, 0x2EFC4C: 0x300BFA, 0x2EFC5C: 0x300BFA, 0x2EF1F0: 0x300BFA};   // movement program ($2EF23E)
// other start routines with the same per-tick routine ($7A) -> the same behaviour
const TICK_BEH = {0x2EE86A: 'walker', 0x2EE50E: 'crab', 0x2EC3D4: 'swordfish', 0x2EEE52: 'starfish', 0x2EC396: 'clam',
  0x2EC4DE: 'runner', 0x2EC0A4: 'pirate', 0x2EBF78: 'axeman'};

// animation blocks set by the start routine (move.l #block, d16(a1) -> brain field) and its per-tick routine
// (move.l #tick, $7a(a0)); blocks loaded with lea abs.l, a1 in the tick routine become 'l0', 'l1'... Scans the words
// up to the first rts word instead of disassembling (an operand word $4E75 would stop it early): on the supported disks
// all 48 stage / routine pairs give what capstone gives in the Python exporter. Keys as the Python slices capstone's
// operand text ('$1e(a1)'[1:3]).
function initRoutine({W, L, S}, p1) {
  const anims = {};
  let tick = null;
  for (let a = p1; a < p1 + 0x80; a += 2) {
    const w = W(a);
    if (w === 0x4E75) break;
    if (w === 0x237C) { const d = S(a + 6); anims[((d < 0 ? '-$' : '$') + hex(Math.abs(d)) + '(a1)').slice(1, 3)] = L(a + 2); a += 6; }
    else if (w === 0x22BC) { anims['a1'] = L(a + 2); a += 4; }
    else if (w === 0x217C && W(a + 6) === 0x7A) { tick = L(a + 2); a += 6; }
  }
  if (tick && tick !== p1)
    for (let a = tick, k = 0; a < tick + 0x60; a += 2) {
      const w = W(a);
      if (w === 0x4E75) break;
      if (w === 0x43F9) { anims['l' + k++] = L(a + 2); a += 4; }
    }
  return [anims, tick];
}

const inMem = (a, wins, pad) => wins.some(([lo, hi]) => lo <= a && a < hi - pad);

function scriptMem(actors) {
  const top = Math.max(MEM[0][1], ...actors.filter(a => a.script < FB).map(a => a.script + 0x800));
  const out = [[0x9800, top], ...MEM.slice(1)];
  for (const a of actors) {
    if (a.script >= FB && !inMem(a.script, out, 0x100)) out.push([a.script - 2, a.script + 0x300]);
    if (a.prog && !inMem(a.prog, out, 0x100)) out.push([a.prog, a.prog + 0x200]);
  }
  return out;
}

function triggerMem(triggers) {
  const out = [];
  for (const t of triggers)
    for (const a of [t.script || 0, ...(t.progs || [])])
      if (a && !inMem(a, [...MEM, ...out], 0x100)) out.push([a - 2, a + 0x200]);
  return out;
}

function extraMem(actors) {
  const out = [];
  for (const a of actors) {
    const p2 = a.p2 || 0;
    if (p2 >= FB && p2 < 0x320000 && !inMem(p2, [...MEM, ...out], 0x20)) out.push([p2, p2 + 0x40]);
    for (const blk of Object.values(a.anims || {}))
      if (blk >= FB && !inMem(blk, [...MEM, ...out], 0)) out.push([blk - 0x40, blk + 0x100]);
  }
  return out;
}

// BOBs of a bank to the $FFFFFFFF terminator: [address, {w, h, ax, ay, box}]
export function walkBank({chip}, base) {
  const dv = new DataView(chip.buffer), out = [];
  for (let a = base; dv.getUint32(a) !== 0xFFFFFFFF;) {
    const w = dv.getUint16(a), h = dv.getUint16(a + 2), ps = dv.getUint16(a + 22), size = dv.getUint16(a + 24);
    let bits = 0; for (let v = chip[a + 16]; v; v >>= 1) bits += v & 1;
    if (!(w > 0 && w <= 320 && h > 0 && h <= 256 && size === 26 + ps * bits + ps)) break;
    out.push([a, {w, h, ax: dv.getInt16(a + 4), ay: dv.getInt16(a + 6), box: [8, 10, 12, 14].map(k => dv.getInt16(a + k))}]);
    a += size;
  }
  return out;
}

export function levelActors(disks, n) {
  const mem = stageMemory(disks, n), m = reader(mem), {rd, L, W, S} = m, lvl = levelJSON(disks, n);
  const banks = {[ENEMY_BANK]: L(ENEMY_BANK), [ITEM_BANK]: L(ITEM_BANK)};
  const frames = [...walkBank(mem, banks[ENEMY_BANK]), ...walkBank(mem, banks[ITEM_BANK])];
  let x = 0, y = 0, row = 0;                           // shelf packing into a 512 px atlas
  for (const [, f] of frames) {
    if (x + f.w > 512) { x = 0; y += row + 1; row = 0; }
    Object.assign(f, {sx: x, sy: y});
    x += f.w + 1; row = Math.max(row, f.h);
  }
  const H = y + row + 1, [surf, water] = stagePalettes(disks, n, lvl);
  const png = pal => { const px = new Uint8Array(512 * H * 4); for (const [a, f] of frames) bob(mem.chip, a, pal, px, 512, f.sx, f.sy); return encodePNG(px, 512, H); };
  const SECT = sections(m), sectOf = a => { const s = SECT.find(([p, e]) => p <= a && a < e); return s ? hex(s[0]) : null; };
  const recs = records(mem, LISTS[n], 0x7FFF), inFast = v => v >= FB && v < 0x320000, s32 = v => v | 0;
  const actors = [];
  for (const r of recs) {
    if (W(r.type + 2) !== 0xFFB6 || L(r.type + 8) !== ENEMY_BANK) continue;   // actor = script with its base in the enemy bank
    const [, p1, p2] = r.p, [hp, hurt] = rd(r.type, 2);
    const act = {x: r.x, y: r.y, type: hex(r.type), script: r.type + 2, hp, hurt};
    if (STATE_BEH.has(BEHAVIOR[p1])) act.state = hex(p2);
    if (p1 === 0x2EFAD8 && inFast(p2)) { act.x = S(p2); act.y = S(p2 + 2); }
    if (['ghoul', 'bob', 'crawler', 'skull', 'roller', 'mace', 'macefast'].includes(BEHAVIOR[p1])) act.p2 = s32(p2);
    if (p1 in MOVER) {
      act.beh = 'mover'; act.prog = MOVER[p1] || p2;
      if (p1 === 0x2EFC4C || p1 === 0x2EFC5C) act.p7e = p2;
      if (p1 === 0x2EFC4C && inFast(p2)) {             // trampoline: player dy per frame from +8 to $0FFC
        const lift = [];
        for (let q = p2 + 8; lift.length < 400; q += 2) { const v = S(q); if (v === 0x0FFC) break; lift.push(v); }
        act.lift = lift;
      }
    } else if (inFast(p1)) {
      const [anims, tick] = initRoutine(m, p1);
      act.anims = anims;
      act.beh = BEHAVIOR[p1] || TICK_BEH[tick] || 'p1_' + hex(p1);
      act.p3 = inFast(p2) ? [S(p2), S(p2 + 2), S(p2 + 4)] : s32(p2);
    }
    if (p1 === 0x2EFA92 && inFast(p2)) {               // container: list {descriptor.L, dx.W, dy.W} to a negative one
      let items = [];
      for (let q = p2; items.length < 8; q += 8) {
        const v = s32(L(q)), dx = S(q + 4), dy = S(q + 6);
        if (v < 0 || !(v > 0 && v < 0x320000)) break;
        const sc = items.length ? v : v + 2;           // the first descriptor: 2 bytes (record +$18/+$16), then the script
        if (W(sc) !== 0xFFB6) { items = []; break; }
        items.push([sc, dx, dy, ...(items.length ? [] : [...rd(v, 2)])]);
      }
      if (items.length) act.burst = items;
    }
    act.sect = sectOf(r.addr);
    actors.push(act);
  }
  // triggers (invisible type $160AC) with routines: actor generators, platform rows, tile swaps
  const triggers = [];
  const list = (a, step, f, stop = q => S(q) < 0) => { const e = []; for (; !stop(a) && e.length < 64; a += step) e.push(f(a)); return e; };
  const longs = a => { const o = []; for (; L(a) && o.length < 32; a += 4) o.push(L(a)); return o; };
  for (const r of recs) {
    const [, p1, p2] = r.p, t = {x: r.x, y: r.y};
    if (p1 === 0x2EDF14) Object.assign(t, {kind: 'spawn', script: 0xA302, entries: list(p2, 8, a => [S(a + 2), S(a + 4), S(a + 6), S(a)]), despawn: 'win'});
    else if (p1 === 0x2EBCF8 || p1 === 0x2EBD0E)
      Object.assign(t, {kind: 'spawn', script: 0xB34C, entries: list(p2, 6, a => [S(a + 2), 0, 0, S(a), S(a + 4)]), beh: 'roller',
        despawn: p1 === 0x2EBCF8 ? 'win' : 'far'});
    else if (p1 === 0x2EF0E4 || p1 === 0x2EF13A) {
      const dy = p1 === 0x2EF0E4 ? 16 : 0;
      Object.assign(t, {kind: 'row', parts: longs(p2).map((pr, k) => [0x308038, 16 * (k + 1), dy, pr])});
    } else if (p1 === 0x2EF184) {
      const progs = longs(p2);
      Object.assign(t, {kind: 'row', parts: [[0x308294, 0, 6, 0], ...progs.map((pr, k) => [k < progs.length - 1 ? 0x308294 : 0x308246, 0, 6 - 16 * (k + 1), pr])]});
    } else if (p1 === 0x2EF978) Object.assign(t, {kind: 'fall', dist: p2 & 0xFFFF});
    else if (p1 === 0x2EFD92) Object.assign(t, {kind: 'ghosts', delay: S(p2), period: S(p2 + 2)});
    else if (p1 === 0x2EDDEE) Object.assign(t, {kind: 'spawn', script: 0xB5B8, entries: list(p2, 8, a => [S(a + 2), S(a + 4), S(a + 6), S(a)]), despawn: 'win'});
    else if (p1 === 0x2EDF6E) Object.assign(t, {kind: 'edge', entries: list(p2, 8, a => [S(a + 2), S(a + 4), S(a + 6), S(a)]), despawn: 'win'});
    else if (p1 === 0x2EBD72) Object.assign(t, {kind: 'flagroll', state: hex(p2), despawn: 'far'});
    else if (p1 === 0x2EC5A0) Object.assign(t, {kind: 'sides', despawn: 'far'});
    else if (p1 === 0x2ED4F6) {                        // plate: tile block $2F9598 fixed in the routine
      const blk = 0x2F9598, idx = list(blk + 12, 2, a => W(a), a => !S(a));
      Object.assign(t, {kind: 'plate', idx, a: [...rd(L(blk + 4), idx.length)], b: [...rd(L(blk + 8), idx.length)], doneTile: 0xFD0, doneVal: 0x8C, despawn: 'win'});
    } else if (p1 === 0x2EBA74) Object.assign(t, {kind: 'sliders', state: hex(p2)});
    else if (p1 === 0x2EBB38) Object.assign(t, {kind: 'vdarts', entries: list(p2, 6, a => [S(a), S(a + 2), S(a + 4)]), despawn: 'win'});
    else if (p1 === 0x2EB970) t.kind = 'rain';
    else if (r.type === 0x300DE2 && inFast(p2)) Object.assign(t, {kind: 'darts', entries: list(p2, 8, a => [S(a), S(a + 2), S(a + 4), S(a + 6)])});
    else if ((r.type === 0x300DAA || r.type === 0x300DC6) && p2) {
      Object.assign(t, {kind: 'flag', addr: hex(p2), val: r.type === 0x300DAA ? 1 : 2});
      if (p1 === 0x2ED3EE) Object.assign(t, {addr: '30cb05', gone: 3});
    } else if (p1 === 0x2EFA92 && r.type === 0x2F2578) Object.assign(t, {kind: 'ambush', sx: S(p2), sy: S(p2 + 2), script: L(p2 + 4) + 2});
    else if (p1 === 0x2ED58E || p1 === 0x2ED616) {
      const idx = list(p2 + 12, 2, a => W(a), a => !S(a));
      Object.assign(t, {kind: 'tiles', idx, vals: [...rd(L(p2 + 8), idx.length)]});
    } else continue;
    t.sect = sectOf(r.addr);
    triggers.push(t);
  }
  const hexBytes = b => [...b].map(v => v.toString(16).padStart(2, '0')).join('');
  const json = {banks: Object.fromEntries(Object.entries(banks).map(([v, b]) => [hex(+v), b])), triggers,
    frames: Object.fromEntries(frames.map(([a, f]) => [hex(a), [f.sx, f.sy, f.w, f.h, f.ax, f.ay, ...f.box]])),
    order: frames.map(([a]) => hex(a)),
    mem: [...scriptMem(actors), ...extraMem(actors), ...triggerMem(triggers)].map(([a, b]) => [a, hexBytes(rd(a, b - a))]), actors};
  return {json, surface: png(surf), water: png(water)};
}

export function extractActors(disks) {
  if (!disks[1] || !disks[2]) return [];
  return [1, 2, 3, 4].flatMap(n => {
    const o = levelActors(disks, n);
    return [{path: `level${n}_actors.json`, data: new TextEncoder().encode(JSON.stringify(o.json))},
      {path: `level${n}_actors_surface.png`, data: o.surface}, {path: `level${n}_actors_water.png`, data: o.water}];
  });
}
