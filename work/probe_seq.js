// Sonda w emulatorze (play.html): sekwencja jak T.seq w jednym wywolaniu, w klatkach [a, b) zapis slow pamieci.
// eval(await (await fetch('work/cmp_rnd.js')).text()); eval(await (await fetch('work/probe_seq.js')).text());
// await T.open('L3'); await T.restore('L3'); await T.call("wasm_configure('CPU_OVERCLOCKING','4'); return 1");
// R = await probeSeq(rndSeq(100033, 5000), 4660, 4690, [[0x30b8ae, 'w'], [0x9dd4, 'b'], [0x2eb222, 'w']])
// wynik: [klatka, x, y, klatka gracza, ...wartosci] - x, y i klatka jak w T.seq (po klatce emulatora)
window.probeSeq = (S, a, b, addrs, invuln = true) => T.call(`
  const l = a => (wasm_peek16(a) << 16 | wasm_peek16(a + 2)) >>> 0, s = a => wasm_peek16(a) << 16 >> 16;
  const rb = a => wasm_peek16(a & ~1) >> (a & 1 ? 0 : 8) & 255;
  const base = l(0x30cda4), idx = {}; for (let i = 0; i < 108; i++) { const v = l(base + 4 * i); if (v) idx[v] = i; }
  const S = ${JSON.stringify(S)}, A = ${JSON.stringify(addrs)}, o = []; let t = 0;
  for (const [n, hold] of S) {
    if (t >= ${b}) break;
    hold.map(h => h === 'FIRE' ? '2PRESS_FIRE' : '2PULL_' + h).forEach(c => emit_joystick_cmd(c));
    for (let i = 0; i < n; i++, t++) {
      ${invuln ? 'Module._wasm_poke(0x30ccd8, 0); Module._wasm_poke(0x30ccd9, 0x50);' : ''} Module._wasm_execute_one_frame();
      if (t >= ${a} && t < ${b}) o.push([t, s(0x30ca80), s(0x30ca82), idx[l(0x2f1804) - base] ?? -1, ...A.map(([p, k]) => k === 'b' ? rb(p) : k === 'l' ? l(p).toString(16) : s(p))]);
    }
    emit_joystick_cmd('2RELEASE_X'); emit_joystick_cmd('2RELEASE_Y'); emit_joystick_cmd('2RELEASE_FIRE');
  }
  return o;`);
