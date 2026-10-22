// Run with Playwright MCP browser_run_code_unsafe({filename: "I:/Projekty/pirat/work/test_compass.js"}).
// Exercises the real game in the browser; no game logic is replaced.
async page => {
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('http://127.0.0.1:8435/game/?level=1');
  await page.waitForFunction(() => typeof L !== 'undefined' && L && game.state === 'intro', null, {polling: 100});
  const results = await page.evaluate(async () => {
    const results = [], slot = 'compass-test', key = 'tnt.save.' + slot, previous = localStorage.getItem(key);
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const equal = (got, want, message) => assert(Object.is(got, want), `${message}: got ${got}, expected ${want}`);
    const test = async (name, run) => {
      try { await run(); results.push({name, pass: true}); }
      catch (e) { results.push({name, pass: false, error: e.message}); }
    };
    const fresh = async n => {
      game.checkpoint = null;
      await startLevel(n); game.state = 'pause';
      for (const code of Object.keys(keys)) keys[code] = false;
    };
    const collect = () => {
      const m = L.objs.objects.find(o => o.type === MAP);
      Object.assign(pl, {x: m.x, y: m.y, vx: 0, vy: 0}); pickups();
      assert(m.taken, 'map must be collected by the real pickup handler');
    };
    const load = async () => { assert(await loadGame(slot), 'saved game must load'); game.state = 'pause'; };
    try {
      await test('map pickup works through a full update in its actual area', async () => {
        await fresh(1); enterArea(100);
        const m = L.objs.objects.find(o => o.type === MAP);
        Object.assign(pl, {x: m.x, y: m.y, vx: 0, vy: 0, ground: false}); follow(true); update();
        assert(m.taken && game.compass, 'pickup must enable compass');
        equal(game.timeShow, 6000, 'level 1 escape time is 2 minutes at 50 Hz');
        equal(game.timer, 0, 'collecting the map must not start the escape countdown');
      });
      await test('compass animates for 30 ticks and points in eight directions with a 32 px dead zone', async () => {
        await fresh(1); enterArea(100); collect(); game.compassF = 0;
        for (let i = 0; i < 30; i++) compassTick();
        equal(game.compassSpin, 0, 'initial spin must finish'); equal(game.compassF, 6, '30 advances from north');
        const [x, y] = L.areas[L.areaId].target;
        for (const [dx, dy, want] of [[0, -40, 4], [40, -40, 5], [40, 0, 6], [40, 40, 7],
          [0, 40, 0], [-40, 40, 1], [-40, 0, 2], [-40, -40, 3], [0, 0, 0], [32, 32, 0], [-32, -32, 0]]) {
          pl.x = x + dx; pl.y = y + dy; compassTick(); equal(game.compassF, want, `direction at offset ${dx},${dy}`);
        }
      });
      await test('saving during the compass spin preserves the needle, spin and time', async () => {
        await fresh(1); enterArea(100); collect(); game.compassF = 0;
        for (let i = 0; i < 7; i++) compassTick();
        assert(saveGame(slot), 'save must succeed');
        game.compass = false; game.compassSpin = 0; game.compassF = 0; game.timeShow = 0;
        await load();
        assert(game.compass, 'compass must remain enabled after loading');
        equal(game.compassSpin, 23, 'remaining spin'); equal(game.compassF, 7, 'needle frame');
        equal(game.timeShow, 6000, 'displayed escape time');
        compassTick(); equal(game.compassF, 0, 'spin resumes at the next frame');
      });
      await test('older saves recover the compass from the collected map', async () => {
        await fresh(1); enterArea(100); collect();
        const d = snapshot();
        for (const name of ['compass', 'compassSpin', 'compassF', 'timeShow']) delete d.g[name];
        localStorage.setItem(key, JSON.stringify(d)); await load();
        assert(game.compass, 'already collected map must restore the compass in an old save');
        equal(game.timeShow, 6000, 'old saves must recover the displayed time');
        equal(game.compassSpin, 0, 'old saves must not replay the pickup animation');
      });
      await test('a map from a previous stage does not enable the compass in an older save', async () => {
        await fresh(2); game.maps = 1;
        const d = snapshot();
        for (const name of ['compass', 'compassSpin', 'compassF', 'timeShow']) delete d.g[name];
        localStorage.setItem(key, JSON.stringify(d)); await load();
        equal(game.compass, false, 'only the map collected in this stage enables compass');
        equal(game.timeShow, 0, 'time stays hidden until this stage map or escape');
      });
      await test('starting a new stage clears the compass animation and display', async () => {
        game.compass = true; game.compassSpin = 17; game.compassF = 5; game.timeShow = 6000;
        await fresh(2);
        equal(game.compass, false, 'compass'); equal(game.compassSpin, 0, 'spin');
        equal(game.compassF, 0, 'needle'); equal(game.timeShow, 0, 'time');
      });
      await test('all four stages provide map pickups, target coordinates and escape times', async () => {
        for (const [n, seconds] of [[1, 120], [2, 360], [3, 180], [4, 300]]) {
          await fresh(n); collect(); assert(game.compass, `stage ${n} pickup`);
          equal(game.timeShow, seconds * 50, `stage ${n} displayed time`);
          for (const [id, area] of Object.entries(L.areas)) {
            assert(area.target && area.target.length === 2 && area.target.every(Number.isFinite), `stage ${n} area ${id} target`);
          }
          hud();
        }
      });
      await test('collecting the map during escape preserves the running countdown', async () => {
        await fresh(1); game.timer = 2500; collect();
        equal(game.timer, 2499, 'escape continues through pickup'); equal(game.timeShow, 0, 'no replacement display timer');
        assert(game.compass, 'compass still activates');
      });
    } finally {
      if (previous === null) localStorage.removeItem(key); else localStorage.setItem(key, previous);
    }
    return results;
  });
  return {passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, results};
}
