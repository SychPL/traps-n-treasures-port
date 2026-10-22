// Porownanie z emulatorem od dowolnego miejsca: snapshot emulatora z graczem przestawionym w (x, y) i kamera gry A4 = (ax, ay)
// (work/dumps/snap_<n>.vAmiga, w emulatorze: T.open(n); T.restore(n); T.seq(S, true) -> work/dumps/<nazwa>.json).
// Port (/game/?level=1): eval(await (await fetch('/work/cmp_at.js')).text()); await cmpAt('rope1_emu') albo runAllAt()
window.runAt = async (lvl, x, y, ax, ay, S, idle = 2, area, weapon, ph, oc = false) => {   // oc: nagranie z procesorem 4x (przejscie drzwiami szybciej)   // ph: [game.frame, game.phase] na starcie sekwencji (SNAPPH)   // area: obszar (granice kamery) jak wpisane w emulatorze; weapon: $30CD50
  window.saveGame = () => true;
  await startLevel(lvl); Object.assign(game, {lives: 3, dying: null, exitWave: 0, pfFade: null, anyLatch: false, doorExtra: oc ? 0 : undefined, doorBlack: oc ? 8 : undefined}); pl.dyOff = 0; game.state = null; game.checkpoint = null; respawn(); game.state = null; if (area) { const [id, wy] = String(area).split(':'); enterArea(id); if (wy) L.waterY = +wy; } game.weapon = weapon || 'start';   // area 'obszar:woda' - snapshot z graczem przestawionym bez przejscia (woda obszaru startu, I4: 453)
  pl.x = x; pl.y = y; pl.vy = 0; pl.face = 1; cam.x = ax + 48; cam.y = ay + 48; pl.latch = pl.fireLatch = false;
  const MAP = {RIGHT: 'ArrowRight', LEFT: 'ArrowLeft', UP: 'ArrowUp', DOWN: 'ArrowDown', FIRE: 'ControlLeft'}, tr = [];
  Object.values(MAP).forEach(c => keys[c] = false);
  for (let i = 0; i < idle; i++) { game.life = 50; update(); follow(); }   // snapshot po ustawieniu + 2 klatki T.restore
  game.frame = ph ? ph[0] : 1; if (ph) game.phase = ph[1];   // takt jak w snapshocie (inaczej zalezy od poprzedniego przebiegu)
  for (const [n, hold] of S) {
    Object.values(MAP).forEach(c => keys[c] = false); hold.forEach(h => keys[MAP[h]] = true);
    for (let i = 0; i < n; i++) {                       // jak petla frame(): wygaszanie i odslanianie po drzwiach bez update()
      game.life = 50; game.hurt = Math.max(game.hurt, 79);
      const btn = hold.includes('FIRE'), press = btn && !game.anyLatch; game.anyLatch = btn;   // okienko tekstu: FIRE po puszczeniu (jak petla gry)
      if (game.pfFade) pfFadeTick(); else if (game.state === 'reveal') revealTick(); else if (game.state === 'msg') { game.msgShown++; msgInput(press); } else { update(); follow(); if (game.fadeIn > 0) game.fadeIn--; }
      tr.push([Math.round(cam.x) - 48, Math.round(cam.y) - 48, pl.x, pl.y, pl.frame]);
    }
  }
  Object.values(MAP).forEach(c => keys[c] = false); game.state = null;
  return tr;
};
// nagrania: [poziom, x, y, A4 x, A4 y, klatki przed sekwencja, sekwencja, obszar]; R3 = poziom 3 przy linach nad kolcami
const R3 = [3, 340, 527, 180, 368, 32];
window.SEQS_AT = {
  rope1_emu: [...R3, [[5, []], [20, ['RIGHT']], [30, ['UP', 'RIGHT']], [40, ['UP']], [20, []], [30, ['DOWN']], [20, ['RIGHT']], [60, []]]],
  rope2_emu: [...R3, [[5, []], [20, ['RIGHT']], [16, ['UP', 'RIGHT']], [10, ['RIGHT']], [10, []], [20, ['UP']], [5, []], [3, ['RIGHT']], [10, ['UP', 'RIGHT']], [30, ['RIGHT']], [20, []], [10, ['FIRE']], [20, []], [60, ['DOWN']], [40, []]]],   // od 223 zjazd w kolce (nie odwzorowany)
  rope3_emu: [...R3, [[5, []], [20, ['RIGHT']], [16, ['UP', 'RIGHT']], [6, []], [10, ['UP']], [4, []], [6, ['LEFT']], [8, ['FIRE']], [12, []], [4, ['LEFT', 'FIRE']], [10, []], [3, ['LEFT']], [8, ['UP', 'LEFT']], [40, ['LEFT']], [30, []]]],
  // I4 = poziom 4, obszar 262 (w emulatorze tez granice kamery A4+$18..$1E = 1888, 176, 4640, 364), przed lodem x 3216-3504
  // D4 = poziom 4 przed drzwiami x 1360-1407 (kafle 15925 / 15927 -> obszar 262, 2464, 399)
  door1_emu: [4, 1340, 399, 1180, 279, 32, [[5, []], [16, ['RIGHT']], [20, []], [10, ['UP']], [30, []], [5, ['FIRE']], [200, []], [30, ['RIGHT']], [30, []]]],   // FIRE po puszczeniu UP = cios
  door2_emu: [4, 1340, 399, 1180, 279, 32, [[5, []], [16, ['RIGHT']], [20, []], [20, ['UP']], [5, ['UP', 'FIRE']], [10, ['UP']], [250, []], [30, ['RIGHT']], [30, []]]],
  door3_emu: [4, 1340, 399, 1180, 279, 32, [[5, []], [16, ['RIGHT']], [20, []], [20, ['UP']], [5, ['UP', 'FIRE']], [10, ['UP']], [5, []], [150, ['RIGHT']], [30, []]]],   // sterowanie od klatki 100
  // bron: w emulatorze $30CD50 = start $2EA95C, miecz $2EAA3C, morgensztern $2EABFC, szabla $2EAE9C (snapshot D4)
  ...Object.fromEntries(['start', 'sword', 'morning_star', 'crooked_sword'].map(w => ['weap_' + w + '_emu', [4, 1340, 399, 1180, 279, 32, [[5, []], [3, ['FIRE']], [40, ['RIGHT']], [20, []]], null, w]])),
  // C2 = poziom 2 przy klatce wieznia (560, 144): UP tylem, FIRE uwalnia; potem UP+FIRE naraz = skok z poza ciosu w powietrzu
  cage1_emu: [2, 556, 159, 400, 32, 32, [[5, []], [20, ['UP']], [5, ['UP', 'FIRE']], [40, ['UP']], [60, []], [5, ['UP', 'FIRE']], [40, []]]],
  ice1_emu: [4, 3200, 399, 3040, 279, 32, [[5, []], [40, ['RIGHT']], [40, []], [30, ['LEFT']], [30, []], [10, ['RIGHT']], [3, ['UP', 'RIGHT']], [30, ['RIGHT']], [40, []], [60, ['LEFT']], [40, []]], '262'],
};
// pozycje z przesunieciem 1 (emulator czyta joystick klatke pozniej), klatki animacji bez przesuniecia
window.cmpAt = async name => {
  const [lvl, x, y, ax, ay, idle, S, area, weapon] = SEQS_AT[name], P = await runAt(lvl, x, y, ax, ay, S, idle, area, weapon), E = await (await fetch('/work/dumps/' + name + '.json')).json();
  const d = [], f = [];
  for (let i = 0; i + 1 < E.length && i < P.length; i++) if (E[i + 1].slice(2, 4).join() !== P[i].slice(2, 4).join()) d.push(i);
  for (let i = 0; i < E.length && i < P.length; i++) if (E[i][4] !== P[i][4]) f.push(i);
  const runs = a => { const r = []; for (const i of a) { const l = r[r.length - 1]; if (l && i === l[1] + 1) l[1] = i; else r.push([i, i]); } return r; };
  return name + ' pos ' + d.length + '/' + P.length + runs(d).slice(0, 6).map(([a, b]) => ` [${a}-${b}: emu ${E[a + 1].slice(2, 4)} port ${P[a].slice(2, 4)}]`).join('') +
    ' | frames ' + f.length + runs(f).slice(0, 8).map(([a, b]) => ` [${a}-${b}: emu ${E.slice(a, b + 1).map(e => e[4])} port ${P.slice(a, b + 1).map(p => p[4])}]`).join('');
};
window.runAllAt = async () => { const o = []; for (const k of Object.keys(SEQS_AT)) o.push(await cmpAt(k)); return o.join('\n'); };
