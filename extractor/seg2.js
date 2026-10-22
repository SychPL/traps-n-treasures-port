// "SEG2" object files of the game's own loader: "SEG2" + sizes d2 d3 d4, seg1[d2] + 3 x ("RLOC" + relocations),
// seg2[d3] + 3 x ("RLOC" + relocations); seg3 is d4 bytes of BSS with no file data. A relocation block is a count
// and delta-coded offsets (word, 0 -> long); block k of a segment adds the base of segment k to the long there.
const RLOC = 0x524C4F43;

// adf + offset of "SEG2", bases [seg1, seg2, seg3] -> {seg1, seg2, bss} relocated byte arrays
export function loadSeg2(adf, at, bases) {
  const dv = new DataView(adf.buffer, adf.byteOffset, adf.byteLength);
  if (dv.getUint32(at) !== 0x53454732) throw new Error(`no SEG2 at $${at.toString(16)}`);
  const size = [dv.getUint32(at + 4), dv.getUint32(at + 8), dv.getUint32(at + 12)];
  let p = at + 16;
  const segs = [];
  for (let s = 0; s < 2; s++) {
    const seg = adf.slice(p, p + size[s]), sv = new DataView(seg.buffer);
    p += size[s];
    for (let k = 0; k < 3; k++) {
      if (dv.getUint32(p) !== RLOC) throw new Error(`no RLOC at $${p.toString(16)}`);
      const n = dv.getUint32(p + 4);
      p += 8;
      for (let i = 0, off = 0; i < n; i++) {
        let d = dv.getInt16(p); p += 2;
        if (!d) { d = dv.getInt32(p); p += 4; }
        off += d;
        sv.setUint32(off, sv.getUint32(off) + bases[k] >>> 0);
      }
    }
    segs.push(seg);
  }
  return {seg1: segs[0], seg2: segs[1], bss: new Uint8Array(size[2]), end: p};
}

// the main program on disk 1 at its layout-A addresses (the ones every export and the engine use)
export const MAIN = {at: 0x21118, bases: [0x2DC97C, 0x9A4C, 0x100FC]};
export const mainProgram = disk1 => loadSeg2(disk1, MAIN.at, MAIN.bases);
