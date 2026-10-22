// Level maps: LEV! files on disk 2 (PowerPacker): "LEV!" + 14 header bytes, then one tile byte per cell, row by row.
// The game lays the crate / brittle stone / bomb wall tiles over the map from its tables at the start of a stage; the
// engine does the same from the level JSON lists, so the raw map is written as level{n}.bin.
import { readFile } from './adf.js';

export const LEV = {1: 0x39C70, 2: 0x532B8, 3: 0x6ED2C, 4: 0x911EC};

export function extractMaps(disks) {
  if (!disks[2]) return [];
  return [1, 2, 3, 4].map(n => {
    const lev = readFile(disks[2], LEV[n]);
    if (String.fromCharCode(...lev.subarray(0, 4)) !== 'LEV!') throw new Error(`map level ${n}: not a LEV! file`);
    return {path: `level${n}.bin`, data: lev.slice(18)};
  });
}
