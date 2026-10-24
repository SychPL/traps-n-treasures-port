// Command line extraction (Node 20+, no packages): the same files as the extractor page, written to game/assets/,
// which the game reads before its demo pack. From the project root:
//   node extractor/extract.mjs <disk 1.adf> <disk 2.adf> [output dir]
//   node extractor/extract.mjs <folder with both ADF files> [output dir]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDisks, extractFrom, COMPLETE } from './extract.js';

const args = process.argv.slice(2), adfs = [];
let i = 0;
if (args[0] && statSync(args[0], {throwIfNoEntry: false})?.isDirectory()) {   // a folder with the disks
  adfs.push(...readdirSync(args[0]).filter(f => /\.adf$/i.test(f)).map(f => join(args[0], f)));
  if (!adfs.length) { console.error(`no ADF files in ${args[0]}`); process.exit(1); }
  i = 1;
} else for (; i < args.length && /\.adf$/i.test(args[i]); i++) adfs.push(args[i]);
if (!adfs.length || args.length > i + 1) {
  console.log('usage: node extractor/extract.mjs <disk 1.adf> <disk 2.adf> [output dir]\n' +
    '       node extractor/extract.mjs <folder with the ADF files> [output dir]');
  process.exit(1);
}
const out = args[i] || join(dirname(fileURLToPath(import.meta.url)), '..', 'game', 'assets');
const disks = await readDisks(adfs.map(f => ({name: basename(f), data: new Uint8Array(readFileSync(f))})), console.log);
const files = extractFrom(disks, console.log);
if (files.length < COMPLETE) {   // the same file names every time: a complete set replaces an older one entirely
  console.error(`${files.length} of ${COMPLETE} files - both disks of the PSG release are needed, nothing written`);
  process.exit(1);
}
for (const {path, data} of files) {
  const p = join(out, path);
  mkdirSync(dirname(p), {recursive: true});
  writeFileSync(p, data);
}
console.log(`${files.length} files written to ${resolve(out)}`);
