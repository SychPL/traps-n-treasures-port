// Porownanie ruchu gracza port <-> emulator (ta sama sekwencja joysticka od startu etapu).
// Emulator (play.html, po T.boot()):  const E = []; for (const [n, h] of SEQ) for (const r of await T.trace(n, h, 0x30ca80, 4)) E.push(r);
//   await fetch('dump/<nazwa>.json', {method: 'POST', body: JSON.stringify(E)})     // [kamera x, y, gracz x, y] co klatke
// Port (/game/?level=n):  eval(await (await fetch('/work/cmp_trace.js')).text());
//   cmpTrace(n, SEQ, '<nazwa>') -> lista roznic; emulator czyta joystick klatke pozniej (shift 1)
window.runSeq = async (lvl, SEQ, invuln = SEQ.invuln) => {   // invuln: nietykalnosc co klatke jak T.seq(S, true)
  window.saveGame = () => true;
  await startLevel(lvl); Object.assign(game, {lives: 3, dying: null, exitWave: 0, pfFade: null, anyLatch: false}); pl.dyOff = 0; game.checkpoint = null; game.weapon = 'start'; respawn(); game.state = null; pl.face = 1; pl.latch = pl.fireLatch = false; game.frame = SEQ.frame0 ?? 1; game.phase = SEQ.phase ?? 2;   // takt aktorow i faza petli jak w snapshocie emulatora (poziom 1)
  const MAP = {RIGHT: 'ArrowRight', LEFT: 'ArrowLeft', UP: 'ArrowUp', DOWN: 'ArrowDown', FIRE: 'ControlLeft'}, tr = [];
  for (const [n, hold] of SEQ) {
    Object.values(MAP).forEach(c => keys[c] = false); hold.forEach(h => keys[MAP[h]] = true);
    for (let i = 0; i < n; i++) { game.life = 50; if (invuln) game.hurt = Math.max(game.hurt, 79); const btn = hold.includes('FIRE'), press = btn && !game.anyLatch; game.anyLatch = btn; if (game.pfFade) pfFadeTick(); else if (game.state === 'reveal') revealTick(); else if (game.state === 'msg') { game.msgShown++; msgInput(press); } else if (game.state !== 'gameover') update(); follow(); tr.push([Math.round(cam.x) - 48, Math.round(cam.y) - 48, pl.x, pl.y]); }   // po odrodzeniu plansza (jak petla gry)
  }
  Object.values(MAP).forEach(c => keys[c] = false); game.state = null;
  return tr;
};
// nagrane sekwencje (work/dumps/<nazwa>.json): poziom, kroki [klatki, kierunki]; runAll() porownuje wszystkie
const SEQ1 = [[80, ['RIGHT']], [30, []], [40, ['UP', 'RIGHT']], [40, []], [60, ['LEFT']], [20, ['DOWN']], [10, ['FIRE']], [30, []], [50, ['RIGHT']], [20, ['UP']], [60, []]];
window.SEQS = {
  seq12_emu: [1, [...SEQ1, [40, ['DOWN']], [60, []], [20, ['DOWN', 'RIGHT']], [40, ['RIGHT']], [60, []], [30, ['LEFT']], [40, []]]],
  seq3_emu: [1, [[6, []], [15, ['UP']], [60, []], [15, ['UP', 'LEFT']], [60, []], [8, ['RIGHT']], [15, ['UP', 'RIGHT']], [80, []]]],
  seq4_emu: [1, [[30, ['RIGHT']], [60, ['RIGHT', 'DOWN']], [40, []], [30, ['DOWN']], [50, []]]],
  seq5_emu: [2, [[10, []], [40, ['RIGHT']], [20, []], [60, ['UP']], [30, []], [40, ['LEFT']], [30, ['DOWN', 'LEFT']], [30, []], [20, ['DOWN']], [30, []], [40, ['RIGHT']], [15, ['UP', 'RIGHT']], [60, []]]],
  seq6_emu: [4, [[10, []], [60, ['RIGHT']], [30, []], [15, ['UP', 'RIGHT']], [50, []], [40, ['LEFT']], [20, []], [30, ['DOWN', 'RIGHT']], [30, []], [100, ['RIGHT']], [40, []]]],   // od 334 butelka pirata (los)
  seq9_emu: [1, [[40, ['RIGHT']], [200, ['DOWN']], [150, ['RIGHT', 'DOWN']], [100, ['DOWN']], [60, []]]],   // dno, sciana pod woda, krab i malze
  seq11_emu: [3, Object.assign([[10, []], [120, ['RIGHT']], [30, []], [40, ['LEFT']], [10, ['LEFT', 'FIRE']], [10, ['FIRE']], [40, ['RIGHT', 'FIRE']], [20, []], [30, ['LEFT']], [40, []]], {invuln: true})],   // schody, skrzynia (nietykalnosc: szczur); od 259 emulator widzi puszczenie FIRE takt przed RIGHT (probkowanie, RESEARCH)
  seq13_emu: [2, Object.assign([[700, ['RIGHT']], [30, []], [60, ['LEFT']], [20, ['UP', 'LEFT']], [60, []]], {invuln: true})],   // dlugi marsz poziomu 2 do sciany
  seq7_emu: [1, [[10, []], [8, ['FIRE']], [20, []], [12, ['RIGHT']], [6, ['RIGHT', 'FIRE']], [10, ['RIGHT']], [20, []], [3, ['UP']], [12, []], [10, ['FIRE']], [30, []], [3, ['UP', 'RIGHT']], [8, ['RIGHT']], [4, ['DOWN', 'RIGHT']], [4, ['UP', 'RIGHT']], [60, ['RIGHT']], [40, []]]],
  jump1_emu: [1, Object.assign([[10, []], [10, ['RIGHT']], [3, ['UP', 'RIGHT']], [60, ['RIGHT']], [20, []], [10, ['LEFT']], [3, ['UP', 'LEFT']], [50, ['LEFT']], [20, []]], {invuln: true})],   // skoki z kierunkiem (nagranie z klatka: T.seq)
  stomp1_emu: [1, Object.assign([[5, []], [3, ['UP']], [6, []], [3, ['FIRE']], [40, []], [3, ['UP', 'FIRE']], [40, []]], {invuln: true})],
  // ze snapshotow L3 / L4 / L2 (T.restore, T.seq(S, true)): smierc od upadku, dlugi marsz twierdzy, zsuniecie w kucki i skok pod sciane
  seq14_emu: [3, Object.assign([[10, []], [200, ['RIGHT']], [3, ['UP', 'RIGHT']], [120, ['RIGHT']], [40, []], [100, ['LEFT']], [3, ['UP', 'LEFT']], [60, ['LEFT']], [40, []]], {invuln: true})],
  seq15_emu: [4, Object.assign([[10, []], [300, ['RIGHT']], [3, ['UP', 'RIGHT']], [200, ['RIGHT']], [30, []], [60, ['LEFT']], [40, []]], {invuln: true})],
  seq16_emu: [2, Object.assign([[10, []], [250, ['RIGHT']], [60, ['DOWN']], [120, ['RIGHT']], [3, ['UP', 'RIGHT']], [80, ['RIGHT']], [40, []]], {invuln: true})],   // FIRE w skoku i UP+FIRE naraz: poza 8 bez zmiany toru
};
window.runAll = async () => { const o = []; for (const [name, [lvl, S]] of Object.entries(SEQS)) o.push(await runsOf(lvl, S, name)); return o.join('\n'); };
// skrot: liczba roznych klatek i pierwsze odcinki roznic (od-do: emu / port)
window.runsOf = async (lvl, SEQ, name) => {
  const d = await cmpTrace(lvl, SEQ, name), E = await (await fetch('/work/dumps/' + name + '.json')).json(), P = await runSeq(lvl, SEQ);
  const runs = [];
  for (const i of d.map(s => +s.split(':')[0])) { const r = runs[runs.length - 1]; if (r && i === r[1] + 1) r[1] = i; else runs.push([i, i]); }
  return name + ' ' + d.length + '/' + P.length + runs.slice(0, 8).map(([a, b]) => `\n${a}-${b}: emu ${E[a + 1].slice(0, 4)} port ${P[a]}`).join('');
};
// klatki animacji gracza: emulator ($2F1804 -> indeks w banku $30CDA4, piaty element nagrania <nazwa>f_emu) bez
// przesuniecia - oryginal ustawia animacje w klatce wcisniecia, a ruch dopiero w nastepnej
window.cmpFrames = async (key, name = key.replace('_emu', 'f_emu')) => {
  const [lvl, S] = SEQS[key], r = await fetch('/work/dumps/' + name + '.json'), E = (await (r.ok ? r : await fetch('/work/dumps/' + key + '.json')).json()).map(e => e[4]), P = [];
  if (E[0] === undefined) return name + ' bez klatek';
  const run = runSeq; window.runSeq = null;
  window.saveGame = () => true;
  await startLevel(lvl); Object.assign(game, {lives: 3, dying: null, exitWave: 0, pfFade: null, anyLatch: false}); pl.dyOff = 0; game.checkpoint = null; game.weapon = 'start'; respawn(); game.state = null; pl.face = 1; pl.latch = pl.fireLatch = false; game.frame = S.frame0 ?? 1; game.phase = S.phase ?? 2;   // takt aktorow i faza petli jak w snapshocie emulatora (poziom 1)
  const MAP = {RIGHT: 'ArrowRight', LEFT: 'ArrowLeft', UP: 'ArrowUp', DOWN: 'ArrowDown', FIRE: 'ControlLeft'};
  for (const [n, hold] of S) {
    Object.values(MAP).forEach(c => keys[c] = false); hold.forEach(h => keys[MAP[h]] = true);
    for (let i = 0; i < n; i++) { game.life = 50; if (S.invuln) game.hurt = Math.max(game.hurt, 79); update(); follow(); P.push(pl.frame); }
  }
  Object.values(MAP).forEach(c => keys[c] = false); game.state = null; window.runSeq = run;
  const runs = [];
  for (let i = 0; i < E.length && i < P.length; i++) if (E[i] !== P[i]) { const r = runs[runs.length - 1]; if (r && i === r[1] + 1) r[1] = i; else runs.push([i, i]); }
  return name + ' ' + runs.reduce((n, [a, b]) => n + b - a + 1, 0) + '/' + P.length +
    runs.slice(0, 12).map(([a, b]) => `\n${a}-${b}: emu ${E.slice(a, b + 1).join(',')} | port ${P.slice(a, b + 1).join(',')}`).join('');
};
// aktorzy: nagranie emulatora co 10 klatek {t, cam, pl, acts: [[bob, x, y]]} (T.actors), w porcie ta sama sekwencja;
// dla kazdego aktora emulatora najblizszy aktor portu (do 40 px) i roznica
window.cmpActors = async (lvl, SEQ, name, ignore = []) => {
  const E = await (await fetch('/work/dumps/' + name + '.json')).json(), ign = new Set(ignore), out = [];
  window.saveGame = () => true;
  await startLevel(lvl); Object.assign(game, {lives: 3, dying: null, exitWave: 0, pfFade: null, anyLatch: false}); pl.dyOff = 0; game.checkpoint = null; game.weapon = 'start'; respawn(); game.state = null; pl.face = 1; pl.latch = pl.fireLatch = false; game.frame = SEQ.frame0 ?? 1; game.phase = SEQ.phase ?? 2;   // takt aktorow i faza petli jak w snapshocie emulatora (poziom 1)
  const MAP = {RIGHT: 'ArrowRight', LEFT: 'ArrowLeft', UP: 'ArrowUp', DOWN: 'ArrowDown', FIRE: 'ControlLeft'}, steps = [];
  for (const [n, hold] of SEQ) for (let i = 0; i < n; i++) steps.push(hold);
  let f = 0;
  for (const e of E) {
    for (; f < e.t; f++) { Object.values(MAP).forEach(c => keys[c] = false); (steps[f] || []).forEach(h => keys[MAP[h]] = true); game.life = 50; update(); follow(); }
    const P = Actors.list.filter(a => !a.dead).map(a => [a.type, Math.round(a.x), Math.round(a.y)]);
    const row = e.acts.filter(a => !ign.has(a[0])).map(([b, x, y]) => {
      const m = P.map(p => [p, Math.abs(p[1] - x) + Math.abs(p[2] - y)]).sort((p, q) => p[1] - q[1])[0];
      return m && m[1] <= 40 ? `${b}:${x},${y}${m[1] ? '~' + m[0][0] + ':' + m[0][1] + ',' + m[0][2] : '='}` : `${b}:${x},${y}!`;
    });
    out.push(`t${e.t} pl ${e.pl}${e.pl[0] === pl.x && e.pl[1] === pl.y ? '=' : '~' + pl.x + ',' + pl.y} ` + row.join(' '));
  }
  Object.values(MAP).forEach(c => keys[c] = false); game.state = null;
  return out.join('\n');
};
window.cmpTrace = async (lvl, SEQ, name, shift = 1) => {
  const E = await (await fetch('/work/dumps/' + name + '.json')).json(), P = await runSeq(lvl, SEQ), out = [];
  for (let i = 0; i + shift < E.length && i < P.length; i++) if (E[i + shift].slice(0, 4).join() !== P[i].join()) out.push(`${i}: emu ${E[i + shift]} port ${P[i]}`);
  return out;
};
