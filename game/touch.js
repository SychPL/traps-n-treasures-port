'use strict';
// sterowanie dotykowe (telefon, APK z Capacitora): krzyzak i przyciski wysylaja te same zdarzenia klawiszy co klawiatura,
// wiec gra, menu i odblokowanie dzwieku (Music.init przy keydown) dzialaja bez zmian. Tylko ekrany dotykowe (albo ?touch).
// Klasa 'touch' na <html> przelacza fit() w main.js na wypelnianie ekranu - dlatego ten plik laduje sie przed main.js.
(() => {
  if (!matchMedia('(pointer: coarse)').matches && !new URLSearchParams(location.search).has('touch')) return;
  document.documentElement.classList.add('touch');
  const css = document.createElement('style');
  css.textContent = `
    .touch #info { display: none }
    #touch { position: fixed; inset: 0; z-index: 20; pointer-events: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent }
    #touch > * { position: absolute; pointer-events: auto; touch-action: none; display: flex; align-items: center; justify-content: center;
      border: 2px solid rgba(255,187,85,.5); border-radius: 50%; background: rgba(51,0,68,.35); color: rgba(255,187,85,.8); font: bold 6vmin sans-serif }
    #touch > .on { background: rgba(255,187,85,.35) }
    #touch > [hidden] { display: none }
    #touch i { position: absolute; font-style: normal; pointer-events: none }
    #tpad { left: calc(3vmin + env(safe-area-inset-left)); bottom: 5vmin; width: 34vmin; height: 34vmin }
    #tfire { right: calc(20vmin + env(safe-area-inset-right)); bottom: 5vmin; width: 16vmin; height: 16vmin }
    #tjump { right: calc(3vmin + env(safe-area-inset-right)); bottom: 19vmin; width: 16vmin; height: 16vmin }
    #tuse, #tnext, #tpause, #tcont { width: 10vmin; height: 10vmin; font-size: 4vmin }
    #tuse { right: calc(3vmin + env(safe-area-inset-right)); bottom: 40vmin }
    #tnext { right: calc(15vmin + env(safe-area-inset-right)); bottom: 40vmin }
    #tpause { right: calc(3vmin + env(safe-area-inset-right)); top: 3vmin }
    #tcont { left: calc(3vmin + env(safe-area-inset-left)); top: 3vmin }`;
  document.head.append(css);
  const ui = document.createElement('div');
  ui.id = 'touch';
  ui.innerHTML = '<div id="tpad"><i style="top:4%">&#9650;</i><i style="bottom:4%">&#9660;</i><i style="left:7%">&#9664;</i><i style="right:7%">&#9654;</i></div>' +
    '<div id="tfire" data-k="KeyX">&#9876;</div><div id="tjump" data-k="Space">&#9650;</div>' +
    '<div id="tuse" data-k="KeyT">T</div><div id="tnext" data-k="Tab">&#8644;</div>' +
    '<div id="tpause" data-k="Escape">&#10074;&#10074;</div><div id="tcont" data-k="KeyC">C</div>';
  document.body.append(ui);
  const pad = ui.querySelector('#tpad');

  // krzyzak: kierunek z kata wzgledem srodka, 8 wycinkow po 45 stopni (skosy = skok w bok), martwe pole w srodku
  const DIRS = [['ArrowRight'], ['ArrowRight', 'ArrowDown'], ['ArrowDown'], ['ArrowDown', 'ArrowLeft'],
    ['ArrowLeft'], ['ArrowLeft', 'ArrowUp'], ['ArrowUp'], ['ArrowUp', 'ArrowRight']];
  function padCodes(x, y) {
    const r = pad.getBoundingClientRect(), dx = x - r.left - r.width / 2, dy = y - r.top - r.height / 2;
    return Math.hypot(dx, dy) < r.width * 0.12 ? [] : DIRS[Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) & 7];
  }
  // kazdy palec osobno: zaczal na krzyzaku -> trzyma krzyzak (takze poza nim), inaczej przycisk pod palcem (mozna przesunac kciuk)
  const ptrs = new Map(), held = new Set();
  const send = (type, code) => dispatchEvent(new KeyboardEvent(type, {code, key: code, bubbles: true, cancelable: true}));
  function sync() {
    const now = new Set([...ptrs.values()].flatMap(p => p.codes));
    for (const c of held) if (!now.has(c)) { held.delete(c); send('keyup', c); }
    for (const c of now) if (!held.has(c)) { held.add(c); send('keydown', c); }
    for (const b of ui.querySelectorAll('[data-k]')) b.classList.toggle('on', held.has(b.dataset.k));
  }
  function move(e) {
    const p = ptrs.get(e.pointerId), b = !p.pad && document.elementFromPoint(e.clientX, e.clientY)?.closest('#touch [data-k]');
    p.codes = p.pad ? padCodes(e.clientX, e.clientY) : b && !b.hidden ? [b.dataset.k] : [];
    sync();
  }
  ui.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, {pad: !!e.target.closest('#tpad'), codes: []}); move(e); });
  ui.addEventListener('pointermove', e => { if (ptrs.has(e.pointerId)) move(e); });
  for (const t of ['pointerup', 'pointercancel']) ui.addEventListener(t, e => { ptrs.delete(e.pointerId); sync(); });
  ui.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('blur', () => { ptrs.clear(); sync(); });

  // przyciski zalezne od stanu: narzedzia tylko w grze, gdy jakies sa; C (kontynuacja z autozapisu) na ekranie tytulowym
  const use = ui.querySelector('#tuse'), next = ui.querySelector('#tnext'), cont = ui.querySelector('#tcont');
  setInterval(() => {
    use.hidden = next.hidden = game.state !== null && game.state !== 'dark' || !game.tool;   // w ciemnosci lampa (SPACJA w oryginale)
    let auto = false; try { auto = localStorage.getItem('tnt.save.auto') !== null; } catch (e) {}
    cont.hidden = game.state !== 'title' || !auto;
  }, 250);
})();
