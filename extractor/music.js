// Music: OctaMED (MMD0) modules, PowerPacker or raw - same table as work/export_music.py.
import { readFile } from './adf.js';

const FILES = [[2, 0x21BA8, 'level1'], [2, 0x3CE4C, 'level2'], [2, 0x5A11C, 'level3'], [2, 0x76024, 'level4'],
               [2, 0xB20F0, 'extra1'], [2, 0xC5C34, 'extra2'], [1, 0x7DF4, 'title'], [2, 0xABC8C, 'map'],
               [2, 0xACD5C, 'extra3'], [2, 0x9B100, 'extra4'], [2, 0x9506C, 'hof_new']];

// disks: {1: Uint8Array, 2: Uint8Array} (either may be missing) -> [{path, data}]
export function extractMusic(disks) {
  const out = [];
  for (const [d, start, name] of FILES) {
    if (!disks[d]) continue;
    const data = readFile(disks[d], start);
    if (String.fromCharCode(...data.subarray(0, 4)) !== 'MMD0') throw new Error(`music ${name}: not an MMD0 module`);
    out.push({path: `music/${name}.med`, data});
  }
  return out;
}
