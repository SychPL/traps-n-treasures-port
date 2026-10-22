// Porownanie ruchu aktorow (wrogow, przedmiotow) z emulatorem od tego samego miejsca: gracz przestawiony w (x, y),
// kamera gry A4 = (ax, ay), bez wejscia, nietykalny. Emulator (play.html, po T.open(snap)): await recEmu(name) ->
// work/dumps/act_<name>.json; port (/game/): await cmpActors(name). Aktorzy laczeni wg punktu i klatki pojawienia.
window.ACT_AT = {
  // [snapshot, poziom, x, y, A4 x, A4 y, klatki, obszar?]
  l1crab: ['L1', 1, 200, 543, 40, 423, 400],
  l1walk: ['L1', 1, 560, 495, 400, 375, 400],
  l2mover: ['L2', 2, 2191, 239, 2031, 119, 400],
  l2roller: ['L2', 2, 1339, 111, 1179, -9, 400],
  l2walker: ['L2', 2, 657, 239, 497, 119, 400],
  l3bob: ['L3', 3, 288, 511, 128, 368, 400],
  l3crawler: ['L3', 3, 1873, 159, 1713, 39, 400],
  l3runner: ['L3', 3, 1808, 127, 1648, 7, 400],
  l3roamer: ['L3', 3, 5048, 223, 4880, 103, 400],
  l4pirate: ['L4', 4, 537, 287, 377, 208, 400],
  l4walker: ['L4', 4, 1253, 399, 1093, 279, 400],
  l1edge: ['L1', 1, 3600, 511, 3440, 382, 600, 100],
  l2gen: ['L2', 2, 3200, 95, 3040, 0, 600, 172],
  l2sides: ['L2', 2, 700, 543, 540, 384, 600, 172],
  l3slide: ['L3', 3, 8200, 300, 8040, 176, 400, 732],
  l3swim: ['L3', 3, 5464, 383, 5304, 192, 400, 2544],
  l4throw: ['L4', 4, 2941, 287, 2781, 192, 400, 262],
  l4float: ['L4', 4, 10032, 479, 9872, 369, 400, 9836],
  l4fall: ['L4', 4, 3100, 112, 2940, 0, 600, 788],
  l4ghost: ['L4', 4, 3760, 96, 3600, 0, 600, 1008],
};
window.recEmu = async name => {
  const [snap, , x, y, ax, ay, n, area] = ACT_AT[name];
  await T.restore(snap); await new Promise(r => setTimeout(r, 800)); await T.step(2);
  const rec = await T.call(`const s = a => wasm_peek16(a) << 16 >> 16, l = a => (wasm_peek16(a) << 16 | wasm_peek16(a + 2)) >>> 0;
    const w = (a, v) => { v &= 0xffff; Module._wasm_poke(a, v >> 8 & 255); Module._wasm_poke(a + 1, v & 255); };
    const P = l(0x30cab0); for (const a of [P + 0x0e, P + 0x12, 0x30ca84]) w(a, ${x}); for (const a of [P + 0x10, P + 0x14, 0x30ca86]) w(a, ${y});
    w(0x30ca80, ${ax}); w(0x30ca82, ${ay});
    const wl = (a, v) => { w(a, v >>> 16); w(a + 2, v); };   // obszar: wskaznik $30CBA2 = baza + numer, sekcja rekordow $30CBE8
    if (${area || 0}) { const A = l(0x30cd98) + ${area || 0}; wl(0x30cba2, A); wl(0x30cbe8, l(l(l(0x30cd14) + 0x64) + 4 * l(A))); }
    const out = [];
    for (let i = 0; i < ${n}; i++) { Module._wasm_poke(0x30ccd8, 0); Module._wasm_poke(0x30ccd9, 80); Module._wasm_execute_one_frame();
      const fr = []; for (let q = l(0x176), k = 0; k < 200 && l(q); k++, q = l(q)) if (q !== P) fr.push([q, s(q + 14), s(q + 16)]);
      out.push([s(0x30ca84), s(0x30ca86), fr, wasm_peek16(0x30cadc) & 255]); }
    return out;`);
  return (await fetch('dump/act_' + name + '.json', {method: 'POST', body: JSON.stringify(rec)})).status;
};
window.recPort = async name => {
  const [, lvl, x, y, ax, ay, n, area] = ACT_AT[name];
  window.saveGame = () => true;
  await startLevel(lvl); game.state = null; game.checkpoint = null; respawn(); game.state = null;
  if (area) { enterArea(area); resetActors(true); }
  Object.assign(pl, {x, y, vx: 0, vy: 0}); cam.x = ax + 48; cam.y = ay + 48; cam.px = x; cam.py = y;
  Object.keys(keys).forEach(k => keys[k] = false);
  // faza petli ($5D(A4)) jak w emulatorze: E[i][3] = faza po klatce i; port liczy faze co takt (game.frame parzyste)
  const E = await (await fetch('/work/dumps/act_' + name + '.json')).json();
  const ch = E.findIndex((e, i) => i > 0 && e[3] !== E[i - 1][3]);   // pierwsza zmiana fazy w emulatorze
  // takt portu w klatce ch ma miec faze E[ch][3]; przed nim port robi ch >> 1 taktow (kazdy zmniejsza faze o 1, 0 -> 5)
  game.frame = ch & 1 ? 1 : 0; game.phase = (E[ch][3] + (ch >> 1)) % 6;
  const ids = new Map(), out = [];
  for (let i = 0; i < n; i++) {
    game.life = 50; game.hurt = Math.max(game.hurt, 79); update(); follow();
    out.push([pl.x, pl.y, Actors.list.filter(a => !a.dead && !a.eye).map(a => { if (!ids.has(a)) ids.set(a, ids.size + 1); return [ids.get(a), Math.round(a.x), Math.round(a.y)]; })]);
  }
  return out;
};
// slady: id -> [[klatka, x, y]]; laczenie: ten sam punkt pojawienia (+-2 px) i klatka pojawienia (+-3)
// emulator uzywa struktur aktorow ponownie: nowy slad, gdy adres zniknie na klatke albo pozycja skoczy o > 24 px
const tracks = rec => {
  const t = new Map(), all = [];
  rec.forEach(([, , fr], i) => fr.forEach(([id, x, y]) => {
    let c = t.get(id); const l = c && c[c.length - 1];
    if (!c || l[0] !== i - 1 || Math.abs(l[1] - x) > 24 || Math.abs(l[2] - y) > 24) { c = []; t.set(id, c); all.push(c); }
    c.push([i, x, y]);
  }));
  return all;
};
window.cmpActors = async name => {
  const E = await (await fetch('/work/dumps/act_' + name + '.json')).json(), P = await recPort(name);
  const te = tracks(E), tp = tracks(P), used = new Set(), lines = [];
  for (const e of te) {
    const [f0, x0, y0] = e[0];
    const p = tp.find(p => !used.has(p) && Math.abs(p[0][0] - f0) <= 3 && Math.abs(p[0][1] - x0) <= 2 && Math.abs(p[0][2] - y0) <= 2);
    if (!p) { lines.push(`emu ${x0},${y0}@${f0}: brak w porcie (zyje do ${e[e.length - 1][0]})`); continue; }
    used.add(p);
    // pozycje z przesunieciem 1 klatki (emulator pokazuje stan klatke pozniej)
    const pm = new Map(p.map(([f, x, y]) => [f, [x, y]]));
    const score = sh => { let bad = 0, first = null; for (const [f, x, y] of e) { const q = pm.get(f - sh); if (!q) continue; if (q[0] !== x || q[1] !== y) { bad++; if (!first) first = `${f}: emu ${x},${y} port ${q}`; } } return [bad, first, sh]; };
    const [bad, first, sh] = [0, 1, 2, -1, -2, -3].map(score).sort((a, b) => a[0] - b[0])[0];   // najlepsze przesuniecie klatek
    // tor bez czasu (emulator potrafi zgubic takt pod obciazeniem): kolejne rozne polozenia, porownane po kolei
    const seq = t => t.map(q => q[1] + ',' + q[2]).filter((v, i, A) => !i || v !== A[i - 1]), se = seq(e), sp = seq(p);
    // poczatek wyrownany o 0-2 polozenia (klatka powstania w emulatorze bywa przed albo po pierwszym takcie)
    let best = null;
    for (const [da, db] of [[0, 0], [1, 0], [0, 1], [2, 0], [0, 2], [1, 1]]) {
      const E2 = se.slice(da), P2 = sp.slice(db), n = Math.min(E2.length, P2.length), k = E2.slice(0, n).findIndex((v, i) => v !== P2[i]);
      const len = k < 0 ? n : k;
      if (!best || len > best.len) best = {len, k, n, E2, P2};
    }
    const {k, n, E2, P2} = best;
    const path = k < 0 ? (E2.length === P2.length ? 'tor zgodny' : `tor zgodny do ${n} (emu ${E2.length}, port ${P2.length})`) : `tor rozny od ${k}: emu ${E2[k]} port ${P2[k]}`;
    lines.push(`${x0},${y0}@${f0}: ${bad}/${e.length} (przes. ${sh})${first ? ' od ' + first : ''} (emu do ${e[e.length - 1][0]}, port do ${p[p.length - 1][0]}) | ${path}`);
  }
  for (const p of tp) if (!used.has(p)) lines.push(`port ${p[0][1]},${p[0][2]}@${p[0][0]}: brak w emulatorze`);
  const pe = E.map(e => e.slice(0, 2).join()), pp = P.map(p => p.slice(0, 2).join());
  const pd = pe.findIndex((v, i) => i > 0 && pp[i - 1] !== undefined && v !== pp[i - 1]);
  return name + ' gracz ' + (pd < 0 ? 'zgodny' : 'rozni sie od ' + pd + ': emu ' + pe[pd] + ' port ' + pp[pd - 1]) + '\n' + lines.join('\n');
};
// obraz z tego samego miejsca: emulator (await shotEmu(name, n) -> work/dumps/scr_<name>_1824x313.rgba) i port
// (await shotPort(name, n) -> work/dumps/scr_<name>_port.png) po n klatkach; potem python work/cmp_screen.py
window.shotEmu = async (name, n = 60) => {
  const [snap, , x, y, ax, ay, , area] = ACT_AT[name];
  await T.restore(snap); await new Promise(r => setTimeout(r, 800)); await T.step(2);
  await T.call(`const l = a => (wasm_peek16(a) << 16 | wasm_peek16(a + 2)) >>> 0;
    const w = (a, v) => { v &= 0xffff; Module._wasm_poke(a, v >> 8 & 255); Module._wasm_poke(a + 1, v & 255); };
    const wl = (a, v) => { w(a, v >>> 16); w(a + 2, v); };
    const P = l(0x30cab0); for (const a of [P + 0x0e, P + 0x12, 0x30ca84]) w(a, ${x}); for (const a of [P + 0x10, P + 0x14, 0x30ca86]) w(a, ${y});
    w(0x30ca80, ${ax}); w(0x30ca82, ${ay});
    if (${area || 0}) { const A = l(0x30cd98) + ${area || 0}; wl(0x30cba2, A); wl(0x30cbe8, l(l(l(0x30cd14) + 0x64) + 4 * l(A))); }
    for (let i = 0; i < ${n}; i++) Module._wasm_execute_one_frame();   // bez nietykalnosci: gracz nie miga
    return 1;`);
  return T.shot('scr_' + name);
};
window.shotPort = async (name, n = 60) => {
  const [, lvl, x, y, ax, ay, , area] = ACT_AT[name];
  window.saveGame = () => true;
  await startLevel(lvl); game.state = null; game.checkpoint = null; respawn(); game.state = null;
  if (area) { enterArea(area); resetActors(true); }
  Object.assign(pl, {x, y, vx: 0, vy: 0}); cam.x = ax + 48; cam.y = ay + 48; cam.px = x; cam.py = y;
  Object.keys(keys).forEach(k => keys[k] = false);
  for (let i = 0; i < n; i++) { game.life = 50; game.hurt = Math.max(game.hurt, 79); update(); follow(); }
  game.hurt = 0; draw();
  const c = document.querySelector('canvas'), blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return (await fetch('/dump/scr_' + name + '_port.png', {method: 'POST', body: blob})).status;
};
