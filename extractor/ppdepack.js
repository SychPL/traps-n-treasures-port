// PowerPacker 2.0 as stored on Traps 'n Treasures disk 2 (no "PP20" magic) - port of work/ppdepack.py.
// Directory entry before the file: {$80000000 | packed length}. File = [unpacked length.L][4 offset widths]
// [bit stream, read backwards][unpacked length.3 B + bits to skip.1 B].
export function ppUnpack(adf, start) {
  const dv = new DataView(adf.buffer, adf.byteOffset, adf.byteLength);
  const packedLen = dv.getUint32(start - 4) & 0x7fffffff;
  const total = dv.getUint32(start), tail = dv.getUint32(start + packedLen - 4);
  const destLen = tail >>> 8, skip = tail & 0xff;
  if (destLen !== total) throw new Error(`PP: length mismatch at $${start.toString(16)}`);
  const eff = adf.subarray(start + 4, start + 8), src = adf.subarray(start + 8, start + packedLen - 4);
  const out = new Uint8Array(destLen);
  let pos = src.length, bits = 0, nbits = 0;
  const read = n => {
    while (nbits < n) {
      if (--pos < 0) throw new Error('PP: out of data');
      bits |= src[pos] << nbits; nbits += 8;
    }
    let v = 0;
    for (let i = 0; i < n; i++) { v = v << 1 | bits & 1; bits >>>= 1; }
    nbits -= n;
    return v;
  };
  let o = destLen, x;
  read(skip);
  while (o > 0) {
    if (read(1) === 0) {                               // literal run
      let todo = 1;
      do { x = read(2); todo += x; } while (x === 3);
      while (todo--) out[--o] = read(8);
      if (o === 0) break;
    }
    x = read(2);                                       // copy from already unpacked data
    let offbits = eff[x], todo = x + 2, off;
    if (x === 3) {
      if (read(1) === 0) offbits = 7;
      off = read(offbits);
      do { x = read(3); todo += x; } while (x === 7);
    } else off = read(offbits);
    while (todo--) { o--; out[o] = out[o + off + 1]; }
  }
  return out;
}
