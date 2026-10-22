// Self-check: the JS depacker must give the same bytes as work/export_music.py (Python ppdepack).
// Run from the project root: node extractor/ppdepack.test.mjs   (needs the ADFs in Traps-n-Treasures_Amiga_EN/)
import { readFileSync } from 'node:fs';
import { ppUnpack } from './ppdepack.js';

const adf = n => new Uint8Array(readFileSync(`Traps-n-Treasures_Amiga_EN/Traps 'n Treasures (1993)(Starbyte)(En)[cr PSG](Disk ${n} of 2).adf`));
const disks = {1: adf(1), 2: adf(2)};
const cases = [[2, 0x21BA8, 'level1'], [2, 0x3CE4C, 'level2'], [2, 0x5A11C, 'level3'], [2, 0x76024, 'level4'],
               [2, 0xB20F0, 'extra1'], [2, 0xC5C34, 'extra2'], [1, 0x7DF4, 'title']];
for (const [d, off, name] of cases) {
  const got = ppUnpack(disks[d], off), want = new Uint8Array(readFileSync(`game/assets/music/${name}.med`));
  if (got.length !== want.length || got.some((v, i) => v !== want[i])) throw new Error(`${name}: mismatch`);
  console.log(`ok ${name} ${got.length} B`);
}
