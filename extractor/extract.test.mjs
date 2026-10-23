// Self-check of the extractor modules against the exported assets in game/assets (developer machine only: needs your
// own ADFs in Traps-n-Treasures_Amiga_EN/ and the exported game/assets). PNGs are compared as decoded RGBA pixels
// (transparent pixels count as equal whatever their colour). Run from the project root:
//   node extractor/extract.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { extractMusic } from './music.js';
import { extractTiles } from './tiles.js';
import { extractMaps } from './levels.js';
import { extractLevels } from './tables.js';
import { extractObjects } from './objects.js';
import { extractPlayer } from './player.js';
import { extractWeapons } from './weapons.js';
import { extractActors } from './actors.js';
import { extractHud } from './hud.js';
import { extractSfx } from './sfx.js';
import { extractShop } from './shop.js';
import { extractScreens } from './screens.js';
import { extractMap } from './map.js';

const adf = n => new Uint8Array(readFileSync(`Traps-n-Treasures_Amiga_EN/Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk ${n} of 2).adf`));
const disks = {1: adf(1), 2: adf(2)};

// PNG -> {w, h, px: RGBA}; colour types 2, 3 (+tRNS), 6, 8 bit
function decodePNG(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), idat = [];
  let w, h, ct, plte, trns, o = 8;
  while (o < buf.length) {
    const len = dv.getUint32(o), type = String.fromCharCode(...buf.subarray(o + 4, o + 8)), d = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = dv.getUint32(o + 8); h = dv.getUint32(o + 12); ct = d[9]; if (d[8] !== 8) throw new Error('bit depth'); }
    else if (type === 'PLTE') plte = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const bpp = {2: 3, 3: 1, 6: 4}[ct], stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), img = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = img.subarray(y * stride, (y + 1) * stride), up = y ? img.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = up ? up[x] : 0, c = up && x >= bpp ? up[x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      row[x] = src[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f] & 255;
    }
  }
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ct === 6) px.set(img.subarray(i * 4, i * 4 + 4), i * 4);
    else if (ct === 2) px.set([...img.subarray(i * 3, i * 3 + 3), 255], i * 4);
    else { const k = img[i]; px.set([plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], trns && k < trns.length ? trns[k] : 255], i * 4); }
  }
  return {w, h, px};
}

// JSON with sorted object keys (the exporters and the extractor write the fields in different orders)
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x);

// differences where the exported file is the questionable one (EXTRACTOR.md, open points): same size and transparency,
// and only the pixels the rule allows may differ (ours, reference, pixel offset, x, y)
const black = (b, k) => !b[k] && !b[k + 1] && !b[k + 2] && b[k + 3] === 255;
const KNOWN = {
  'level4_objects_water.png': ['exported from a copper list with colours 16-31 at 000 below the water line', (a, b, k) => black(b, k)],
  'level4_actors_water.png': ['exported from a copper list with colours 16-31 at 000 below the water line', (a, b, k) => black(b, k)],
  'hud_bottom.png': ['the screenshot had tool 01 and crew 09; the engine repaints both boxes',
    (a, b, k, x, y) => x >= 52 && x < 74 && y >= 12 && y < 35 || x >= 124 && x < 137 && y >= 29 && y < 35],
};
// actors JSON: the exports were taken from a running game, so the script memory windows (and level 3 fields read from
// a data block the game changes) carry run-time state; compared are the window layout and everything else, the
// differing window bytes are counted (the recordings replay the same with either file)
const RUNTIME = {'level3_actors.json': [19, 20, 21, 22, 34, 35, 39, 40, 62, 64].map(i => ['actors', i, 'p3'])};
function runtime(path, j) {
  if (!path.endsWith('_actors.json')) return [j, ''];
  for (const [...keys] of RUNTIME[path] || []) { const last = keys.pop(); delete keys.reduce((o, k) => o[k], j)[last]; }
  const mem = j.mem;
  j.mem = mem.map(([a, h]) => [a, h.length]);
  return [j, mem];
}

let bad = 0;
function check(files) {
  for (const {path, data} of files) {
    const p = `game/assets/${path}`;
    if (!existsSync(p)) { console.log(`?  ${path} (no reference file)`); continue; }
    const ref = new Uint8Array(readFileSync(p));
    let ok, note = `${data.length} B`;
    if (path.endsWith('.png')) {
      const a = decodePNG(data), b = decodePNG(ref);
      let diff = 0, known = 0;
      if (a.w === b.w && a.h === b.h)
        for (let i = 0; i < a.w * a.h; i++) {
          const ta = a.px[i * 4 + 3], tb = b.px[i * 4 + 3];
          if (ta !== tb || ta && (a.px[i * 4] !== b.px[i * 4] || a.px[i * 4 + 1] !== b.px[i * 4 + 1] || a.px[i * 4 + 2] !== b.px[i * 4 + 2]))
            if (KNOWN[path] && ta === tb && KNOWN[path][1](a.px, b.px, i * 4, i % a.w, i / a.w | 0)) known++; else diff++;
        }
      ok = a.w === b.w && a.h === b.h && !diff;
      note = `${a.w}x${a.h} vs ${b.w}x${b.h}, ${diff} pixels differ` + (known ? `, ${known} known (${KNOWN[path][0]})` : '');
    } else if (path.endsWith('.json')) {
      const [a, ma] = runtime(path, JSON.parse(new TextDecoder().decode(data))), [b, mb] = runtime(path, JSON.parse(new TextDecoder().decode(ref)));
      ok = canon(a) === canon(b);
      if (ok && ma) {
        let n = 0, d = 0;
        ma.forEach(([, h], i) => { for (let k = 0; k < h.length; k += 2) { n++; if (h.substr(k, 2) !== mb[i][1].substr(k, 2)) d++; } });
        note += `, script memory ${n} B, ${d} B run-time state`;
      }
    }
    else ok = data.length === ref.length && data.every((v, i) => v === ref[i]);
    if (!ok) bad++;
    console.log(`${ok ? 'ok' : 'XX'} ${path} ${note}`);
  }
}
check(extractMusic(disks));
check(extractTiles(disks));
// maps: the engine lays the overlay tiles from the level JSON lists (as the game does from its tables)
check(extractMaps(disks).map(({path, data}) => {
  const meta = JSON.parse(readFileSync(`game/assets/${path.replace('.bin', '.json')}`)), m = data.slice();
  for (const k of ['crates', 'bombwalls', 'brittle']) for (const e of meta[k]?.list || []) m[e.idx] = meta[k].tile;
  return {path, data: m};
}));
check(extractLevels(disks));
check(extractObjects(disks));
check(extractPlayer(disks));
check(extractWeapons(disks));
check(extractActors(disks));
check(extractHud(disks));
check(extractSfx(disks));
check(extractShop(disks));
check(extractScreens(disks));
check(extractMap(disks));
if (bad) { console.log(`${bad} mismatches`); process.exit(1); }
