// Sterowanie emulatorem z konsoli / automatu (ladowane przez play.html).
// Dziala tez przy ukrytej karcie: klatki liczone recznie (_wasm_execute_one_frame), ~8x szybciej niz Amiga.
//   await T.step(50, ['RIGHT','FIRE'])  - 50 klatek z wcisnietym joystickiem (port 2)
//   await T.mouse()                     - lewy przycisk myszy (cracktro)
//   await T.load(1)                     - wloz dysk 2 do df0 (bez okna wyboru)
//   await T.dump('nazwa')               - chip RAM -> work/dumps/nazwa_chip.bin
//   await T.shot('nazwa')               - bufor obrazu -> work/dumps/nazwa_WxH.rgba (work/shot2png.py)
window.T = {
  wait: ms => new Promise(r => setTimeout(r, ms)),
  // wykonuje skrypt w iframe emulatora i zwraca wynik
  call(script) {
    return new Promise(res => {
      const id = Math.random().toString(36).slice(2);
      const h = e => {
        if (e.data && e.data.msg === 'T' && e.data.id === id) { removeEventListener('message', h); res(e.data.v); }
      };
      addEventListener('message', h);
      emu(`const __r = await (async () => { ${script} })(); parent.postMessage({msg: 'T', id: '${id}', v: __r}, '*');`);
    });
  },
  step(n, hold = []) {
    const press = hold.map(h => h === 'FIRE' ? '2PRESS_FIRE' : '2PULL_' + h);
    const rel = hold.map(h => h === 'FIRE' ? '2RELEASE_FIRE' : (h === 'LEFT' || h === 'RIGHT') ? '2RELEASE_X' : '2RELEASE_Y');
    return this.call(`${press.map(c => `emit_joystick_cmd('${c}');`).join('')}
      for (let i = 0; i < ${n}; i++) Module._wasm_execute_one_frame();
      ${rel.map(c => `emit_joystick_cmd('${c}');`).join('')} return ${n};`);
  },
  mouse(n = 15) {
    return this.call(`Module._wasm_mouse_button(1,1,1); for (let i = 0; i < ${n}; i++) Module._wasm_execute_one_frame();
      Module._wasm_mouse_button(1,1,0); for (let i = 0; i < ${n}; i++) Module._wasm_execute_one_frame(); return 1;`);
  },
  drive() { return this.call(`return document.getElementById('drop_zone').textContent;`); },
  // n bajtow pamieci od addr jako slowa 16-bit
  rd(addr, n) { return this.call(`const o = []; for (let a = ${addr}; a < ${addr} + ${n}; a += 2) o.push(wasm_peek16(a)); return o;`); },
  // n klatek z wcisnietym joystickiem; po kazdej klatce n slow z addr (np. rekord gracza)
  trace(n, hold, addr, words = 64) {
    const press = hold.map(h => h === 'FIRE' ? '2PRESS_FIRE' : '2PULL_' + h);
    return this.call(`${press.map(c => `emit_joystick_cmd('${c}');`).join('')}
      const out = [];
      for (let i = 0; i < ${n}; i++) { Module._wasm_execute_one_frame(); const r = [];
        for (let a = ${addr}; a < ${addr} + ${2 * words}; a += 2) r.push(wasm_peek16(a) << 16 >> 16); out.push(r); }
      emit_joystick_cmd('2RELEASE_X'); emit_joystick_cmd('2RELEASE_Y'); emit_joystick_cmd('2RELEASE_FIRE');
      return out;`);
  },
  // aktywni aktorzy (obiekty na ekranie): struktura z BOB-em @+$0A i x,y @+$0E/+$10 (fast $290000-$2B0000)
  actors() {
    return this.call(`const out = [];
      const hdr = a => { if (a < 0x1000 || a >= 0x80000) return false; const w = wasm_peek16(a), h = wasm_peek16(a + 2);
        return w > 0 && w <= 96 && h > 0 && h <= 96 && wasm_peek16(a + 22) === ((w + 15) >> 4) * 2 * h; };
      for (let a = 0x290000; a < 0x2b0000; a += 2) {
        const p = (wasm_peek16(a + 10) << 16 | wasm_peek16(a + 12)) >>> 0;
        if (hdr(p)) { const x = wasm_peek16(a + 14), y = wasm_peek16(a + 16); if (x < 8640 && y < 768) out.push([a, p, x, y]); }
      }
      return out;`);
  },
  // zywi aktorzy z listy gry ($176: naglowek, ln_Succ) - bez struktur usunietych, ktore skan actors() tez znajduje
  live() {
    return this.call(`const l = a => (wasm_peek16(a) << 16 | wasm_peek16(a + 2)) >>> 0, o = [];
      for (let n = l(0x176), k = 0; k < 400 && l(n); k++, n = l(n)) o.push([n, l(n + 10), wasm_peek16(n + 14), wasm_peek16(n + 16)]);
      return o;`);
  },
  // plyniecie w prawo przy dnie; co 'every' klatek zapis aktorow. Zwraca slownik BOB -> pozycje
  async explore(frames = 6000, every = 50, player = 0x2aac14) {
    const seen = {}, path = [];
    let lastX = -1, stuck = 0;
    for (let f = 0; f < frames; f += every) {
      const pos = await this.rd(player + 0x0e, 4);
      if (pos[0] === lastX) stuck++; else stuck = 0;
      lastX = pos[0];
      await this.step(every, stuck > 3 ? ['RIGHT', 'UP'] : ['RIGHT', 'DOWN']);
      for (const [a, p, x, y] of await this.actors()) (seen[p.toString(16)] ||= []).push([f, a.toString(16), x, y]);
      path.push(pos);
    }
    return {seen, path};
  },
  // przejazd przez poziom: gracz przesuwany zapisem (x += dx/kl., y staly), kamera gry podaza sama;
  // zycie podtrzymywane (chip $13114-$1311A); co 'every' klatek zapis aktorow -> {bob: [[klatka, x, y]]}
  // y: liczba albo tablica y (stopy) na kolumne kafli - np. wolna sciezka z mapy (work/sweep_path_lvl1.json)
  async sweep(x0, x1, y, dx = 2, every = 50, P = this.P, A4 = this.A4) {
    const seen = {}, ys = JSON.stringify(Array.isArray(y) ? y : null), y0 = Array.isArray(y) ? y[x0 >> 4] : y;
    const move = n => this.call(`const w = (a, v) => { v &= 0xffff; Module._wasm_poke(a, v >> 8 & 255); Module._wasm_poke(a + 1, v & 255); };
      const ys = ${ys};
      for (let i = 0; i < ${n}; i++) {
        const x = Math.min(${x1}, wasm_peek16(${P}+0x0e) + ${dx});
        const cy = wasm_peek16(${P}+0x10), ty = ys ? ys[x >> 4] : ${y0};
        const ny = cy + Math.max(-2, Math.min(2, ty - cy));
        for (const a of [${P}+0x0e, ${A4}+4]) w(a, x); for (const a of [${P}+0x10, ${A4}+6]) w(a, ny);
        for (const a of [0x13114, 0x13116, 0x13118]) w(a, 5); w(0x1311a, 3);
        Module._wasm_execute_one_frame();
      }
      return wasm_peek16(${P}+0x0e);`);
    await this.call(`const w = (a, v) => { v &= 0xffff; Module._wasm_poke(a, v >> 8 & 255); Module._wasm_poke(a + 1, v & 255); };
      for (const a of [${P}+0x0e, ${P}+0x12, ${A4}+4]) w(a, ${x0}); for (const a of [${P}+0x10, ${P}+0x14, ${A4}+6]) w(a, ${y0}); return 1;`);
    for (let f = 0, x = x0; x < x1; f += every) {
      x = await move(every);
      for (const [a, p, ax, ay] of await this.actors()) if (ax > 0 && ay > 0 && a !== P) (seen[p.toString(16)] ||= []).push([f, ax, ay]);
    }
    return seen;
  },
  // uklad pamieci rozni sie miedzy uruchomieniami: A4 = zmienne globalne (wymiary mapy $0030,$021C pod A4+$20),
  // gracz = wskaznik pod A4+$30. Wynik w T.A4 / T.P (uzywaja go walkTo, sweep, put).
  async locate() {
    // ponytail: zakres $300000-$320000 wystarcza dla poziomu 1 (A4 byl $30CA80 albo $319370); szerzej gdy nie znajdzie
    const r = await this.call(`for (let a = 0x300000; a < 0x320000; a += 2) if (wasm_peek16(a) === 0x30 && wasm_peek16(a + 2) === 0x21c) {
        const A4 = a - 0x20; return [A4, (wasm_peek16(A4 + 0x30) << 16 | wasm_peek16(A4 + 0x32)) >>> 0]; }
      return null;`);
    if (r) [this.A4, this.P] = r;
    return r && r.map(v => v.toString(16));
  },
  // przesuwanie gracza do (tx, ty) zapisem pozycji (max 2 px/kl. w kazdej osi), zycie podtrzymywane;
  // ty = null -> y zostaje fizyce gry. Kamera gry podaza, bo gracz jest caly czas widoczny.
  walkTo(tx, ty = null, frames = 4000, sp = 1, P = this.P, A4 = this.A4) {
    return this.call(`const w = (a, v) => { v &= 0xffff; Module._wasm_poke(a, v >> 8 & 255); Module._wasm_poke(a + 1, v & 255); };
      let i = 0;
      emit_joystick_cmd(${tx} > wasm_peek16(${P}+0x0e) ? '2PULL_RIGHT' : '2PULL_LEFT');   // gra rusza kamera tylko przy ruchu gracza
      for (; i < ${frames}; i++) {
        let x = wasm_peek16(${P}+0x0e), y = wasm_peek16(${P}+0x10);
        const dx = Math.max(-${sp}, Math.min(${sp}, ${tx} - x)), dy = ${ty === null ? 0 : `Math.max(-${sp}, Math.min(${sp}, ${ty} - y))`};
        if (!dx && !dy) break;
        x += dx; y += dy;
        for (const a of [${P}+0x0e, ${A4}+4]) w(a, x); ${ty === null ? '' : `for (const a of [${P}+0x10, ${A4}+6]) w(a, y);`}
        for (const a of [0x13114, 0x13116, 0x13118]) w(a, 5); w(0x1311a, 3);
        Module._wasm_execute_one_frame();
      }
      emit_joystick_cmd('2RELEASE_X');
      return [i, wasm_peek16(${P}+0x0e), wasm_peek16(${P}+0x10), (wasm_peek16(${A4}) << 16 >> 16) + 48, wasm_peek16(${A4}+2) + 48];`);
  },
  // klawisz Amigi (kod surowy: F1-F10 $50-$59, HELP $5F, Enter $44, Space $40, [ $1A, ] $1B)
  key(code, frames = 6) {
    return this.call(`wasm_schedule_key(${code}, 0, 1, 0); for (let i = 0; i < ${frames}; i++) Module._wasm_execute_one_frame();
      wasm_schedule_key(${code}, 0, 0, 1); for (let i = 0; i < ${frames}; i++) Module._wasm_execute_one_frame(); return 1;`);
  },
  // od zera do startu poziomu 1 (po start() w play.html i wlozeniu dysku 1); ~15 s
  // until = 'map' zatrzymuje na mapie wyspy (przed tekstem etapu)
  async boot(until = null) {
    await this.call(`insert_file(0); return 1;`);
    await this.step(500); await this.mouse(15); await this.step(1500);
    const colSum = base => this.call(`let s = 0; for (let a = ${base}; a < ${base} + 4 * 700; a += 4) {
      const r = wasm_peek16(a), v = wasm_peek16(a + 2); if (r === 0xFFFF) break; if (r >= 0x180 && r <= 0x1be) s += v; } return s;`);
    for (let k = 0; k < 10; k++) {                       // intro -> tytul (paleta tytulu w copper @$71B4)
      if (await colSum(0x71b4) && !(await colSum(0x73a8))) break;
      await this.step(20, ['FIRE']); await this.step(150);
    }
    await this.step(20, ['FIRE']); await this.step(1800);  // -> "insert disk B"
    await this.load(1); await this.step(50); await this.step(15, ['FIRE']); await this.step(800);
    for (let i = 0; i < 4; i++) { await this.step(5, ['FIRE']); await this.step(60); }   // hall of fame / credits
    await this.step(400);
    if (until === 'map') return this.drive();
    await this.step(5, ['FIRE']); await this.step(800);           // mapa wyspy -> tekst etapu
    await this.step(5, ['FIRE']); await this.step(900);
    await this.step(5, ['FIRE']); await this.step(400);                                 // "press button" -> gra
    return this.drive();
  },
  // sekwencja [[klatki, kierunki]] -> co klatke [kamera x, y, gracz x, y, klatka gracza] (porownanie: work/cmp_trace.js)
  async seq(S, invuln = false) {                    // invuln: nietykalnosc $30CCD8 co klatke (wrogowie nie zmieniaja toru gracza)
    const E = [];
    for (const [n, hold] of S) E.push(...await this.call(`const press = ${JSON.stringify(hold)}.map(h => h === 'FIRE' ? '2PRESS_FIRE' : '2PULL_' + h);
      press.forEach(c => emit_joystick_cmd(c)); const o = [];
      const l = a => (wasm_peek16(a) << 16 | wasm_peek16(a + 2)) >>> 0, s = a => wasm_peek16(a) << 16 >> 16;
      const base = l(0x30cda4), idx = {}; for (let i = 0; i < 108; i++) { const v = l(base + 4 * i); if (v) idx[v] = i; }
      for (let i = 0; i < ${n}; i++) { ${invuln ? 'Module._wasm_poke(0x30ccd8, 0); Module._wasm_poke(0x30ccd9, 0x50);' : ''} Module._wasm_execute_one_frame(); const f = idx[l(0x2f1804) - base];
        o.push([s(0x30ca80), s(0x30ca82), s(0x30ca84), s(0x30ca86), f ?? -1]); }
      emit_joystick_cmd('2RELEASE_X'); emit_joystick_cmd('2RELEASE_Y'); emit_joystick_cmd('2RELEASE_FIRE'); return o;`));
    return E;
  },
  // jak seq, ale co 10 klatek gracz i aktorzy z listy $176: {t, pl: [x, y], acts: [[adres, x, y]]} (work/cmp_rnd.js cmpRndActors)
  async seqActs(S, invuln = false) {
    const E = []; let t = 0;
    for (const [n, hold] of S) {
      E.push(...await this.call(`const press = ${JSON.stringify(hold)}.map(h => h === 'FIRE' ? '2PRESS_FIRE' : '2PULL_' + h);
        press.forEach(c => emit_joystick_cmd(c)); const o = [];
        const l = a => (wasm_peek16(a) << 16 | wasm_peek16(a + 2)) >>> 0, s = a => wasm_peek16(a) << 16 >> 16, P = l(0x30cab0);
        for (let i = 1; i <= ${n}; i++) { ${invuln ? 'Module._wasm_poke(0x30ccd8, 0); Module._wasm_poke(0x30ccd9, 0x50);' : ''} Module._wasm_execute_one_frame();
          if ((${t} + i) % 10) continue;
          const acts = []; for (let q = l(0x176), k = 0; k < 200 && l(q); k++, q = l(q)) if (q !== P) acts.push([q, s(q + 14), s(q + 16)]);
          o.push({t: ${t} + i, pl: [s(0x30ca84), s(0x30ca86)], acts}); }
        emit_joystick_cmd('2RELEASE_X'); emit_joystick_cmd('2RELEASE_Y'); emit_joystick_cmd('2RELEASE_FIRE'); return o;`));
      t += n;
    }
    return E;
  },
  // snapshot calej Amigi w iframe (szybki powrot): T.snap('a') / T.restore('a') - restore wykonuje jeszcze 2 klatki
  snap(name) { return this.call(`const j = JSON.parse(wasm_take_user_snapshot()); window.SNAP_${name} = new Uint8Array(Module.HEAPU8.buffer, j.address, j.size).slice(); wasm_delete_user_snapshot(); return 1;`); },
  restore(name) { return this.call(`if (!window.SNAP_${name}) return 0; wasm_loadfile('snap.vAmiga', window.SNAP_${name}); for (let i = 0; i < 2; i++) Module._wasm_execute_one_frame(); return 1;`); },
  // snapshot na dysk i z powrotem (work/dumps/snap_<name>.vAmiga; L1 = start poziomu 1, L4 = start poziomu 4)
  async save(name) { return (await fetch(`dump/snap_${name}.vAmiga`, {method: 'POST', body: await this.call(`return window.SNAP_${name};`)})).status; },
  async open(name) {
    const b = new Uint8Array(await (await fetch(`work/dumps/snap_${name}.vAmiga`)).arrayBuffer());
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return this.call(`window.SNAP_${name} = Uint8Array.from(atob('${btoa(s)}'), c => c.charCodeAt(0)); return window.SNAP_${name}.length;`);
  },
  // polecenie konsoli RetroShell (debugger vAmiga); wynik pojawia sie po klatce
  sh(cmd, frames = 1) {
    return this.call(`wasm_retro_shell(${JSON.stringify(cmd)}); for (let i = 0; i < ${frames}; i++) Module._wasm_execute_one_frame();
      return wasm_retro_shell_get_text().slice(-6000);`);
  },
  async load(i) {
    await insert(DISKS[i]); await this.wait(1500);
    return this.call(`insert_file(0); return 'df0: ' + ${JSON.stringify(DISKS[i].name)};`);
  },
  // chip RAM -> <label>_chip.bin, fast RAM (konfiguracja AROS: 2 MB od $200000, tam laduje kod gry) -> <label>_fast.bin
  async dump(label) {
    const m = await this.call(`const rd = (base, n) => { const b = new Uint8Array(n);
        for (let a = 0; a < n; a += 2) { const w = wasm_peek16(base + a); b[a] = w >> 8; b[a + 1] = w & 255; } return b; };
      const fs = wasm_get_access_fast_size();
      return {chip: rd(0, wasm_get_access_chip_size()), fast: fs ? rd(wasm_get_fast_base() >>> 0, fs) : null};`);
    let st = (await fetch('dump/' + label + '_chip.bin', {method: 'POST', body: m.chip})).status;
    if (m.fast) st = (await fetch('dump/' + label + '_fast.bin', {method: 'POST', body: m.fast})).status;
    return st;
  },
  async shot(label) {
    const v = await this.call(`const p = Module._wasm_pixel_buffer();
      return {w: HPIXELS, h: VPIXELS, px: new Uint8Array(Module.HEAPU8.buffer.slice(p, p + HPIXELS * VPIXELS * 4))};`);
    return (await fetch(`dump/${label}_${v.w}x${v.h}.rgba`, {method: 'POST', body: v.px})).status;
  }
};
