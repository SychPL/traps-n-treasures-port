// Zrzuty ekranu emulatora w wybranych klatkach sekwencji (play.html, po T.restore): PNG do work/dumps/<label>_<klatka>.png.
// eval(await (await fetch('work/cmp_rnd.js')).text()); eval(await (await fetch('work/probe_shots.js')).text());
// await probeShots(rndSeq(100038, 5000), [1915, 1925, 1960], 'c4')
window.probeShots = async (S, frames, label, invuln = true) => {
  const shots = await T.call(`
    const S = ${JSON.stringify(S)}, F = ${JSON.stringify(frames)}, last = Math.max(...F), out = {}; let t = 0;
    for (const [n, hold] of S) {
      if (t > last) break;
      hold.map(h => h === 'FIRE' ? '2PRESS_FIRE' : '2PULL_' + h).forEach(c => emit_joystick_cmd(c));
      for (let i = 0; i < n; i++, t++) {
        ${invuln ? 'Module._wasm_poke(0x30ccd8, 0); Module._wasm_poke(0x30ccd9, 0x50);' : ''} Module._wasm_execute_one_frame();
        if (F.includes(t)) { const p = Module._wasm_pixel_buffer(); out[t] = {w: HPIXELS, h: VPIXELS, px: new Uint8Array(Module.HEAPU8.buffer.slice(p, p + HPIXELS * VPIXELS * 4))}; }
      }
      emit_joystick_cmd('2RELEASE_X'); emit_joystick_cmd('2RELEASE_Y'); emit_joystick_cmd('2RELEASE_FIRE');
    }
    return out;`);
  const res = [];
  for (const [t, v] of Object.entries(shots)) {
    const c = document.createElement('canvas'); c.width = v.w; c.height = v.h;
    const img = new ImageData(new Uint8ClampedArray(v.px.buffer), v.w, v.h);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    c.getContext('2d').putImageData(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    res.push(t + ':' + (await fetch(`dump/${label}_${t}.png`, {method: 'POST', body: blob})).status);
  }
  return res.join(' ');
};
