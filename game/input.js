'use strict';
// Pad (Gamepad API) i sterowanie dotykowe: oba wysylaja zdarzenia klawiatury, wiec gra, menu, sklep i tryb foto
// dzialaja bez zmian. Pad: krzyzak/lewa galka = strzalki, A = skok (spacja), B/X = miecz (X), Start = pauza (Esc),
// Select = opcje (O), LB = tryb foto (P), Y = narzedzie (T), RB = nastepne narzedzie (Tab). Dotyk: przyciski w kolorach HUD-u, tylko na ekranach dotykowych.
(() => {
  const held = {};
  // zrodlo (pad/dotyk) + kod: zmiana stanu -> keydown/keyup z kodem klawisza
  const press = (src, code, on) => {
    if (!!held[src + code] === on) return;
    held[src + code] = on;
    dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', {code}));
  };

  const PAD = {0: 'Space', 1: 'KeyX', 2: 'KeyX', 3: 'KeyT', 5: 'Tab', 9: 'Escape', 8: 'KeyO', 4: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight'};
  const CODES = [...new Set(Object.values(PAD))];
  (function poll() {
    const p = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
    if (p) {
      const want = {}, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      for (const [i, code] of Object.entries(PAD)) if (p.buttons[i] && p.buttons[i].pressed) want[code] = true;
      if (ax < -0.5) want.ArrowLeft = true; if (ax > 0.5) want.ArrowRight = true;
      if (ay < -0.5) want.ArrowUp = true; if (ay > 0.5) want.ArrowDown = true;
      for (const code of CODES) press('pad', code, !!want[code]);
    }
    requestAnimationFrame(poll);
  })();

  // przyciski dotykowe tylko, gdy nie ma touch.js (klasa 'touch' na <html> - wlasne sterowanie dotykowe APK)
  if (!matchMedia('(pointer: coarse)').matches || document.documentElement.classList.contains('touch')) return;
  const css = document.createElement('style');
  css.textContent = `.tb{position:fixed;z-index:20;width:64px;height:64px;border:3px solid #fb5;border-radius:12px;
    background:rgba(51,0,68,.55);color:#fb5;font:bold 22px monospace;display:flex;align-items:center;justify-content:center;
    user-select:none;-webkit-user-select:none;touch-action:none}.tb.on{background:rgba(255,187,85,.45);color:#fff}
    .tb.s{width:52px;height:36px;font-size:13px;border-radius:8px}`;
  document.head.append(css);
  for (const [code, label, pos, small] of [
    ['ArrowLeft', '◀', 'left:6px;bottom:96px'], ['ArrowRight', '▶', 'left:142px;bottom:96px'],
    ['ArrowUp', '▲', 'left:74px;bottom:164px'], ['ArrowDown', '▼', 'left:74px;bottom:28px'],
    ['Space', 'A', 'right:100px;bottom:60px'], ['KeyX', 'B', 'right:24px;bottom:110px'], ['KeyT', 'T', 'right:100px;bottom:150px'],
    ['Tab', '⇄', 'right:30px;bottom:196px', 1],
    ['Escape', 'II', 'right:16px;top:12px', 1], ['KeyO', 'OPT', 'right:76px;top:12px', 1], ['KeyP', 'FOTO', 'right:136px;top:12px', 1]]) {
    const el = document.createElement('div');
    el.className = small ? 'tb s' : 'tb'; el.textContent = label; el.style.cssText += pos;
    const set = on => e => { e.preventDefault(); el.classList.toggle('on', on); press('touch', code, on); };
    el.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, set(false));
    document.body.append(el);
  }
})();
