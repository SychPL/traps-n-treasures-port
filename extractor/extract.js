// The whole extraction from the player's own ADF files, shared by the extractor page (index.html), the game page
// (../game/index.html loads the disks itself when it runs on the demo pack) and the command line (extract.mjs)
import { identify } from './adf.js';
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
import { extractMenu } from './menu.js';
import { extractIntro } from './intro.js';

export const CACHE = 'tnt-assets-v1';                  // read by ../game/sw.js
export const COMPLETE = 107;                            // files of a full extraction (both disks)
const TYPES = {png: 'image/png', json: 'application/json', med: 'application/octet-stream', bin: 'application/octet-stream'};

// tiles, maps, level tables, objects and actors only work together (tile numbers, attributes, areas, types): one
// module fails, none is stored
const MODULES = [['music', extractMusic], ['sfx', extractSfx], ['player', extractPlayer], ['weapons', extractWeapons],
  ['hud', extractHud], ['shop', extractShop], ['screens', extractScreens], ['map', extractMap], ['menu', extractMenu],
  ['intro', extractIntro],
  ['stages', d => d[1] && d[2] ? [extractTiles, extractMaps, extractLevels, extractObjects, extractActors].flatMap(f => f(d)) : []]];

// files: [{name, data: Uint8Array}] -> {1: disk 1, 2: disk 2} (only the PSG release is recognised)
export async function readDisks(files, log = () => {}) {
  if (!globalThis.crypto?.subtle) throw new Error('crypto.subtle is missing: open the page over https or http://127.0.0.1');
  const disks = {};
  for (const {name, data} of files) {
    const d = await identify(data);
    log(`${name}: ${d ? 'recognised as ' + d.name : 'unknown disk (only the PSG release is supported)'}`);
    if (d) disks[d.id] = data;
  }
  return disks;
}

// disks -> [{path, data}] relative to game/assets/
export function extractFrom(disks, log = () => {}) {
  const out = [];
  for (const [name, run] of MODULES) {
    try { const r = run(disks); out.push(...r); log(`${name}: ${r.length} files`); }
    catch (e) { log(`${name}: ${e.message}`); }
  }
  return out;
}

// browser: every extraction is one complete set in Cache Storage under the URL of game/assets/<path>, nothing left
// from an older one; ../game/sw.js serves it in place of the demo pack
export async function storeInCache(out, assetsURL) {
  await caches.delete(CACHE);
  const cache = await caches.open(CACHE);
  // level1.json last: the stage files (level*) are used only with it (sw.js, BLOBS in main.js) - an interrupted store
  // never mixes an original map with demo tables
  out = [...out.filter(f => f.path !== 'level1.json'), ...out.filter(f => f.path === 'level1.json')];
  for (const {path, data} of out)
    await cache.put(new URL(path, assetsURL).href, new Response(data, {headers: {'Content-Type': TYPES[path.split('.').pop()] || 'application/octet-stream'}}));
}
