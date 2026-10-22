// Minimal PNG writer (RGBA 8 bit, filter 0, uncompressed deflate blocks) - works in the browser and in node, no
// dependencies. The files are bigger than compressed ones, which does not matter for the browser cache.
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
const crc32 = (b, c = 0xffffffff) => { for (const x of b) c = CRC[(c ^ x) & 255] ^ c >>> 8; return c;};
const u32 = v => [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255];

function chunk(type, data) {
  const t = [...type].map(c => c.charCodeAt(0)), body = new Uint8Array(4 + data.length);
  body.set(t); body.set(data, 4);
  const out = new Uint8Array(12 + data.length);
  out.set(u32(data.length)); out.set(body, 4); out.set(u32((crc32(body) ^ 0xffffffff) >>> 0), 8 + data.length);
  return out;
}

// rgba: Uint8Array w*h*4 -> PNG file bytes
export function encodePNG(rgba, w, h) {
  const raw = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const blocks = Math.ceil(raw.length / 65535) || 1, z = new Uint8Array(2 + raw.length + 5 * blocks + 4);
  z[0] = 0x78; z[1] = 0x01;
  let o = 2;
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * 65535, Math.min(raw.length, (i + 1) * 65535));
    z[o++] = i === blocks - 1 ? 1 : 0; z[o++] = part.length & 255; z[o++] = part.length >> 8;
    z[o++] = ~part.length & 255; z[o++] = ~part.length >> 8 & 255;
    z.set(part, o); o += part.length;
  }
  let a = 1, b = 0;
  for (const x of raw) { a = (a + x) % 65521; b = (b + a) % 65521; }
  z.set(u32((b << 16 | a) >>> 0), o);
  const ihdr = new Uint8Array([...u32(w), ...u32(h), 8, 6, 0, 0, 0]);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let k = 0;
  for (const p of parts) { out.set(p, k); k += p.length; }
  return out;
}
