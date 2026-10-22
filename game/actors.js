'use strict';
// Aktorzy (wrogowie) jak w oryginale: skrypty animacji i ruchu GAME EXEC wykonywane 1:1
// (interpreter w chip $21B2, ruch po sciezce $2240, tablica rozkazow $1CA0) + zachowania natywne
// przepisane z kodu gry (patrol $2EE86A, krab $2EE50E, miecznik $2EC3D4, skok $2EF6C8, rozgwiazda $2EEE52).
// Dane: work/export_actors.py -> assets/level1_actors.json, actors_surface.png, actors_water.png.
// Takt aktorow = 25 Hz (co druga klatka gry). Wspolrzedne: x,y = punkt zaczepienia BOB-a (stopy).
// makeActors(opts): osobne instancje (poziom, mapa wyspy); opts.absPos: rozkazy $0EFE/$10FE ustawiaja polozenie
const makeActors = (opts = {}) => {
  let D, mem, index, list = [], gflags = 0;
  const pokes = {};

  // --- pamiec skryptow (okna chip/fast ze zrzutu) ---
  function load(data) {
    D = data;
    mem = data.mem.map(([a, hex]) => ({a, b: Uint8Array.from(hex.match(/../g), h => parseInt(h, 16))}));
    index = {};
    data.order.forEach((a, i) => { index[parseInt(a, 16)] = i; });
  }
  function rb(a) {
    for (const m of mem) if (a >= m.a && a < m.a + m.b.length) return m.b[a - m.a];
    return 0;
  }
  const missing = new Set();                          // nieobslugiwane procedury natywne / co takt (podglad: Actors.missing)
  const rw = a => rb(a) << 8 | rb(a + 1);
  const rws = a => rw(a) << 16 >> 16;
  const rl = a => (rw(a) << 16 | rw(a + 2)) >>> 0;
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * Math.max(1, hi - lo));

  // klatka -> BOB: i-ty BOB liczac od bazy (rozkaz 'base' $FFB6)
  function bob(a) {
    if (a.base === undefined) return null;
    const i = index[a.base];
    return i === undefined ? null : D.frames[D.order[i + a.frame]];
  }

  // --- rozkazy wspolne dla animacji (licznik petli +$6A, uspienie +$46) i sciezki (+$6C, +$48) ---
  // c = kontekst {blk, off, loop, sleep}; zwraca true = koniec na ten takt
  function op(a, c, w) {
    const p = c.blk + c.off + 2;
    if ((w & 0xff) === 0xfe) { a.f[w >> 8] = rw(p); c.off += 4; return false; }
    if ((w & 0xff) === 0xfc) {
      a.f[w >> 8] = rl(p); c.off += 6;
      if (w >> 8 === 0x7a && a.born && TICKS[a.f[0x7a]]) { a.beh = TICKS[a.f[0x7a]]; BEH[a.beh].init(a); }   // np. kropla: $2EF930
      else if (w >> 8 === 0x7a && a.born && !BEH[a.beh]) missing.add('tick ' + a.f[0x7a].toString(16) + ' ' + a.type);
      return false;
    }
    switch (w) {
      case 0xfffa: c.off = 0; return false;                          // od poczatku bloku
      case 0xfff8: return true;                                      // stop (aktor zostaje)
      case 0xfff6: a.dead = true; return true;                       // usun aktora
      case 0xfff4: a.layer = rws(p); c.off += 4; return false;      // warstwa ze znakiem ($FF81 = -127: najglebiej)
      case 0xfff2: gflags |= rw(p); c.off += 4; return false;
      case 0xfff0: if (gflags & rw(p)) { gflags &= ~rw(p); c.off += 4; return false; } return true;
      case 0xffee: c.off += 10; (NATIVE[rl(p)] || (() => missing.add('native ' + rl(p).toString(16) + ' ' + a.type)))(a, rl(p + 4)); return false;   // kod natywny (znane procedury), d0 = argument
      case 0xffec: case 0xffea:
        if (gflags & rw(p)) c.off += 6; else c.off -= rw(p + 2); return false;
      case 0xffe8: case 0xffe6: pokes[rl(p)] = rw(p + 4); c.off += 8; return false;
      case 0xffe4: pokes[rl(p)] = rl(p + 4); c.off += 10; return false;
      case 0xffe2: a.pcount = rw(p); c.off += 4; return false;       // liczba bajtow listy (dx, dy) sciezki
      case 0xffe0: c.off += 6; setAnim(a, rl(p), a.delay); return c === a.anim;   // nowy blok animacji
      case 0xffde: startPath(a, rl(p)); c.off += 6; return false;
      case 0xffdc: c.off += 12; return false;                        // okno przycinania
      case 0xffda: a.base = rl(p); c.off += 6; return false;
      case 0xffd8: a.pdelay = rw(p) & 255; a.pcnt = 0; c.off += 4; return false;
      case 0xffd6: a.delay = rw(p) & 255; a.cnt = 0; c.off += 4; return false;
      case 0xffd4: c.off += 4; return false;                         // priorytet
      case 0xffd2: c.loop = rw(p); c.off += 4; return false;
      case 0xffd0:
        if (c.loop === 0xffff || --c.loop !== 0) c.off -= rw(p); else c.off += 4;
        return false;
      case 0xffce: a.flags |= rw(p); c.off += 4; return false;
      case 0xffcc: if (a.flags & rw(p)) { a.flags &= ~rw(p); c.off += 4; return false; } return true;
      case 0xffca: c.sleep = rw(p); c.off += 4; return false;
      case 0xffc8: c.sleep = rnd(rw(p), rw(p + 2)); c.off += 6; return false;
      case 0xffc6: c.off += 6; if (!(a.flags & 0x2000)) spawnScript(rl(p), a.x, a.y); return false;   // nowy aktor
      case 0xffc4: a.frame = rnd(rw(p), rw(p + 2)); c.off += 6; return true;
      case 0xffc2: {                                                 // plynny ruch do (x, y) w n krokach (1/16 px)
        const n = rws(p + 4);
        a.glide = {n, x: a.x * 16, y: a.y * 16, dx: Math.trunc((rws(p) - a.x) * 16 / n), dy: Math.trunc((rws(p + 2) - a.y) * 16 / n)};
        c.off += 8; return false;
      }
      case 0xffc0: c.off += 6; return false;                         // dzwiek
      case 0xffbe: a.remap = {t: rl(p), mul: rw(p + 4), add: rw(p + 6)}; c.off += 10; return false;
      case 0xffbc: a.frame = rw(p); a.target = rws(p + 2); c.off += 6; return false;
      case 0xffba: c.blk = rl(p); c.off = 0; return false;
      case 0xffb8: case 0xffb4:                                      // nowy aktor w (x + dx, y + dy)
        c.off += 10; spawnScript(rl(p), a.x + rws(p + 4), a.y + rws(p + 6)); return false;
      case 0xffb6: a.base = (D.banks[rl(p + 4).toString(16)] || 0) + rl(p); c.off += 10; return false;
      case 0xffb2: c.off += 4; return false;
      case 0xffb0: c.off += 8; return false;
      case 0xffae: case 0xffac: c.off += 4; return false;
    }
    console.warn('nieznany rozkaz skryptu', w.toString(16), 'w', (c.blk + c.off).toString(16));
    a.anim.blk = 0; return true;
  }

  // animacja: wywolywana co takt; co a.delay taktow jeden krok skryptu ($2188-$223E)
  function animTick(a) {
    const c = a.anim;
    if (!c.blk || ++a.cnt < a.delay) return;
    a.cnt = 0;
    for (let guard = 0; guard < 64; guard++) {
      if (c.sleep > 0) { c.sleep--; return; }
      if (a.target >= 0) {
        if (a.frame !== a.target) { a.frame += a.frame < a.target ? 1 : -1; return; }
        a.target = -1;
      }
      const w = rw(c.blk + c.off);
      if (w < 0x8000 && (w & 0xff) !== 0xfe && (w & 0xff) !== 0xfc) {
        a.frame = a.remap ? rw(a.remap.t + w * a.remap.mul + a.remap.add) : w;
        c.off += 2; return;
      }
      if (op(a, c, w) || a.dead) return;
    }
  }
  function setAnim(a, blk, delay = 1) {
    Object.assign(a.anim, {blk, off: 0, loop: 0, sleep: 0});
    a.delay = delay || 1; a.cnt = a.delay - 1; a.target = -1;
  }

  // ruch po sciezce ($2240): lista (dx, dy) albo kierunek (bity: 1 lewo, 2 prawo, 4 gora, 8 dol) x powtorzenia
  function startPath(a, blk, delay, speed) {                // $1CFA / jsr $2D8(a6): sciezka, co ile taktow, ile krokow
    Object.assign(a.path, {blk, off: 0, loop: 0, sleep: 0});
    a.pcnt = 0; a.pcount = 0; a.prep = 0; a.pdir = 0;
    if (delay !== undefined) { a.pdelay = delay; a.f[0x42] = speed; }
  }
  function pathTick(a) {
    const c = a.path;
    if (!c.blk || ++a.pcnt < a.pdelay) return;
    a.pcnt = 0;
    const mx = a.flags & 0x100 ? -1 : 1, my = a.flags & 0x200 ? -1 : 1, speed = a.f[0x42] || 0;
    for (let guard = 0; guard < 64; guard++) {
      if (c.sleep > 0) { c.sleep--; return; }
      // speed razy: kolejna para (dx, dy) z listy; pusta lista -> polecenia ponizej
      let i = 0;
      for (; i < speed && a.pcount > 0; i++) {
        a.x += mx * rws(c.blk + c.off); a.y += my * rws(c.blk + c.off + 2);
        c.off += 4; a.pcount -= 4;
      }
      if (i === speed) return;
      if (a.glide && a.glide.n > 0) {
        const g = a.glide; g.n--; g.x += g.dx; g.y += g.dy; a.x = g.x >> 4; a.y = g.y >> 4; return;
      }
      if (a.prep > 0) {
        a.prep--;
        const s = speed * mx * my;
        if (a.pdir & 1) a.x -= s; if (a.pdir & 2) a.x += s; if (a.pdir & 4) a.y -= s; if (a.pdir & 8) a.y += s;
        return;
      }
      const w = rw(c.blk + c.off);
      if (w < 0x8000 && (w & 0xff) !== 0xfe && (w & 0xff) !== 0xfc) {
        a.pdir = w; a.prep = rw(c.blk + c.off + 2); c.off += 4; continue;
      }
      if (op(a, c, w) || a.dead) return;
    }
  }

  // --- zachowania natywne (pole $7A aktora), parametry z rekordu obiektu (zasieg, dystans, predkosc) ---
  const pl = () => Actors.player;
  function faceAnim(a) {                                    // $2EE05C: blok lewo (+$1E) albo prawo (+$22)
    const b = a.brain, blk = b.v < 0 ? a.anims['1e'] : a.anims['22'];
    if (blk) setAnim(a, blk);
  }
  function patrol(a, steps = 1) {                           // $2EE86A
    const b = a.brain;
    if (b.stun > 0) { b.stun--; return; }
    for (let i = 0; i < steps; i++) {
      if (b.dist < 0) { b.dist = b.range; b.v = -b.v; faceAnim(a); return; }
      b.dist -= Math.abs(b.v); a.x += b.v;
    }
  }
  // grawitacja ze skokiem i odbiciem ($2EF6C8): 0 = wyladowal, -1 = odbil sie, 1 = w powietrzu
  function physics(a) {
    const b = a.brain, f = bob(a), pass = a.beh === 'clam' || a.beh === 'starfish';
    let n = b.iter;
    if (a.y > L.waterY) n = ((n - 1) >> 1) + 1;              // pod linia wody obszaru: polowa krokow ($2EF6F0)
    for (let i = 0; i < n; i++) {
      let vy = b.vy;
      if (vy >= 0) {
        // podloga przy przejsciu przez krawedz kafla ($2F4D90, fizyka $2EF5D0: przedmioty, beczki, maczugi...); tylko $2EF6C8
        // (malz, rozgwiazda) sprawdza $2F4DF2 - pod woda przepuszcza platformy jednostronne ($100)
        const t = attr(a.x, a.y + vy);
        if (t & FLOOR && !(pass && a.y >= L.waterY && t & 0x100) && ((a.y + vy) & ~15) !== (a.y & ~15)) {
          const v2 = Math.min(vy, b.cap) - 1;
          if (v2 <= 0) { a.y = ((a.y + vy) & ~15) - 1; b.vy = 0; return 0; }
          b.vy = -v2; b.acc = 0; a.y = (a.y + vy) & ~15; return -1;
        }
      } else if (attr(a.x, a.y - (f ? f[5] : 8) + vy) & CEIL) { b.vy = 0; b.acc = 0; return 1; }
      a.y += vy;
      if (b.acc <= 0) { b.acc = 4; if (vy < 5) vy++; }
      b.acc--; b.vy = vy;
    }
    return 1;
  }
  // $2EC9AA: chod z grawitacja (8 px/takt bez podloza), zawraca na krawedzi i przy scianie (ramka +$62/+$66)
  function roam(a) {
    const b = a.brain;
    if (b.stun > 0) { b.stun--; return; }
    if (!(attr(a.x, a.y + 1) & FLOOR)) { a.y += 8; return; }
    const f = bob(a), l = f ? -f[4] : -8, r = f ? f[2] - f[4] : 8;
    const edge = b.v > 0 ? r : l, wall = b.v > 0 ? r + 4 : l - 6;
    if (!(attr(a.x + edge, a.y + 1) & FLOOR) || attr(a.x + wall, a.y) & WALL) { b.v = -b.v; faceAnim(a); }
    a.x += b.v;
  }
  function climbWalk(a, b) {                              // $2ECA6C
    if (b.stun > 0) { b.stun--; return; }
    if (b.path) return;                                   // stopien albo rzut w toku (sciezka, koniec: native $2EEB00 / $2EDD30)
    const f = bob(a), l = f ? -f[4] : -8, r = f ? f[2] - f[4] : 8, at = (dx, dy) => attr(a.x + dx, a.y + dy);
    if (!(at(l, 1) & FLOOR) && !(at(r, 1) & FLOOR)) { a.y += 8; return; }
    const turn = () => { b.v = -b.v; faceAnim(a); b.t = 15 + Math.floor(Math.random() * 30); };
    const right = b.v >= 0, e = right ? r : l, w = right ? r + 4 : l - 6;
    if (!(at(e, 1) & FLOOR)) {
      if (at(e, 17) & FLOOR) { startPath(a, right ? 0x2f2b52 : 0x2f2bda, 1, 1); b.path = true; return; }
      turn();
    } else if (at(w, 0) & WALL) {
      if (!(at(w, -16) & WALL)) { startPath(a, right ? 0x2f2b96 : 0x2f2c1e, 1, 1); b.path = true; return; }
      turn();
    }
    a.x += b.v;
    if (b.t > 0) { b.t--; return; }
    const d = pl().x - a.x;
    if ((d > 0 && b.v < 0) || (d <= 0 && b.v > 0)) turn(); else b.t = 30;
  }
  const w16 = v => v << 16 >> 16;
  // zapadnie, sciany i kraty czytaja bajt stanu (dzwignia, zamek, kombinacja): 1 otwarte, 2 zamkniete
  const flag = a => Actors.flags[a.state] | 0;
  const GHOST_V = [2, 2, 2, 2, 2, 1, 2, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, -2, -1, -2, -2, -2, -2, -2];   // chip $BCAC
  const BEH = {
    roamer: {init(a) { a.brain = {v: -3, stun: 0}; faceAnim(a); }, tick: roam},   // $2EC476
    ghoul: {                                                // $2EC750: jedno z 4 miejsc (p2), rusza w strone gracza na 50-150 taktow
      init(a) {
        const k = Math.floor(Math.random() * 4);
        if (a.p2 > 0xffff) { a.x = rws(a.p2 + 4 * k); a.y = rws(a.p2 + 4 * k + 2); }
        a.brain = {wake: 1, wait: 50, walk: 50 + Math.floor(Math.random() * 100), v: 2, stun: 0};
      },
      tick(a) {
        const b = a.brain;
        if (b.wake > 0 && --b.wake === 0) { b.v = pl().x < a.x ? -2 : 2; setAnim(a, a.anims[b.v < 0 ? '26' : '2a']); }
        if (b.wait > 0) { b.wait--; return; }
        if (b.walk > 0) { b.walk--; roam(a); return; }
        b.wait = 100; setAnim(a, a.anims[b.v < 0 ? '2e' : '32']);
      }
    },
    trapdoor: {                                             // $2ED41E: zapadnia/most wg bajtu stanu
      init(a) { const s = flag(a); a.brain = {s}; if (s === 1) setAnim(a, 0x300ac8); else if (s === 2) setAnim(a, 0x300acc); },
      tick(a) {
        const s = flag(a), b = a.brain;
        if (s === 1 && b.s !== 1) { b.s = 1; setAnim(a, 0x300ada, 2); }
        else if (s === 2 && b.s !== 2) { b.s = 2; setAnim(a, 0x300ad0, 2); }
      }
    },
    vanish: {                                               // $2ED2EC: sciana znika (animacja do konca skryptu), gdy stan = 1
      init(a) { a.brain = {}; if (flag(a) !== 1) setAnim(a, 0x300a86); },
      tick(a) { if (!a.brain.gone && flag(a) === 1) { a.brain.gone = true; setAnim(a, 0x300a8e, 3); } }
    },
    bob: {                                                  // $2EE19C: gora-dol o zasieg (p2: dx, dy, zasieg, licznik, predkosc)
      init(a) {
        const p = a.p2; a.x += rws(p); a.y += rws(p + 2);
        a.brain = {range: rws(p + 4), dist: rws(p + 6), v: rws(p + 8)}; faceAnim(a);
      },
      tick(a) {
        const b = a.brain;
        if (b.dist < 0) { b.dist = b.range; b.v = -b.v; faceAnim(a); return; }
        b.dist -= Math.abs(b.v); a.y += b.v;
      }
    },
    skull: {                                                // $2EEF64: podskakuje w miejscu (skok = p2)
      init(a) { const j = w16(a.p2); a.brain = {jump: j, vy: j, acc: 0, cap: 9, iter: 2}; },
      tick(a) { if (physics(a) < 0) a.brain.vy = a.brain.jump; }
    },
    roller: {                                               // $2EED08: toczy sie (p2 = predkosc), odbija od scian, spada
      init(a) {                                             // procedura startowa konczy sie jednym taktem ($2EED4A)
        a.brain = {vx: w16(a.p2), vy: 0, acc: 0, cap: 6, iter: 3};
        setAnim(a, a.brain.vx < 0 ? 0xb376 : 0xb388);
        this.tick(a);
      },
      tick(a) {
        const b = a.brain;
        physics(a);
        if (b.vx) {                                         // sonda $2F4F5C przy krawedzi ramki ($62 / $66) w y - 1 i w gorze ramki (+$64)
          const f = bob(a), edge = b.vx < 0 ? (f ? f[6] : -8) : (f ? f[8] : 8), x = a.x + edge + b.vx;
          if (attr(x, a.y - 1) & WALL || attr(x, a.y - 1 + (f ? f[7] : 0)) & WALL) { b.vx = -b.vx; setAnim(a, b.vx < 0 ? 0xb376 : 0xb388); }
          a.x += b.vx;
        }
        if (attr(a.x, a.y - 8) & 0x200) {                 // kafel z bitem 9: rozbija sie (aktor $B58A), najpierw $7E z indeksem kafla
          if (a.onSmash) a.onSmash(((a.y - 8) >> 4) * L.w + (a.x >> 4));
          spawnScript(0xb58a, (a.x & ~15) + 8, ((a.y - 8) & ~15) + 15); a.dead = true;
        }
      }
    },
    mace: {                                                 // $2ECF94/$2ECF04: podnosi sie o p2 px, spada z odbiciem, znowu w gore
      init(a) { a.brain = {vy: 0, acc: 0, cap: 3, iter: 2, rise: 0, top: w16(a.p2), slow: a.beh === 'mace', half: 0}; },
      tick(a) {
        const b = a.brain;
        if (b.rise > 0) {
          if (b.slow && (b.half ^= 1)) return;
          a.y--; b.rise--; return;
        }
        a.y += 5; const r = physics(a); a.y -= 5;
        if (r < 0) sound(a, 'bounce'); else if (r === 0) b.rise = b.top;
      }
    },
    get macefast() { return this.mace; },                // $2ECF04: to samo, ale wznosi sie co takt
    guard: {init(a) {}, tick(a) { if (Actors.escape) a.dead = true; }},
    dropper8: {init(a) {}, tick(a) {                        // $2EF9D2: spada 8 px na takt o dystans +$A0, potem na kafel (y & ~15) + 1
      const d = (a.f[0xa0] = w16((a.f[0xa0] || 0) - 8)) - 8;
      if (d > 0) { a.y += 8; return; }
      a.beh = null; a.f[0x7a] = 0; a.y = ((a.y + 8) & ~15) + 1;
      startPath(a, 0x2e1010, 1, 1); setAnim(a, 0x308932, 2);
    }},
    raindrop: {init(a) {}, tick(a) {                         // $2EBA1A: kropla deszczu (sciezka -2, +7 na takt); podloga przy y + 7 ($2F4D90)
      const ny = a.y + 7;                                     // albo linia wody obszaru -> plusk $30802E (klatki 1-3, opoznienie 2)
      if (a.beh === 'raindrop' && attr(a.x, ny) & FLOOR && (ny & ~15) !== (a.y & ~15)) a.y = ny & ~15;   // $2EBA2E (szybka, -2 / +10, z przodu): bez podlogi
      else if (L.waterY < 99999 && L.waterY <= ny) a.y = L.waterY;
      else return;
      a.path.blk = 0; a.beh = null; a.f[0x7a] = 0; setAnim(a, 0x30802e, 2);
    }},
    get raindropw() { return this.raindrop; },
    dartwait: {init(a) {}, tick(a) {                        // $2EBC46: po zwloce rzutka $300E54 (w lewo) / $300E90 (w prawo)
      if (a.wait-- > 0) return;
      a.dead = true; sound(a, 'puff');
      const d = spawnScript(a.dir >= 0 ? 0x300e54 : 0x300e90, a.x, a.y, 'sdart'); d.f[0xa0] = a.dir;
    }},
    dart: {init(a) {}, tick(a) {                            // $2EBBEA: leci sciezka (9 px); sciana przed nia -> odpada lukiem, nie rani
      const dx = (a.f[0xa0] | 0) < 0 ? 9 : -9;
      if (!(attr(a.x + dx, a.y - 2) & WALL)) return;
      startPath(a, (a.f[0xa0] | 0) < 0 ? 0x2eb33c : 0x2eb29e, 1, 1); setAnim(a, 0x2eb240, 1); a.f[0x78] = 0; a.beh = null;
    }},
    surfacer: {                                             // $2EF7C0: aktor $A302 z generatora znika, gdy gora ramki siega linii wody
      init() {},
      tick(a) { const f = bob(a); if (L.waterY < 99999 && L.waterY >= a.y - (f ? f[5] : 0)) a.dead = true; }
    },
    bubble: {                                               // $2F5164: babelek wznosi sie o +$98 px/takt, prad niesie go o (dx, dy) + $98
      init() {},
      tick(a) {
        const f = bob(a), l = a.x - (f ? f[4] : 4), t = a.y - (f ? f[5] : 4), r = l + (f ? f[2] : 8), b = t + (f ? f[3] : 8), v = a.f[0x98] | 0;
        const c = (L.currents || []).find(([x1, y1, x2, y2]) => x1 <= r && x2 >= l && y1 <= b && y2 >= t);   // $2ED132
        if (c) { a.x += c[4] + Math.sign(c[4]) * v; a.y += c[5] + Math.sign(c[5]) * v; } else a.y -= v;
        if (L.waterY > a.y) { startPath(a, 0x2e152c, 1, 1); a.beh = null; }   // nad woda: pekniecie (sciezka $2E152C)
      }
    },
    drip: {                                                 // $2EF930: kropla spada (+$7E px/takt), na podlodze rozbryzg ($2E1012)
      init(a) {},
      tick(a) {
        const v = (a.f[0x7e] | 0) & 0xffff || 6;
        if (attr(a.x, a.y + v) & FLOOR && ((a.y + v) & ~15) !== (a.y & ~15)) {
          a.y = (a.y + v) & ~15; a.beh = null; a.path.blk = 0; setAnim(a, 0x2e1012, 2);
        } else a.y += v;
      }
    },   // $2EFF44: straznik wyjscia znika, gdy zaczyna sie ucieczka
    drifter: {init(a) {}, tick(a) { a.x += a.vx || 0; }},   // $2EFA6C: x += slowo +$80 (nietoperze z trumny)
    fallpiece: {                                            // $2EE8E6 stalaktyt / $2EE9E8 kawalek: spada (predkosc +$7E, co +$80 szybciej do 6)
      init(a) {},
      tick(a) {
        for (let k = 0; k < 2; k++) {                         // moveq #1,d3 / dbra: dwa kroki na takt
          let v = a.f[0x7e] | 0, n = a.f[0x80] | 0;
          const t = attr(a.x, a.y + v);
          if (v > 0 && t & FLOOR && ((a.y + v) & ~15) !== (a.y & ~15)) {   // podloga ($2F03E8): na kafel, oblok, koniec
            a.y = ((a.y + v) & ~15) - 1; a.dead = true; a.beh = null;
            const stal = a.f[0x7a] === 0x2ee8e6;
            spawnScript(0x2e12c8, a.x, stal ? a.y : a.y - 8); sound(a, 'smash');
            if (stal) { spawnScript(0xad18, a.x, a.y, 'rad16'); spawnScript(0xad54, a.x, a.y, 'rad52'); sound(a, 'crash'); }   // odlamki $AD16/$AD52, $2EE96E
            return;
          }
          a.y += v;
          if (n <= 0) { n = 8; if (v < 6) v++; }
          a.f[0x7e] = v; a.f[0x80] = n - 1;
        }
      }
    },
    dropbat: {                                              // $2EE086: nietoperz spada 2 px na takt do wysokosci gracza, krzyczy i leci
      init(a) { a.brain = {go: false}; },                   // poziomo w jego strone (sciezka $B130/$B12A, 6 px); nad woda staje ($B136)
      tick(a) {
        const b = a.brain, p = pl(), water = L.waterY < 99999 ? L.waterY : null;
        if (water !== null && a.y >= water - 16) { a.beh = null; a.f[0x7a] = 0x2e3694; startPath(a, 0xb136, 1, 1); return; }   // $2EE11A
        if (b.go) return;
        a.y += 2;
        if (a.y > p.y - 16) {                               // $2EE0AE: dalej tylko znikanie poza oknem ($2E3694)
          b.go = true; a.f[0x7a] = 0x2e3694; sound(a, 'screech');
          startPath(a, p.x - a.x < 0 ? 0xb130 : 0xb12a, 1, 6);   // pierwszy krok w nastepnym takcie (mozg po sciezce)
        }
      }
    },
    faller: {                                               // $2EF54C: przedmiot wypada (vy -1, cap 6, iter 3) i lezy
      init(a) { a.brain = {vy: -1, acc: 0, cap: 6, iter: 3}; },
      tick(a) { if (a.brain && physics(a) === 0) a.brain = null; }
    },
    dropstone: {                                            // $2EF576: kamien po dzwonie spada (cap 2, iter 2); po wyladowaniu kafel $DF
      init(a) { a.brain = {vy: 0, acc: 0, cap: 2, iter: 2}; },
      tick(a) { if (physics(a) === 0) { if (Actors.onStone) Actors.onStone(a); a.dead = true; } }
    },
    p1_2ecf84: {                                            // $2ECF84: tlok czeka na bajt $30CAF8 (narzedzie 14), potem wznosi sie
      init(a, p) { a.brain = null; a.up = typeof p === 'number' ? p : 30; },   // p3 px (1 px co 2 takty), spada z odbiciem ($2EF5D0, y+5), od nowa
      tick(a) {
        let b = a.brain;
        if (!b) {
          if (!Actors.flags['30caf8']) return;
          a.f[0x76] = 0; b = a.brain = {vy: 0, acc: 0, cap: 3, iter: 2, rise: 0, t: 0, up: a.up};
        }
        if (b.rise) { if (b.t) b.t--; else { b.t = 1; a.y--; b.rise--; } return; }
        a.y += 5; const r = physics(a); a.y -= 5;
        if (r < 0) sound(a, 'bounce'); else if (r === 0) b.rise = b.up;
      }
    },
    rope: {                                                 // $2ED1BC: rzucona lina leci po sciezce; trafia w punkt zaczepu -> main.js (Actors.onRope)
      init(a) { a.brain = {life: 60}; },
      tick(a) { if (--a.brain.life <= 0 || (Actors.onRope && Actors.onRope(a))) a.dead = true; }
    },
    thrown: {                                               // $2EC15E: rzucony przedmiot (pirat), luk, przy odbiciu sie rozbija ($2E135E)
      init(a) { a.brain = {vx: (a.f[0x7e] | 0) || -3, vy: -2, acc: 0, cap: 8, iter: 1}; },
      tick(a) {
        a.x += a.brain.vx;
        if (physics(a) <= 0) { spawnScript(0x2e135e, a.x, a.y - 8); a.dead = true; }
      }
    },
    roamer2: {                                              // $2EC646: chod jak $2EC9AA, predkosc z rekordu, bloki $ACA2/$ACB0
      init(a, p) { a.anims = {'1e': 0xaca2, '22': 0xacb0}; a.brain = {v: (typeof p === 'number' && p) || w16(a.f[0x7e] || 0) || 2, stun: 0}; faceAnim(a); roam(a); },   // odlamki: +$7E; konczy sie taktem
      tick: roam
    },
    flier: {                                                // $2EDA18/$2ED9E4: leci do gracza 1 px/takt, kierunek co 4-23 taktow
      init(a) {
        a.anims = a.f[0x7a] === 0x2ed9e4 ? {'1e': 0x30885a, '22': 0x308864} : {'1e': 0xb82a, '22': 0xb844};
        a.brain = {v: -1, dy: -1, t: 0}; faceAnim(a);
      },
      tick(a) {
        const b = a.brain, p = pl();
        if (b.t <= 0) {
          b.t = 4 + Math.floor(Math.random() * 20);
          const v = p.x - 8 - a.x < 0 ? -1 : 1;
          if (v !== b.v) { b.v = v; faceAnim(a); }
          b.dy = p.y - a.y < 0 ? -1 : 1;
        }
        b.t--;
        const f = bob(a), edge = b.v < 0 ? (f ? -f[4] : -8) : (f ? f[2] - f[4] : 8);
        if (attr(a.x + edge + b.v, a.y - 1) & WALL) b.t = 0; else a.x += b.v;
        const water = L.waterY < 99999 ? L.waterY : -1;
        if (water > a.y) return;                            // nad woda obszaru nie plywa w pionie
        if (b.dy >= 0) { if (attr(a.x, a.y + b.dy) & FLOOR) b.t = 0; else a.y += b.dy; }
        else if (water >= 0 && a.y <= water + 8) { b.dy = 1; b.t = 20; }
        else if (attr(a.x, a.y - (f ? f[5] : 8) + b.dy) & CEIL) b.t = 0; else a.y += b.dy;
      }
    },
    popper: {                                               // $2ED0B8: 50 taktow obraca sie do gracza ($2EE05C), potem seria
      init(a) { if (!a.brain) a.brain = {t: 50, v: 1}; },   // 4 x 2 strzaly ($A976 w lewo / $A9C8 w prawo, sciezka), $2ED126: od nowa
      tick(a) {
        const b = a.brain;
        if (!(b.t > 0)) return;
        b.v = pl().x - a.x; faceAnim(a);
        if (--b.t === 0) startPath(a, b.v < 0 ? 0xa976 : 0xa9c8, 1, 1);
      }
    },
    cobra: {                                                // $2EC856: patrzy na gracza; gracz w 58 px -> pluje co 65 taktow
      init(a) {
        Object.assign(a.anims, {'1e': 0x300726, '22': 0x30071c, '26': 0x300746, '2a': 0x300730});
        a.brain = {v: pl().x - a.x < 0 ? -1 : 1, wait: 0}; faceAnim(a);
      },
      tick(a) {
        const b = a.brain, d = pl().x - a.x;
        if (d >= 0 && b.v <= 0) { b.v = 1; faceAnim(a); } else if (d < 0 && b.v >= 0) { b.v = -1; faceAnim(a); }
        if (b.wait > 0) { b.wait--; return; }
        if (Math.abs(d) > 58) return;
        b.wait = 65;
        const s = spawnScript(0x30075c, a.x + (b.v > 0 ? 16 : -16), a.y - 16);
        startPath(s, b.v > 0 ? 0x3008f2 : 0x300912, 1, 2);
        setAnim(a, a.anims[b.v > 0 ? '2a' : '26']);
      }
    },
    bouncer: {                                              // $2EF7EA/$2EF7F4/$2EF7FE: kula odbija sie od podlog, sufitow i scian
      init(a) {
        const v = {0x2ef7ea: [-3, 3], 0x2ef7f4: [-1, 5], 0x2ef7fe: [1, 5]}[a.f[0x7a]] || [-3, 3];
        a.brain = {v: v[0], vy: v[1]};
      },
      tick(a) {
        const b = a.brain, f = bob(a);
        if (b.vy >= 0 ? attr(a.x, a.y + b.vy) & FLOOR : attr(a.x, a.y - (f ? f[5] : 8) + b.vy) & CEIL) b.vy = -b.vy; else a.y += b.vy;
        const edge = b.v < 0 ? (f ? -f[4] : -8) : (f ? f[2] - f[4] : 8);
        if (attr(a.x + edge + b.v, a.y - 1) & WALL) b.v = -b.v; else a.x += b.v;
      }
    },
    slider: {                                               // $2EBAF4: bajt $30CB04 ustawiony -> w prawo do $2094, inaczej w lewo do $1FDB, potem znika
      init(a) { a.brain = {}; },
      tick(a) {
        if (Actors.flags['30cb04']) { if (++a.x >= 0x2094) a.dead = true; }
        else if (--a.x <= 0x1fdb) a.dead = true;
      }
    },
    ghost: {                                                // $2EFD4A/$2EFDF0/$2EFD02 -> $2EFE58: wskaznik w tablicy predkosci przesuwa sie
      init(a) {                                             // ku poczatkowi albo koncowi zaleznie od strony gracza; na koncu tablicy nowy pomiar
        if (a.f[0x7a] === 0x2efdf0) a.anims = {'1e': 0x307e5c, '22': 0x307e5c};
        // ptak z poziomu 1 ($2EFD02): tablica chip $A884..$A8CE (start $A8A8), bloki $A84C/$A868; duch: $BCAC..$BCE8 (start $BCCA)
        const bird = a.f[0x7a] === 0x2efd02, mid = bird ? 18 : 15;
        if (bird) a.anims = {'1e': 0xa84c, '22': 0xa868};
        const p = pl(); a.brain = {px: mid, py: mid, mid, last: bird ? 37 : 30, tab: bird ? 0xa884 : 0, dx: a.x - p.x, dy: a.y - p.y, v: 1}; faceAnim(a);
      },
      tick(a) {
        const b = a.brain, p = pl(), V = i => b.tab ? rws(b.tab + 2 * i) : GHOST_V[i];
        if (b.dx < 0) { if (b.px > 0) b.px--; else b.dx = a.x - p.x; } else if (b.px < b.last) b.px++; else b.dx = a.x - p.x;
        a.x += V(b.px);
        const v = b.px < b.mid ? 1 : -1;
        if (v !== b.v) { b.v = v; faceAnim(a); }
        if (b.dy < 0) { if (b.py > 0) b.py--; else b.dy = a.y - p.y + 10; } else if (b.py < b.last) b.py++; else b.dy = a.y - p.y + 10;
        a.y += V(b.py);
      }
    },
    crawler: {                                              // $2EC1B8: pajak chodzi miedzy xmin/xmax (p2), czasem skacze na sufit i z powrotem
      init(a) {
        const p = a.p2;
        a.brain = {xmin: rws(p), xmax: rws(p + 2), v: rws(p + 4), vy: 8, timer: Math.floor(Math.random() * 100), wait: 0, up: false};
        faceAnim(a);
      },
      tick(a) {
        const b = a.brain, A = a.anims;
        if (b.wait > 0) { b.wait--; return; }
        if (b.up) {                                         // skok pionowy: do podlogi albo sufitu
          if (b.vy >= 0) {
            if (!(attr(a.x, a.y + b.vy) & FLOOR)) { a.y += b.vy; return; }
            b.wait = 6; setAnim(a, b.v < 0 ? 0x300182 : 0x300164);
          } else {
            const f = bob(a), top = f ? f[5] : 16;
            if (!(attr(a.x, a.y - top + b.vy) & CEIL)) { a.y += b.vy; return; }
            a.y -= 8; b.wait = 6; setAnim(a, b.v < 0 ? 0x3001ca : 0x3001ac);
          }
          b.up = false;
          [A['1e'], A['26']] = [A['26'], A['1e']]; [A['22'], A['2a']] = [A['2a'], A['22']];   // chod po suficie / podlodze
        } else if (b.timer > 0) b.timer--;
        else {
          b.up = true; b.vy = -b.vy; setAnim(a, b.vy < 0 ? A['2e'] : A['32']);
          b.wait = 9; b.timer = Math.floor(Math.random() * 100);
        }
        a.x += b.v;
        if (a.x <= b.xmin || a.x >= b.xmax) { b.v = -b.v; faceAnim(a); }
      }
    },
    // procedura startowa wpada w takt, a petla aktorow wola go jeszcze raz w tym samym przebiegu: dwa kroki w takcie
    // powstania (emulator 4x, L1 / L2: wrog z rekordu 518 -> 514)
    walker: {init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2], stun: 0}; faceAnim(a); patrol(a); }, tick: a => patrol(a)},
    // $2EE724 -> $2EE758 (poziom 3): chod $2EE86A; gdy gracz jest w wodzie ($30CC7C / $30CC7D), zapamietuje miejsce i plynie do
    // (x, y + 6) gracza 4 krokami po 1 px na takt w obu osiach ($2EE7E2, obrot przy zmianie strony); potem wraca 3 krokami
    // na takt i chodzi dalej z dawna predkoscia. Procedura startowa wpada w takt
    swimmer: {
      init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2], stun: 0, home: null}; faceAnim(a); this.tick(a); },
      tick(a) {
        const b = a.brain, P = pl();
        const step = (tx, ty, n) => {
          for (let i = 0; i < n; i++) {
            if (tx > a.x) { a.x++; if (b.v < 0) { b.v = -b.v; faceAnim(a); } }
            else if (tx < a.x) { a.x--; if (b.v >= 0) { b.v = -b.v; faceAnim(a); } }
            if (ty > a.y) a.y++; else if (ty < a.y) a.y--;
          }
        };
        if (P.water || P.surf) { if (!b.home) { b.home = [a.x, a.y]; b.v0 = b.v; } step(P.x, P.y + 6, 4); return; }
        if (!b.home) { patrol(a); return; }
        step(b.home[0], b.home[1], 3);
        if (a.x === b.home[0] && a.y === b.home[1]) { b.home = null; b.v = b.v0; faceAnim(a); }
      }
    },
    crab: {
      init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2], stun: 0, wait: 0}; faceAnim(a); },
      tick(a) { const b = a.brain; if (b.wait > 0) { if (--b.wait === 0) faceAnim(a); } else patrol(a); }
    },
    swordfish: {                                            // przyspiesza, gdy gracz jest w pasie +-40 px
      init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2], stun: 0}; faceAnim(a); },
      tick(a) { patrol(a, Math.abs(a.y - pl().y) <= 40 ? 2 : 1); }
    },
    clam: {                                                 // malz: odbija sie coraz nizej; krab nad nim -> wyskok
      init(a, p) { a.brain = {jump: p, vy: 0, acc: 0, cap: 10, iter: 2}; },
      tick(a) { physics(a); }
    },
    starfish: {                                             // rozgwiazda: skacze lukami, po kazdym ladowaniu zawraca
      init(a, p) { a.brain = {jump: p[0], vy: p[0], vx: p[1], acc: 0, cap: 4, iter: 2}; this.tick(a); },   // start wpada w takt (emulator 4x, L1: 345,527 -> 349,512)
      tick(a) {
        const b = a.brain; a.x += b.vx;
        if (physics(a) < 0) { b.vx = -b.vx; b.vy = b.jump; setAnim(a, b.vx < 0 ? a.anims.l0 : a.anims.l1); }
      }
    },
    leaper: {                                               // $2EDE4A: otwarty malz rzuca sie na gracza nad soba
      init(a) { a.brain = {flags: 0}; },
      tick(a) {
        const b = a.brain, p = pl();
        if (b.flags & 2) return;
        if (p.y + 24 < a.y && Math.abs(p.x - a.x) <= 32 && p.y >= a.y - 56 && p.y <= a.y) {
          startPath(a, p.x < a.x ? 0xa25a : 0xa296, 1, 1); b.flags |= 2;
        } else if (!(attr(a.x, a.y + 1) & FLOOR)) a.y++;   // $2EFBC4: spada 1 px/takt bez podloza
      }
    },
    trap: {                                                 // $2EE52E: muszla-rakieta startuje, gdy gracz jest nad nia
      init(a) { a.brain = {}; },
      tick(a) {
        if (a.brain.fired || !underPlayer(a)) return;
        if (Math.abs(pl().x - a.x) <= 4) { a.brain.fired = true; setAnim(a, 0xa434); startPath(a, 0xa43e, 1, 1); }
      }
    },
    dropper: {                                              // $2EE5E6: slimak chodzi; gracz nad nim -> chowa sie, potem start
      init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2], flags: 0}; faceAnim(a); },
      tick(a) {
        const b = a.brain;
        if (b.fired) return;
        if (!(b.flags & 2)) {
          if (b.dist === 0) { b.dist = b.range; b.v = -b.v; faceAnim(a); return; }
          b.dist -= Math.abs(b.v); a.x += b.v;
          if (underPlayer(a)) { setAnim(a, a.anims['26']); b.flags |= 2; }
        } else if (underPlayer(a)) {
          if (Math.abs(pl().x - a.x) <= 4) { b.fired = true; setAnim(a, a.anims['2a']); startPath(a, 0xa43e, 1, 1); }
        } else { b.flags &= ~2; faceAnim(a); }
      }
    },
    shooter: {                                              // $2EE220: jezowiec patrzy na gracza, co 40 taktow kolec
      init(a) { a.brain = {side: 2, timer: 0}; },
      tick(a) {
        const b = a.brain, left = pl().x - a.x < 0;
        if (left && b.side !== 0) { b.side = 0; setAnim(a, 0xa1ec, 5); }
        if (!left && b.side !== 1) { b.side = 1; setAnim(a, 0xa1f2, 5); }
        if (b.timer > 0) { b.timer--; return; }
        b.timer = 40;
        spawnScript(0xa1f8, a.x, a.y);
      }
    },
    bullet: {                                               // $2EE2B6: kolec leci do gracza; os dluzsza co takt
      init(a) {
        const p = pl(), dx = Math.abs(p.x - a.x), dy = Math.abs(p.y - a.y);
        a.vx = p.x > a.x ? 1 : -1; a.vy = p.y > a.y ? 1 : -1;
        const px = dy > dx ? (dx ? Math.floor(dy / dx) : dy) : 1, py = dx > dy ? (dy ? Math.floor(dx / dy) : dx) : 1;
        a.brain = {px, py, cx: px, cy: py, life: 0x41};
      },
      tick(a) {
        const b = a.brain;
        if (!b.life-- || pl().y + 8 >= a.y) { a.dead = true; return; }
        for (let i = 0; i < 2; i++) {
          if (b.px && --b.cx === 0) { b.cx = b.px; a.x += a.vx; }
          if (b.py && --b.cy === 0) { b.cy = b.py; a.y += a.vy; }
        }
      }
    },
    climber: {                                              // $2ECA6C: pirat chodzi, schodzi/wchodzi po stopniach (sciezki $2F2B52..), skreca do gracza
      init(a) {                                             // procedury startowe koncza sie taktem ($2EDD72 / $2EDDB0 / $2EDC0A bsr, $2EDC92 wpada)
        a.anims = CLIMBER[a.f[0x7a]];
        a.brain = {v: a.f[0x7a] === 0x2edd54 ? -3 : -2, stun: 0, path: false, t: 0}; faceAnim(a);
        if (a.f[0x7a] === 0x2edc92) a.brain.throwT = rnd(40, 140);   // czerwony pirat: $2EDD30 - pauza rzutu 40..139 taktow
        this.tick(a);
      },
      tick(a) {
        const b = a.brain;
        climbWalk(a, b);
        // $2EDCCE (czerwony pirat, po $2ECA6C): gracz dalej niz 32 px - po pauzie rzut nozem: sciezka $3075C6 (w prawo) / $3075A2
        // (w lewo), animacja rzutu, po 10 taktach noz $307662 / $30762A w (+-10, -18), po kolejnych 10 nowa pauza ($2EDD30)
        if (b.throwT === undefined) return;
        const d = pl().x - a.x;
        if (Math.abs(d) < 32) return;
        if (b.throwT > 0) { b.throwT--; return; }
        if (!b.path) { b.path = true; startPath(a, d > 0 ? 0x3075c6 : 0x3075a2, 1, 1); }
      }
    },
    ball: {init(a) { a.brain = {}; }, tick(a) { if (attr(a.x, a.y - 4) & WALL) a.dead = true; }},
    runner: {                                               // $2EC4DE: szczur/nietoperz, 2 kroki na wysokosci gracza
      init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2]}; faceAnim(a); },
      tick(a) {
        const b = a.brain;
        for (let n = a.y === pl().y ? 2 : 1; n > 0; n--) {
          if (b.dist === 0) { b.dist = b.range; b.v = -b.v; faceAnim(a); return; }
          b.dist -= Math.abs(b.v); a.x += b.v;
        }
      }
    },
    pirate: {                                               // $2EC0A4: na koncu odcinka sciezka obrotu (+$26/+$2A)
      init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2], wait: 0}; faceAnim(a); },
      tick(a) {
        const b = a.brain;
        if (b.wait > 0) { if (--b.wait === 0) faceAnim(a); return; }
        if (b.dist === 0) {
          const blk = b.v < 0 ? a.anims['26'] : a.anims['2a'];
          if (blk) startPath(a, blk, 1, 1);
          b.dist = b.range; b.v = -b.v; b.wait = 40;   // koniec obrotu: $2EFAC2 na koncu sciezki (ok. 20 taktow), 40 = zapas
          return;
        }
        b.dist -= Math.abs(b.v); a.x += b.v;
      }
    },
    axeman: {                                               // $2EBF78: topornik atakuje gracza na tej samej wysokosci
      init(a, p) { a.brain = {range: p[0], dist: p[1], v: p[2], wait: 0}; faceAnim(a); },
      tick(a) {
        const b = a.brain;
        if (b.wait > 0) { if (--b.wait === 0) faceAnim(a); return; }
        if (a.y === pl().y) {
          const blk = a.x - pl().x >= 0 ? a.anims['26'] : a.anims['2a'];
          if (blk) { startPath(a, blk, 1, 1); b.wait = 50; return; }
        }
        if (b.dist === 0) { b.dist = b.range; b.v = -b.v; faceAnim(a); return; }
        b.dist -= Math.abs(b.v); a.x += b.v;
      }
    },
    riser: {init(a) { a.brain = {}; }, tick(a) { if (L.waterY < 99999 && L.waterY >= 0 && L.waterY < a.y - 12) a.y--; }},   // $2EFC02: plywa - wznosi sie, gdy linia wody obszaru (+$10) jest wyzej niz y - 12
    gate: {                                                 // $2ED34A: krata czyta bajt stanu (dzwignia, zamek): 1 otworz, 2 zamknij
      init(a) {
        const s = Actors.flags[a.state] | 0;
        a.brain = {};
        if (s === 1 || s === 3) setAnim(a, 0xb424); else if (s === 2 || s === 4) setAnim(a, 0xb420);
      },
      tick(a) {
        const s = Actors.flags[a.state] | 0;
        if (s === 1) { setAnim(a, 0xb41a, 4); Actors.flags[a.state] = 3; sound(a, 'gate'); }
        else if (s === 2) { setAnim(a, 0xb414, 1); Actors.flags[a.state] = 4; sound(a, 'gate_close'); }   // $2ED3CC: krata opada (52, 0)
      }
    },
    mover: {                                                // $2EF23E: program ruchu (bloki, platformy, duchy)
      init(a, p, prog) {                                    // $2EF23E konczy sie pierwszym taktem programu ($2EF26C)
        a.brain = {start: prog, pc: prog, list: 0, back: false, loopPc: 0, loopN: 0, rep: 0, speed: 1, wait: 0, cmd: 0, mirror: 0, dx: 0, dy: 0};
        if (prog) moverTick(a);
      },
      tick: moverTick
    }
  };
  // takt programu ruchu: kroki 1 px w kierunku polecenia ($FFD lewo, $FFC prawo, $FFB gora, $FFA dol) przez
  // 'rep' taktow, 'speed' krokow na takt; lista bajtow (dx, dy) do $80; petle, czekanie, lustro, skoki
  function moverTick(a) {
    const b = a.brain;
    b.dx = b.dy = 0;
    if (b.rep > 0) b.rep--;
    if (b.wait > 0) { b.wait--; return; }
    const move = (dx, dy) => { if (b.mirror & 1) dx = -dx; if (b.mirror & 2) dy = -dy; a.x += dx; a.y += dy; b.dx += dx; b.dy += dy; };
    let n = b.speed;
    for (let guard = 0; guard < 256 && n > 0; guard++) {
      if (b.rep > 0) {
        const c = b.cmd;
        if (c === 0xffd) move(-1, 0); else if (c === 0xffc) move(1, 0); else if (c === 0xffb) move(0, -1); else if (c === 0xffa) move(0, 1);
        n--; continue;
      }
      if (b.list) {
        let dx, dy;
        if (b.back) { dy = rb(--b.list); dx = rb(--b.list); } else { dx = rb(b.list++); dy = rb(b.list++); }
        if (dx === 0x80) { b.list = 0; continue; }
        move(dx, dy); n--; continue;
      }
      const w = rw(b.pc), arg = rw(b.pc + 2);
      if (w >= 0xffa && w <= 0xffd) { b.cmd = w; b.rep = arg; b.pc += 4; return; }
      if (w === 0xffe) b.pc = b.start;
      else if (w === 0xff8) { b.speed = arg; b.pc += 4; }
      else if (w === 0xff9) { b.back = arg >= 0x8000; b.list = rl(b.pc + 4); b.pc += 8; }
      else if (w === 0xff7) { b.mirror |= 1 << arg; b.pc += 4; }
      else if (w === 0xff6) { b.mirror &= ~(1 << arg); b.pc += 4; }
      else if (w === 0xff5) { b.loopN = arg; b.pc += 4; b.loopPc = b.pc; }
      else if (w === 0xff4) { if (--b.loopN !== 0) b.pc = b.loopPc; else b.pc += 2; }
      else if (w === 0xff3) { b.wait = arg; b.pc += 4; }
      else if (w === 0xff2) { a.dead = true; return; }
      else if (w === 0xff1) { b.start = b.pc = rl(b.pc + 2); }
      else return;                                          // $FFF i nieznane: stop
      if (b.wait > 0) { b.wait--; return; }
    }
  }
  // dzwiek aktora tylko gdy jest blisko gracza (oryginal gra efekty z ekranu)
  const sound = (a, name) => { if (Actors.onSound && Math.abs(a.x - pl().x) < 200 && Math.abs(a.y - pl().y) < 140) Actors.onSound(name); };
  // gracz w oknie nad aktorem: x +-32, y od -80 do 0 (wspolne dla pulapek)
  const underPlayer = a => { const p = pl(); return Math.abs(p.x - a.x) <= 32 && p.y >= a.y - 80 && p.y <= a.y; };
  // procedury natywne wolane ze skryptow (rozkaz $FFEE)
  const NATIVE = {
    0x2edf0a: a => { if (a.brain) a.brain.flags = 0; },                   // koniec skoku malza
    0x2eeb00: a => { if (a.brain) a.brain.path = false; faceAnim(a); },     // koniec stopnia pirata ($2ECA6C), animacja kierunku ($2EE05C)
    0x2edd30: a => { if (a.brain) { a.brain.path = false; a.brain.throwT = rnd(40, 140); } faceAnim(a); },   // to samo + pauza rzutu 40..139 ($2EDD44)
    0x2e72b8: a => { a.dead = true; },                                     // usuniecie aktora (koniec sciezki smierci)
    0x2efb50: a => { spawnScript(0x2e1228, a.x - 10, a.y - 8); sound(a, 'cannon'); },   // armata w lewo: kula
    0x2efb82: a => { spawnScript(0x2e1278, a.x + 10, a.y - 8); sound(a, 'cannon'); },   // armata w prawo
    0x2efa8c: (a, v) => { a.f[0x7a] = v; a.beh = TICKS[v] || null; if (BEH[a.beh]) BEH[a.beh].init(a); else missing.add('tick ' + v.toString(16)); },   // nowa procedura co takt
    0x2efa98: (a, v) => { a.f[0x98] = v; },                               // predkosc babelka
    0x2ddfc8: a => { a.beh = null; a.f[0x72] = 0; a.f[0x7a] = 0; a.brain = null; },   // koniec procedury i dotyku
    0x2ee8d8: a => { a.f[0x7e] = 0; a.f[0x80] = 4; },                    // stalaktyt: predkosc 0, przyspieszenie co 4
    0x2ee9a0: a => { a.f[0x7e] = 1; a.f[0x80] = 8; },                    // kruszacy sie kawalek: 1, co 8
    0x2e7276: a => { a.f[0x78] = 0x8000; },                              // od teraz rani gracza
    0x2e721a: a => { a.f[0x78] = 0x8000; },
    0x2e720e: a => { a.f[0x78] = 0; a.f[0x76] = 1; },                    // pulapka znow uzbrojona
    0x2efb4a: (a, v) => { a.x += v | 0; },                               // x += d0 (straznik przy wyjsciu)
    0x2efa24: () => { if (Actors.onMusic) Actors.onMusic(8); },           // akcent muzyczny (zdarzenie 8)
    0x2f0352: () => { if (Actors.onMusic) Actors.onMusic(2); },           // zdarzenie muzyczne 2
    0x2e6d9e: a => sound(a, 'smash'), 0x2e6d86: a => sound(a, 'smash'), 0x2efbb4: a => sound(a, 'cannon'),
    0x2ee124: a => sound(a, 'screech'),
    0x2efac2: a => { if (a.brain && a.brain.wait) { a.brain.wait = 0; faceAnim(a); } },   // pirat: koniec obrotu (bclr #1 +$10)                                   // pisk nietoperza (sciezka $AE3C, poziom 2)
    0x2ee9bc: a => { if (Actors.onShake) Actors.onShake(); if (Math.random() < 0.2) sound(a, 'bounce'); },   // wstrzas ($30B77A)
    0x2ea3ac: a => { spawnScript(0x2e176a, a.x, a.y - 4); a.beh = null; },  // efekt $2E176A nad aktorem
    0x2edbcc: a => {                                                      // nowy wspinacz $300622 w miejscu z listy +$7E
      const p = a.f[0x7e]; if (p) spawnScript(0x300624, rws(p), rws(p + 2), '300622');
    },
    0x2eeb16: a => { a.collapsed = false; a.f[0x78] = 0x8000; a.f[0x76] = 2; a.dmg = 0; if (a.rec !== undefined) recDmg.set(a.rec, 0); },   // szkielet znow caly
    0x2ec840: a => { if (a.rec !== undefined) recDmg.set(a.rec, 0); },    // ghul znika: rekord wolny, +$17 = 0 (respawnTick)
    0x2ed082: a => { Object.assign(a.anims, {'1e': 0xa972, '22': 0xa96e}); a.brain = {t: 50, v: 1}; },   // strzelec z pojemnika (poziom 2)
    0x2ed126: a => { if (a.brain) a.brain.t = 50; }                      // po serii znow 50 taktow celowania
  };
  // dotyk gracza (klasa +$76 bit 0, procedura +$72)
  // $2E72BA + $2B0: nowy aktor zamiast dotknietego (spawnNow - rusza juz w tym przebiegu)
  const replace = (a, sc, type) => { a.f[0x72] = 0; a.dead = true; return spawnNow(sc, a.x, a.y, type || 'r' + sc.toString(16)); };
  const TOUCH = {
    0x2e65ac: a => replace(a, 0xa81c, 'bird'),                           // ptaszysko na slupku zrywa sie ($A81C)
    0x2e71b4: a => replace(a, 0xadbc),                                   // spiacy nietoperz (poziom 2) budzi sie
    0x2e71d6: a => replace(a, 0x307e98),                                 // to samo na poziomie 4
    0x2e71f8: a => { a.f[0x72] = 0; startPath(a, 0xacec, 1, 1); },        // stalaktyt: drga 5 razy i spada
    0x2e727e: a => { a.f[0x72] = 0; a.f[0x76] = 0; setAnim(a, 0xb65e, 1); startPath(a, 0xb66c, 2, 1); },   // kruszy sie
    0x2e724c: a => { if (a.f[0x78]) return; setAnim(a, 0x300a2c, 1); sound(a, 'trap'); },  // pulapka (poziom 3)
    0x2e7222: a => { a.f[0x76] = 0; setAnim(a, 0x2f2f80, 1); sound(a, 'spike'); }          // ukryte kolce: wyskakuja na 30 taktow
  };
  // zachowanie aktora bez procedury startowej: po polu $7A ustawionym w skrypcie
  const TICKS = {0x2ede4a: 'leaper', 0x2ee52e: 'trap', 0x2ee220: 'shooter', 0x2edd72: 'climber', 0x2eddb0: 'climber',
    0x2edc92: 'climber', 0x2ee2b6: 'bullet', 0x2e4be4: 'ball', 0x2efc02: 'riser',
    0x2edc0a: 'climber', 0x2edd54: 'climber', 0x2ec646: 'roamer2', 0x2eda18: 'flier', 0x2ed9e4: 'flier', 0x2ec856: 'cobra',
    0x2ef7ea: 'bouncer', 0x2ef7f4: 'bouncer', 0x2ef7fe: 'bouncer', 0x2ebaf4: 'slider', 0x2efd4a: 'ghost', 0x2efdf0: 'ghost',
    0x2ec15e: 'thrown', 0x2ed1bc: 'rope', 0x2efa6c: 'drifter', 0x2efd02: 'ghost',
    0x2ee8e6: 'fallpiece', 0x2ee9e8: 'fallpiece', 0x2ee086: 'dropbat', 0x2eff44: 'guard', 0x2ef930: 'drip', 0x2ebbea: 'dart', 0x2f5164: 'bubble', 0x2ef7c0: 'surfacer', 0x2ed0b8: 'popper', 0x2eba1a: 'raindrop', 0x2ef9d2: 'dropper8', 0x2eba2e: 'raindropw'};
  // znikanie wg procedury co takt ($7A): $2F039A = $2E3694 (faza 3, poza oknem A4) albo $2F03B8 = $2E3714 (faza 4, daleko od
  // gracza); procedura startowa z rekordu podmienia $7A (chodzacy $2EE86A wola $2F03B8 - emulator 4x, L2: wrog idzie
  // 162 px, poza okno A4 + 499, i nie znika)
  const DESP_T = {0x2ebaf4: 'win', 0x2ec856: 'win', 0x2edc0a: 'win', 0x2edc92: 'win', 0x2edd54: 'win', 0x2edd72: 'win', 0x2eddb0: 'win',
    0x2ede4a: 'win', 0x2ee086: 'win', 0x2ee220: 'win', 0x2ee2b6: 'win', 0x2ef7ea: 'win', 0x2ef7f4: 'win', 0x2ef7fe: 'win', 0x2ef930: 'win',
    0x2ef9d2: 'win', 0x2efa6c: 'win', 0x2efc02: 'win', 0x2eba2e: 'win', 0x2ebbea: 'win', 0x2e4be4: 'win',
    0x2ec15e: 'far', 0x2ec646: 'far', 0x2ed9e4: 'far', 0x2eda18: 'far', 0x2ee52e: 'far', 0x2efd4a: 'far', 0x2efdf0: 'far', 0x2ef7c0: 'far',
    0x2eba1a: null, 0x2ed0b8: null, 0x2ed1bc: null, 0x2ee8e6: null, 0x2ee9e8: null, 0x2efd02: null, 0x2eff44: null, 0x2f5164: null};
  const DESP_B = {walker: 'far', crab: 'far', swordfish: 'far', starfish: 'far', clam: 'far', runner: 'far', pirate: 'far', axeman: 'far'};
  // bloki lewo/prawo z procedur startowych chodzacych po stopniach (maly pirat c34, pirat ze sztyletem c7a)
  const CLIMBER = {0x2edd72: {'1e': 0xa6b2, '22': 0xa6bc}, 0x2eddb0: {'1e': 0x3005ea, '22': 0x300602},
    0x2edc92: {'1e': 0x307602, '22': 0x307612},    // czerwony pirat (twierdza)
    0x2edc0a: {'1e': 0x3006ae, '22': 0x3006c4}, 0x2edd54: {'1e': 0x307522, '22': 0x30752c}};

  // dotkniecie malza przez kraba ($2E65D4): ramki sie nakladaja i |dx| <= 3 -> malz wyskakuje, krab unosi szczypce
  // na 10 taktow; malz w powietrzu nie styka sie z krabem, wiec krab idzie dalej
  function overlap(p, q) {                              // ramki kolizji z naglowkow BOB-ow
    const f = hitBox(p), g = hitBox(q);
    return !!f && !!g && f.l < g.l + g.w && g.l < f.l + f.w && f.t < g.t + g.h && g.t < f.t + f.h;
  }
  function touches() {
    for (const c of list) {
      if (c.beh !== 'crab') continue;                     // dotyk co takt, takze w czasie czekania (licznik od nowa)
      for (const m of list) if (m.beh === 'clam' && Math.abs(m.x - c.x) <= 3 && overlap(c, m)) {
        m.brain.vy = m.brain.jump; c.brain.wait = 10; setAnim(c, 0xa3e4);
      }
    }
  }

  // nowy aktor: skrypt startowy (do rozkazu stop), potem zachowanie z rekordu albo z pola $7A
  function make(type, script, x, y, beh, anims, p3, hp = 0, prog = 0, state, p2 = 0) {
    const a = {type, x, y, hp, dmg: 0, stun: 0, frame: 0, state, p2, base: undefined, f: {}, flags: 0, delay: 1, cnt: 0, target: -1,
      anim: {blk: 0, off: 0, loop: 0, sleep: 0}, path: {blk: 0, off: 0, loop: 0, sleep: 0},
      pdelay: 1, pcnt: 0, pcount: 0, prep: 0, pdir: 0, anims: anims || {}, dead: false};
    const c = {blk: script, off: 0, loop: 0, sleep: 0};
    for (let g = 0; g < 32; g++) {
      const w = rw(c.blk + c.off);
      if (w < 0x8000 && (w & 0xff) !== 0xfe && (w & 0xff) !== 0xfc) { a.frame = w; c.off += 2; continue; }
      if (op(a, c, w)) break;
    }
    if (opts.absPos) { if (a.f[0x0e] !== undefined) a.x = a.f[0x0e]; if (a.f[0x10] !== undefined) a.y = a.f[0x10]; }
    a.beh = (beh && BEH[beh] ? beh : null) || TICKS[a.f[0x7a]] || beh;   // np. p1_2efad8 (polozenie) + procedura z $7A
    if (BEH[a.beh]) BEH[a.beh].init(a, p3, prog);
    else if (a.f[0x7a] && a.f[0x7a] !== 0x2e3694) missing.add('tick ' + a.f[0x7a].toString(16) + ' ' + type);   // $2E3694: tylko znikanie poza oknem
    a.born = true; a.f72 = a.f[0x72];
    a.desp = DESP_T[a.f[0x7a]] !== undefined ? DESP_T[a.f[0x7a]] : DESP_B[a.beh] || (a.f[0x7a] === 0x2e3694 ? 'win' : null);
    return a;
  }
  const born = [];
  function spawnScript(script, x, y, type, beh) { const a = make(type || 's' + script.toString(16), script, x, y, beh); born.push(a); return a; }
  // aktor wstawiony w czasie przebiegu aktorow ($2B0, wg priorytetu): przy warstwie >= 0 rusza juz w tym przebiegu (emulator 4x,
  // L2: nietoperz budzi sie i w pierwszej klatce jest 2 px nizej, dzieci rozbitego dzbana od razu o krok dalej)
  function spawnNow(script, x, y, type) { const a = make(type || 's' + script.toString(16), script, x, y); ((a.layer || 0) < 0 ? born : list).push(a); return a; }
  // odradzanie ($2E35AE): wrog z procedura $2E6B12/$2E6B3C po smierci dostaje licznik +$19 = 20; poza oknem kamery
  // (x -50..+466, y -50..+306 od A4) licznik maleje co 25 wywolan petli (300 klatek, 20 = ok. 2 min); przy 0 rekord wraca i wrog pojawia sie,
  // gdy jego punkt startu wejdzie w okno. $2E7180 (ghul) czysci rekord od razu.
  const RESP = {0x2e6b12: 20, 0x2e6b3c: 20, 0x2e7180: 0};
  let resp = new Map(), respClock = 0;
  // rekord +$17: suma obrazen zostaje w rekordzie - odrodzony wrog pamieta trafienia (zeruja tylko ghul i szkielet)
  let recDmg = new Map();
  const fromRec = (r, i) => Object.assign(make(r.type, r.script, r.x, r.y, r.beh, r.anims, r.p3, r.hp, r.prog, r.state, r.p2),
    {rec: i, hurt: r.hurt, dmg: recDmg.get(i) || 0}, r.burst ? {burst: r.burst} : {}, r.p7e ? {p7e: r.p7e} : {}, r.lift ? {lift: r.lift} : {});
  // $2E35AE (opts.lazy - poziom): aktor powstaje z rekordu dopiero, gdy rekord wejdzie w okno kamery gry (A4 - 50 ..
  // A4 + 466, A4 - 50 .. A4 + 306); zywy aktor z procedura $2E3694 znika poza oknem A4 - 83 .. +499 / +339 i blokuje
  // rekord (bit 3) do pierwszego wyjscia rekordu z okna - potem powstaje od nowa w punkcie startu. Zabity z RESP:
  // licznik +$19 maleje co 25 klatek poza oknem; inny zabity nie wraca
  // wolane z petli gry (main.js) w fazie $5D = 1, czyli co 12 klatek; licznik odradzania maleje co 25 wywolan ($2E5174)
  let recs = [], respDiv = 0;
  function recTick(ax, ay) {
    ctlTick(ax, ay);
    const step = respDiv === 0; respDiv = (respDiv || 25) - 1;
    D.actors.forEach((r, i) => {
      if (sect && r.sect && r.sect !== sect) return;      // $2E35A4 przechodzi tylko sekcje rekordow biezacego obszaru
      const R = recs[i];
      if (R.live && R.live.dead) {
        if (R.live.despawned) R.hold = true;
        else if (RESP[R.live.f72] !== undefined) resp.set(i, RESP[R.live.f72]);
        else R.done = true;
        R.live = null;
      }
      if (R.live || R.done) return;
      if (r.x >= ax - 50 && r.x <= ax + 466 && r.y >= ay - 50 && r.y <= ay + 306) {
        if (!R.hold && !(resp.get(i) > 0)) { resp.delete(i); R.live = fromRec(r, i); list.push(R.live); }   // takt juz w tej petli (pirat poziomu 4: rzut 5 taktow po powstaniu)
      } else {
        R.hold = false;
        if (step && resp.get(i) > 0) resp.set(i, resp.get(i) - 1);
      }
    });
  }
  // $2E3694 dziala tylko w fazie $5D = 3 (main.js): aktor z ta procedura poza oknem A4 - 83 .. +499 / +339 znika
  // sekcja rekordow obszaru ($30CBE8 = tablica poziomu +$64 [numer obszaru], $2DD23C); bez sekcji (bonus, skarb) - wszystkie
  let sect = null;
  const setSect = s => { sect = s || null; };
  // drzwi ($2DDF6A) i smierc ($2DDFF2): wszyscy aktorzy znikaja, rekordy biezacej sekcji bez powiazania - powstana
  // od nowa w oknie kamery; przy drzwiach $2E3820 zwalnia tez rekordy z licznikiem odradzania
  function reset(door) {
    list = []; born.length = 0;
    for (const t of triggers) t.live = t.hold = false;
    rollBusy = false;                                     // port: beczka znika z drzwiami / smiercia - blokada $30CC70 tez (oryginal by ja zostawil)
    D.actors.forEach((r, i) => {
      if (sect && r.sect && r.sect !== sect) return;
      const R = recs[i]; R.live = null; R.hold = false;
      if (door && resp.has(i)) resp.delete(i);
    });
  }
  function despawnTick(ax, ay, ph = 3) {
    const out = (x, y) => x < ax - 83 || x > ax + 499 || y < ay - 83 || y > ay + 339;
    const p = pl();                                       // $2E3714 (faza 4): dalej niz 700 / 300 od gracza (A4 +4 / +6)
    for (const a of list) if (!a.dead && (ph === 3 ? a.desp === 'win' && out(a.x, a.y) : a.desp === 'far' && (Math.abs(a.x - p.x) >= 700 || Math.abs(a.y - p.y) > 300))) a.dead = a.despawned = true;
    for (const t of triggers) if (t.live && (ph === 3 ? t.despawn === 'win' && out(t.x, t.y) : ph === 4 && t.despawn === 'far' && (Math.abs(t.x - p.x) >= 700 || Math.abs(t.y - p.y) > 300))) { t.live = false; t.hold = true; }
  }
  const deadRecs = () => recs.flatMap((R, i) => R.done ? [i] : []);
  function killRecs(ids) { for (const i of ids) if (recs[i]) { recs[i].done = true; if (recs[i].live) recs[i].live.dead = true; recs[i].live = null; } }
  function respawnTick(cx0, cy0) {
    for (const a of list) if (a.dead && a.rec !== undefined && RESP[a.f72] !== undefined && !resp.has(a.rec)) resp.set(a.rec, RESP[a.f72]);
    const step = ++respClock % 12 === 0, l = cx0 - 160, t = cy0 - 80;
    for (const [i, n] of resp) {
      const r = D.actors[i], inside = r.x >= l - 50 && r.x <= l + 466 && r.y >= t - 50 && r.y <= t + 306;
      if (!inside) { if (step && n > 0) resp.set(i, n - 1); continue; }
      if (n <= 0) { resp.delete(i); born.push(fromRec(r, i)); }
    }
  }
  function spawn() {
    recDmg = new Map(); resp = new Map(); respClock = 0; respDiv = 0; rollBusy = false;
    born.length = 0; gflags = 0; for (const k in pokes) delete pokes[k];   // nic nie przechodzi z poprzedniego poziomu
    recs = D.actors.map(() => ({live: null, hold: false, done: false}));
    list = opts.lazy ? [] : D.actors.map(fromRec);
    triggers = (D.triggers || []).map(t => ({...t, c: (t.entries || []).map(e => e[3] ?? e[0]), done: false}));
  }
  // kontrolery z rekordow (niewidzialny typ $2F2A28): powstaja jak rekordy ($2E35A4 - faza 1, okno kamery, sekcja obszaru),
  // procedura startowa od razu wpada w procedure co takt; 'win' znikaja w fazie 3 poza oknem ($2E3694), 'far' w fazie 4 dalej
  // niz 700 / 300 od gracza ($2E3714), potem wracaja jak rekordy; reszta dziala do drzwi / smierci. Liczniki generatorow
  // $2EDF14 / $2EBCF8 sa w danych poziomu, wiec przetrwaja znikniecie kontrolera. Kontroler jest aktorem listy: jego dzieci
  // dzialaja juz w tym samym przebiegu petli ($1FBA; emulator: kamien $3088E8 ma uspienie 13 w klatce powstania)
  // lista aktorow jest wg warstwy, petla idzie od wyzszej: dziecko z warstwa ujemna (kropla $307FEC, -127) trafia za kontroler
  // i rusza dopiero w nastepnym przebiegu (emulator: kropla 7 px widoczna najpierw w A4 y + 32, 10 px ($307FAA, +127) juz o 10 nizej)
  const kid = (sc, x, y, beh, p2 = 0) => { const a = make('s' + sc.toString(16), sc, x, y, beh, null, null, 0, 0, undefined, p2); ((a.layer || 0) < 0 ? born : list).push(a); return a; };
  const CTL = {
    // $2EDF14 / $2EBCF8 / $2EBD0E: wpis {licznik, okres, ...}: przy 0 licznik = okres i nowy aktor, inaczej licznik - 1
    spawn: {init() {}, tick(t) {
      t.entries.forEach((e, i) => {
        if (t.c[i] > 0) { t.c[i]--; return; }
        t.c[i] = e[0];
        kid(t.script, t.x + e[1], t.y + e[2], t.beh, e[4] || 0);
      });
    }},
    // rzedy platform $2EF0E4 / $2EF13A ($308038 co 16 px) i kolumny $2EF184 ($308294, szczyt $308246): kazdy z wlasnym programem
    // ruchu $2EF23E od poczatku; kontroler bez procedury co takt, czesci dzialaja tez daleko od kamery
    row: {init(t) {
      for (const [sc, dx, dy, prog] of t.parts) {
        const a = make('r' + t.x, sc, t.x + dx, t.y + dy, prog ? 'mover' : null, null, null, 0, prog); a.always = true; list.push(a);
      }
    }},
    // $2EF978: co rnd(50) + 50 taktow (pierwszy po rnd(50)) spadajacy $3088E8 z dystansem +$A0 (mozg $2EF9D2)
    fall: {init(t) { t.c = rnd(0, 50); }, tick(t) {
      if (t.c > 0) { t.c--; return; }
      t.c = rnd(0, 50) + 50;
      kid(0x3088e8, t.x, t.y).f[0xa0] = t.dist;
    }},
    // $2EFD92: duch $307E2C po zwloce, potem co okres + 1 taktow
    ghosts: {init(t) { t.d = t.delay; t.c = t.period; }, tick(t) {
      if (t.d > 0) { if (--t.d > 0) return; }
      else if (t.c > 0) { t.c--; return; }
      else t.c = t.period;
      kid(0x307e2c, t.x, t.y);
    }},
    // $2EDF6E (poziom 1): wpis {okres, y, strona, licznik}: $A5CC od lewej krawedzi ekranu (A4 x + 16) albo $A580 od prawej (+376)
    edge: {init() {}, tick(t) {
      const ax = Actors.a4[0];
      t.entries.forEach((e, i) => {
        if (t.c[i] > 0) { t.c[i]--; return; }
        t.c[i] = e[0];
        if (e[2] >= 0) kid(0xa5cc, ax + 16, e[1]); else kid(0xa580, ax + 376, e[1]);
      });
    }},
    // $2EBD72 (poziom 2): bajt stanu (kombinacja $2ED8E0 -> $30CAF0) wypuszcza beczke $B34C z predkoscia 2, jedna naraz ($30CC70);
    // beczka nie znika poza ekranem; rozbita ($7E = $2EBDD6) zwalnia blokade: na kaflu $3433 bajt $30CAF8, inaczej $B098 od
    // lewej krawedzi ekranu (y 232 albo 216) z dzwiekiem
    flagroll: {init() {}, tick(t) {
      if (!Actors.flags[t.state]) return;
      if (!rollBusy) {
        rollBusy = true;
        const a = make('r' + t.x, 0xb34c, t.x, t.y, 'roller', null, null, 0, 0, undefined, 2); a.always = true; list.push(a);
        a.onSmash = ix => {
          rollBusy = false;
          if (ix === 0x3433) { if (!Actors.flags['30caf8']) Actors.flags['30caf8'] = 1; return; }
          spawnScript(0xb098, Actors.a4[0], rnd(0, 2) ? 0xd8 : 0xe8); if (Actors.onSound) Actors.onSound('puff');
        };
      }
      Actors.flags[t.state] = 0;
    }},
    // $2EC5A0 (poziom 2): gracz y >= 500 i A4 x <= 800: co rnd(30) + 20 taktow $AC78 (chod $2EC646 z predkoscia 4) od krawedzi
    // ekranu - A4 x > 576 z lewej (A4 x + 16, w prawo), <= 160 z prawej (+368, w lewo), pomiedzy losowo
    sides: {init(t) { t.c = 0; }, tick(t) {
      const ax = Actors.a4[0];
      if (pl().y < 500 || ax > 800) return;
      if (t.c > 0) { t.c--; return; }
      t.c = rnd(0, 30) + 20;
      const left = ax > 576 || ax > 160 && rnd(0, 2) === 0;
      list.push(make('sac78', 0xac78, left ? ax + 16 : ax + 368, t.y, 'roamer2', null, left ? 4 : -4));
    }},
    // $2ED4F6 (poziom 2): plyta - gracz dokladnie na wysokosci rekordu, x +-8: kafle bloku $2F9598 +4 (dzwiek mech), zejscie +8
    // (unmech); kafel $FD0 = $8C - plyta znika na zawsze ($2E3802)
    plate: {init(t) { t.on = false; }, tick(t) {
      if (L.map[t.doneTile] === t.doneVal) { t.done = true; t.live = false; return; }
      const p = pl(), on = Math.round(p.y) === t.y && Math.abs(t.x - p.x) <= 8;
      if (on === t.on) return;
      t.on = on; t.idx.forEach((ix, i) => { L.map[ix] = (on ? t.a : t.b)[i]; });
      if (Actors.onSound) Actors.onSound(on ? 'mech' : 'unmech');
    }},
    // $2EBB38 (poziom 3): wysokosc gracza przy ostatniej rzutce (+$A0); gdy y gracza przekroczy wysokosc wpisu {x, y, kierunek},
    // rzutka $300E54 (kierunek >= 0) / $300E90 w (x, y - 14) z dzwiekiem i nowa wysokosc
    vdarts: {init(t) { t.last = Math.round(pl().y); }, tick(t) {
      const py = Math.round(pl().y);
      if (py === t.last) return;
      const down = py > t.last;
      for (const [x, y, dir] of t.entries) {
        if (down ? y < t.last || y > py : y > t.last || y < py) continue;
        t.last = py;
        kid(dir >= 0 ? 0x300e54 : 0x300e90, x, y - 14).f[0xa0] = dir;
        if (Actors.onSound) Actors.onSound('puff');
      }
    }},
  };
  // $2EBA74 (poziom 3): licznik +$A0 0..45 - bajt stanu ustawiony: w gore, przy 45 zero i suwak $300E12 z lewej (x $1FDB),
  // skasowany: w dol, przy 0 = 45 i suwak z prawej ($2094), y $13E (mozg $2EBAF4: 1 px na takt do drugiego konca)
  CTL.sliders = {init(t) { t.c = 0; }, tick(t) {
    const on = !!Actors.flags[t.state];
    if (on ? t.c !== 45 : t.c !== 0) { t.c += on ? 1 : -1; return; }
    t.c = on ? 0 : 45;
    kid(0x300e12, on ? 0x1fdb : 0x2094, 0x13e);
  }};
  let rollBusy = false;
  function ctlTick(ax, ay) {
    for (const t of triggers) {
      if (!CTL[t.kind] || t.live || t.done || sect && t.sect && t.sect !== sect) continue;
      if (t.x < ax - 50 || t.x > ax + 466 || t.y < ay - 50 || t.y > ay + 306) { t.hold = false; continue; }
      if (t.hold) continue;
      t.live = true; CTL[t.kind].init(t);
      if (CTL[t.kind].tick) CTL[t.kind].tick(t);
    }
  }
  // wyzwalacze co takt: generatory aktorow (licznik -> nowy aktor w x+dx, y+dy); podmiana kafli zwraca main.js
  let triggers = [];
  function triggerTick(px, py, setTiles) {
    for (const t of triggers) {
      if (CTL[t.kind]) continue;
      if (sect && t.sect && t.sect !== sect) continue;
      if (t.done || Math.abs(t.x - px) > 400 || Math.abs(t.y - py) > 300) continue;
      if (t.kind === 'tiles' && Math.abs(px - t.x) <= 16 && py >= t.y - 8 && py <= t.y + 32) { setTiles(t.idx, t.vals); t.done = true; }
      else if (t.kind === 'ambush' && Math.abs(px - t.x) <= 12 && py >= t.y - 8 && py <= t.y + 32) { spawnScript(t.script, t.sx, t.sy); t.done = true; }
      else if (t.kind === 'darts' && Math.abs(px - t.x) <= 12 && py >= t.y - 8 && py <= t.y + 32) {   // znaczniki czekaja, potem rzutki
        for (const [x, y, dir, delay] of t.entries) Object.assign(spawnScript(dir >= 0 ? 0x300ed0 : 0x300ef2, x, y, 'sdartw', 'dartwait'), {dir, wait: delay});
        t.done = true;
      }
      else if (t.kind === 'flag' && t.gone !== undefined && (Actors.flags[t.addr] | 0) === t.gone) t.done = true;
      else if (t.kind === 'flag' && Math.abs(px - t.x) <= 12 && py >= t.y - 8 && py <= t.y + 32) {
        if ((Actors.flags[t.addr] | 0) !== t.val + 2) Actors.flags[t.addr] = t.val;
      }
    }
  }
  // takt 25 Hz; tylko aktorzy w poblizu kamery (oryginal tworzy ich przy wejsciu w okno ekranu)
  // pojemnik ($2E62D2, dotyk gracza): odlatuje lukiem od gracza w obloku $2E12F4, z listy wychodza aktorzy (opis, dx, dy)
  function touchesPlayer(a) {                            // nakladanie ramek aktora i gracza (Actors.playerBox z main.js)
    const p = pl(), b = hitBox(a), q = Actors.playerBox ? Actors.playerBox() : [-5, -26, 8, 0];
    return !!b && q[1] !== q[3] && p.x + q[0] < b.l + b.w && p.x + q[2] > b.l && p.y + q[1] < b.t + b.h && p.y + q[3] > b.t;
  }
  function burst(a) {
    const x = a.x, y = a.y & ~1, items = a.burst;
    a.burst = null; a.f[0x78] = 0; a.dying = true;
    startPath(a, pl().x - a.x >= 0 ? 0x2eb33c : 0x2eb29e, 1, 1);
    spawnScript(0x2e12f4, x, y - 18);
    for (const [sc, dx, dy, hp, hurt] of items) {           // predkosc +$80 (mlodsze slowo +$7E), w strone gracza ($2E6370)
      const b = spawnNow(sc, x + dx, y + dy, 'b' + sc.toString(16)), v = w16(b.f[0x7e] || 0);
      if (hp !== undefined) Object.assign(b, {hp, hurt, rec: a.rec});   // $2E6338: pierwszy dostaje rekord pojemnika
      b.vx = pl().x - x < 0 ? -v : v;
    }
  }
  // gracz stanal na platformie: $2E6430 uruchamia program ruchu z +$7E (raz)
  function stood(a) {
    if (a.f[0x72] !== 0x2e6430 || !a.p7e || a.go || a.beh !== 'mover') return;
    a.go = true; Object.assign(a.brain, {start: a.p7e, pc: a.p7e, list: 0, rep: 0, wait: 0, loopN: 0});
  }
  function tick(cx0, cy0, only) {
    if (!only) for (const t of triggers) if (t.live && CTL[t.kind].tick) CTL[t.kind].tick(t);
    for (const a of list) {
      if (only && !only(a)) continue;
      const far = Math.abs(a.x - cx0) > 480 || Math.abs(a.y - cy0) > 320;
      if (a.dead || far && (!opts.lazy || a.rec === undefined && !a.always || a.type[0] === 's' || a.dying)) {   // z rekordu: takt zawsze
        if (a.type[0] === 's' || a.dying) a.dead = true;                  // pociski i umierajacy poza ekranem znikaja
        continue;
      }
      if (a.dying) { if (a.flash > 0) a.flash--; pathTick(a); animTick(a); if (a.y - cy0 > 400) a.dead = true; continue; }
      if (a.stun > 0) a.stun--;
      if (a.flash > 0) a.flash--;
      if (a.burst && touchesPlayer(a)) burst(a);
      if (TOUCH[a.f[0x72]] && a.f[0x76] & 1 && touchesPlayer(a)) TOUCH[a.f[0x72]](a);
      animTick(a); pathTick(a);                          // petla $1FBA: animacja ($2188), sciezka ($2240), potem mozg $7A ($2442)
      if (BEH[a.beh] && !a.collapsed && !a.dead) BEH[a.beh].tick(a);
    }
    touches();
    if (!opts.lazy) respawnTick(cx0, cy0);
    list = list.filter(a => !a.dead).concat(born.splice(0));
  }
  function draw(ctx, atlas, camX, camY, w, h, only) {
    // kolejnosc BOB-ow wg warstwy (rozkaz $FFF4): wyzsza na wierzchu (oblok/ogien $7F nad wrogami $70)
    for (const a of list.slice().sort((p, q) => (p.layer || 0) - (q.layer || 0))) {
      if (only && !only(a)) continue;
      const f = bob(a);
      if (!f) continue;
      const x = Math.round(a.x) - f[4] - camX, y = Math.round(a.y) - f[5] - camY;
      if (x > w || y > h || x + f[2] < 0 || y + f[3] < 0) continue;
      if (a.flash > 0) {                                    // $2EC / $96-$97: BOB jako jednolita plama koloru 22 (biel)
        const c = flashCv || (flashCv = document.createElement('canvas')), g = c.getContext('2d');
        c.width = f[2]; c.height = f[3]; g.drawImage(atlas, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
        g.globalCompositeOperation = 'source-in'; g.fillStyle = Actors.flashColor || '#fff'; g.fillRect(0, 0, f[2], f[3]);
        ctx.drawImage(c, x, y);
      } else if (a.clipY !== undefined) {                  // dolna granica ($5E, np. odlamki sciany po wybuchu $2E4DE6)
        const ch = Math.min(f[3], a.clipY - camY - y);
        if (ch > 0) ctx.drawImage(atlas, f[0], f[1], f[2], ch, x, y, f[2], ch);
      } else ctx.drawImage(atlas, f[0], f[1], f[2], f[3], x, y, f[2], f[3]);
    }
  }
  let flashCv = null;
  // trafienie bronia ($2E6BC6): obrazenia += sila; ponad wytrzymalosc -> smierc, inaczej krotkie oszolomienie
  // procedury trafienia (+$72) z wlasnym przebiegiem; reszta: obrazenia + luk smierci ($2E6BC6)
  function hit(a, strength) {
    if (a.stun || a.dying || !(a.f[0x78] & 0x8000)) return false;
    const H = a.f[0x72];
    if (H === 0x2e6db6) {                                   // kula (poziom 3): odbita od gracza z predkoscia 3, juz nie rani
      a.f[0x78] = 0; if (a.brain) a.brain.v = pl().x - a.x >= 0 ? -3 : 3; a.stun = 2; return true;
    }
    if (H === 0x2e6e02 && a.frame === 8) { a.stun = 2; a.flash = 2; sound(a, 'hit'); return true; }   // $2E6E02: w klatce 8 bez obrazen
    a.dmg += strength;                                      // $2E6B82: rekord +$17 += sila broni ($A0), smierc gdy >= +$16
    if (a.rec !== undefined) recDmg.set(a.rec, a.dmg);
    if (a.rec !== undefined && a.dmg < a.hp) { a.stun = 2; a.flash = 2; sound(a, 'hit'); return true; }   // $2E6ACC: 2 klatki bieli; bez rekordu od razu
    if (H === 0x2e6e2a) { a.kill = 'kill2'; a.flash = 3; }   // $2E6E9A: inny dzwiek smierci, 3 klatki bieli ($2E6E92)
    // $2E6BB2: oblok $2E12C8, lup ($2E70D2), dzwiek (38,7), aktor znika od razu; tak tez $2E6E02 poza klatka 8
    // i ghul $2E7180 (ten zeruje rekord: +$17 = 0, odradza sie)
    if (H === 0x2e6b66 || H === 0x2e6b12 || H === 0x2e6e02 || H === 0x2e7180) {
      if (H === 0x2e7180 && a.rec !== undefined) recDmg.set(a.rec, 0);
      spawnScript(0x2e12c8, a.x, a.y - 8); if (Actors.onLoot) Actors.onLoot(a.x, a.y);
      a.kill = 'smash'; a.dying = a.dead = true; return true;
    }
    if (H === 0x2e6f08 && Actors.onDrop) Actors.onDrop(a.x, a.y);   // $2E6F08: smierc ustawia bit 0 rekordu -> kawalek mapy ($2F317C)
    if (H === 0x2e6ece) { a.dead = true; spawnScript(0x2e139c, a.x, a.y); return true; }   // $2E709C: wybuch $2E139C
    if (H === 0x2e6c82) {                                   // $2E6C82: animacja smierci $300686, iskry $2E1656, potem znika
      a.f[0x78] = 0; a.path.blk = 0; a.dying = true; startPath(a, 0x300698, 1, 1); spawnScript(0x2e1656, a.x, a.y); sound(a, 'spark'); return true;   // $2E6D2A
    }
    if (H === 0x2e6d3a) {                                   // waz (poziom 3): rozpada sie jak dzban - sciezka $30096E (odlamki
      a.f[0x78] = 0; a.path.blk = 0; a.dying = true;        // $2E12C8, zdarzenie muzyczne 2, usuniecie), oblok $2E13D0, $2E70BA
      startPath(a, 0x30096e, 1, 1); spawnScript(0x2e13d0, a.x, a.y); sound(a, 'smash'); return true;
    }
    if (H === 0x2e7106 && a.anims['2e']) {                  // szkielet (poziom 2): rozsypuje sie, akcent muzyczny, sklada sie i wraca
      if (Actors.onMusic) Actors.onMusic(7);              // $2E7178
      a.f[0x78] = 0; a.f[0x76] = 0; a.path.blk = 0; a.collapsed = true; setAnim(a, a.frame <= 10 ? a.anims['32'] : a.anims['2e']); return true;
    }
    const blk = pl().x - a.x >= 0 ? a.anims['3e'] : a.anims['42'];
    if (blk) setAnim(a, blk);
    a.f[0x78] = 0; a.path.blk = 0;
    startPath(a, pl().x - a.x >= 0 ? 0x2eb81e : 0x2eb74a, 1, 1);   // sciezka smierci: luk od gracza, spadek, usuniecie ($2E72B8)
    a.dying = true;
    return true;
  }
  // platformy: aktorzy z klasa kolizji $2000 (+$76); gracz staje na gorze klatki + 3 px ($2E6070/$2E61CA),
  // jesli spada i ma stopy nie nizej niz 6 px pod gora; bloki przesuwaja go o swoje dx
  function platformUnder(x, y) {
    for (const a of list) {
      if (!(a.f[0x76] & 0x2000) || a.dead) continue;
      const f = bob(a);
      if (!f) continue;
      const l = a.x - f[4], top = a.y - f[5];
      if (x >= l - 4 && x <= l + f[2] + 4 && y >= top - 4 && y <= top + 6) return {a, top: top + 3};
    }
    return null;
  }
  // zamknieta krata (klatka inna niz 2 = otwarta): przy zderzeniu ramek ($2E5F6A) $9F06 = x kraty - x gracza, a ruch w bok
  // w jej strone stoi jak przy scianie ($2F4440 -> $2F4554); zwraca kierunek do kraty albo 0
  function gateDir(px, py, b) {
    for (const a of list) {
      if (a.beh !== 'gate' || a.frame === 2) continue;
      const h = hitBox(a);
      if (h && !(px + b[2] < h.l || px + b[0] > h.l + h.w || py + b[3] <= h.t || py + b[1] >= h.t + h.h)) return Math.sign(a.x - px);   // krawedz w krawedz to juz zderzenie (emulator 4x, R3)
    }
    return 0;
  }
  // ramka kolizji aktora (z wymiarow biezacej klatki) dla trafien gracza
  // ramka kolizji z naglowka BOB-a (+8: x1, y1, x2, y2 wzgledem punktu zaczepienia; obiekt +$62..+$68): moze byc inna niz
  // obrazek (spiacy nietoperz -61..63 x -2..116 - widzi gracza pod soba); y1 = y2 = bez kolizji ($2E663C)
  function hitBox(a) {
    const f = bob(a);
    if (!f) return null;
    if (f.length < 10) return {a, l: a.x - f[4], t: a.y - f[5], w: f[2], h: f[3]};
    return f[7] === f[9] ? null : {a, l: a.x + f[6], t: a.y + f[7], w: f[8] - f[6], h: f[9] - f[7]};
  }
  function boxes() { return list.map(hitBox).filter(Boolean); }
  // klatka BOB-a po adresie (ikony sklepu, pociski): [sx, sy, w, h, ax, ay] w atlasie aktorow
  const frame = addr => D.frames[addr];
  return {a4: [0, 0], kid, missing, load, spawn, spawnScript, deadRecs, killRecs, recTick, despawnTick, setSect, reset, startPath, stood, tick, draw, boxes, hit, platformUnder, triggerTick, frame, bob, physics, gateDir, flags: {}, player: null, get list() { return list; },
    get n0() { return D.actors.length; }};
};
const Actors = makeActors({lazy: true});
