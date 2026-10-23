// Menu after the title and the Hall of Fame logo (module $309DF0..$30AB16; the export cut them from emulator
// screenshots): menu.png (3 screens of 320 x 243 one under another: START, PASSWORD, the password fields without the
// cursor), menu_icons.png (6 pictures in an 18 x 18 field), pass_icons.png (6 pictures 16 x 16), hof_logo.png, menu.json.
// The module loads the BOB bank disk 2 PP $9C6BC (logo, captain medallion, ribbon, password field row, PASSWORD
// highlight, cursor frame) and the picture bank $96AA8 (6 opaque BOBs 16 x 16); palette = 32 colours at $30C4B2 ($30A3FA).
// Positions (checked pixel for pixel against the screenshots): logo 58,1; medallion 100,41; ribbon 18,158; PASSWORD
// highlight 130,173; field row 81,174 (fields 20 px apart); a picture at field +2,+2, the cursor frame at field +0,+0.
import { readFile } from './adf.js';
import { encodePNG } from './png.js';
import { mainProgram, MAIN } from './seg2.js';
import { bob } from './objects.js';
import { walkBank } from './actors.js';

const BIG = 0x9C6BC, SMALL = 0x96AA8, PAL = 0x30C4B2, PASSWORDS = 0x30C438, SW = 320, SH = 243;

export function extractMenu(disks) {
  if (!disks[1] || !disks[2]) return [];
  const {seg1} = mainProgram(disks[1]), fv = new DataView(seg1.buffer), S1 = MAIN.bases[0];
  const pal = [...Array(32)].map((_, i) => fv.getUint16(PAL + 2 * i - S1));
  const load = at => { const r = readFile(disks[2], at), b = new Uint8Array(r.length + 4); b.set(r); b.fill(255, r.length); return b; };
  const big = load(BIG), small = load(SMALL);
  const B = walkBank({chip: big}, 0), I = walkBank({chip: small}, 0).map(([a]) => a), out = [];
  const canvas = (w, h) => { const px = new Uint8Array(w * h * 4); for (let k = 3; k < px.length; k += 4) px[k] = 255; return px; };   // black
  const crop = (px, w, x0, y0, cw, ch) => { const c = new Uint8Array(cw * ch * 4); for (let y = 0; y < ch; y++) c.set(px.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + cw) * 4), y * cw * 4); return c; };
  // one field cell as the export cut it: the field row, picture k at +2,+2 and the cursor frame, 18 x 18 inside the frame
  const cell = k => { const c = canvas(SW, SH); bob(big, B[3][0], pal, c, SW, 81, 174); bob(small, I[k], pal, c, SW, 83, 176); bob(big, B[5][0], pal, c, SW, 81, 174); return crop(c, SW, 82, 175, 18, 18); };
  const menu = canvas(SW, 3 * SH);
  for (let s = 0; s < 3; s++) {
    bob(big, B[0][0], pal, menu, SW, 58, SH * s + 1); bob(big, B[1][0], pal, menu, SW, 100, SH * s + 41); bob(big, B[2][0], pal, menu, SW, 18, SH * s + 158);
  }
  bob(big, B[4][0], pal, menu, SW, 130, SH + 173);
  bob(big, B[3][0], pal, menu, SW, 81, 2 * SH + 174);
  const c0 = cell(0);                                   // the fields screen shows picture 0 in every field
  for (let k = 0; k < 8; k++) for (let y = 0; y < 18; y++) menu.set(c0.subarray(y * 72, (y + 1) * 72), ((2 * SH + 175 + y) * SW + 82 + 20 * k) * 4);
  out.push({path: 'menu.png', data: encodePNG(menu, SW, 3 * SH)});
  const icons = new Uint8Array(108 * 18 * 4);
  for (let k = 0; k < 6; k++) { const c = cell(k); for (let y = 0; y < 18; y++) icons.set(c.subarray(y * 72, (y + 1) * 72), (y * 108 + 18 * k) * 4); }
  out.push({path: 'menu_icons.png', data: encodePNG(icons, 108, 18)});
  const pass = new Uint8Array(96 * 16 * 4);
  I.forEach((a, k) => bob(small, a, pal, pass, 96, 16 * k, 0));
  out.push({path: 'pass_icons.png', data: encodePNG(pass, 96, 16)});
  const [la, lf] = B[0], logo = new Uint8Array(lf.w * lf.h * 4);
  bob(big, la, pal, logo, lf.w, 0, 0);
  out.push({path: 'hof_logo.png', data: encodePNG(logo, lf.w, lf.h)});
  // passwords: 8 words per stage 2.. ($30C438), the list ends with a negative word
  const words = [...Array(32)].map((_, i) => fv.getInt16(PASSWORDS - S1 + 2 * i)), passwords = [];
  for (let i = 0; i < 32 && words[i] >= 0; i += 8) passwords.push(words.slice(i, i + 8));
  out.push({path: 'menu.json', data: new TextEncoder().encode(JSON.stringify({w: SW, h: SH, slot: [81, 174], step: 20, cursor: '#c00000', passwords}))});
  return out;
}
