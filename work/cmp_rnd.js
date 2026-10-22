// Losowe sekwencje joysticka (ziarno -> ta sama sekwencja w emulatorze i w porcie), nietykalnosc co klatke.
// Emulator (play.html): eval(await (await fetch('work/cmp_rnd.js')).text()); await T.open('l1'); await T.restore('l1');
//   E = await T.seq(rndSeq(101, 1500), true); await fetch('dump/rnd1_emu.json', {method: 'POST', body: JSON.stringify(E)})
// Port (/game/?level=1, po work/cmp_trace.js): await cmpRnd('rnd1_emu') -> pierwsza roznica pozycji i klatki (RND nizej)
window.rndSeq = (seed, total) => {
  let s = seed >>> 0;
  const r = () => { s = s + 0x6D2B79F5 >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // ziarno >= 100000: rozklad B - wiecej kierunkow w lewo, FIRE i DOWN z kierunkiem, krotsze odcinki
  const B = seed >= 100000, C = B
    ? [[[], 2], [['RIGHT'], 4], [['LEFT'], 4], [['UP'], 2], [['DOWN'], 2], [['UP', 'RIGHT'], 2], [['UP', 'LEFT'], 2], [['DOWN', 'RIGHT'], 1.5], [['DOWN', 'LEFT'], 1.5], [['FIRE'], 2], [['RIGHT', 'FIRE'], 1], [['LEFT', 'FIRE'], 1], [['UP', 'FIRE'], 1], [['DOWN', 'FIRE'], 1]]
    : [[[], 2], [['RIGHT'], 8], [['LEFT'], 3], [['UP'], 2], [['DOWN'], 1.5], [['UP', 'RIGHT'], 3], [['UP', 'LEFT'], 1], [['DOWN', 'RIGHT'], 1], [['FIRE'], 1], [['RIGHT', 'FIRE'], 1], [['UP', 'FIRE'], 0.5], [['DOWN', 'LEFT'], 0.5]];
  const W = C.reduce((a, c) => a + c[1], 0), S = [[10, []]];
  for (let n = 10; n < total;) {
    let x = r() * W, c = C[0];
    for (const k of C) if ((x -= k[1]) < 0) { c = k; break; }
    const len = c[0].includes('UP') ? 2 + (r() * 20 | 0) : 3 + (r() * (B ? 30 : 50) | 0);
    S.push([len, c[0]]); n += len;
  }
  return S;
};
// takt petli glownej w snapshotach (faza $5D(A4) co klatke po T.restore: zmiana w klatkach parzystych albo nieparzystych):
// [game.frame na starcie, game.phase] - pierwszy takt portu ma faze z pierwszej zmiany w emulatorze
window.SNAPPH = {l1: [1, 2], L2: [1, 1], L3: [0, 4], l4: [1, 2], R3: [0, 2], I4: [1, 4], D4: [1, 4], C2: [1, 3]};
const LVLSNAP = {1: 'l1', 2: 'L2', 3: 'L3', 4: 'l4'};
// RND: nagrania [poziom, ziarno, klatki]
window.RND = {rnd1_emu: [1, 101, 1500], rnd2_emu: [2, 202, 2000], rnd3_emu: [3, 303, 2000], rnd4_emu: [4, 404, 2000],   // 2-4: snapshoty L2, L3, l4
  rnd5_emu: [1, 505, 2500], rnd6_emu: [2, 606, 2500], rnd7_emu: [3, 707, 2500], rnd8_emu: [4, 808, 2500],
  rnd9_emu: [1, 909, 3000], rnd10_emu: [2, 1010, 3000], rnd11_emu: [3, 1111, 3000], rnd12_emu: [4, 1212, 3000],
  rnd13_emu: [1, 1313, 8000], rnd14_emu: [4, 1414, 8000],
  // nagrania z procesorem 4x (wasm_configure('CPU_OVERCLOCKING', '4') po T.restore): petla glowna bez zgubionych taktow
  rnd2oc_emu: [2, 202, 2000], rnd6oc_emu: [2, 606, 2500], rnd10oc_emu: [2, 1010, 3000], rnd7oc_emu: [3, 707, 2500, [[41, 6, 47], [41, 6, 46]]],
  rnd3oc_emu: [3, 303, 2000, [[42, 7, 46], [41, 6, 45]]], rnd11oc_emu: [3, 1111, 3000, [[42, 6, 46], [41, 6, 47]]],
  rnd15oc_emu: [2, 1515, 3000], rnd16oc_emu: [3, 1616, 3000, [[41, 6, 46], [41, 6, 46]]], rnd17oc_emu: [2, 1717, 3000], rnd18oc_emu: [3, 1818, 3000, [[42, 6, 46], [41, 7, 46]]],
  rnd19oc_emu: [1, 1919, 3000], rnd20oc_emu: [4, 2020, 3000],
  rnd21oc_emu: [2, 2121, 4000], rnd22oc_emu: [3, 2222, 4000], rnd23oc_emu: [1, 2323, 4000], rnd24oc_emu: [4, 2424, 4000],
  rnd25oc_emu: [2, 2525, 4000], rnd26oc_emu: [3, 2626, 4000, [[42, 7, 46], [41, 6, 46]]],
  rnd27oc_emu: [1, 2727, 5000], rnd28oc_emu: [4, 2828, 5000], rnd29oc_emu: [2, 2929, 5000], rnd30oc_emu: [3, 3030, 5000, [[41, 6, 46]]],
  rnd31oc_emu: [1, 3131, 5000], rnd32oc_emu: [2, 3232, 5000], rnd33oc_emu: [3, 3333, 5000], rnd34oc_emu: [4, 3434, 5000],
  rnd35oc_emu: [1, 3535, 5000], rnd36oc_emu: [2, 3636, 5000], rnd37oc_emu: [3, 3737, 5000, [[42, 6, 46], [41, 6, 46]]], rnd38oc_emu: [4, 3838, 5000],
  rnd39oc_emu: [1, 3939, 5000], rnd40oc_emu: [2, 4040, 5000], rnd41oc_emu: [3, 4141, 5000, [[41, 6, 46], [41, 7, 46]]], rnd42oc_emu: [4, 4242, 5000],
  rnd43oc_emu: [1, 4343, 5000], rnd44oc_emu: [2, 4444, 5000], rnd45oc_emu: [3, 4545, 5000, [[42, 6, 46], [41, 6, 46]]], rnd46oc_emu: [4, 4646, 5000],
  // rozklad B (ziarno >= 100000)
  rndb1oc_emu: [1, 100001, 5000], rndb2oc_emu: [2, 100002, 5000], rndb3oc_emu: [3, 100003, 5000], rndb4oc_emu: [4, 100004, 5000],
  rndb5oc_emu: [1, 100011, 5000], rndb6oc_emu: [2, 100012, 5000], rndb7oc_emu: [3, 100013, 5000], rndb8oc_emu: [4, 100014, 5000],
  rndb9oc_emu: [1, 100021, 5000], rndb10oc_emu: [2, 100022, 5000], rndb11oc_emu: [3, 100023, 5000, [[41, 7, 46]]], rndb12oc_emu: [4, 100024, 5000],
  rndb13oc_emu: [1, 100031, 5000], rndb14oc_emu: [2, 100032, 5000], rndb15oc_emu: [3, 100033, 5000], rndb16oc_emu: [4, 100034, 5000]};
// odrodzenie w nagraniu 4x: etap wczytuje sie w 41-42 klatki od FIRE (A500: 61-62), obiekt gracza zerowany 6-7 klatek
// przed polozeniem, sterowanie 46 klatek po odrodzeniu (A500: 63) - rozrzut 1 klatki; RND [3]: czas dla kazdej smierci albo
// lista [czas, klatki 0, postoj] na kolejne smierci (fitRespawn), dalej 42 / 6 / 46
window.setRespawn = name => {
  const oc = name.includes('oc_'), w = RND[name][3], q = Array.isArray(w) ? w.slice() : null;
  let blank = 6, frozen = 46;
  Object.defineProperty(game, 'respawnWait', {configurable: true, get: () => {
    if (!oc) return 0;
    const [a, b, c] = q ? q.shift() || [42] : [w || 42]; blank = b || 6; frozen = c || 46; return a;
  }});
  Object.defineProperty(game, 'respawnBlank', {configurable: true, get: () => oc ? blank : 0});
  Object.defineProperty(game, 'respawnFrozen', {configurable: true, get: () => oc ? frozen : 0});
  game.doorExtra = oc ? 0 : undefined; game.doorBlack = oc ? 8 : undefined;   // przejscie drzwiami z procesorem 4x: nowa pozycja 16 klatek po FIRE, sterowanie 10 klatek pozniej
};
// dobiera RND[name][3] smierc po smierci: czas, klatki 0 i postoj, przy ktorych pierwsza roznica jest najdalej
window.fitRespawn = async (name, from = 0) => {   // from: pomin znane roznice przed ta klatka
  const first = async () => { const r = (await cmpRnd(name, 6, from)).split('\n')[0], p = parseInt(r.split('pos ')[1].split(' od ')[1]), f = parseInt(r.split('klatki ')[1].split(' od ')[1]); return Math.min(isNaN(p) ? 1e9 : p, isNaN(f) ? 1e9 : f); };
  const fit = [], D = [42, 6, 46]; let best = 0;
  for (let k = 0; k < 4; k++) {                          // smierci po kolei; remis zostawia domyslne
    let pick = D; RND[name][3] = [...fit, D]; best = await first();
    for (const a of [41, 42]) for (const b of [6, 7]) for (const c of [45, 46, 47]) {
      if (a === D[0] && b === D[1] && c === D[2]) continue;
      RND[name][3] = [...fit, [a, b, c]];
      const f = await first(); if (f > best) { best = f; pick = [a, b, c]; }
    }
    fit.push(pick);
  }
  while (fit.length && fit[fit.length - 1].join() === D.join()) fit.pop();
  RND[name][3] = fit;
  return name + ': ' + JSON.stringify(fit) + ' -> ' + (best < 1e9 ? best : '-');
};
window.cmpRnd = async (name, ctx = 6, from = 0) => {   // from: pomin roznice przed ta klatka (znane przypadki)
  setRespawn(name);
  const [lvl, seed, total] = RND[name], [frame0, phase] = SNAPPH[LVLSNAP[lvl]], S = Object.assign(rndSeq(seed, total), {invuln: true, frame0, phase});
  const E = await (await fetch('/work/dumps/' + name + '.json', {cache: 'no-store'})).json();
  const src = runSeq.toString().replace("tr.push([Math.round(cam.x) - 48, Math.round(cam.y) - 48, pl.x, pl.y]);", "tr.push([Math.round(cam.x) - 48, Math.round(cam.y) - 48, pl.x, pl.y, pl.frame]);");
  const P = await eval('(' + src + ')')(lvl, S);
  let first = -1, d = 0, fd = 0, ff = -1;
  for (let i = from; i + 1 < E.length && i < P.length; i++) {
    if (E[i + 1].slice(0, 4).join() !== P[i].slice(0, 4).join()) { d++; if (first < 0) first = i; }
    if (E[i][4] !== P[i][4]) { fd++; if (ff < 0) ff = i; }
  }
  const segAt = f => { let acc = 0, k = 0; for (const [n] of S) { if (acc + n > f) break; acc += n; k++; } return `${f}: seg ${k} od ${acc} ${JSON.stringify(S.slice(Math.max(0, k - 2), k + 1))}`; };
  const rows = f => f < 0 ? [] : Array.from({length: 2 * ctx + 2}, (_, k) => f - ctx + k).map(i => `${i} emu ${E[i + 1]} | port ${P[i]}`);
  return `${name} pos ${d} od ${first >= 0 ? segAt(first) : '-'} | klatki ${fd} od ${ff >= 0 ? segAt(ff) : '-'}\n` + rows(first).join('\n') + '\n--\n' + rows(ff).join('\n');
};
// losowe sekwencje ze snapshotow z work/cmp_at.js (gracz przestawiony): [poziom, x, y, A4 x, A4 y, klatki przed, obszar,
// bron, ziarno, klatki]; emulator: T.open('R3'); T.restore('R3'); T.seq(rndSeq(ziarno, klatki), true)
window.RNDAT = {
  rndR_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 2001, 2000, 'R3'],     // R3: liny nad kolcami
  rndRoc_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 2001, 2000, 'R3'],   // R3 z procesorem 4x
  rndI_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 2002, 2000, 'I4'],       // I4: lod
  rndD_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 2003, 2000, 'D4'],   // D4: drzwi
  rndC_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 2004, 2000, 'C2'],      // C2: klatka wieznia
  rndIoc_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 2002, 2000, 'I4'], rndDoc_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 2003, 2000, 'D4'],
  rndCoc_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 2004, 2000, 'C2'],   // I4, D4, C2 z procesorem 4x
  rndI2oc_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 5005, 5000, 'I4'], rndD2oc_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 5006, 5000, 'D4'],
  rndC2oc_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 5007, 5000, 'C2'], rndR2oc_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 5008, 5000, 'R3'],
  rndR3oc_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 5009, 5000, 'R3'], rndI3oc_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 5010, 5000, 'I4'],
  rndD3oc_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 5011, 5000, 'D4'], rndC3oc_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 5012, 5000, 'C2'],
  rndbRoc_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 100005, 5000, 'R3'], rndbIoc_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 100006, 5000, 'I4'],
  rndbDoc_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 100007, 5000, 'D4'], rndbCoc_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 100008, 5000, 'C2'],
  rndbR2oc_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 100015, 5000, 'R3'], rndbI2oc_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 100016, 5000, 'I4'],
  rndbD2oc_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 100017, 5000, 'D4'], rndbC2oc_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 100018, 5000, 'C2'],
  rndbR3oc_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 100025, 5000, 'R3'], rndbI3oc_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 100026, 5000, 'I4'],
  rndbD3oc_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 100027, 5000, 'D4'], rndbC3oc_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 100028, 5000, 'C2'],
  rndbR4oc_emu: [3, 340, 527, 180, 368, 32, undefined, undefined, 100035, 5000, 'R3'], rndbI4oc_emu: [4, 3200, 399, 3040, 279, 32, '262:453', undefined, 100036, 5000, 'I4'],
  rndbD4oc_emu: [4, 1340, 399, 1180, 279, 32, undefined, undefined, 100037, 5000, 'D4'], rndbC4oc_emu: [2, 556, 159, 400, 32, 32, undefined, undefined, 100038, 5000, 'C2'],
};
window.cmpRndAt = async (name, ctx = 6) => {
  const [lvl, x, y, ax, ay, idle, area, weapon, seed, total, snap] = RNDAT[name], S = rndSeq(seed, total);
  const E = await (await fetch('/work/dumps/' + name + '.json', {cache: 'no-store'})).json();
  const P = await runAt(lvl, x, y, ax, ay, S, idle, area, weapon, SNAPPH[snap], name.includes('oc_'));
  let first = -1, d = 0, fd = 0, ff = -1;
  for (let i = 0; i + 1 < E.length && i < P.length; i++) {
    if (E[i + 1].slice(2, 4).join() !== P[i].slice(2, 4).join()) { d++; if (first < 0) first = i; }
    if (E[i][4] !== P[i][4]) { fd++; if (ff < 0) ff = i; }
  }
  const inp = []; for (const [n, h] of S) for (let i = 0; i < n; i++) inp.push(h.join('+'));
  const rows = f => f < 0 ? [] : Array.from({length: 2 * ctx + 2}, (_, k) => f - ctx + k).map(i => `${i} [${inp[i]}] emuF ${E[i] && E[i][4]} emuPos ${E[i + 1] && E[i + 1].slice(2, 4)} | port ${P[i]}`);
  return `${name} pos ${d} od ${first} | klatki ${fd} od ${ff}\n` + rows(Math.min(first < 0 ? 1e9 : first, ff < 0 ? 1e9 : ff) % 1e9).join('\n');
};
// klatki a..b nagrania ze snapshotu (RNDAT) jak dbgRnd: wejscie, klatka i pozycja emulatora, port x, y, klatka + extra
window.dbgAt = async (name, a, b, extra = "''") => {
  const [lvl, x, y, ax, ay, idle, area, weapon, seed, total, snap] = RNDAT[name], S = rndSeq(seed, total);
  const E = await (await fetch('/work/dumps/' + name + '.json', {cache: 'no-store'})).json();
  const src = runAt.toString().replace("tr.push([Math.round(cam.x) - 48, Math.round(cam.y) - 48, pl.x, pl.y, pl.frame]);", "tr.push([pl.x, pl.y, pl.frame, " + extra + "]);");
  const P = await eval('(' + src + ')')(lvl, x, y, ax, ay, S, idle, area, weapon, SNAPPH[snap], name.includes('oc_'));
  const inp = []; for (const [n, h] of S) for (let i = 0; i < n; i++) inp.push(h.join('+'));
  const rows = []; for (let i = a; i < b; i++) rows.push(i + ' [' + inp[i] + '] emuF ' + E[i][4] + ' emuPos ' + E[i + 1].slice(2, 4) + ' | port ' + P[i].join(' '));
  return rows.join('\n');
};
// aktorzy w losowym nagraniu: emulator co 10 klatek {t, pl, acts: [[bob, x, y]]} (lista $176, seqActs w play.html), port
// po t klatkach tej samej sekwencji; dla kazdego aktora emulatora najblizszy aktor portu (do 24 px). Wynik: pierwsze chwile
// z brakami / przesunieciami
// oc: nagranie z procesorem 4x (T.seqActs) - aktorzy jak gracz: port po t - 1 klatkach = emulator po t
window.cmpRndActors = async (name, lvl, seed, total, maxRows = 12, frame0 = SNAPPH[LVLSNAP[lvl]][0], phase0 = SNAPPH[LVLSNAP[lvl]][1], oc = name.includes('oca_')) => {
  const S = Object.assign(rndSeq(seed, total), {invuln: true});
  const E = await (await fetch('/work/dumps/' + name + '.json', {cache: 'no-store'})).json();
  const steps = []; for (const [n, h] of S) for (let i = 0; i < n; i++) steps.push(h);
  window.saveGame = () => true;
  await startLevel(lvl); Object.assign(game, {lives: 3, dying: null, exitWave: 0, pfFade: null, anyLatch: false}); pl.dyOff = 0; game.checkpoint = null; game.weapon = 'start'; respawn(); game.state = null; pl.face = 1; pl.latch = pl.fireLatch = false; game.frame = frame0; game.phase = phase0;
  const MAP = {RIGHT: 'ArrowRight', LEFT: 'ArrowLeft', UP: 'ArrowUp', DOWN: 'ArrowDown', FIRE: 'ControlLeft'}, out = [];
  let f = 0, bad = 0;
  for (const e of E) {
    let plx = pl.x, ply = pl.y;
    for (; f < e.t - oc; f++) { plx = pl.x; ply = pl.y; Object.values(MAP).forEach(c => keys[c] = false); (steps[f] || []).forEach(h => keys[MAP[h]] = true); game.life = 50; game.hurt = Math.max(game.hurt, 79); update(); follow(); }
    // aktorzy: port po t klatkach = emulator po t (petla glowna); gracz: port po t - 1 (joystick czytany klatke pozniej);
    // obiekty poziomu (L.objs) tez sa aktorami w oryginale
    const P = Actors.list.filter(a => !a.dead).map(a => [a.type, Math.round(a.x), Math.round(a.y)])
      .concat(L.objs.objects.filter(o => !o.taken && !o.off).map(o => ['obj' + o.type, Math.round(o.x), Math.round(o.y)]));
    const miss = [];
    for (const [b, x, y] of e.acts) {
      const m = P.map(p => [p, Math.abs(p[1] - x) + Math.abs(p[2] - y)]).sort((p, q) => p[1] - q[1])[0];
      if (m && m[0][0] === 'obj2f2fe2' && Math.abs(m[0][1] - x) <= 1 && m[0][2] - y >= 0 && m[0][2] - y <= 8) continue;   // dymek HELP nad klatka (losowy cykl)
      if (!m || m[1] > 24) miss.push(`${b}:${x},${y}!`); else if (m[1]) miss.push(`${b}:${x},${y}~${m[0][0]}:${m[0][1]},${m[0][2]}`);
    }
    if (oc) { plx = pl.x; ply = pl.y; }
    const plOk = e.pl[0] === plx && e.pl[1] === ply;
    if (miss.length || !plOk) { bad++; if (out.length < maxRows) out.push(`t${e.t} pl ${e.pl}${plOk ? '=' : '~' + plx + ',' + ply} ${e.acts.length}/${P.length} ` + miss.join(' ')); }
  }
  Object.values(MAP).forEach(c => keys[c] = false); game.state = null;
  return `${name}: ${bad}/${E.length} chwil z roznica\n` + out.join('\n');
};
// klatki a..b: wejscie, klatka emulatora, pozycja emulatora (przesuniecie 1) i port: x, y, klatka + wyrazenie extra
window.dbgRnd = async (name, a, b, extra = "''") => {
  setRespawn(name);
  const [lvl, seed, total] = RND[name], [frame0, phase] = SNAPPH[LVLSNAP[lvl]], S = Object.assign(rndSeq(seed, total), {invuln: true, frame0, phase});
  const E = await (await fetch('/work/dumps/' + name + '.json', {cache: 'no-store'})).json();
  const src = runSeq.toString().replace("tr.push([Math.round(cam.x) - 48, Math.round(cam.y) - 48, pl.x, pl.y]);", "tr.push([pl.x, pl.y, pl.frame, " + extra + "]);");
  const P = await eval('(' + src + ')')(lvl, S);
  const inp = []; for (const [n, h] of S) for (let i = 0; i < n; i++) inp.push(h.join('+'));
  const rows = []; for (let i = a; i < b; i++) rows.push(i + ' [' + inp[i] + '] emuF ' + E[i][4] + ' emuPos ' + E[i + 1].slice(2, 4) + ' | port ' + P[i].join(' '));
  return rows.join('\n');
};
// pierwsza roznica klatek nagrania z otoczeniem (dbgRnd)
window.nextDiff = async (name, extra, before = 8, after = 10) => {
  const r = await cmpRnd(name), ff = parseInt(r.split('klatki ')[1].split(' od ')[1]);
  return r.split('\n')[0] + '\n' + (ff >= 0 ? await dbgRnd(name, Math.max(0, ff - before), ff + after, extra) : '');
};
// pierwsza roznica pozycji nagrania z otoczeniem (dbgRnd)
window.posDiff = async (name, extra, before = 5, after = 4, from = 0) => {
  const r = await cmpRnd(name, 6, from), f = parseInt(r.split('pos ')[1].split(' od ')[1]);
  return r.split('\n')[0].replace(/\[\[.*?\]\]\]/g, '') + '\n' + (f >= 0 ? await dbgRnd(name, Math.max(0, f - before), f + after, extra) : '');
};
// wszystkie nagrania naraz (rnd, cmp_trace, cmp_at, klatki): tylko wiersze z roznicami
window.fullCheck = async () => {
  const o = []; for (const k of Object.keys(RND)) o.push((await cmpRnd(k)).split('\n')[0]);
  for (const k of Object.keys(RNDAT)) o.push((await cmpRndAt(k)).split('\n')[0]);
  game.doorExtra = game.doorBlack = undefined;   // dalej nagrania A500 (runSeq / runAt bez procesora 4x)
  const fr = [];
  for (const k of ['seq11_emu', 'seq12_emu', 'seq13_emu', 'seq3_emu', 'seq4_emu', 'seq5_emu', 'seq7_emu', 'seq9_emu', 'seq14_emu', 'seq15_emu', 'seq16_emu', 'jump1_emu', 'stomp1_emu']) {
    const r = (await cmpFrames(k)).split('\n'); if (!/ 0\/\d+$/.test(r[0])) fr.push(r.slice(0, 2).join(' / '));
  }
  return o.join('\n') + '\n' + (await runAll()).split('\n').filter(l => !/ 0\//.test(l)).join('\n') + '\n' +
    (await runAllAt()).split('\n').filter(l => !/pos 0\/\d+ \| frames 0$/.test(l)).join('\n') + '\nklatki: ' + fr.join('\n');
};
// nagrania emulatora z procesorem 4x (petla glowna bez zgubionych taktow - wzorzec dla portu): rnd*oc, rndRoc, seq14-16oc,
// rope1-3oc (T.restore, wasm_configure('CPU_OVERCLOCKING', '4'), T.seq)
window.ocCheck = async () => {
  const r = [];
  for (const k of Object.keys(RND).filter(k => k.includes('oc_'))) r.push((await cmpRnd(k)).split('\n')[0]);
  r.push((await cmpRndAt('rndRoc_emu')).split('\n')[0]);
  for (const [k, lvl, snap] of [['seq14', 3, 'L3'], ['seq15', 4, 'l4'], ['seq16', 2, 'L2']]) {
    const [f0, ph] = SNAPPH[snap], S = Object.assign(SEQS[k + '_emu'][1].slice(), {invuln: true, frame0: f0, phase: ph});
    r.push((await runsOf(lvl, S, k + 'oc_emu')).split('\n').slice(0, 2).join(' / '));
  }
  for (const k of ['rope1', 'rope2', 'rope3']) {
    const [lvl, x, y, ax, ay, idle, S, area, weapon] = SEQS_AT[k + '_emu'], P = await runAt(lvl, x, y, ax, ay, S, idle, area, weapon, SNAPPH.R3, true);
    const E = await (await fetch('/work/dumps/' + k + 'oc_emu.json')).json();
    let d = 0, first = -1, fd = 0;
    for (let i = 0; i + 1 < E.length && i < P.length; i++) { if (E[i + 1].slice(2, 4).join() !== P[i].slice(2, 4).join()) { d++; if (first < 0) first = i; } if (E[i][4] !== P[i][4]) fd++; }
    r.push(`${k}oc pos ${d} od ${first} klatki ${fd}`);
  }
  return r.join('\n');
};
// test awarii przed wypchnieciem: poziomy 1-4, losowe klawisze co 12 klatek, zycie podtrzymywane; klatki, woda, blad
window.crashTest = async (frames = 4000) => {
  window.saveGame = () => true;
  const K = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ControlLeft'], out = [];
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let lv = 1; lv <= 4; lv++) {
    await startLevel(lv); game.state = null; respawn(); game.state = null;
    let err = null, water = 0, n = 0;
    for (let f = 0; f < frames; f++) {
      if (f % 12 === 0) { K.forEach(k => keys[k] = false); K.forEach((k, i) => { if (rnd() < [0.5, 0.25, 0.25, 0.2, 0.2][i]) keys[k] = true; }); }
      game.life = 50; game.dying = 0; if (game.state && game.state !== 'reveal') game.state = null;
      try { update(); follow(); draw(); n++; } catch (e) { err = e.stack.split('\n').slice(0, 3).join(' | '); break; }
      if (pl.water) water++;
    }
    out.push('L' + lv + ' frames ' + n + ' water ' + water + ' x ' + pl.x + ' ' + (err || 'ok'));
  }
  K.forEach(k => keys[k] = false);
  return out.join('\n') + '\nmissing ' + JSON.stringify(Actors.missing);
};
