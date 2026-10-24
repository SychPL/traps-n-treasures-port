'use strict';
// Demo pack running (no files from the player's own disks yet): a bar at the top offers to load the two ADF files
// right on the game page - ../extractor/extract.js builds the game's files in the browser and stores them for sw.js,
// then the page reloads with the original game. Nothing is uploaded. Not in the Android app (files in the APK).
(() => {
  if (window.Capacitor || !location.protocol.startsWith('http')) return;
  const T = {
    en: ['Demo pack. To play the original game, load your two ADF disk images (PSG release).', 'Load ADF disks',
      'or drop them here', 'Building the game files from the disks (up to a minute)...', 'Both disks are needed (disk 1 and disk 2 of the PSG release).',
      'Done - starting the original game...'],
    pl: ['Pakiet demo. Żeby zagrać w oryginalną grę, wczytaj obie swoje dyskietki ADF (wersja PSG).', 'Wczytaj dyskietki ADF',
      'albo upuść je tutaj', 'Składanie plików gry z dyskietek (do minuty)...', 'Potrzebne są obie dyskietki (dysk 1 i dysk 2 wersji PSG).',
      'Gotowe - uruchamiam oryginalną grę...'],
  };
  const t = i => (T[typeof langCode === 'string' && T[langCode] ? langCode : (navigator.language || '').startsWith('pl') ? 'pl' : 'en'])[i];
  let bar, msg, busy = false;

  async function load(files) {
    files = [...files].filter(f => /\.adf$/i.test(f.name));
    if (!files.length || busy) return;
    busy = true; msg.textContent = t(3);
    try {
      const X = await import('../extractor/extract.js'), log = s => console.log('[disks] ' + s);
      const disks = await X.readDisks(await Promise.all(files.map(async f => ({name: f.name, data: new Uint8Array(await f.arrayBuffer())}))), log);
      if (!disks[1] || !disks[2]) throw new Error(t(4));
      const out = X.extractFrom(disks, log);
      if (out.length < X.COMPLETE) throw new Error(`${out.length} / ${X.COMPLETE} files - see the browser console`);
      await X.storeInCache(out, new URL('assets/', location.href).href);
      msg.textContent = t(5);
      const u = new URL(location.href); u.searchParams.delete('assets'); location.replace(u);   // ?assets=demo would hide them again
    } catch (e) { msg.textContent = e.message; busy = false; }
  }

  function show() {
    bar = document.createElement('div');
    bar.id = 'disks';
    bar.innerHTML = '<span></span> <label><input type="file" accept=".adf" multiple hidden><b></b></label> <i></i> <a href="#">×</a>';
    msg = bar.querySelector('span'); msg.textContent = t(0);
    bar.querySelector('b').textContent = t(1); bar.querySelector('i').textContent = t(2);
    bar.querySelector('input').onchange = e => load(e.target.files);
    bar.querySelector('a').onclick = e => { e.preventDefault(); bar.remove(); };
    document.body.appendChild(bar);
    addEventListener('dragover', e => { e.preventDefault(); bar.classList.add('drop'); });
    addEventListener('dragleave', () => bar.classList.remove('drop'));
    addEventListener('drop', e => { e.preventDefault(); bar.classList.remove('drop'); load(e.dataTransfer.files); });
  }

  // demo: the engine chose assets-demo/ (no service worker yet, no game/assets on the server) or sw.js served
  // the demo pack in place of the missing files (X-TNT-Demo); without a service worker the engine reads the stored
  // files from Cache Storage itself (BLOBS in main.js)
  assetsReady.then(async () => {
    const demo = !BLOBS?.['level1.json'] && (ASSETS === 'assets-demo/' || await fetch('assets/level1.json', {cache: 'no-store'}).then(r => r.headers.has('X-TNT-Demo'), () => false));
    for (let i = 0; i < 30 && !(typeof LANG === 'object' && LANG._name); i++) await new Promise(r => setTimeout(r, 100));   // texts in the game's language
    if (demo) show();
  });
})();
