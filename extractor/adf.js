// ADF access for the extractor: disk identification and files of the PSG release (no file system: each file is
// [length.L or $80000000|packed.L][data] at a fixed offset, see EXTRACTOR.md section 1).
import { ppUnpack } from './ppdepack.js';

// game data ranges (boot block and crack sectors excluded, so the PSG disk 1 and its [a] variant both match)
export const DISKS = [
  {id: 1, name: 'disk 1', lo: 0x3200, hi: 0x5D6D8, sha1: '21ea697fc7aea748ef15f341203e47733934f0a0'},
  {id: 2, name: 'disk 2', lo: 0x3200, hi: 0xCA3E0, sha1: 'dd75f5794c5592e7dd2608e0448b69224a7db78d'},
];
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

// -> disk descriptor or null (crypto.subtle needs a secure context: https or http://localhost)
export async function identify(adf) {
  if (adf.length !== 901120) return null;
  for (const d of DISKS)
    if (hex(await crypto.subtle.digest('SHA-1', adf.subarray(d.lo, d.hi))) === d.sha1) return d;
  return null;
}

// file at `start` (the length word is at start - 4): unpacked bytes, PowerPacker or raw
export function readFile(adf, start) {
  const flag = new DataView(adf.buffer, adf.byteOffset, adf.byteLength).getUint32(start - 4);
  return flag >>> 31 ? ppUnpack(adf, start) : adf.slice(start, start + flag);
}
